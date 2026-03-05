"""
Richfield Fertilisers - Sales Forecasting Backend
Run: pip install flask flask-cors pandas scikit-learn numpy
     python app.py
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
import os, json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# ── Load data ────────────────────────────────────────────────────────────────
def load_data():
    train  = pd.read_csv(f"{DATA_DIR}/train.csv", parse_dates=["date"])
    stores = pd.read_csv(f"{DATA_DIR}/stores.csv")
    items  = pd.read_csv(f"{DATA_DIR}/items.csv")
    txns   = pd.read_csv(f"{DATA_DIR}/transactions.csv", parse_dates=["date"])
    hols   = pd.read_csv(f"{DATA_DIR}/holidays_events.csv", parse_dates=["date"])
    return train, stores, items, txns, hols

train, stores_df, items_df, txns_df, hols_df = load_data()
merged = (train
          .merge(items_df[["item_nbr","family","perishable","item_name"]], on="item_nbr", how="left")
          .merge(stores_df[["store_nbr","name","city","type","cluster"]], on="store_nbr", how="left"))

holiday_dates = set(hols_df["date"].dt.date)

# ── Feature engineering ──────────────────────────────────────────────────────
def make_features(df):
    df = df.copy()
    df["day_of_week"] = df["date"].dt.dayofweek
    df["month"]       = df["date"].dt.month
    df["day"]         = df["date"].dt.day
    df["quarter"]     = df["date"].dt.quarter
    df["is_holiday"]  = df["date"].dt.date.apply(lambda d: 1 if d in holiday_dates else 0)
    df["is_weekend"]  = (df["day_of_week"] >= 5).astype(int)
    # Seasonal: kharif Jun-Oct, rabi Nov-Mar
    df["kharif"]  = df["month"].isin([6,7,8,9,10]).astype(int)
    df["rabi"]    = df["month"].isin([11,12,1,2,3]).astype(int)
    return df

# ── Train model ───────────────────────────────────────────────────────────────
le_family  = LabelEncoder()
le_store   = LabelEncoder()

train_feat = make_features(merged)
train_feat["family_enc"]     = le_family.fit_transform(train_feat["family"])
train_feat["store_type_enc"] = le_store.fit_transform(train_feat["type"])

FEATURES = ["store_nbr","item_nbr","day_of_week","month","day","quarter",
            "is_holiday","is_weekend","kharif","rabi","onpromotion",
            "family_enc","store_type_enc","cluster","perishable"]

X = train_feat[FEATURES].fillna(0)
y = train_feat["unit_sales"].clip(lower=0)

model = GradientBoostingRegressor(n_estimators=120, max_depth=5,
                                  learning_rate=0.08, random_state=42)
model.fit(X, y)
print("Model trained ✓")

# ── Helpers ───────────────────────────────────────────────────────────────────
def predict_future(store_nbr, item_nbr, days=30):
    item_row  = items_df[items_df["item_nbr"] == item_nbr].iloc[0]
    store_row = stores_df[stores_df["store_nbr"] == store_nbr].iloc[0]
    future_dates = [datetime.today().date() + timedelta(days=i) for i in range(1, days+1)]
    rows = []
    for d in future_dates:
        rows.append({
            "date": pd.Timestamp(d),
            "store_nbr": store_nbr,
            "item_nbr": item_nbr,
            "onpromotion": 0,
            "family": item_row["family"],
            "perishable": item_row["perishable"],
            "type": store_row["type"],
            "cluster": store_row["cluster"],
        })
    df = pd.DataFrame(rows)
    df = make_features(df)
    df["family_enc"]     = le_family.transform(df["family"].apply(
        lambda x: x if x in le_family.classes_ else le_family.classes_[0]))
    df["store_type_enc"] = le_store.transform(df["type"].apply(
        lambda x: x if x in le_store.classes_ else le_store.classes_[0]))
    preds = model.predict(df[FEATURES].fillna(0)).clip(min=0)
    return [{"date": str(d), "predicted_sales": round(float(p), 2)}
            for d, p in zip(future_dates, preds)]

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/api/summary")
def summary():
    total_sales   = float(merged["unit_sales"].sum())
    total_txns    = int(txns_df["transactions"].sum())
    top_item      = merged.groupby("item_name")["unit_sales"].sum().idxmax()
    top_store_nbr = merged.groupby("store_nbr")["unit_sales"].sum().idxmax()
    top_store     = stores_df[stores_df["store_nbr"] == top_store_nbr]["name"].values[0]
    return jsonify({
        "total_sales": round(total_sales, 2),
        "total_transactions": total_txns,
        "top_item": top_item,
        "top_store": top_store,
        "date_range": {
            "start": str(merged["date"].min().date()),
            "end":   str(merged["date"].max().date()),
        }
    })

@app.route("/api/stores")
def get_stores():
    return jsonify(stores_df.to_dict(orient="records"))

@app.route("/api/items")
def get_items():
    return jsonify(items_df.to_dict(orient="records"))

@app.route("/api/sales_by_family")
def sales_by_family():
    grp = merged.groupby("family")["unit_sales"].sum().reset_index()
    grp.columns = ["family","total_sales"]
    grp["total_sales"] = grp["total_sales"].round(2)
    return jsonify(grp.sort_values("total_sales", ascending=False).to_dict(orient="records"))

@app.route("/api/sales_trend")
def sales_trend():
    store_nbr = request.args.get("store_nbr", type=int)
    df = merged.copy()
    if store_nbr:
        df = df[df["store_nbr"] == store_nbr]
    trend = df.groupby("date")["unit_sales"].sum().reset_index()
    trend["date"] = trend["date"].astype(str)
    return jsonify(trend.to_dict(orient="records"))

@app.route("/api/top_items")
def top_items():
    store_nbr = request.args.get("store_nbr", type=int)
    df = merged.copy()
    if store_nbr:
        df = df[df["store_nbr"] == store_nbr]
    top = (df.groupby(["item_nbr","item_name","family"])["unit_sales"]
             .sum().reset_index()
             .sort_values("unit_sales", ascending=False)
             .head(10))
    top["unit_sales"] = top["unit_sales"].round(2)
    return jsonify(top.to_dict(orient="records"))

@app.route("/api/forecast")
def forecast():
    store_nbr = request.args.get("store_nbr", type=int, default=1)
    item_nbr  = request.args.get("item_nbr",  type=int, default=1)
    days      = request.args.get("days",       type=int, default=30)
    days      = min(days, 90)
    preds     = predict_future(store_nbr, item_nbr, days)
    # also return recent actuals for chart context
    actuals = (merged[(merged["store_nbr"] == store_nbr) & (merged["item_nbr"] == item_nbr)]
               .groupby("date")["unit_sales"].sum()
               .tail(30).reset_index())
    actuals["date"] = actuals["date"].astype(str)
    actuals["unit_sales"] = actuals["unit_sales"].round(2)
    item_name = items_df[items_df["item_nbr"] == item_nbr]["item_name"].values
    store_name = stores_df[stores_df["store_nbr"] == store_nbr]["name"].values
    return jsonify({
        "item_name":  item_name[0]  if len(item_name)  else f"Item {item_nbr}",
        "store_name": store_name[0] if len(store_name) else f"Store {store_nbr}",
        "actuals":    actuals.to_dict(orient="records"),
        "forecast":   preds,
    })

@app.route("/api/monthly_sales")
def monthly_sales():
    df = merged.copy()
    df["month_year"] = df["date"].dt.to_period("M").astype(str)
    grp = df.groupby(["month_year","family"])["unit_sales"].sum().reset_index()
    grp["unit_sales"] = grp["unit_sales"].round(2)
    return jsonify(grp.to_dict(orient="records"))

@app.route("/api/store_comparison")
def store_comparison():
    grp = (merged.groupby(["store_nbr"])["unit_sales"].sum().reset_index()
           .merge(stores_df[["store_nbr","name","city"]], on="store_nbr"))
    grp["unit_sales"] = grp["unit_sales"].round(2)
    return jsonify(grp.to_dict(orient="records"))

if __name__ == "__main__":
    app.run(debug=True, port=5000)