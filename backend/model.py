import numpy as np
import pandas as pd
import os
import logging
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error
from typing import Optional

logger = logging.getLogger(__name__)

FEATURES_BASE = [
    "actual_price", "discount_percentage", "rating", "rating_count",
    "demand_score", "competitor_price", "description_length",
]

EXTRA_FEATURES = [
    "price_gap", "demand_intensity", "value_score",
    "discount_value", "platform_encoded",
]


class PricingEngine:

    def __init__(self, data_path: Optional[str] = None):
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.n_samples = 0
        self._mape = None
        self.categories = []
        # ✅ NEW: per-category stats consumed by /stats → Dashboard charts
        self._category_stats: dict = {}

        path = data_path or os.getenv("DATASET_PATH", "final_merged_dataset.csv")

        if os.path.exists(path):
            self._train(path)
        else:
            logger.warning("Dataset not found. Running in fallback mode.")

    # ================= TRAIN ================= #

    def _train(self, path: str):
        logger.info(f"Loading dataset from {path}")
        df = pd.read_csv(path)

        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        if "final_price" in df.columns:
            df["discounted_price"] = df["final_price"]

        df = df.dropna(subset=[
            "discounted_price", "actual_price", "rating",
            "rating_count", "category", "discount_percentage",
            "competitor_price",
        ])

        df.fillna(df.median(numeric_only=True), inplace=True)

        df["category"] = df["category"].astype(str).apply(lambda x: x.split("|")[0])
        self.categories = sorted(df["category"].unique().tolist())

        # 🔥 FEATURE ENGINEERING
        df["demand_score"]       = df["rating"] * np.log1p(df["rating_count"])
        df["description_length"] = df.get("description_length", 50)
        df["price_gap"]          = df["actual_price"] - df["competitor_price"]
        df["demand_intensity"]   = df["demand_score"]
        df["value_score"]        = df["rating"] / (df["actual_price"] + 1)
        df["discount_value"]     = df["discount_percentage"] * df["actual_price"]

        if "platform" in df.columns:
            df["platform_encoded"] = df["platform"].astype("category").cat.codes
        else:
            df["platform_encoded"] = 0

        # ✅ NEW: build category stats for Dashboard charts
        # margin proxy = (actual - discounted) / actual * 100
        df["_margin"] = (
            (df["actual_price"] - df["discounted_price"]) / (df["actual_price"] + 1e-9) * 100
        )
        self._category_stats = {}
        for cat, grp in df.groupby("category"):
            self._category_stats[cat] = {
                "avg_price":    round(float(grp["actual_price"].mean()), 2),
                "median_price": round(float(grp["actual_price"].median()), 2),
                "avg_discount": round(float(grp["discount_percentage"].mean()), 2),
                "avg_rating":   round(float(grp["rating"].mean()), 3),
                "avg_demand":   round(float(grp["demand_score"].mean()), 2),
                "avg_margin":   round(float(grp["_margin"].mean()), 2),
                "count":        int(len(grp)),
            }
        logger.info(f"   Category stats built for {len(self._category_stats)} categories")

        FEATURES = FEATURES_BASE + EXTRA_FEATURES

        X = df[FEATURES]
        y = df["discounted_price"]

        q_low, q_high = y.quantile(0.01), y.quantile(0.99)
        mask = (y >= q_low) & (y <= q_high)
        X, y = X[mask], y[mask]

        y = y * np.random.uniform(0.98, 1.02, len(y))

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.15, random_state=42
        )

        X_train_s = self.scaler.fit_transform(X_train)
        X_test_s  = self.scaler.transform(X_test)

        self.model = GradientBoostingRegressor(
            n_estimators=500,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.85,
            min_samples_split=5,
            random_state=42,
        )

        self.model.fit(X_train_s, y_train)

        preds      = self.model.predict(X_test_s)
        self._mape = mean_absolute_percentage_error(y_test, preds) * 100

        self.n_samples = len(X)
        self.is_trained = True

        logger.info(f"✅ Model trained — {self.n_samples} samples, MAPE={self._mape:.2f}%")
        logger.info(f"   Categories found: {len(self.categories)} ({', '.join(self.categories[:5])}...)")

    # ================= PREDICT ================= #

    def predict(self, data: dict) -> dict:

        actual_price      = data.get("market_price") or data.get("current_price") or 1000
        competitor_price  = data.get("competitor_price") or actual_price
        rating            = data.get("rating") or 4.0
        rating_count      = data.get("rating_count") or 1000
        discount_percentage = (
            (actual_price - (data.get("current_price") or actual_price * 0.7))
            / actual_price * 100
        )

        description        = data.get("description", "")
        description_length = len(description)

        demand_score      = rating * np.log1p(rating_count)
        price_gap         = actual_price - competitor_price
        demand_intensity  = demand_score
        value_score       = rating / (actual_price + 1)
        discount_value    = discount_percentage * actual_price
        platform_encoded  = 0

        row = np.array([[
            actual_price, discount_percentage, rating, rating_count,
            demand_score, competitor_price, description_length,
            price_gap, demand_intensity, value_score, discount_value, platform_encoded,
        ]])

        if self.is_trained:
            row_s    = self.scaler.transform(row)
            ml_price = float(self.model.predict(row_s)[0])
        else:
            ml_price = actual_price * 0.7

        multiplier = 1.0
        factors    = []

        if rating > 4.3:
            multiplier *= 1.05
            factors.append({"label": "High rating boost", "type": "up"})

        if rating_count > 5000:
            multiplier *= 1.03
            factors.append({"label": "High demand", "type": "up"})

        if competitor_price < ml_price:
            multiplier *= 0.97
            factors.append({"label": "Competitive pressure", "type": "down"})

        recommended = round((ml_price * multiplier) / 10) * 10
        price_low   = round(recommended * 0.9 / 10) * 10
        price_high  = round(recommended * 1.1 / 10) * 10

        confidence  = min(90 + (5 if self.is_trained else 0), 97)

        change_pct = None
        if data.get("current_price"):
            change_pct = round(
                (recommended - data["current_price"]) / data["current_price"] * 100, 2
            )

        return {
            "recommended_price": recommended,
            "price_low":         price_low,
            "price_high":        price_high,
            "confidence":        confidence,
            "factors":           factors,
            "insights": {
                "change_from_current": change_pct,
                "ml_price":            round(ml_price, 2),
            },
            # Key must stay "model_breakdown" here — main.py pops it and
            # renames it to "breakdown" before returning PriceResult to the client.
            "model_breakdown": {
                "mape":       round(self._mape, 2) if self._mape else None,
                "n_training": self.n_samples,
            },
        }

    def get_stats(self):
        return {
            "model": {
                "trained":    self.is_trained,
                "samples":    self.n_samples,
                "mape":       self._mape,
                "categories": len(self.categories),
            }
        }