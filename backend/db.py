"""
RocketSales — MongoDB Connection
Async Motor client with proper singleton init and full index coverage.
"""

import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB", "rocketsales")

# ✅ FIX: module-level singleton — no lazy init race condition under concurrent startup requests
_client: AsyncIOMotorClient | None = None


def _init_client() -> AsyncIOMotorClient:
    """Called once at app startup — not lazily on first request."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
        logger.info(f"✅ MongoDB connected → {MONGO_URI}/{DB_NAME}")
    return _client


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("MongoDB client not initialised — call _init_client() in startup lifespan")
    return _client


# ── DB Wrapper ───────────────────────────────────────────

class _DB:
    def __getattr__(self, name):
        return get_client()[DB_NAME][name]

    def __getitem__(self, name):
        return get_client()[DB_NAME][name]


db = _DB()


# ── Index Setup ──────────────────────────────────────────

async def create_indexes():
    """Call once during app startup lifespan."""
    _init_client()   # ensure client exists before any index operations
    try:
        database = get_client()[DB_NAME]

        # Users
        await database.users.create_index("email", unique=True)

        # Products
        await database.products.create_index("user_id")
        await database.products.create_index([("user_id", 1), ("created_at", -1)])

        # ✅ FIX: price_alerts compound index for cooldown queries — was missing,
        # causing full collection scans on every single prediction.
        await database.price_alerts.create_index(
            [("user_id", 1), ("product_name", 1), ("alert_type", 1), ("sent_at", -1)],
            name="alerts_cooldown_idx",
        )
        # Fast history fetch by user
        await database.price_alerts.create_index(
            [("user_id", 1), ("sent_at", -1)],
            name="alerts_history_idx",
        )

        logger.info("✅ MongoDB indexes ensured")

    except Exception as e:
        logger.error(f"❌ Index creation failed: {e}")
        raise