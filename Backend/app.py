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
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
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

# ── Model Evaluation ──────────────────────────────────────────────────────────
# Split: take a 20% slice from the middle of the date range as the validation set
# (still time-based to avoid leakage, but not using the most recent data)
unique_dates = sorted(train_feat["date"].unique())

# determine indices for a central 20% window. for example, start at 40% and
# end at 60% through the sorted dates. this can be adjusted if you want the
# "middle" region shifted.
start_idx = int(len(unique_dates) * 0.4)
end_idx   = start_idx + int(len(unique_dates) * 0.2)
# guard against rounding issues
end_idx = min(end_idx, len(unique_dates)-1)

val_start_date = unique_dates[start_idx]
val_end_date   = unique_dates[end_idx]

train_mask = (train_feat["date"] < val_start_date) | (train_feat["date"] > val_end_date)
val_mask   = (train_feat["date"] >= val_start_date) & (train_feat["date"] <= val_end_date)

X_tr, y_tr = X[train_mask],  y[train_mask]
X_val, y_val = X[val_mask],  y[val_mask]

# Train a separate evaluation model on the 80% split
eval_model = GradientBoostingRegressor(n_estimators=120, max_depth=5,
                                       learning_rate=0.08, random_state=42)
eval_model.fit(X_tr, y_tr)
val_preds = eval_model.predict(X_val).clip(min=0)

# ── Core metrics ──────────────────────────────────────────────────────────────
def nwrmsle(y_true, y_pred, weights):
    """Normalized Weighted Root Mean Squared Logarithmic Error — competition metric."""
    y_true = np.array(y_true).clip(min=0)
    y_pred = np.array(y_pred).clip(min=0)
    weights = np.array(weights)
    log_diff = (np.log1p(y_pred) - np.log1p(y_true)) ** 2
    return float(np.sqrt(np.sum(weights * log_diff) / np.sum(weights)))

val_weights = train_feat[val_mask].merge(
    items_df[["item_nbr","perishable"]], on="item_nbr", how="left"
)["perishable_y"].fillna(0).apply(lambda p: 1.25 if p == 1 else 1.0).values

mae   = float(mean_absolute_error(y_val, val_preds))
rmse  = float(np.sqrt(mean_squared_error(y_val, val_preds)))
r2    = float(r2_score(y_val, val_preds))
mape  = float(np.mean(np.abs((y_val - val_preds) / (y_val + 1e-9))) * 100)
nwrmsle_score = nwrmsle(y_val, val_preds, val_weights)

# ── Cross-validation with TimeSeriesSplit ─────────────────────────────────────
tscv     = TimeSeriesSplit(n_splits=5)
cv_maes  = []
cv_rmses = []
cv_r2s   = []

for fold, (tr_idx, val_idx) in enumerate(tscv.split(X)):
    cv_model = GradientBoostingRegressor(n_estimators=80, max_depth=5,
                                         learning_rate=0.08, random_state=42)
    cv_model.fit(X.iloc[tr_idx], y.iloc[tr_idx])
    cv_preds = cv_model.predict(X.iloc[val_idx]).clip(min=0)
    cv_maes.append(mean_absolute_error(y.iloc[val_idx], cv_preds))
    cv_rmses.append(np.sqrt(mean_squared_error(y.iloc[val_idx], cv_preds)))
    cv_r2s.append(r2_score(y.iloc[val_idx], cv_preds))

# ── Feature importance ────────────────────────────────────────────────────────
feature_importances = [
    {"feature": f, "importance": round(float(v), 5)}
    for f, v in sorted(zip(FEATURES, model.feature_importances_),
                       key=lambda x: x[1], reverse=True)
]

# ── Residual analysis ─────────────────────────────────────────────────────────
val_df = train_feat[val_mask].copy()
val_df["predicted"]  = val_preds
val_df["residual"]   = val_df["unit_sales"] - val_df["predicted"]
val_df["abs_error"]  = val_df["residual"].abs()
val_df["date_str"]   = val_df["date"].astype(str)

# Residuals by month
residuals_by_month = (
    val_df.groupby(val_df["date"].dt.month)
    .agg(mean_residual=("residual","mean"), mae=("abs_error","mean"))
    .reset_index()
    .rename(columns={"date":"month"})
)
residuals_by_month["month"] = residuals_by_month["month"].map({
    1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",
    7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"
})
residuals_by_month = residuals_by_month.round(4).to_dict(orient="records")

# Actual vs predicted sample (100 rows for chart)
sample_val = val_df.sort_values("date").head(100)
actual_vs_pred = [
    {"date": row["date_str"], "actual": round(row["unit_sales"], 2),
     "predicted": round(row["predicted"], 2)}
    for _, row in sample_val.iterrows()
]

# Error distribution buckets
errors = val_df["abs_error"].values
error_dist = [
    {"bucket": "0–1",   "count": int((errors < 1).sum())},
    {"bucket": "1–2",   "count": int(((errors >= 1)  & (errors < 2)).sum())},
    {"bucket": "2–3",   "count": int(((errors >= 2)  & (errors < 3)).sum())},
    {"bucket": "3–5",   "count": int(((errors >= 3)  & (errors < 5)).sum())},
    {"bucket": "5–10",  "count": int(((errors >= 5)  & (errors < 10)).sum())},
    {"bucket": "10+",   "count": int((errors >= 10).sum())},
]

# Per-family MAE
family_mae = (
    val_df.groupby("family")["abs_error"].mean()
    .reset_index()
    .rename(columns={"abs_error":"mae"})
    .round(4)
    .to_dict(orient="records")
)

# Per-store MAE
store_mae = (
    val_df.groupby("store_nbr")["abs_error"].mean()
    .reset_index()
    .merge(stores_df[["store_nbr","name"]], on="store_nbr")
    .rename(columns={"abs_error":"mae"})
    .round(4)
    .to_dict(orient="records")
)

# Store cross-validation results per fold
cv_fold_results = [
    {"fold": i + 1,
     "mae":  round(cv_maes[i],  4),
     "rmse": round(cv_rmses[i], 4),
     "r2":   round(cv_r2s[i],   4)}
    for i in range(len(cv_maes))
]

print(f"Evaluation done ✓  MAE={mae:.3f}  RMSE={rmse:.3f}  R²={r2:.3f}  NWRMSLE={nwrmsle_score:.4f}")

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

@app.route("/api/evaluation")
def evaluation():
    return jsonify({
        # ── Split info ──────────────────────────────────────────────────────
        "split": {
            "train_rows":      int(train_mask.sum()),
            "val_rows":        int(val_mask.sum()),
            # For legacy compatibility, include a field indicating where the validation slice sits
            "val_start":       str(val_start_date.date()),
            "val_end":         str(val_end_date.date()),
            "split_ratio":     "80 / 20",
            "split_strategy":  "Time-based (middle 20% of dates)",
        },
        # ── Metrics ─────────────────────────────────────────────────────────
        "metrics": {
            "mae":            round(mae, 4),
            "rmse":           round(rmse, 4),
            "r2":             round(r2, 4),
            "mape":           round(mape, 4),
            "nwrmsle":        round(nwrmsle_score, 4),
        },
        # ── Cross-validation ─────────────────────────────────────────────
        "cross_validation": {
            "strategy":       "TimeSeriesSplit (5 folds)",
            "folds":          cv_fold_results,
            "mean_mae":       round(float(np.mean(cv_maes)),  4),
            "mean_rmse":      round(float(np.mean(cv_rmses)), 4),
            "mean_r2":        round(float(np.mean(cv_r2s)),   4),
            "std_mae":        round(float(np.std(cv_maes)),   4),
        },
        # ── Feature importance ───────────────────────────────────────────
        "feature_importance":   feature_importances,
        # ── Residual analysis ────────────────────────────────────────────
        "residuals_by_month":   residuals_by_month,
        "actual_vs_predicted":  actual_vs_pred,
        "error_distribution":   error_dist,
        "family_mae":           family_mae,
        "store_mae":            store_mae,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)