# Engineering conventions

- User requirements: Traditional Chinese, light UI, Taiwan first, repo `stock-integrated`, GitHub Pages + Actions. Preserve these choices.
- Frontend is native ES modules and SVG. `engine.js` contains pure quantitative functions; `app.js` contains UI and browser-local state. Python in `scripts/update_data.py` is the batch data backend.
- Never fabricate market data, fill missing prices, substitute markets, or claim intraday/adjusted-price coverage. Use null for undefined statistics and full indicator warm-up.
- Preserve provider provenance and dates. Keep previously validated history when a source fails. No credentials in browser files, data JSON or Git.
- Backtests observe prior-session signals and execute at the next common-session open. Test accounting, costs and future-data mutation whenever execution rules change.
- Run `npm test`, `node scripts/validate-data.mjs`, `npm run build` after relevant changes. CI runs Playwright on desktop and mobile. Do not claim tests ran unless observed.
- Read `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, `docs/QUANT_METHODS.md`, `docs/BACKTEST_ASSUMPTIONS.md` before changing the respective subsystem.
- Keep `docs/PROGRESS.md` and known limitations accurate. Do not silently reinterpret a future imported user market-regime specification.
