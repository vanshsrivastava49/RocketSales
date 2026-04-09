"""
PriceIQ — Backend API (v4.3)
FastAPI + scikit-learn + JWT + Motor/MongoDB

FIXES vs v4.2:
  ✅ /my/products/export declared before /my/products (route ordering fix)
  ✅ MongoDB _id excluded from export cursor docs before DictWriter (ObjectId
     is not CSV-serialisable and caused silent crashes on some Motor versions)
  ✅ Content-Disposition filename wrapped in double-quotes so browsers don't
     truncate filenames at underscores or special characters
  ✅ result dict passed to AI prompt AFTER pop() — model_breakdown already
     removed, all other keys (recommended_price etc.) still present
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uvicorn
import anthropic
import httpx
import pandas as pd
import numpy as np
import io
import os
import csv
import logging
import uuid
import asyncio
from datetime import datetime, timedelta

from model import PricingEngine
from db import db, create_indexes
from auth import router as auth_router, get_current_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PriceIQ API",
    description="AI-powered price recommendation engine for e-commerce sellers",
    version="4.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

engine = PricingEngine()
anthropic_client = None

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

REQUIRED_COLUMNS = {"category"}
PRICE_COLUMNS    = {"current_price", "discounted_price"}
OPTIONAL_COLUMNS = {
    "product_name", "brand", "market_price", "actual_price",
    "competitor_price", "rating", "rating_count",
    "demand_score", "description", "about_product",
}


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global anthropic_client
    try:
        anthropic_client = anthropic.Anthropic()
        logger.info("✅ Anthropic client initialised")
    except Exception as e:
        logger.warning(f"⚠️ Anthropic client not available: {e}")

    await create_indexes()
    logger.info("PriceIQ API v4.3 ready")


# ── Schemas ───────────────────────────────────────────────────────────────────

class PriceResult(BaseModel):
    recommended_price: float
    price_low:         float
    price_high:        float
    confidence:        float
    factors:           list[dict]
    insights:          dict
    ai_analysis:       Optional[str] = None
    breakdown:         dict
    model_config = ConfigDict(protected_namespaces=())


class PredictRequest(BaseModel):
    product_name:        Optional[str]   = ""
    category:            str
    brand:               Optional[str]   = ""
    current_price:       Optional[float] = Field(None, gt=0)
    market_price:        Optional[float] = Field(None, gt=0)
    competitor_price:    Optional[float] = Field(None, gt=0)
    rating:              Optional[float] = Field(None, ge=1, le=5)
    rating_count:        Optional[int]   = Field(None, ge=0)
    demand_score:        Optional[float] = Field(None, ge=0)
    description:         Optional[str]   = ""
    include_ai_analysis: bool = True
    save_to_history:     bool = True


# ── Public routes ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "PriceIQ API v4.3"}


@app.get("/health")
def health():
    return {
        "status":              "healthy",
        "model_trained":       engine.is_trained,
        "training_samples":    engine.n_samples,
        "model_mape":          round(engine._mape, 2) if engine._mape else None,
        "anthropic_available": anthropic_client is not None,
    }


@app.get("/stats")
def dataset_stats():
    base = engine.get_stats()

    category_stats = {}
    if engine.is_trained and hasattr(engine, "_category_stats"):
        category_stats = engine._category_stats

    return {
        **base,
        "category_stats": category_stats,
        "model": {
            **base.get("model", {}),
            "algorithm": "GradientBoostingRegressor",
            "features": [
                "actual_price", "discount_percentage", "rating",
                "rating_count", "demand_score", "competitor_price",
                "description_length", "price_gap", "demand_intensity",
                "value_score", "discount_value", "platform_encoded",
            ],
            "mape_pct":  round(engine._mape, 2) if engine._mape else None,
            "n_samples": engine.n_samples,
        },
    }


# ── Prediction ────────────────────────────────────────────────────────────────

@app.post("/predict", response_model=PriceResult)
async def predict_single(
    req: PredictRequest,
    current_user: dict = Depends(get_current_user),
):
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Prediction request: {req.product_name or 'N/A'}")

    try:
        result = engine.predict(req.model_dump())
    except Exception as e:
        logger.error(f"[{request_id}] Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    # Pop breakdown BEFORE passing result anywhere else — the AI prompt
    # receives a clean dict with only price/factor keys it actually uses.
    breakdown = result.pop("model_breakdown")

    ai_text = None
    if req.include_ai_analysis and anthropic_client:
        try:
            ai_text = await asyncio.to_thread(
                _get_ai_analysis_sync, req.model_dump(), result
            )
            logger.info(f"[{request_id}] AI analysis generated")
        except Exception as e:
            logger.warning(f"[{request_id}] AI analysis failed: {e}")
            ai_text = "AI analysis temporarily unavailable."

    if req.save_to_history:
        try:
            await db.products.insert_one({
                "user_id":           str(current_user["_id"]),
                "product_name":      req.product_name,
                "category":          req.category,
                "brand":             req.brand,
                "current_price":     req.current_price,
                "recommended_price": result["recommended_price"],
                "price_low":         result["price_low"],
                "price_high":        result["price_high"],
                "confidence":        result["confidence"],
                "change_pct":        result["insights"].get("change_from_current"),
                "factors":           result["factors"],
                "ai_analysis":       ai_text,
                "created_at":        datetime.utcnow(),
            })
            await db.users.update_one(
                {"_id": current_user["_id"]},
                {"$inc": {"products_analyzed": 1},
                 "$set": {"updated_at": datetime.utcnow()}},
            )
            logger.info(f"[{request_id}] Saved to history")
        except Exception as e:
            logger.warning(f"[{request_id}] Could not save product history: {e}")

    return PriceResult(
        ai_analysis=ai_text,
        breakdown=breakdown,
        **result,
    )


@app.post("/predict/bulk")
async def predict_bulk(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Bulk upload started: {file.filename}")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    contents = await file.read()

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing_required = REQUIRED_COLUMNS - set(df.columns)
    if missing_required:
        raise HTTPException(
            status_code=422,
            detail={
                "message":          "CSV is missing required columns",
                "missing_columns":  sorted(missing_required),
                "required_columns": sorted(REQUIRED_COLUMNS),
            },
        )

    has_price_col = bool(PRICE_COLUMNS & set(df.columns))
    if not has_price_col:
        raise HTTPException(
            status_code=422,
            detail={
                "message":                  "CSV must contain at least one price column",
                "acceptable_price_columns": sorted(PRICE_COLUMNS),
                "columns_found":            sorted(df.columns.tolist()),
            },
        )

    col_map = {
        "discounted_price": "current_price",
        "actual_price":     "market_price",
        "about_product":    "description",
    }
    df.rename(columns=col_map, inplace=True)

    results    = []
    row_errors = []

    for idx, row in df.iterrows():
        row_num = int(idx) + 2
        record = {
            "product_name":     str(row.get("product_name", "")),
            "category":         str(row.get("category", "")).split("|")[0],
            "brand":            str(row.get("brand", "")),
            "current_price":    _safe_float(row.get("current_price")),
            "market_price":     _safe_float(row.get("market_price")),
            "competitor_price": _safe_float(row.get("competitor_price")),
            "rating":           _safe_float(row.get("rating")),
            "rating_count":     _safe_int(row.get("rating_count")),
            "demand_score":     _safe_float(row.get("demand_score")),
            "description":      str(row.get("description", "")),
        }

        if not record["category"] or record["category"].lower() in ("", "nan", "none"):
            row_errors.append({
                "row":          row_num,
                "product_name": record["product_name"] or f"Row {row_num}",
                "error":        "Missing required field: category",
            })
            continue

        try:
            pred = engine.predict(record)
            results.append({
                "product_name":      record["product_name"],
                "category":          record["category"],
                "current_price":     record["current_price"],
                "recommended_price": pred["recommended_price"],
                "price_low":         pred["price_low"],
                "price_high":        pred["price_high"],
                "confidence":        pred["confidence"],
                "change_pct":        pred["insights"].get("change_from_current"),
            })
        except Exception as e:
            row_errors.append({
                "row":          row_num,
                "product_name": record["product_name"] or f"Row {row_num}",
                "error":        str(e),
            })

    summary = _bulk_summary(results)
    logger.info(f"[{request_id}] Bulk complete: {len(results)} success, {len(row_errors)} errors")

    if results:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"products_analyzed": len(results)}},
        )

    return {
        "request_id":    request_id,
        "total_rows":    len(df),
        "total_success": len(results),
        "total_errors":  len(row_errors),
        "summary":       summary,
        "results":       results,
        "row_errors":    row_errors,
    }


# ── User history & stats ──────────────────────────────────────────────────────
# ✅ /my/products/export MUST stay above /my/products — FastAPI matches routes
# top-to-bottom; /my/products would shadow the export route and return 404.

@app.get("/my/products/export")
async def export_my_products(current_user: dict = Depends(get_current_user)):
    uid = str(current_user["_id"])

    cursor   = db.products.find({"user_id": uid}, sort=[("created_at", -1)])
    products = []
    async for doc in cursor:
        # ✅ FIXED: pop _id before passing to DictWriter — raw ObjectId is not
        # CSV-serialisable and silently crashes the writer on some Motor versions.
        doc.pop("_id", None)
        products.append(doc)

    if not products:
        raise HTTPException(status_code=404, detail="No product history to export")

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "product_name", "category", "brand",
            "current_price", "recommended_price",
            "price_low", "price_high",
            "confidence", "change_pct", "created_at",
        ],
        extrasaction="ignore",
    )
    writer.writeheader()
    for p in products:
        writer.writerow({
            "product_name":      p.get("product_name", ""),
            "category":          p.get("category", ""),
            "brand":             p.get("brand", ""),
            "current_price":     p.get("current_price", ""),
            "recommended_price": p.get("recommended_price", ""),
            "price_low":         p.get("price_low", ""),
            "price_high":        p.get("price_high", ""),
            "confidence":        p.get("confidence", ""),
            "change_pct":        p.get("change_pct", ""),
            "created_at": (
                p["created_at"].strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(p.get("created_at"), datetime)
                else str(p.get("created_at", ""))
            ),
        })

    output.seek(0)
    filename = f"priceiq_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        # ✅ FIXED: filename in double-quotes — unquoted filenames are truncated
        # at underscores/spaces by Chrome, Firefox, and Safari.
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/my/products")
async def get_my_products(
    limit: int = Query(default=20, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    cursor = db.products.find(
        {"user_id": str(current_user["_id"])},
        sort=[("created_at", -1)],
        limit=limit,
    )
    products = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        products.append(doc)
    return {"products": products, "total": len(products)}


@app.get("/my/stats")
async def get_my_stats(current_user: dict = Depends(get_current_user)):
    uid   = str(current_user["_id"])
    total = await db.products.count_documents({"user_id": uid})

    pipeline = [
        {"$match": {"user_id": uid, "change_pct": {"$ne": None}}},
        {"$group": {
            "_id":         None,
            "avg_change":  {"$avg": "$change_pct"},
            "underpriced": {"$sum": {"$cond": [{"$gt": ["$change_pct", 5]},  1, 0]}},
            "overpriced":  {"$sum": {"$cond": [{"$lt": ["$change_pct", -5]}, 1, 0]}},
        }},
    ]
    agg = await db.products.aggregate(pipeline).to_list(1)
    agg = agg[0] if agg else {}

    return {
        "total_analyzed":      total,
        "avg_change_pct":      round(agg.get("avg_change", 0), 2),
        "underpriced_count":   agg.get("underpriced", 0),
        "overpriced_count":    agg.get("overpriced", 0),
        "optimal_count":       total - agg.get("underpriced", 0) - agg.get("overpriced", 0),
        "api_calls_remaining": current_user.get("api_calls_remaining", 100),
        "empty_state":         total == 0,
    }


@app.get("/my/trends")
async def get_my_trends(
    days: int = Query(default=30, ge=7, le=365),
    current_user: dict = Depends(get_current_user),
):
    uid   = str(current_user["_id"])
    since = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"user_id": uid, "created_at": {"$gte": since}}},
        {"$group": {
            "_id": {
                "year":  {"$year":  "$created_at"},
                "month": {"$month": "$created_at"},
                "day":   {"$dayOfMonth": "$created_at"},
            },
            "count":         {"$sum": 1},
            "avg_rec_price": {"$avg": "$recommended_price"},
            "avg_change":    {"$avg": "$change_pct"},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}},
    ]

    raw = await db.products.aggregate(pipeline).to_list(days)

    trend_data = [
        {
            "date":           f"{r['_id']['year']}-{r['_id']['month']:02d}-{r['_id']['day']:02d}",
            "count":          r["count"],
            "avg_rec_price":  round(r["avg_rec_price"], 2) if r["avg_rec_price"] else None,
            "avg_change_pct": round(r["avg_change"],    2) if r["avg_change"]    else None,
        }
        for r in raw
    ]

    return {
        "days":        days,
        "empty_state": len(trend_data) == 0,
        "trend":       trend_data,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(val):
    try:
        v = float(val)
        return v if np.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def _safe_int(val):
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _bulk_summary(results: list) -> dict:
    changes = [r["change_pct"] for r in results if r.get("change_pct") is not None]
    under   = sum(1 for c in changes if c > 5)
    over    = sum(1 for c in changes if c < -5)
    avg_chg = float(np.mean(changes)) if changes else 0.0
    return {
        "avg_change_pct":    round(avg_chg, 2),
        "underpriced_count": under,
        "overpriced_count":  over,
        "optimal_count":     len(results) - under - over,
    }


def _get_ai_analysis_sync(req: dict, result: dict) -> str:
    """
    Synchronous — called via asyncio.to_thread() so it doesn't block the
    event loop. The Anthropic SDK is blocking (wraps httpx internally).
    """
    if not anthropic_client:
        return None

    prompt = f"""You are a senior e-commerce pricing strategist. Write a concise, data-driven pricing rationale in 3-4 sentences.

Product: {req.get('product_name') or 'N/A'}
Category: {req.get('category')}
Current Price: Rs.{req.get('current_price') or 'N/A'}
Market/MRP: Rs.{req.get('market_price') or 'N/A'}
Competitor Price: Rs.{req.get('competitor_price') or 'N/A'}
Rating: {req.get('rating') or 'N/A'} ({req.get('rating_count') or 'N/A'} ratings)

Recommended Price: Rs.{result['recommended_price']} (range Rs.{result['price_low']}–Rs.{result['price_high']})
Confidence: {result['confidence']}%
Key Factors: {', '.join(f['label'] for f in result['factors'][:4])}

Provide strategic rationale: why this price is optimal, what signals drove it, and one actionable tip. No bullet points."""

    message = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
        timeout=httpx.Timeout(30.0),
    )
    return message.content[0].text


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)