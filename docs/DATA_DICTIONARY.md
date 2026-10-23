# Data dictionary

`data/market.json`: schemaVersion, ingestedAt (UTC), observationDate (ISO local session date), provider, currency, frequency, adjustment, sources, publicationTimestamp (null when unverified), availableAt (ingestion bound), errors, stocks, indices.

Stock: symbol, name, exchange, currency, type, sector, date, price/open/high/low (TWD), change (TWD), pct (percentage units), volume (shares), turnover (TWD), marketCap (TWD, close × ordinary shares), pe/pb (multiples), yieldPct (percentage units), valuationDate. Missing numeric facts are null. Market cap is an estimate using currently reported ordinary shares, not a point-in-time shares-outstanding history.

`data/history.json`: series keyed by instrument, ordered `{date,open,high,low,close,volume,change?}` bars, coverage `{first,last,count,missingSessions}`, validation issues, errors, requestedMonths, source metadata. Index volume is null. ETF/share prices are unadjusted. Calendar gaps are measured against the actual collected TAIEX dates within each series range, not assumed Monday-Friday trading.

`data/macro.json`: series keyed by FRED identifier, name, unit, group, source/endpoint, ingestedAt, license, vintage and ordered `{date,value}` observations. Missing observations are excluded, not forward-filled. Monthly observation date is not its announcement date.

Frontend engine returns: fractional returns (0.01 = 1%), RSI 0–100, volatility as an annualized fraction, Sharpe/Sortino dimensionless. Snapshot pct/yieldPct are percentage units and must be divided by 100 before combining with engine return fractions.

Error vocabulary currently emitted: SOURCE_UNAVAILABLE, NOT_PUBLISHED (provider text), SCHEMA_ERROR (schema guard), VALIDATION_FAILED, DUPLICATE_OBSERVATION, CORPORATE_ACTION_REVIEW_REQUIRED. UI also identifies STALE_DATA, HISTORICAL_COVERAGE_INSUFFICIENT, MODEL_NOT_CONFIGURED and PERMISSION_RESTRICTED. Not all aspirational provider error codes are implemented.
