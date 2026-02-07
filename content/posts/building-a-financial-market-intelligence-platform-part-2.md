# Building a Financial Market Intelligence Platform, Part 2: Making the ML Models Actually Work

*February 07, 2026 | By Cassidy Dobratz*

In [Part 1](https://cassidydobratz.com/blog/building-a-financial-market-intelligence-platform-from-data-ingestion-to-ml-models), I walked through the architecture of my Financial Market Intelligence Platform — the data ingestion pipeline, feature engineering, and getting a basic XGBoost model up and running with MLflow tracking. It was a solid foundation, but I'll be honest: the model results were... humbling. An R² of 0.353 isn't going to impress anyone on a trading desk.

So I went back to the drawing board. Not to scrap the project, but to address the hard truth that building an ML pipeline is only half the battle. The other half is making your models actually learn something meaningful from the data. In this post, I'll walk through four major changes I made — and why each one matters.

---

## The Problem with a Simple Train/Test Split

My first version used a standard 80/20 train/test split. Straightforward, widely taught, and completely wrong for financial time series.

Here's the issue: financial data is temporal. If you randomly shuffle your data and split it, your model gets to "peek" at future information during training. It might train on data from March and test on data from January. In a textbook ML course that's fine. In finance, it's a recipe for overfitting and a model that looks great in backtesting but falls apart in production.

### Walk-Forward Validation

I replaced the static split with walk-forward validation using scikit-learn's `TimeSeriesSplit`. The idea is simple but powerful: train on an expanding window of past data, then test on the next N days. Slide the window forward and repeat.

```python
from sklearn.model_selection import TimeSeriesSplit

def walk_forward_validation(model, X, y, n_splits=5, test_size=30):
    tscv = TimeSeriesSplit(n_splits=n_splits, test_size=test_size)
    metrics_per_fold = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        model.train(X_train, y_train)
        fold_metrics = model.evaluate(X_test, y_test, f"fold_{fold}")
        metrics_per_fold.append(fold_metrics)

    return {
        "mean_rmse": np.mean([m["rmse"] for m in metrics_per_fold]),
        "std_rmse": np.std([m["rmse"] for m in metrics_per_fold]),
        "mean_directional_accuracy": np.mean(
            [m["directional_accuracy"] for m in metrics_per_fold]
        ),
    }
```

This simulates how the model would actually perform if deployed: it only ever sees past data when making predictions. The standard deviation of RMSE across folds also tells you something important — how *stable* your model is over time. A model that nails one period but blows up in another isn't useful, even if the average looks decent.

This is standard practice in quantitative finance for good reason. If you're building ML models on time series and you aren't doing this, your performance metrics are lying to you.

---

## Better Targets, Better Signals

The next issue was more fundamental: I was predicting raw returns, and raw returns are noisy. The signal-to-noise ratio in daily stock returns is notoriously low, which means a model trained on them is mostly learning noise.

I introduced two key improvements to the prediction targets.

### Volatility-Adjusted Returns

Instead of predicting raw 5-day returns, I started predicting volatility-adjusted returns — essentially a rolling Sharpe ratio. This normalizes the signal relative to recent market turbulence, so a 2% gain during a calm week is treated differently from a 2% gain during a volatile selloff.

```python
df['vol_20d'] = df['close'].pct_change().rolling(20).std()
df['risk_adj_return_5d'] = df['return_5d'] / df['vol_20d']
```

### Triple Barrier Labeling

This one comes from Marcos López de Prado's *Advances in Financial Machine Learning*, and it fundamentally changes how you frame the prediction problem. Instead of asking "what will the return be?", you ask "what happens first: does price hit a profit target, a stop loss, or does time run out?"

```python
def create_triple_barrier_labels(prices, take_profit=0.02, stop_loss=0.01, max_holding=10):
    labels = []
    for i in range(len(prices) - max_holding):
        entry = prices.iloc[i]
        future = prices.iloc[i+1:i+max_holding+1]
        returns = (future - entry) / entry

        tp_hit = returns >= take_profit
        sl_hit = returns <= -stop_loss

        if tp_hit.any() and (not sl_hit.any() or tp_hit.idxmax() < sl_hit.idxmax()):
            labels.append(1)   # Take profit hit first
        elif sl_hit.any():
            labels.append(-1)  # Stop loss hit first
        else:
            labels.append(0)   # Neither — time expired

    return pd.Series(labels + [np.nan] * max_holding, index=prices.index)
```

This maps much more closely to how actual trading decisions work. You're not trying to predict an exact number — you're trying to classify whether a trade setup is likely to be profitable within a risk framework. The result was roughly a 10–20% improvement in classification accuracy compared to raw return prediction.

---

## 56 Features Is Too Many Features

My pipeline was generating 56 features — every technical indicator I could think of, plus lag features, rolling statistics, and sentiment scores. The problem is that many of these are redundant (SMA-20 and Bollinger Band middle are literally the same value), and the noisy ones were giving the model too many opportunities to overfit.

I added a `FeatureSelector` class that supports three methods: mutual information scoring, correlation-based filtering, and recursive feature elimination.

```python
class FeatureSelector:
    def select_features(self, X, y, n_features=20):
        if self.method == "correlation":
            # First, remove features correlated >0.95 with each other
            corr_matrix = X.corr().abs()
            upper = corr_matrix.where(
                np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
            )
            to_drop = [col for col in upper.columns if any(upper[col] > 0.95)]
            X = X.drop(columns=to_drop)

            # Then rank by target correlation
            target_corr = X.corrwith(y).abs()
            sorted_features = target_corr.sort_values(ascending=False)
            return sorted_features.index[:n_features].tolist()
```

In practice, I found that cutting from 56 features down to about 20 actually *improved* test set performance while cutting training time nearly in half. That's the paradox of high-dimensional data — more features doesn't mean more information. It usually means more noise.

---

## From One Model to an Ensemble

The single XGBoost model was decent, but it was also unstable. Small changes in the training data could swing predictions significantly. The fix: a stacking ensemble that combines multiple base learners.

I set up four base models — XGBoost, LightGBM, Random Forest, and Ridge Regression — and stacked them with a RidgeCV meta-learner on top. The key design decision was using a simple linear model as the meta-learner rather than another tree-based model, which helps prevent the ensemble from overfitting to the base model outputs.

```python
from sklearn.ensemble import StackingRegressor
from sklearn.linear_model import RidgeCV

class StackingEnsemble:
    def __init__(self):
        self.base_models = [
            ('xgboost', XGBRegressor(n_estimators=100, max_depth=4)),
            ('lightgbm', LGBMRegressor(n_estimators=100, max_depth=4)),
            ('rf', RandomForestRegressor(n_estimators=100, max_depth=6)),
            ('ridge', Ridge(alpha=1.0))
        ]
        self.meta_learner = RidgeCV(alphas=[0.1, 1.0, 10.0])

        self.model = StackingRegressor(
            estimators=self.base_models,
            final_estimator=self.meta_learner,
            cv=5,
            passthrough=False
        )
```

Each base model brings a different inductive bias. XGBoost and LightGBM are strong on non-linear feature interactions but in different ways. Random Forest averages many decorrelated trees. Ridge provides a linear baseline that's hard to overfit. The meta-learner figures out which base model to trust in which situations.

The expected improvement is meaningful: R² moving from the 0.35 range up to 0.45–0.55, with more stable predictions across different market conditions. Just as importantly, the predictions are less volatile — the ensemble smooths out the individual quirks of each model.

---

## What I Learned

If I had to distill Part 2 into a single takeaway, it's this: **the pipeline is not the product. The model quality is.**

It's tempting as an engineer to spend weeks perfecting the Docker setup, the DAG orchestration, the MLflow tracking dashboards. And all of that matters — I covered it in Part 1. But the gap between "a pipeline that runs" and "a pipeline that produces useful predictions" is bridged by the less glamorous work: proper validation, thoughtful target engineering, disciplined feature selection, and robust model architecture.

The project is still a work in progress. Next on the list are market regime detection (training separate models for bull, bear, and sideways conditions), upgrading the sentiment analysis from keyword matching to FinBERT, and thinking about deployment costs. But that's a story for Part 3.

If you want to dig into the code, the project is on [GitHub](https://github.com/cdobratz/market-intelligence-mvp).
