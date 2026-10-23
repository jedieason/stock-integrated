# Static data API contracts

This deployment exposes static read-only JSON, relative to the Pages project base:

- `GET ./data/market.json`: daily instruments, indices, provenance and collection errors.
- `GET ./data/history.json`: versioned OHLC histories, coverage and validation issues.
- `GET ./data/macro.json`: macro series, dates, units and revisions.

No writable HTTP endpoints, OpenAPI server, credentials or brokerage access are exposed. Manual update is the authenticated GitHub Actions `workflow_dispatch` operation available to repository managers; browser visitors cannot dispatch it.

Browser operations: screener, chart aggregation and indicators, backtests, reports and alert evaluation execute locally. State keys are namespaced `twave:` in localStorage. Alert evaluation deduplicates by rule ID and observation date; maximum 300 events retained. Research history retains 30 reports. Workspace import validates version, symbols, price thresholds and direction; it only restores watchlists/alerts.

Stable contracts and units are described in DATA_DICTIONARY.md. A future backend should preserve this separation and supply typed unavailable-capability responses rather than fabricate endpoints for unsupported features.
