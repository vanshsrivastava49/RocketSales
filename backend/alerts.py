from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import asyncio
import os
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from db import db
from auth import get_current_user, _send_email

# ✅ FIX: Load the .env file explicitly
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["alerts"])

ALERT_THRESHOLD_PCT = float(os.getenv("ALERT_THRESHOLD_PCT", "5.0"))
DIGEST_CRON_HOUR    = int(os.getenv("DIGEST_CRON_HOUR", "9"))
APP_BASE_URL        = os.getenv("APP_BASE_URL", "http://localhost:5173")
ALERT_COOLDOWN_HRS  = 24
PREDICTION_EMAIL_THRESHOLD_PCT = float(os.getenv("PREDICTION_EMAIL_THRESHOLD_PCT", "10.0"))
PREDICTION_EMAIL_COOLDOWN_HRS  = 6


# ─────────────────────────────────────────────
# 📧 EMAIL TEMPLATES
# ─────────────────────────────────────────────

def _fmt_change(change_pct) -> str:
    """
    ✅ FIX: Safe formatter for change_pct which can be None when current_price
    is not provided. Previously used f'{p["change_pct"]:+.1f}%' directly which
    raises TypeError: unsupported format character for NoneType.
    """
    if change_pct is None:
        return "N/A"
    return f"{change_pct:+.1f}%"


def _smart_prediction_email(user, product_name, current, recommended, change_pct):
    subject = f"📊 Pricing Insight: {product_name}"
    body = (
        f"Hi {user.get('first_name', 'there')},\n\n"
        f"Here's a pricing update for your product:\n\n"
        f"  {product_name}\n"
        f"  ₹{current} → ₹{recommended} ({_fmt_change(change_pct)})\n\n"
        f"View your dashboard: {APP_BASE_URL}/dashboard\n\n"
        f"— RocketSales AI"
    )
    return subject, body


def _bulk_summary_email(user, items: List[dict]):
    subject = f"📊 Bulk Pricing Summary ({len(items)} products)"
    lines = ""
    for p in items[:5]:
        # ✅ FIX: use _fmt_change() — change_pct can be None when current_price absent
        lines += (
            f"  • {str(p.get('product_name', 'Unknown'))[:30]} "
            f"₹{p.get('current_price', '?')} → ₹{p.get('recommended_price', '?')} "
            f"({_fmt_change(p.get('change_pct'))})\n"
        )
    body = (
        f"Hi {user.get('first_name', 'there')},\n\n"
        f"Your bulk analysis of {len(items)} products is complete.\n\n"
        f"Top changes:\n{lines}\n"
        f"View full results: {APP_BASE_URL}/dashboard\n\n"
        f"— RocketSales AI"
    )
    return subject, body


def _drop_email(user, product_name, current, recommended, change_pct):
    return (
        f"⚠️ Price reduction recommended: {product_name}",
        (
            f"Hi {user.get('first_name', 'there')},\n\n"
            f"Our AI recommends reducing the price for: {product_name}\n\n"
            f"  Current:     ₹{current}\n"
            f"  Recommended: ₹{recommended} ({_fmt_change(change_pct)})\n\n"
            f"View your dashboard: {APP_BASE_URL}/dashboard\n\n— RocketSales AI"
        ),
    )


def _rise_email(user, product_name, current, recommended, change_pct):
    return (
        f"💰 Price increase opportunity: {product_name}",
        (
            f"Hi {user.get('first_name', 'there')},\n\n"
            f"Our AI has found a price increase opportunity for: {product_name}\n\n"
            f"  Current:     ₹{current}\n"
            f"  Recommended: ₹{recommended} ({_fmt_change(change_pct)})\n\n"
            f"View your dashboard: {APP_BASE_URL}/dashboard\n\n— RocketSales AI"
        ),
    )


# ─────────────────────────────────────────────
# 🔔 CORE ALERT LOGIC
# ─────────────────────────────────────────────

async def maybe_send_price_alert(user, product_name, current_price, recommended_price):
    """
    Called after every single /predict. Sends two kinds of emails:
      1. "prediction" email  — any significant change (>PREDICTION_EMAIL_THRESHOLD_PCT)
      2. "drop" / "rise"     — when change exceeds the user's ALERT_THRESHOLD_PCT

    Both respect their own cooldown windows so the same product doesn't spam.
    """
    if not current_price or not recommended_price:
        return

    change_pct = (recommended_price - current_price) / current_price * 100

    # ── Prediction email (informational) ──────────────────────────────────────
    # ✅ FIX: threshold raised from 2% → PREDICTION_EMAIL_THRESHOLD_PCT (default 10%)
    # so casual analyses don't flood the inbox.
    if abs(change_pct) >= PREDICTION_EMAIL_THRESHOLD_PCT:
        pred_since = datetime.now(timezone.utc) - timedelta(hours=PREDICTION_EMAIL_COOLDOWN_HRS)
        try:
            recent_pred = await db.price_alerts.find_one({
                "user_id":      str(user["_id"]),
                "product_name": product_name,
                "alert_type":   "prediction",
                "sent_at":      {"$gte": pred_since},
            })
            if not recent_pred:
                subject, body = _smart_prediction_email(
                    user, product_name, current_price, recommended_price, change_pct
                )
                await asyncio.to_thread(_send_email, user["email"], subject, body)
                await db.price_alerts.insert_one({
                    "user_id":           str(user["_id"]),
                    "product_name":      product_name,
                    "alert_type":        "prediction",
                    "current_price":     current_price,
                    "recommended_price": recommended_price,
                    "change_pct":        round(change_pct, 2),
                    "sent_at":           datetime.now(timezone.utc),
                })
        except Exception as e:
            logger.warning(f"Prediction email failed for {product_name!r}: {e}")

    # ── Drop / rise alert (actionable) ───────────────────────────────────────
    threshold = user.get("alert_threshold_pct", ALERT_THRESHOLD_PCT)
    if change_pct <= -threshold:
        alert_type = "drop"
    elif change_pct >= threshold:
        alert_type = "rise"
    else:
        return

    since  = datetime.now(timezone.utc) - timedelta(hours=ALERT_COOLDOWN_HRS)
    try:
        recent = await db.price_alerts.find_one({
            "user_id":      str(user["_id"]),
            "product_name": product_name,
            "alert_type":   alert_type,
            "sent_at":      {"$gte": since},
        })
        if recent:
            return

        if alert_type == "drop":
            subject, body = _drop_email(user, product_name, current_price, recommended_price, change_pct)
        else:
            subject, body = _rise_email(user, product_name, current_price, recommended_price, change_pct)

        await asyncio.to_thread(_send_email, user["email"], subject, body)

        await db.price_alerts.insert_one({
            "user_id":           str(user["_id"]),
            "product_name":      product_name,
            "alert_type":        alert_type,
            "current_price":     current_price,
            "recommended_price": recommended_price,
            "change_pct":        round(change_pct, 2),
            "sent_at":           datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f"Alert email ({alert_type}) failed for {product_name!r}: {e}")


# ─────────────────────────────────────────────
# 📊 BULK SUMMARY EMAIL
# ─────────────────────────────────────────────

async def send_bulk_summary(user, results: List[dict]):
    """Send a summary email after a bulk upload. Only fires for ≥3 results."""
    if len(results) < 3:
        return
    # Only send if the user has notifications enabled
    if not user.get("notifications", True):
        return
    try:
        subject, body = _bulk_summary_email(user, results)
        await asyncio.to_thread(_send_email, user["email"], subject, body)
        logger.info(f"Bulk summary email sent to {user['email']!r} ({len(results)} products)")
    except Exception as e:
        logger.warning(f"Bulk summary email failed: {e}")


# ─────────────────────────────────────────────
# 📅 WEEKLY DIGEST
# ─────────────────────────────────────────────

async def _send_weekly_digest():
    sent   = 0
    failed = 0
    async for user in db.users.find({"notifications": {"$ne": False}}):
        try:
            await asyncio.to_thread(
                _send_email,
                user["email"],
                "📊 Your weekly pricing digest — RocketSales AI",
                (
                    f"Hi {user.get('first_name', 'there')},\n\n"
                    f"Check your dashboard for this week's pricing insights and recommendations.\n\n"
                    f"{APP_BASE_URL}/dashboard\n\n"
                    f"— RocketSales AI"
                ),
            )
            sent += 1
        except Exception as e:
            logger.warning(f"Weekly digest failed for {user.get('email', '?')!r}: {e}")
            failed += 1
    logger.info(f"Weekly digest complete: {sent} sent, {failed} failed")


_scheduler: Optional[AsyncIOScheduler] = None


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        logger.warning("Scheduler already running — skipping duplicate start")
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _send_weekly_digest,
        CronTrigger(day_of_week="mon", hour=DIGEST_CRON_HOUR),
        id="weekly_digest",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("✅ Alert scheduler started")


# ─────────────────────────────────────────────
# 📡 ROUTES
# ─────────────────────────────────────────────

@router.get("/history")
async def get_alert_history(
    limit: int = Query(default=20, ge=1, le=100),
    skip:  int = Query(default=0,  ge=0),
    current_user: dict = Depends(get_current_user),
):
    cursor = (
        db.price_alerts
        .find({"user_id": str(current_user["_id"])})
        .sort("sent_at", -1)
        .skip(skip)
        .limit(limit)
    )
    alerts = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        alerts.append(doc)

    total = await db.price_alerts.count_documents({"user_id": str(current_user["_id"])})
    return {"alerts": alerts, "total": total, "limit": limit, "skip": skip}