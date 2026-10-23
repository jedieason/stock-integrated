import { test } from "node:test";
import assert from "node:assert/strict";
import * as Q from "../engine.js";
const close = (a, b, epsilon = 1e-8) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const bars = (prices) =>
  prices.map((p, i) => ({
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    open: p,
    high: p + 1,
    low: p - 1,
    close: p,
    volume: 100,
  }));

test("SMA requires full warm-up and propagates missing observations", () => {
  assert.deepEqual(Q.sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  assert.deepEqual(Q.sma([1, null, 3, 4, 5], 3), [null, null, null, null, 4]);
});
test("YoY matches the same calendar month across missing observations", () => {
  const a = [
    { date: "2025-08-01", value: 90 },
    { date: "2025-09-01", value: 100 },
    { date: "2026-09-01", value: 105 },
  ];
  close(Q.yearOverYear(a), 0.05);
  assert.equal(
    Q.yearOverYear([
      { date: "2025-08-01", value: 90 },
      { date: "2026-09-01", value: 105 },
    ]),
    null,
  );
  assert.deepEqual(
    Q.monthlyGaps([
      { date: "2025-09-01", value: 1 },
      { date: "2025-11-01", value: 2 },
    ]),
    ["2025-10"],
  );
});
test("EMA is seeded with the n-observation mean", () =>
  assert.deepEqual(Q.ema([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]));
test("WMA assigns the highest weight to the newest observation", () =>
  close(Q.wma([1, 2, 3], 3)[2], 14 / 6));
test("Wilder RSI handles gain-only, loss-only, flat and warm-up histories", () => {
  assert.equal(Q.last(Q.rsi([1, 2, 3], 2)), 100);
  assert.equal(Q.last(Q.rsi([3, 2, 1], 2)), 0);
  assert.equal(Q.last(Q.rsi([2, 2, 2], 2)), 50);
  assert.deepEqual(Q.rsi([1, 2, 3], 14), [null, null, null]);
  close(Q.rsi([1, 3, 2], 2)[2], 100 - 100 / (1 + 2));
});
test("MACD constant series is zero only after its full warm-up", () => {
  const m = Q.macd(Array(50).fill(100));
  assert.equal(m.histogram[32], null);
  assert.equal(m.histogram[33], 0);
});
test("ATR uses gaps and Wilder smoothing", () => {
  const a = [
    { high: 12, low: 8, close: 10 },
    { high: 15, low: 12, close: 14 },
    { high: 14, low: 10, close: 11 },
  ];
  assert.deepEqual(Q.atr(a, 2), [null, 4.5, 4.25]);
});
test("Bollinger, stochastic and OBV have explicit defined limits", () => {
  const bb = Q.bollinger([5, 5, 5], 3);
  assert.equal(bb.upper[2], 5);
  assert.equal(bb.lower[2], 5);
  assert.deepEqual(Q.obv(bars([10, 12, 11])), [0, 100, 0]);
  assert.equal(Q.stochastic(bars([10, 12, 11]), 3)[2], 50);
});
test("sample volatility and linear returns follow the documented formula", () => {
  const p = [100, 110, 99];
  close(Q.last(Q.volatility(p, 2)), Math.sqrt(0.02) * Math.sqrt(252));
  assert.deepEqual(
    Q.drawdowns([100, 120, 90, 99]),
    [0, 0, -0.25, -0.17500000000000004],
  );
});
test("undefined zero-volatility ratios remain null", () => {
  const m = Q.metrics([100, 100, 100]);
  assert.equal(m.sharpe, null);
  assert.equal(m.sortino, null);
  assert.equal(Q.correlation([1, 1], [2, 3]), null);
  assert.equal(Q.beta([1, 2], [1, 1]), null);
});
test("CAGR uses elapsed calendar time when dates are provided", () => {
  const m = Q.metrics([100, 110], 0, ["2024-01-01", "2025-01-01"]);
  close(m.cagr, 1.1 ** (365.25 / 366) - 1);
});
test("correlation and beta use aligned return observations", () => {
  close(Q.correlation([1, 2, 3], [3, 5, 7]), 1);
  close(Q.beta([2, 4, 6], [1, 2, 3]), 2);
  assert.equal(Q.correlation([1], [1]), null);
});
test("weekly aggregation preserves real OHLC and sums volume", () => {
  const b = bars([10, 11, 12, 13, 14]);
  const w = Q.aggregate(b, "W");
  assert.equal(w[0].open, 10);
  assert.equal(w[0].close, 13);
  assert.equal(w[0].high, 14);
  assert.equal(w[0].volume, 400);
});
test("buy and hold executes at next-session open with exact cash accounting", () => {
  const r = Q.backtest(
    { "0050": bars([10, 10, 20, 20]) },
    {
      initial: 100,
      weights: { "0050": 1 },
      fee: 0,
      sellTax: 0,
      slippage: 0,
      minFee: 0,
      rebalance: "none",
    },
  );
  assert.equal(r.trades.length, 1);
  assert.equal(r.trades[0].date, "2026-01-02");
  assert.equal(r.trades[0].signalDate, "2026-01-01");
  assert.equal(r.trades[0].qty, 10);
  assert.equal(Q.last(r.curve).value, 200);
  assert.equal(r.stats.total, 1);
});
test("fees and slippage lower final wealth and never create negative cash", () => {
  const s = { "0050": bars([10, 12, 13, 14]) };
  const no = Q.backtest(s, {
      initial: 1000,
      fee: 0,
      minFee: 0,
      slippage: 0,
      sellTax: 0,
    }),
    cost = Q.backtest(s, {
      initial: 1000,
      fee: 0.01,
      minFee: 2,
      slippage: 0.01,
      sellTax: 0,
    });
  assert.ok(Q.last(cost.curve).value < Q.last(no.curve).value);
  assert.ok(cost.cost > 0);
  assert.ok(cost.trades.every((t) => t.cash >= -1e-8));
});
test("sell proceeds deduct commissions and tax", () => {
  const r = Q.backtest(
    { "0050": bars([10, 11, 12, 9, 8, 10]) },
    {
      strategy: "trend",
      lookback: 2,
      initial: 10000,
      fee: 0.01,
      sellTax: 0.02,
      slippage: 0,
      minFee: 0,
      rebalance: "none",
    },
  );
  const sell = r.trades.find((t) => t.side === "SELL");
  assert.ok(sell);
  close(sell.tax, sell.qty * sell.price * 0.02);
  assert.ok(r.trades.every((t) => t.signalDate < t.date));
});
test("insufficient funds and no trend signal leave the strategy in cash", () => {
  const r = Q.backtest(
    { "0050": bars([10, 9, 8, 7, 6]) },
    { strategy: "trend", lookback: 2, initial: 1, fee: 0, minFee: 20 },
  );
  assert.equal(r.trades.length, 0);
  assert.equal(Q.last(r.curve).value, 1);
});
test("cash allocation remains uninvested and allocations are validated", () => {
  const r = Q.backtest(
    { "0050": bars([10, 10, 20]) },
    {
      initial: 100,
      weights: { "0050": 0.5 },
      fee: 0,
      minFee: 0,
      slippage: 0,
      rebalance: "none",
    },
  );
  assert.equal(Q.last(r.curve).value, 150);
  assert.throws(() =>
    Q.backtest({ "0050": bars([10, 11, 12]) }, { weights: { "0050": 1.1 } }),
  );
  assert.throws(() =>
    Q.backtest({ "0050": bars([10, 11, 12]) }, { fee: -0.1 }),
  );
});
test("missing trading sessions are aligned by intersection, never forward-filled", () => {
  const a = bars([10, 11, 12, 13, 14]),
    b = bars([10, 11, 12, 13, 14]).filter((_, i) => i !== 2);
  const r = Q.backtest(
    { "0050": a, 2330: b },
    { weights: { "0050": 0.5, 2330: 0.5 }, fee: 0, minFee: 0 },
  );
  assert.ok(!r.dates.includes("2026-01-03"));
  assert.equal(r.dates.length, 4);
});
test("future mutations cannot change historical indicators or executed orders", () => {
  const a = bars(
    Array.from({ length: 100 }, (_, i) => 50 + i * 0.1 + Math.sin(i / 4)),
  );
  const b = a.map((x, i) =>
    i > 60
      ? {
          ...x,
          open: x.open * 2,
          high: x.high * 2,
          low: x.low * 2,
          close: x.close * 2,
        }
      : x,
  );
  assert.equal(
    Q.signalAt(a, 45, { strategy: "trend", lookback: 20 }),
    Q.signalAt(b, 45, { strategy: "trend", lookback: 20 }),
  );
  const c = {
      strategy: "trend",
      lookback: 20,
      initial: 10000,
      fee: 0.001,
      minFee: 0,
    },
    r1 = Q.backtest({ "0050": a }, c),
    r2 = Q.backtest({ "0050": b }, c);
  assert.deepEqual(
    r1.trades.filter((x) => x.date <= a[60].date),
    r2.trades.filter((x) => x.date <= a[60].date),
  );
});
test("momentum switching uses previous observations and is reproducible", () => {
  const s = {
    "0050": bars(Array.from({ length: 80 }, (_, i) => 50 + i)),
    2330: bars(Array.from({ length: 80 }, (_, i) => 50 + i * 2)),
  };
  const c = {
    strategy: "switch",
    lookback: 20,
    initial: 10000,
    fee: 0,
    minFee: 0,
    slippage: 0,
  };
  const a = Q.backtest(s, c),
    b = Q.backtest(s, c);
  assert.deepEqual(a, b);
  assert.equal(a.trades[0].symbol, "2330");
  assert.ok(a.trades.every((t) => t.signalDate < t.date));
});
test("research baseline discloses its identity and missing inputs", () => {
  const r = Q.researchReport(
    "test",
    bars(Array.from({ length: 130 }, (_, i) => 100 + i)),
  );
  assert.equal(r.regime, "上升趨勢");
  assert.equal(r.status, "PARTIAL_EVIDENCE");
  assert.equal(r.version, "baseline-trend-v1");
  assert.ok(r.missing.length);
  assert.equal(
    Q.researchReport("test", bars([1, 2, 3])).status,
    "INSUFFICIENT_DATA",
  );
});
