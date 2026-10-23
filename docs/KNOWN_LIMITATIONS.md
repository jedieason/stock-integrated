# Known limitations

- Static single-user research release, not the entire aspirational PAQRT production architecture. No server-side DB, FastAPI, account login, LLM endpoint or live trading.
- Listed TWSE only. TPEx and native US equities require additional verified adapters. 00646 is a Taiwan-listed TWD exposure to the US market, not an interchangeable native US index.
- Daily unadjusted prices. No intraday, dividends/rights/splits adjustment, corporate-action ledger, total return, historical constituents or delisted coverage. A large-change review guard is only a heuristic.
- Core historical coverage begins 2025-10-01 in the initial release. Full-market screening supports snapshot fields; historical technical filters only cover explicitly backfilled symbols.
- Snapshot market-cap estimates use current reported ordinary share counts. Financial statements, forward valuations, analyst estimates, flows and margin financing are unavailable.
- Backtest ignores price-limit fill feasibility, tick rounding, suspension execution, odd-lot liquidity and market impact. Sell tax is a uniform editable research assumption. No final liquidation costs.
- Cross-asset comparison intersects trading dates, is TWD-denominated and not total-return adjusted. No FX-neutral attribution or timezone-aware intraday synchronization.
- FRED values are the latest revised vintage; observation date is not release time. No ALFRED vintages or point-in-time macro strategy engine.
- Research model is a transparent three-state price-trend baseline, separate from any user seven-stage Skill. No fitted confidence, historical conditional win probability, calibrated scenario model or LLM narrative.
- Chronological holdout is available, but no nested validation, full walk-forward, parameter search, optimizer, efficient frontier or causal inference.
- Alerts evaluate on page load/manual checks, at daily frequency; no email, push, closed-browser scheduling or continuous price crossing monitor.
- Personal settings do not sync across devices. JSON backup currently restores watchlist and alerts only. No verified English UI translation.
- Public Pages site has no visitor authentication; Actions protects the data/deployment operations, not page access.
