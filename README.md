# PriceIQ — AI-Powered Price Recommendation Engine

A full-stack e-commerce pricing tool that combines a **GradientBoosting ML model** trained on 5,000 Amazon products with **Claude AI** narrative analysis to recommend optimal selling prices.

---

## Architecture

```
priceiq/
├── backend/                  # FastAPI + scikit-learn
│   ├── main.py               # API routes, CORS, Claude integration
│   ├── model.py              # ML training + rule-based signal engine
│   ├── requirements.txt
│   └── .env.example
└── frontend/                 # React + Vite
    ├── src/
    │   ├── App.jsx
    │   ├── api.js            # Axios service layer
    │   └── components/
    │       ├── Header.jsx
    │       ├── SinglePredictor.jsx   # Single product form
    │       ├── PriceResult.jsx       # Result display
    │       ├── BulkPredictor.jsx     # CSV upload + table + charts
    │       └── Dashboard.jsx         # Market stats + model info
    ├── package.json
    └── vite.config.js
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your API key
cp .env.example .env

# Place your CSV dataset in the backend folder
cp /path/to/amazon_rocketsales_5000.csv .

# Run the API server
DATASET_PATH=amazon_rocketsales_5000.csv \
ANTHROPIC_API_KEY=sk-ant-... \
uvicorn main:app --reload --port 8000
```

The API will auto-train the GradientBoosting model on startup.  
Visit `http://localhost:8000/docs` for the interactive Swagger UI.

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# → Opens at http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint          | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/health`         | Model status + training info       |
| GET    | `/stats`          | Category stats + model metadata    |
| GET    | `/categories`     | List of supported categories       |
| POST   | `/predict`        | Single product price prediction    |
| POST   | `/predict/bulk`   | Bulk CSV price prediction          |

### POST `/predict` — Request Body

```json
{
  "product_name": "Ambrane 60W Type-C Cable",
  "category": "Computers&Accessories",
  "brand": "Ambrane",
  "current_price": 199,
  "market_price": 349,
  "competitor_price": 185,
  "rating": 4.0,
  "rating_count": 43994,
  "demand_score": 175976,
  "description": "Unbreakable braided cable with 3A fast charging...",
  "include_ai_analysis": true
}
```

### POST `/predict` — Response

```json
{
  "recommended_price": 210,
  "price_low": 193,
  "price_high": 231,
  "confidence": 95,
  "factors": [
    {"label": "⭐ Rating 4.0 (category avg)", "type": "neutral"},
    {"label": "📈 Very high sales volume", "type": "up"},
    ...
  ],
  "insights": {
    "change_from_current": 5.5,
    "category_avg_price": 819.92,
    "ml_base_price": 204.0
  },
  "model_breakdown": {
    "mode": "ml+rules",
    "mape": 14.2,
    "n_training": 4832,
    "ml_price": 204.0,
    "rule_multiplier": 1.03
  },
  "ai_analysis": "At ₹210, this cable sits optimally..."
}
```

---

## ML Model Details

**Algorithm:** `GradientBoostingRegressor` (scikit-learn)  
**Features (14):**
- `actual_price`, `discount_percentage`
- `rating`, `rating_count`
- `demand_score`, `competitor_price`, `description_length`
- Category-derived: `cat_avg_price`, `cat_avg_rating`, `cat_avg_discount`, `cat_avg_demand`
- Relative signals: `rating_vs_cat`, `demand_vs_cat`, `price_vs_cat`

**Hyperparameters:** 300 estimators, LR 0.08, depth 5, subsample 0.8  
**Train/Test split:** 85/15

After training, the ML prediction is passed through a **rule-based signal layer** that applies interpretable multipliers for rating, demand, competitor alignment, and MRP discount band — and produces the `factors` list shown in the UI.

---

## CSV Format for Bulk Upload

Your CSV should contain these columns (extra columns are ignored):

```
product_name, category, discounted_price, actual_price,
rating, rating_count, demand_score, competitor_price,
about_product (optional), brand (optional)
```

---

## Environment Variables

| Variable         | Default                         | Description                 |
|------------------|---------------------------------|-----------------------------|
| `ANTHROPIC_API_KEY` | *(required for AI analysis)* | Your Anthropic API key      |
| `DATASET_PATH`   | `amazon_rocketsales_5000.csv`   | Path to training CSV        |
| `PORT`           | `8000`                          | Backend port                |

---

## Tech Stack

**Backend:** FastAPI · uvicorn · scikit-learn · pandas · anthropic-sdk  
**Frontend:** React 18 · Vite · Recharts · react-dropzone · react-hot-toast · CSS Modules
