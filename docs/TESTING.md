# Validation

`npm test`: 21 deterministic Node quantitative tests and 7 Python provider tests. They cover formulas/warm-up, missing fields, OHLC validation, duplicates, discontinuity detection, FRED formats, exact buy/hold accounting, costs/tax, cash, aligned dates, switching, research limitations and future-data-mutation anti-look-ahead behavior.

`node scripts/validate-data.mjs`: validates the collected real universe, unique symbols, positive prices, ordered unique history dates, valid OHLC relationships and >=120 observations for TAIEX/0050/2330.

`npm run test:e2e`: 6 Playwright workflows × desktop/mobile. Tests overview, real-symbol search, weekly switching, missing-field screener behavior, executing backtests, persistent alerts and all research-page layout/error checks. CI uses the committed datasets and never requires markets to be open or provider credentials. Collection is a separate deployment operation.

Development also uses the available browser tooling for actual visual inspection and interaction. No claims of stress testing, complete regulatory transaction simulation, independent strategy validation, macOS container execution or security audit are made.

See PROGRESS.md for actually observed run results. New execution rules must include fixture accounting and anti-look-ahead tests. New providers must include schema/missing-data/error fixtures.
