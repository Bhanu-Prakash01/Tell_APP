#!/usr/bin/env python3
"""
Online Real‑Time Sales Predictor (Region & Sector)
-------------------------------------------------
A single-file Python CLI app that learns *incrementally* from your daily inputs
and immediately makes smarter predictions for sales.

✅ What it does
- Predicts numeric **sales** based on features like **region**, **sector**, optional **regain** (if you track it),
  plus date-derived features (day_of_week, month) and any numeric context you provide (e.g., leads, avg_ticket).
- **Online learning**: updates the model instantly after you enter the actual sales.
- **No schema headaches**: uses a hashing trick, so you can type any categorical strings without pre-fitting encoders.
- **Persists** the model to `sales_model.joblib` so it keeps improving across runs.

🧠 Tech
- Feature vectorization: `sklearn.feature_extraction.FeatureHasher` (fit-free, supports streaming)
- Model: `sklearn.linear_model.SGDRegressor` with `partial_fit` (incremental updates)

📦 Dependencies
- Python 3.9+
- scikit-learn
- joblib

Install:
    pip install scikit-learn joblib

Run:
    python sales_realtime_cli.py

Optional CSV warm-start:
    python sales_realtime_cli.py --warmstart path/to/data.csv
CSV columns (flexible): region, sector, regain (optional), date (YYYY-MM-DD), sales,
                        leads (int, optional), avg_ticket (float, optional)

Tip: If you don't have `regain` as a concept, just press Enter when asked.

"""
from __future__ import annotations
import argparse
import csv
import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, List, Optional

import joblib
import numpy as np
from sklearn.feature_extraction import FeatureHasher
from sklearn.linear_model import SGDRegressor

MODEL_PATH = "sales_model.joblib"


@dataclass
class Sample:
    region: str
    sector: str
    date: str  # YYYY-MM-DD
    regain: Optional[str] = None  # optional categorical field if you use it
    leads: Optional[float] = None
    avg_ticket: Optional[float] = None
    # you can freely add more numeric keys later via the CLI JSON mode

    def to_feature_dict(self) -> Dict[str, float]:
        # Categorical features as strings (hashed by FeatureHasher)
        d: Dict[str, float] = {
            f"region={self.region}": 1.0,
            f"sector={self.sector}": 1.0,
        }
        if self.regain:
            d[f"regain={self.regain}"] = 1.0

        # Date derived features
        try:
            dt = datetime.strptime(self.date, "%Y-%m-%d")
            d[f"dow={dt.weekday()}"] = 1.0  # 0=Mon
            d[f"month={dt.month}"] = 1.0
        except Exception:
            # If date is malformed, ignore date-derived features
            pass

        # Numeric features (if provided)
        if self.leads is not None:
            d["leads"] = float(self.leads)
        if self.avg_ticket is not None:
            d["avg_ticket"] = float(self.avg_ticket)

        return d


class OnlineSalesPredictor:
    def __init__(self, n_features: int = 2 ** 12, random_state: int = 42):
        # FeatureHasher is stateless (no fit required), perfect for streaming.
        self.hasher = FeatureHasher(n_features=n_features, input_type="dict")
        # SGDRegressor supports partial_fit for regression.
        self.model = SGDRegressor(
            loss="squared_error",
            penalty="l2",
            alpha=1e-4,
            learning_rate="adaptive",
            eta0=0.01,
            random_state=random_state,
            max_iter=1,  # we'll call partial_fit repeatedly
            warm_start=True,
        )
        self._is_initialized = False

    def _vectorize(self, records: List[Dict[str, float]]):
        X = self.hasher.transform(records)  # returns sparse matrix
        return X

    def partial_fit(self, samples: List[Sample], y: List[float]):
        records = [s.to_feature_dict() for s in samples]
        X = self._vectorize(records)
        y = np.asarray(y, dtype=float)
        # For regression, partial_fit does not require 'classes' arg
        self.model.partial_fit(X, y)
        self._is_initialized = True

    def predict(self, samples: List[Sample]) -> np.ndarray:
        records = [s.to_feature_dict() for s in samples]
        X = self._vectorize(records)
        if not self._is_initialized:
            # Cold start: if model hasn't seen data, default to zeros
            return np.zeros(X.shape[0])
        return self.model.predict(X)

    def save(self, path: str = MODEL_PATH):
        joblib.dump({
            "model": self.model,
            "n_features": self.hasher.n_features,
        }, path)

    @staticmethod
    def load(path: str = MODEL_PATH) -> "OnlineSalesPredictor":
        state = joblib.load(path)
        predictor = OnlineSalesPredictor(n_features=state["n_features"])
        predictor.model = state["model"]
        predictor._is_initialized = True
        return predictor


def warmstart_from_csv(predictor: OnlineSalesPredictor, csv_path: str, target_col: str = "sales"):
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        samples: List[Sample] = []
        targets: List[float] = []
        for row in reader:
            if target_col not in row or not row[target_col]:
                continue
            sample = Sample(
                region=row.get("region", ""),
                sector=row.get("sector", ""),
                regain=row.get("regain") or None,
                date=row.get("date", datetime.now().strftime("%Y-%m-%d")),
                leads=float(row["leads"]) if row.get("leads") else None,
                avg_ticket=float(row["avg_ticket"]) if row.get("avg_ticket") else None,
            )
            samples.append(sample)
            targets.append(float(row[target_col]))
        if samples:
            predictor.partial_fit(samples, targets)
            print(f"Warm-started on {len(samples)} rows from {csv_path}.")
        else:
            print("No valid rows found to warm-start.")


def prompt_sample_interactive() -> Sample:
    today = datetime.now().strftime("%Y-%m-%d")
    region = input("Region: ").strip()
    sector = input("Sector: ").strip()
    regain = input("Regain (optional): ").strip() or None
    date = input(f"Date [YYYY-MM-DD, default {today}]: ").strip() or today
    leads_s = input("Leads (optional number): ").strip()
    avg_ticket_s = input("Avg ticket (optional number): ").strip()
    leads = float(leads_s) if leads_s else None
    avg_ticket = float(avg_ticket_s) if avg_ticket_s else None
    return Sample(region=region, sector=sector, regain=regain, date=date, leads=leads, avg_ticket=avg_ticket)


def prompt_json_mode() -> Sample:
    print("Enter a JSON object with arbitrary features (must include region, sector). Example:\n"
          "{""region"": ""South"", ""sector"": ""Retail"", ""regain"": ""Tier2"", ""date"": ""2025-08-14"", ""leads"": 42, ""avg_ticket"": 799.0}")
    while True:
        try:
            raw = input("
JSON > ").strip()
            obj = json.loads(raw)
            region = str(obj.get("region", ""))
            sector = str(obj.get("sector", ""))
            regain = obj.get("regain")
            date = obj.get("date") or datetime.now().strftime("%Y-%m-%d")
            leads = float(obj["leads"]) if "leads" in obj and obj["leads"] is not None else None
            avg_ticket = float(obj["avg_ticket"]) if "avg_ticket" in obj and obj["avg_ticket"] is not None else None
            return Sample(region=region, sector=sector, regain=regain, date=date, leads=leads, avg_ticket=avg_ticket)
        except Exception as e:
            print(f"Invalid JSON, try again: {e}")


def main():
    parser = argparse.ArgumentParser(description="Online real-time sales predictor (region/sector)")
    parser.add_argument("--warmstart", type=str, default=None, help="Optional CSV path to pre-train the model")
    args = parser.parse_args()

    if os.path.exists(MODEL_PATH):
        try:
            predictor = OnlineSalesPredictor.load(MODEL_PATH)
            print(f"Loaded existing model from {MODEL_PATH}.")
        except Exception:
            predictor = OnlineSalesPredictor()
            print("Could not load existing model, starting fresh.")
    else:
        predictor = OnlineSalesPredictor()
        print("Starting with a fresh model.")

    if args.warmstart:
        warmstart_from_csv(predictor, args.warmstart)
        predictor.save(MODEL_PATH)

    print("\n=== Real-Time Sales Prediction ===")
    print("Type 'q' at any prompt to quit.\n")

    while True:
        mode = input("Input mode: [1] Guided prompts  [2] JSON  -> ").strip().lower()
        if mode == 'q':
            break
        if mode not in {"1", "2"}:
            print("Choose 1 or 2, or q to quit.")
            continue

        if mode == "1":
            sample = prompt_sample_interactive()
        else:
            sample = prompt_json_mode()

        # Predict
        pred = predictor.predict([sample])[0]
        print(f"\nPredicted sales: {pred:.2f}")

        # Learn immediately if you have the ground truth
        actual_s = input("Actual sales (press Enter if unknown): ").strip()
        if actual_s.lower() == 'q':
            break
        if actual_s:
            try:
                y = float(actual_s)
                predictor.partial_fit([sample], [y])
                predictor.save(MODEL_PATH)
                print("Model updated and saved.\n")
            except ValueError:
                print("Not a number. Skipped update.\n")
        else:
            print("No label provided. Model not updated.\n")

    print("Goodbye!")


if __name__ == "__main__":
    main()

