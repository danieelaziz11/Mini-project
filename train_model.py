"""
Train the used-car price model (same steps as the notebook) and save it for the Flask app.

    python train_model.py --csv data/used_car_listings_dataset_from_hatla2ee2026.csv

Creates:  model/pipeline.joblib   (preprocessing + XGBoost in one sklearn Pipeline)
          model/meta.json         (dropdown values, per-model stats, test metrics)
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

BASE = Path(__file__).parent
NUM = ["year", "km"]
CAT = ["brand", "model", "fuel", "transmission"]


def to_number(series):
    """'EGP 1,250,000' -> 1250000 ,  '120,000 KM' -> 120000"""
    return pd.to_numeric(series.astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce")


def clean(df):
    """Same cleaning order as the notebook."""
    df = df.dropna().copy()
    df["price"] = to_number(df["price"])
    df["km"] = to_number(df["km"])
    df = df.dropna(subset=["price", "km"])
    df = df[df["km"] != 0]
    # keep the 20 brands with the most distinct models
    top20 = df.groupby("brand")["model"].nunique().sort_values(ascending=False).head(20).index
    df = df[df["brand"].isin(top20)]
    df["year"] = df["year"].astype(int)
    df = df[df["price"] <= 50_000_000]
    return df[NUM + CAT + ["price"]].reset_index(drop=True)


def make_pipeline():
    prep = ColumnTransformer(
        [
            ("num", StandardScaler(), NUM),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CAT),
        ],
        sparse_threshold=0,
    )
    xgb = XGBRegressor(
        n_estimators=500, learning_rate=0.1, max_depth=6,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
    )
    return Pipeline([("prep", prep), ("xgb", xgb)])


def build_meta(df, metrics):
    brands = [{"name": b, "n": int(n)} for b, n in df["brand"].value_counts().items()]
    models = {
        b: [{"name": m, "n": int(n)} for m, n in g["model"].value_counts().items()]
        for b, g in df.groupby("brand")
    }
    stats = {}
    for (b, m), g in df.groupby(["brand", "model"]):
        stats[f"{b}|{m}"] = {
            "n": int(len(g)),
            "median_price": float(g["price"].median()),
        }
    order = ["Gas", "Diesel", "Natural Gas", "Hybrid", "Electric"]
    fuels = [f for f in order if f in set(df["fuel"])] + sorted(set(df["fuel"]) - set(order))
    km_cap = min(600_000, int(np.ceil(np.percentile(df["km"], 99) / 50_000) * 50_000))
    return {
        "brands": brands,
        "models": models,
        "stats": stats,
        "fuels": fuels,
        "transmissions": sorted(set(df["transmission"])),
        "year_min": int(df["year"].min()),
        "year_max": int(df["year"].max()),
        "km_max": km_cap,
        "metrics": metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=str(BASE / "data" / "used_car_listings_dataset_from_hatla2ee2026.csv"))
    args = ap.parse_args()

    df = clean(pd.read_csv(args.csv))
    print(f"rows after cleaning: {len(df)}")

    X, y = df.drop(columns="price"), df["price"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

    pipe = make_pipeline().fit(X_tr, y_tr)
    pred = np.clip(pipe.predict(X_te), 1000, None)
    ratio = y_te.to_numpy() / pred  # actual / predicted -> empirical error band
    metrics = {
        "mae": float(mean_absolute_error(y_te, pred)),
        "rmse": float(mean_squared_error(y_te, pred) ** 0.5),
        "r2": float(r2_score(y_te, pred)),
        "ratio_lo": float(np.quantile(ratio, 0.10)),
        "ratio_hi": float(np.quantile(ratio, 0.90)),
        "n_rows": int(len(df)),
        "n_test": int(len(X_te)),
    }
    print({k: round(v, 3) for k, v in metrics.items()})

    # final model: refit on ALL rows (metrics above come from the held-out split)
    pipe = make_pipeline().fit(X, y)

    out = BASE / "model"
    out.mkdir(exist_ok=True)
    joblib.dump(pipe, out / "pipeline.joblib")
    (out / "meta.json").write_text(
        json.dumps(build_meta(df, metrics), ensure_ascii=False), encoding="utf-8"
    )
    print("saved ->", out)


if __name__ == "__main__":
    main()
