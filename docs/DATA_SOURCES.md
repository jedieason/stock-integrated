# Data sources and access

| Provider | Implemented endpoints | Meaning |
|---|---|---|
| TWSE OpenAPI | `exchangeReport/STOCK_DAY_ALL` | latest available daily unadjusted OHLC, volume, trading value |
| TWSE OpenAPI | `exchangeReport/BWIBBU_ALL` | available P/E, P/B, dividend yield, with observation date |
| TWSE OpenAPI | `opendata/t187ap03_L` | official industry code and ordinary share count |
| TWSE OpenAPI | `exchangeReport/MI_INDEX` | daily index closes and changes |
| TWSE history | `/exchangeReport/STOCK_DAY?response=json&date=YYYYMM01&stockNo=...` | date-selectable monthly daily observations |
| TWSE history | `/indicesReport/MI_5MINS_HIST?response=json&date=YYYYMM01` | daily TAIEX OHLC by month; no inferred intraday |
| FRED | `/data/SERIES.txt` | official downloadable public observations; currently returns a table plus deferred HTML rows |

Base: <https://openapi.twse.com.tw/v1/> and <https://www.twse.com.tw/>. Official terms: <https://www.twse.com.tw/zh/terms/terms.html>.

FRED series: DGS10, DGS2, FEDFUNDS, UNRATE, CPIAUCSL, DEXTAUS. Federal statistical releases only; we do not redistribute proprietary US equity or VIX feeds. Each series links to its source and <https://fred.stlouisfed.org/legal/>. Review provider terms before commercial redistribution or expanding coverage; public accessibility is not a universal license.

FRED's old graph CSV URL returned errors during development. The implemented adapter reads the official public table without executing provider JavaScript. It supports plain text, HTML table rows and deferred `#date|value` rows; validates numeric observations, deduplicates and sorts dates. It stores endpoint and revision semantics.

Capabilities: TWSE daily, monthly backfill, snapshot valuations and classification; FRED macro. Unsupported: TPEx, intraday, corporate actions/adjusted prices, margin/flows, historical constituents, statements/consensus, native US equity prices. Unsupported capability is disclosed; no cross-market fallbacks.

Requests have bounded timeouts and retry/backoff. Up to three TWSE monthly requests run concurrently. FRED text collection uses installed curl; no API keys, authentication bypass, paid pages or paid data are used.
