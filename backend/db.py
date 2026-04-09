"""
PriceIQ — MongoDB Connection (FINAL FIXED)
Async Motor client
"""

import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# 🔥 FIX: remove trailing slash
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB", "rocketsales")

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        try:
            _client = AsyncIOMotorClient(MONGO_URI)
            logger.info(f"✅ MongoDB connected → {MONGO_URI}/{DB_NAME}")
        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            raise
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
    """Call this on app startup to ensure required indexes exist."""
    try:
        database = get_client()[DB_NAME]

        # Users
        await database.users.create_index("email", unique=True)

        # Products
        await database.products.create_index("user_id")
        await database.products.create_index(
            [("user_id", 1), ("updated_at", -1)]
        )

        logger.info("✅ MongoDB indexes ensured")

    except Exception as e:
        logger.error(f"❌ Index creation failed: {e}")
        raise
