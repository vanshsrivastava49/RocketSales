import pandas as pd
import numpy as np

# ================= LOAD DATA ================= #

amazon = pd.read_csv("amazon_rocketsales_5000.csv")
flipkart = pd.read_csv("flipkart_final_realistic.csv")
snapdeal = pd.read_csv("snapdeal_final_realistic.csv")

# ================= CLEAN COLUMN NAMES ================= #

def clean_columns(df):
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    return df

amazon = clean_columns(amazon)
flipkart = clean_columns(flipkart)
snapdeal = clean_columns(snapdeal)

# ================= TRANSFORM FUNCTION ================= #

def transform(df, platform_name):
    df = df.copy()

    # Platform column
    df["platform"] = platform_name

    # Price alignment
    df["actual_price"] = df.get("actual_price", df.get("base_price"))
    df["discount_percentage"] = df.get("discount_percentage", df.get("discount_percent"))

    # Target variable
    if "discounted_price" in df.columns:
        df["final_price"] = df["discounted_price"]
    elif "final_price" not in df.columns:
        df["final_price"] = df["actual_price"] * (1 - df["discount_percentage"]/100)

    # Ratings
    df["rating"] = df.get("rating", 4.0)
    df["rating_count"] = df.get("rating_count", df.get("num_reviews", 1000))

    # Demand score
    df["demand_score"] = df["rating"] * np.log1p(df["rating_count"])

    # Competitor price
    df["competitor_price"] = df.get("competitor_price", df.get("competitor_price_avg", df["actual_price"]))

    # Description
    if "description" not in df.columns:
        df["description"] = df.get("product_name", "Generic Product")

    df["description_length"] = df["description"].astype(str).apply(len)

    # Category normalization
    df["category"] = df.get("category", "General").astype(str)

    return df

# ================= APPLY TRANSFORMATION ================= #

amazon = transform(amazon, "Amazon")
flipkart = transform(flipkart, "Flipkart")
snapdeal = transform(snapdeal, "Snapdeal")

# ================= SELECT FINAL COLUMNS ================= #

final_columns = [
    "platform",
    "product_name",
    "brand",
    "category",
    "description",
    "actual_price",
    "discount_percentage",
    "rating",
    "rating_count",
    "demand_score",
    "competitor_price",
    "description_length",
    "final_price"
]

def safe_select(df):
    for col in final_columns:
        if col not in df.columns:
            df[col] = None
    return df[final_columns]

amazon = safe_select(amazon)
flipkart = safe_select(flipkart)
snapdeal = safe_select(snapdeal)

# ================= MERGE ================= #

final_df = pd.concat([amazon, flipkart, snapdeal], ignore_index=True)

# ================= CLEAN FINAL DATA ================= #

# Drop extreme missing rows
final_df.dropna(subset=["actual_price", "final_price"], inplace=True)

# Fill remaining missing values
final_df.fillna({
    "brand": "Unknown",
    "description": "No description available",
    "rating": 4.0,
    "rating_count": 1000
}, inplace=True)

# ================= SAVE ================= #

final_df.to_csv("final_merged_dataset.csv", index=False)

print("✅ Dataset merged successfully!")
print("Total rows:", len(final_df))
print(final_df.head())