# Validation

`npm test`: 22 deterministic Node quantitative tests, 1 deployed-asset packaging test and 7 Python provider tests (30 total). They cover formulas/warm-up, missing fields, OHLC validation, duplicates, discontinuity detection, FRED formats, exact buy/hold accounting, costs/tax, cash, aligned dates, switching, research limitations and future-data-mutation anti-look-ahead behavior.

`node scripts/validate-data.mjs`: validates the collected real universe, unique symbols, positive prices, ordered unique history dates, valid OHLC relationships and >=120 observations for TAIEX/0050/2330.

`npm run test:e2e`: 6 Playwright workflows × desktop/mobile against the built dist/ artifact. Stop any development server using port 5173 before this command. Tests overview, real-symbol search, weekly switching, missing-field screener behavior, executing backtests, persistent alerts and all research-page layout/error checks. CI uses the committed datasets and never requires markets to be open or provider credentials. Collection is a separate deployment operation.

CI uses the official Ubuntu 24.04 runner's preinstalled stable Google Chrome through Playwright's documented `chrome` channel. This removes an observed browser-download stall and tests the publicly released browser. Local Playwright retains its default Chromium setup. Development also uses the available browser tooling for actual visual inspection and interaction. No claims of stress testing, complete regulatory transaction simulation, independent strategy validation, macOS container execution or security audit are made.

See PROGRESS.md for actually observed run results. New execution rules must include fixture accounting and anti-look-ahead tests. New providers must include schema/missing-data/error fixtures.

Observed GitHub Actions run 39967694637: all 12 desktop/mobile E2E tests passed in 8.9 seconds; tests, collection, build and deploy succeeded. Subsequent date-alignment repair adds a 22nd Node test, bringing the local quantitative/provider total to 29.

Observed run 39969413245: stable Chrome 155; 12/12 E2E tests passed in 38.9s; all three deployment jobs succeeded, with 1,319 securities, 3,840 bars, six macro series and zero collection errors. Production inspection then exposed old module-cache reuse, repaired with content-hashed code assets and a packaging regression test.

Final acceptance run 39970238307: 30 unit/provider/packaging checks and 12 E2E cases passed; the actual dist/ artifact was deployed and independently inspected in the live browser.
