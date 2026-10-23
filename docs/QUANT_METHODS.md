# Quantitative formulas

- SMA(n): arithmetic mean of n observations; returns null until a full valid window exists.
- EMA(n): first value = n-point SMA, then alpha=2/(n+1). Missing values reset warm-up.
- WMA(n): weights 1..n, newest largest.
- RSI(n): Wilder initial n-period mean gains/losses, then recursive Wilder smoothing. No losses ->100; flat gains/losses ->50. Requires n+1 prices.
- MACD: EMA12 − EMA26; signal = EMA9 of valid MACD; histogram requires full signal warm-up.
- Bollinger: SMA20 ±2 sample standard deviations (n−1 denominator), explicitly different from population-standard-deviation implementations.
- ATR: true range includes previous close gaps, initial n ranges mean, Wilder smoothing.
- Stochastic: current close position in n-period high/low range; flat range ->50.
- OBV: cumulative signed volume; first bar contributes zero.
- Volatility: sample standard deviation of daily simple returns × sqrt(252).
- Drawdown: equity / running peak −1; maximum drawdown = minimum of this series.
- CAGR: (last/first)^(1/elapsed calendar years)−1; 365.25-day years. Not a prediction, especially for short histories.
- Sharpe: (mean daily return ×252 − annual risk-free rate)/(daily sample SD ×sqrt(252)). Default risk-free rate 0. Zero denominator ->null.
- Sortino: annualized mean excess return divided by annualized root-mean-square negative excess returns (all periods in denominator).
- Correlation: Pearson daily return correlation on intersected dates. Beta = covariance/benchmark variance.
- Historical VaR95: negative empirical lower 5% return quantile (nearest rank); ES95: negative mean of all returns at/below that quantile. Not a forward-looking risk bound.
- Calmar: CAGR/abs(max drawdown), undefined at zero drawdown.
- Tracking error: sample SD of strategy-minus-benchmark daily returns ×sqrt(252).

Baseline research model `baseline-trend-v1`: close>SMA20 and close>SMA60 -> 上升趨勢; both below ->下降趨勢; otherwise 過渡整理. Requires 60 observations. Output remains PARTIAL_EVIDENCE because flows, point-in-time fundamentals and a calibrated model are missing. This is not the user's seven-stage Skill. No confidence percentages or price forecasts.

Weekly/monthly bars aggregate actual daily OHLC; latest incomplete weekly/monthly bars are included and identifiable by last observation date. No daily data is turned into synthetic intraday observations.
