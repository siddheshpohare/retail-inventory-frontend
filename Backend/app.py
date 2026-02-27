"""
Favorita Store Sales Forecasting Agent - Backend API
Run: pip install flask flask-cors pandas numpy scikit-learn lightgbm
     python app.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
import re
from datetime import datetime, timedelta
from functools import lru_cache
import warnings
warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

DATA_DIR = "./data"

# ─────────────────────────────────────────────
# In-memory cache — all data loaded ONCE at startup
# ─────────────────────────────────────────────
_CACHE = {}          # raw dataframes
_AGG_CACHE = {}      # pre-computed aggregations
_MODEL_CACHE = {}    # trained forecast models


def _cache(key, fn):
    """Return cached value or compute + store it."""
    if key not in _CACHE:
        _CACHE[key] = fn()
    return _CACHE[key]


def load_csv(name, **kwargs):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        return pd.read_csv(path, **kwargs)
    return None


# ─────────────────────────────────────────────
# Data loaders — each called once, result cached
# ─────────────────────────────────────────────

def get_train_data():
    def _load():
        df = load_csv("train.csv", parse_dates=["date"])
        if df is None:
            # Fast vectorised synthetic data — no Python loops
            np.random.seed(42)
            dates  = pd.date_range("2015-01-01", "2017-08-15", freq="W")  # weekly
            stores = np.arange(1, 6)
            dd, ss = np.meshgrid(dates, stores)
            dd = dd.ravel()
            ss = ss.ravel()
            seasonal = 20 * np.sin(pd.DatetimeIndex(dd).dayofyear / 365 * 2 * np.pi)
            base     = 200 + ss * 30
            sales    = np.maximum(0, np.random.normal(base + seasonal, 50))
            df = pd.DataFrame({"date": dd, "store_nbr": ss, "unit_sales": sales})
        df["unit_sales"] = df["unit_sales"].clip(lower=0)
        return df
    return _cache("train", _load)


def get_stores():
    def _load():
        df = load_csv("stores.csv")
        if df is None:
            n      = 54
            cities = (["Quito"] * 22 + ["Guayaquil"] * 15 +
                      ["Cuenca"] * 10 + ["Ambato"] * 4 + ["Other"] * 3)
            states = (["Pichincha"] * 22 + ["Guayas"] * 15 +
                      ["Azuay"] * 10 + ["Tungurahua"] * 4 + ["Other"] * 3)
            df = pd.DataFrame({
                "store_nbr": np.arange(1, n + 1),
                "city":      cities,
                "state":     states,
                "type":      (["A", "B", "C", "D", "E"] * 11)[:n],
                "cluster":   np.arange(n) % 17 + 1,
            })
        return df
    return _cache("stores", _load)


def get_items():
    def _load():
        df = load_csv("items.csv")
        if df is None:
            families = ["GROCERY I", "BEVERAGES", "PRODUCE", "CLEANING", "DAIRY",
                        "BREAD/BAKERY", "FROZEN FOODS", "MEATS", "PERSONAL CARE", "DELI"]
            n = 200
            df = pd.DataFrame({
                "item_nbr":   np.arange(1, n + 1),
                "family":     [families[i % len(families)] for i in range(n)],
                "class":      np.arange(n) % 100 + 1,
                "perishable": (np.arange(n) % 5 == 0).astype(int),
            })
        return df
    return _cache("items", _load)


def get_oil():
    def _load():
        df = load_csv("oil.csv", parse_dates=["date"])
        if df is None:
            dates = pd.date_range("2013-01-01", "2017-08-31", freq="D")
            np.random.seed(10)
            price = np.clip(100 + np.cumsum(np.random.normal(0, 0.8, len(dates))), 30, 120)
            df = pd.DataFrame({"date": dates, "dcoilwtico": price})
        return df
    return _cache("oil", _load)


def get_transactions():
    def _load():
        df = load_csv("transactions.csv", parse_dates=["date"])
        if df is None:
            # Fully vectorised — no loops
            np.random.seed(7)
            dates  = pd.date_range("2015-01-01", "2017-08-15", freq="3D")
            stores = np.arange(1, 55)
            dd, ss = np.meshgrid(dates, stores)
            dd = dd.ravel()
            ss = ss.ravel()
            txn = np.maximum(0, np.random.normal(800 + ss * 10, 120)).astype(int)
            df  = pd.DataFrame({"date": dd, "store_nbr": ss, "transactions": txn})
        return df
    return _cache("transactions", _load)


def get_holidays():
    def _load():
        df = load_csv("holidays_events.csv", parse_dates=["date"])
        if df is None:
            df = pd.DataFrame({
                "date": pd.to_datetime(["2016-04-16", "2016-12-25", "2016-01-01",
                                        "2016-05-01", "2016-08-10", "2016-10-09"]),
                "type": ["Additional", "Holiday", "Holiday", "Holiday", "Holiday", "Transfer"],
                "locale":      ["National"] * 6,
                "locale_name": ["Ecuador"]  * 6,
                "description": ["Earthquake Relief", "Christmas", "New Year",
                                "Labor Day", "Independence Day", "Guayaquil Day"],
                "transferred": [False] * 6,
            })
        return df
    return _cache("holidays", _load)


# ─────────────────────────────────────────────
# Pre-computed aggregations (built once at startup)
# ─────────────────────────────────────────────

def _build_agg_cache():
    """Runs once at startup — pre-computes all heavy aggregations."""
    print("⏳ Pre-computing aggregations…", flush=True)

    df     = get_train_data()
    stores = get_stores()
    items  = get_items()

    # 1. Monthly trend
    df2 = df.copy()
    df2["month_year"] = df2["date"].dt.to_period("M").astype(str)
    monthly = df2.groupby("month_year")["unit_sales"].sum().reset_index()
    monthly.columns = ["month_year", "unit_sales"]
    _AGG_CACHE["monthly_trend"] = monthly.tail(24).to_dict(orient="records")

    # 2. Weekly pattern
    df2["dow"] = df2["date"].dt.day_name()
    dow_order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    weekly = df2.groupby("dow")["unit_sales"].mean().reset_index()
    weekly.columns = ["day", "avg_sales"]
    weekly["_o"] = weekly["day"].map({d: i for i, d in enumerate(dow_order)})
    weekly = weekly.sort_values("_o").drop("_o", axis=1)
    weekly["avg_sales"] = weekly["avg_sales"].round(2)
    _AGG_CACHE["weekly"] = weekly.to_dict(orient="records")

    # 3. By product family
    if "item_nbr" in df.columns:
        merged = df.merge(items[["item_nbr", "family"]], on="item_nbr", how="left")
    else:
        families = ["GROCERY I","BEVERAGES","PRODUCE","CLEANING","DAIRY",
                    "BREAD/BAKERY","FROZEN FOODS","MEATS","PERSONAL CARE","DELI"]
        df2["family"] = [families[i % len(families)] for i in range(len(df2))]
        merged = df2
    by_fam = merged.groupby("family")["unit_sales"].sum().reset_index()
    by_fam.columns = ["family", "total_sales"]
    by_fam = by_fam.sort_values("total_sales", ascending=False)
    by_fam["total_sales"] = by_fam["total_sales"].round(2)
    _AGG_CACHE["by_family"] = by_fam.to_dict(orient="records")

    # 4. Store totals
    store_sales = df.groupby("store_nbr")["unit_sales"].sum().reset_index()
    store_sales.columns = ["store_nbr", "total_sales"]
    merged_stores = stores.merge(store_sales, on="store_nbr", how="left")
    merged_stores["total_sales"] = merged_stores["total_sales"].fillna(0).round(2)
    _AGG_CACHE["stores"] = merged_stores.to_dict(orient="records")

    # 5. By city
    city_sales = merged_stores.groupby("city")["total_sales"].sum().reset_index()
    city_sales.columns = ["city", "total_sales"]
    city_sales = city_sales.sort_values("total_sales", ascending=False)
    _AGG_CACHE["by_city"] = city_sales.to_dict(orient="records")

    # 6. Oil monthly
    oil = get_oil().dropna().copy()
    oil["month_year"] = oil["date"].dt.to_period("M").astype(str)
    oil_monthly = oil.groupby("month_year")["dcoilwtico"].mean().reset_index()
    oil_monthly.columns = ["month", "oil_price"]
    oil_monthly["oil_price"] = oil_monthly["oil_price"].round(2)
    _AGG_CACHE["oil"] = oil_monthly.to_dict(orient="records")

    # 7. Overview summary
    _AGG_CACHE["overview"] = {
        "total_sales":  round(float(df["unit_sales"].sum()), 2),
        "date_range":   {
            "start": str(df["date"].min().date()),
            "end":   str(df["date"].max().date()),
        },
        "store_count":  int(stores["store_nbr"].nunique()),
        "item_count":   int(items["item_nbr"].nunique()),
        "monthly_trend": _AGG_CACHE["monthly_trend"],
    }

    # 8. Transactions monthly
    txn = get_transactions().copy()
    txn["month_year"] = txn["date"].dt.to_period("M").astype(str)
    txn_monthly = txn.groupby("month_year")["transactions"].sum().reset_index()
    _AGG_CACHE["transactions"] = txn_monthly.tail(24).to_dict(orient="records")

    # 9. Top store stats for agent
    top5 = merged_stores.nlargest(5, "total_sales")[["store_nbr", "total_sales"]]
    _AGG_CACHE["top_stores"] = top5.to_dict(orient="records")

    print("✅ Aggregations ready.", flush=True)


# ─────────────────────────────────────────────
# Forecasting — fast LinearRegression fallback,
# LightGBM if available, cached per store
# ─────────────────────────────────────────────

def _build_features(df):
    df = df.copy()
    df["date"]   = pd.to_datetime(df["date"])
    df["year"]   = df["date"].dt.year
    df["month"]  = df["date"].dt.month
    df["day"]    = df["date"].dt.day
    df["dow"]    = df["date"].dt.dayofweek
    df["woy"]    = df["date"].dt.isocalendar().week.astype(int)
    df["wkend"]  = (df["dow"] >= 5).astype(int)
    df["qtr"]    = df["date"].dt.quarter
    df["payday"] = ((df["day"] == 15) | (df["date"].dt.is_month_end)).astype(int)
    df["quake"]  = ((df["date"] >= "2016-04-16") &
                    (df["date"] <= "2016-05-15")).astype(int)
    return df

FEATURE_COLS = ["year","month","day","dow","woy","wkend","qtr","payday","quake"]


def _train_model(store_nbr):
    df = get_train_data()
    sdf = df[df["store_nbr"] == store_nbr] if "store_nbr" in df.columns else df
    if len(sdf) < 10:
        return None

    daily = sdf.groupby("date")["unit_sales"].sum().reset_index()
    daily = _build_features(daily)
    X, y = daily[FEATURE_COLS].values, daily["unit_sales"].values

    try:
        import lightgbm as lgb
        model = lgb.LGBMRegressor(
            n_estimators=50, learning_rate=0.15,
            num_leaves=16, random_state=42, verbose=-1
        )
    except ImportError:
        from sklearn.linear_model import Ridge
        model = Ridge(alpha=1.0)   # much faster than GradientBoosting

    model.fit(X, y)
    return model


def forecast_store(store_nbr, days=16):
    if store_nbr not in _MODEL_CACHE:
        m = _train_model(store_nbr)
        _MODEL_CACHE[store_nbr] = m  # cache even if None

    model = _MODEL_CACHE[store_nbr]
    df    = get_train_data()

    if model is None:
        # Pure average fallback
        sdf = df[df["store_nbr"] == store_nbr] if "store_nbr" in df.columns else df
        avg = float(sdf["unit_sales"].mean()) if len(sdf) else 500.0
        last = df["date"].max()
        return [{"date": str((last + timedelta(days=i)).date()),
                 "predicted_sales": round(avg * np.random.normal(1, 0.03), 2)}
                for i in range(1, days + 1)]

    last = df["date"].max()
    future = pd.DataFrame({"date": pd.date_range(last + timedelta(1), periods=days),
                            "unit_sales": 0})
    future = _build_features(future)
    preds  = np.clip(model.predict(future[FEATURE_COLS].values), 0, None)
    return [{"date": str(d.date()), "predicted_sales": round(float(p), 2)}
            for d, p in zip(future["date"], preds)]


# ─────────────────────────────────────────────
# Routes — all heavy work hits _AGG_CACHE
# ─────────────────────────────────────────────

@app.route("/api/overview", methods=["GET"])
def overview():
    return jsonify(_AGG_CACHE["overview"])


@app.route("/api/stores", methods=["GET"])
def stores_endpoint():
    return jsonify(_AGG_CACHE["stores"])


@app.route("/api/sales/by-family", methods=["GET"])
def sales_by_family():
    return jsonify(_AGG_CACHE["by_family"])


@app.route("/api/sales/by-city", methods=["GET"])
def sales_by_city():
    return jsonify(_AGG_CACHE["by_city"])


@app.route("/api/sales/weekly", methods=["GET"])
def weekly_sales():
    return jsonify(_AGG_CACHE["weekly"])


@app.route("/api/oil", methods=["GET"])
def oil_endpoint():
    return jsonify(_AGG_CACHE["oil"])


@app.route("/api/holidays", methods=["GET"])
def holidays_endpoint():
    df = get_holidays().copy()
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    return jsonify(df.to_dict(orient="records"))


@app.route("/api/transactions", methods=["GET"])
def transactions_endpoint():
    return jsonify(_AGG_CACHE["transactions"])


@app.route("/api/forecast", methods=["GET"])
def forecast_endpoint():
    store_nbr = request.args.get("store_nbr", type=int, default=1)
    days      = min(request.args.get("days", type=int, default=16), 30)
    preds     = forecast_store(store_nbr, days)
    return jsonify({"store_nbr": store_nbr, "forecast_days": days, "predictions": preds})


@app.route("/api/forecast/all-stores", methods=["GET"])
def forecast_all_stores():
    summaries = []
    for store_nbr in range(1, 11):
        preds = forecast_store(store_nbr, 16)
        if preds:
            total = sum(r["predicted_sales"] for r in preds)
            summaries.append({
                "store_nbr":      store_nbr,
                "total_forecast": round(total, 2),
                "daily_avg":      round(total / 16, 2),
            })
    return jsonify(summaries)


@app.route("/api/agent/chat", methods=["POST"])
def agent_chat():
    message = (request.json or {}).get("message", "").lower()
    store_match = re.search(r"store\s*(\d+)", message)
    store_nbr   = int(store_match.group(1)) if store_match else 1

    if any(w in message for w in ["forecast", "predict", "future", "next"]):
        preds = forecast_store(store_nbr, 16)
        total = sum(r["predicted_sales"] for r in preds)
        peak  = max(preds, key=lambda x: x["predicted_sales"])
        response = (
            f"📊 **Forecast for Store {store_nbr} (next 16 days)**\n\n"
            f"• Total projected sales: **{total:,.0f} units**\n"
            f"• Daily average: **{total/16:,.0f} units/day**\n"
            f"• Peak day: **{peak['date']}** with {peak['predicted_sales']:,.0f} units\n\n"
            f"Model accounts for day-of-week patterns, paydays, and seasonal trends."
        )

    elif any(w in message for w in ["top", "best", "highest"]):
        lines = "\n".join(
            f"• Store {r['store_nbr']}: {r['total_sales']:,.0f} units"
            for r in _AGG_CACHE["top_stores"]
        )
        response = f"🏆 **Top 5 Performing Stores:**\n\n{lines}"

    elif any(w in message for w in ["oil", "price", "economic"]):
        latest = _AGG_CACHE["oil"][-1]
        response = (
            f"🛢️ **Oil Price Context:**\n\n"
            f"Latest monthly avg: **${latest['oil_price']:.2f}/barrel**\n\n"
            f"Ecuador is heavily oil-dependent. Price shocks directly affect "
            f"consumer spending and supermarket sales nationwide."
        )

    elif any(w in message for w in ["earthquake", "2016", "disaster"]):
        response = (
            "🌎 **April 2016 Earthquake Impact:**\n\n"
            "A 7.8 magnitude earthquake struck Ecuador on April 16, 2016.\n\n"
            "• Immediate spike in essential goods (water, food)\n"
            "• Disrupted supply chains for several weeks\n"
            "• Sales patterns deviated ~40% from baseline\n\n"
            "The model includes a post-earthquake feature flag (Apr 16 – May 15, 2016)."
        )

    elif any(w in message for w in ["holiday", "christmas", "celebration"]):
        holidays = get_holidays().copy()
        holidays["date"] = pd.to_datetime(holidays["date"]).dt.strftime("%Y-%m-%d")
        lines = "\n".join(
            f"• {r['date']} — {r['description']} ({r['type']})"
            for _, r in holidays.tail(5).iterrows()
        )
        response = f"🎉 **Recent Holidays/Events:**\n\n{lines}\n\nHolidays can significantly boost or shift sales patterns."

    elif any(w in message for w in ["payday", "wage", "salary", "15th"]):
        response = (
            "💰 **Payday Effect:**\n\n"
            "Public sector wages are paid on the **15th** and **last day** of each month.\n"
            "Sales increase ~15–25% on these days. The model uses this as a binary feature."
        )

    elif any(w in message for w in ["family", "category", "product"]):
        top = _AGG_CACHE["by_family"][:5]
        lines = "\n".join(f"• {r['family']}: {r['total_sales']:,.0f} units" for r in top)
        response = f"🛒 **Top Product Families:**\n\n{lines}"

    elif any(w in message for w in ["help", "what", "how", "can you"]):
        response = (
            "🤖 **Favorita Forecasting Agent**\n\n"
            "I can help with:\n\n"
            "• **Forecast** — 'Forecast store 3 sales'\n"
            "• **Top stores** — 'Which stores perform best?'\n"
            "• **Oil prices** — 'How does oil affect sales?'\n"
            "• **Earthquake** — 'Tell me about the 2016 earthquake'\n"
            "• **Paydays** — 'Explain the payday effect'\n"
            "• **Holidays** — 'Show upcoming holidays'\n"
            "• **Products** — 'What product categories exist?'"
        )

    else:
        ov = _AGG_CACHE["overview"]
        response = (
            f"📈 **Dataset Summary:**\n\n"
            f"• Total sales: **{ov['total_sales']:,.0f} units**\n"
            f"• Stores: **{ov['store_count']}**\n"
            f"• Date range: **{ov['date_range']['start']} → {ov['date_range']['end']}**\n\n"
            f"Ask me to forecast a store, explain oil impacts, or analyse product families!"
        )

    return jsonify({"response": response, "timestamp": datetime.now().isoformat()})


# ─────────────────────────────────────────────
# Startup — warm up everything before first request
# ─────────────────────────────────────────────

if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    print("🚀 Favorita Forecasting API starting…")
    print(f"📁 Data directory: {os.path.abspath(DATA_DIR)}")
    print("   (Synthetic demo data used if CSVs are missing)\n")

    # Pre-load all data and aggregations at startup
    get_train_data()
    get_stores()
    get_items()
    get_oil()
    get_transactions()
    get_holidays()
    _build_agg_cache()

    # Pre-train forecast model for store 1 so first request is instant
    forecast_store(1, 16)
    print("✅ Ready — http://localhost:5000\n")

    app.run(debug=False, port=5000)   # debug=False avoids double startup
