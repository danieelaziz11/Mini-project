import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

BASE = Path(__file__).parent
app = Flask(__name__)

PIPE = None
META = None


def load_model():
    global PIPE, META
    pipe_path, meta_path = BASE / "model" / "pipeline.joblib", BASE / "model" / "meta.json"
    if pipe_path.exists() and meta_path.exists():
        PIPE = joblib.load(pipe_path)
        META = json.loads(meta_path.read_text(encoding="utf-8"))


load_model()


def nice(p):
    """Round for display: nearest 1,000 EGP under 1M, nearest 5,000 above."""
    step = 1000 if p < 1_000_000 else 5000
    return int(round(p / step) * step)


def predict_many(rows):
    df = pd.DataFrame(rows, columns=["brand", "model", "year", "km", "fuel", "transmission"])
    return np.clip(PIPE.predict(df), 1000, None)


def parse(payload):
    """Validate the request. Raises ValueError(code) with a short error code."""
    try:
        brand, model = str(payload["brand"]), str(payload["model"])
        year, km = int(payload["year"]), int(payload["km"])
        fuel, trans = str(payload["fuel"]), str(payload["transmission"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("missing_fields")
    if brand not in META["models"] or model not in {m["name"] for m in META["models"][brand]}:
        raise ValueError("unknown_car")
    if not META["year_min"] <= year <= META["year_max"] + 1:
        raise ValueError("bad_year")
    if not 0 <= km <= 2_000_000:
        raise ValueError("bad_km")
    if fuel not in META["fuels"] or trans not in META["transmissions"]:
        raise ValueError("bad_option")
    return brand, model, year, km, fuel, trans


@app.get("/")
def index():
    if META is None:
        return (
            "Model not found. Run:  python train_model.py --csv data/<your_file>.csv  "
            "then restart the app.",
            503,
        )
    return render_template("index.html", meta=META)


@app.post("/api/predict")
def api_predict():
    if META is None:
        return jsonify(error="no_model"), 503
    try:
        brand, model, year, km, fuel, trans = parse(request.get_json(silent=True) or {})
    except ValueError as e:
        return jsonify(error=str(e)), 400

    price = float(predict_many([(brand, model, year, km, fuel, trans)])[0])
    m = META["metrics"]
    lo, hi = price * m["ratio_lo"], price * m["ratio_hi"]

    # what-if curve: same car, same year, only the odometer changes
    ks = sorted({int(k) for k in np.linspace(5000, META["km_max"], 16)} | {km})
    curve_prices = predict_many([(brand, model, year, k, fuel, trans) for k in ks])

    st = META["stats"].get(f"{brand}|{model}", {})
    median = st.get("median_price")
    n = st.get("n", 0)
    return jsonify(
        price=nice(price),
        low=nice(lo),
        high=nice(hi),
        n_listings=n,
        median_price=nice(median) if median else None,
        vs_median_pct=round((price / median - 1) * 100) if median else None,
        low_confidence=n < 5,
        curve=[{"km": k, "price": nice(p)} for k, p in zip(ks, curve_prices)],
    )


@app.get("/api/health")
def health():
    return jsonify(ok=PIPE is not None)


if __name__ == "__main__":
    app.run(debug=True)
