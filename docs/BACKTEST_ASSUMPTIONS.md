# Backtesting assumptions

The backtest is a deterministic educational/research accounting engine on real unadjusted TWSE daily prices.

1. Intersect the dates of selected holdings, required switching assets and benchmark. Never forward-fill a missing execution price.
2. The first date is context/initial equity. Earliest trade is the next common session open. All trend/momentum/volatility signals read only through the previous common date.
3. Hold allocation: target specified weights; monthly rebalance or initial only. Trend: hold each configured asset only above its prior-close lookback SMA. Switching: select 0050 or 2330 using prior-close lookback momentum. Volatility: min(1,target annual volatility / trailing realized volatility), scaled by configured weights.
4. Sell before buy, calculate whole-share quantities, keep cash nonnegative, preserve unallocated cash at zero interest. Minimum commission applies to each executed order. Buy execution=open×(1+slippage); sell=open×(1−slippage). Sell tax applies only to sells.
5. Fees, minimum fee, slippage and a **uniform configurable sell-tax assumption** are shown and editable. These are research assumptions, not a claim of legal/contractual rates for every asset or investor.
6. Mark holdings at each session close. Terminal positions are not liquidated, so final liquidation costs are not included. Benchmark buys at the same first execution session open, with no fees; this difference is disclosed.
7. Weights can total less than 100% to leave cash, but must be positive in aggregate and cannot exceed 100%. Switching ignores allocation weights and uses a 100% chosen-asset target; warm-up is cash.
8. Exclude invalid OHLC. Reference-price discontinuities >20% are flagged for corporate-action review; affected selected holdings are blocked by UI. This heuristic is not a complete split detector.
9. Holdout mode uses only the last 30% of the user-selected benchmark session range for evaluation; earlier prices can warm up indicators. No parameter optimization is performed. This is not a complete walk-forward validation system.

**Limitations:** no dividends, splits/rights total-return reconstruction, delisted universe, historical constituents, tick rounding, limit-up/down queueing, suspension fills, market impact, loan costs or cash interest. Using today's surviving selected universe creates selection/survivorship bias. No fundamentals or revised macro observations drive historical trades. Profitable outputs do not establish an investable strategy.

Every result exports configuration, equity, benchmark, costs, trades and signal dates in JSON. Synthetic prices occur only in tests, never in application data.
