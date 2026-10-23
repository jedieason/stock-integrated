import { icon } from "./icons.js";
import * as Q from "./engine.js";

const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const n = (v, d = 2) =>
  v == null || !Number.isFinite(+v)
    ? "—"
    : (+v).toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
const signed = (v, d = 2) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${n(v, d)}`;
const pct = (v, d = 2) => (v == null ? "—" : `${signed(v * 100, d)}%`);
const tone = (v) => (v > 0 ? "up" : v < 0 ? "down" : "muted");
const compact = (v) =>
  v == null
    ? "—"
    : v >= 1e12
      ? n(v / 1e12, 2) + " 兆"
      : v >= 1e8
        ? n(v / 1e8, 1) + " 億"
        : v >= 1e4
          ? n(v / 1e4, 1) + " 萬"
          : n(v, 0);
const load = (k, f) => {
  try {
    return JSON.parse(localStorage.getItem("twave:" + k)) ?? f;
  } catch {
    return f;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem("twave:" + k, JSON.stringify(v));
  } catch {
    toast("瀏覽器儲存空間不足，設定未儲存。");
  }
};
const state = {
  route: "overview",
  symbol: load("symbol", "TAIEX"),
  range: load("range", 132),
  interval: load("interval", "D"),
  chartType: load("chartType", "candles"),
  indicators: load("indicators", ["ma5", "ma20", "ma60", "volume"]),
  pan: 0,
  watch: load("watch", [
    "2330",
    "2317",
    "2454",
    "2308",
    "2382",
    "0050",
    "00878",
  ]),
  alerts: load("alerts", []),
  reports: load("reports", []),
  filters: load("filters", {}),
  sort: "turnover",
  sortAsc: false,
  page: 1,
  watchTab: "watch",
  heatSize: "marketCap",
  heatSector: "all",
  compare: ["0050", "2330", "00646"],
  screenLogic: "AND",
  result: null,
  resultTab: "equity",
  searchMode: "chart",
  log: false,
};
let market,
  history,
  macro,
  stocks,
  features = {},
  chartModels = new Map(),
  toastTimer;
const routes = [
  ["overview", "市場總覽", "grid"],
  ["charts", "技術圖表", "candles"],
  ["screener", "智慧選股", "filter"],
  ["heatmap", "市場熱力圖", "heat"],
  ["macro", "總經與輪動", "globe"],
  ["compare", "資產比較", "chart"],
  ["backtest", "策略與投組回測", "portfolio"],
  ["research", "量化研究", "spark"],
];
const personal = [
  ["watchlist", "自選清單", "star"],
  ["alerts", "價格警示", "bell"],
];
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
function routeTo(path) {
  if (location.hash === "#/" + path) render();
  else location.hash = "/" + path;
}
function stock(symbol) {
  if (symbol === "TAIEX") {
    const a = market?.indices.find((x) => x.name === "發行量加權股價指數");
    return {
      symbol: "TAIEX",
      name: "加權指數",
      sector: "市場指數",
      type: "指數",
      currency: "TWD",
      ...a,
      name: "加權指數",
    };
  }
  return stocks?.find((s) => s.symbol === symbol);
}
const barsFor = (s) => history?.series[s] || [];
function stockOptions(selected, onlyHistory = true) {
  const arr = onlyHistory
    ? Object.keys(history.series)
        .filter((s) => s !== "TAIEX")
        .map(stock)
        .filter(Boolean)
    : stocks;
  return arr
    .map(
      (s) =>
        `<option value="${esc(s.symbol)}" ${s.symbol === selected ? "selected" : ""}>${esc(s.symbol)} ${esc(s.name)}</option>`,
    )
    .join("");
}
function button(text, action, ic = "", cls = "") {
  return `<button class="btn ${cls}" data-action="${action}">${ic ? icon(ic) : ""}${text}</button>`;
}
function notice(text, amber = false) {
  return `<div class="notice ${amber ? "amber" : ""}">${icon("info")}<div>${text}</div></div>`;
}
function empty(title, description, action = "") {
  return `<div class="empty">${icon("database", 27)}<h3>${title}</h3><p>${description}</p>${action}</div>`;
}
function heading(
  title,
  sub,
  actions = "",
  label = "TAIWAN MARKET INTELLIGENCE",
) {
  return `<div class="page-head"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p class="page-sub">${sub}</p></div><div class="head-actions">${actions}</div></div>`;
}
function sidebar() {
  const link = ([id, title, ic]) =>
    `<a href="#/${id}" class="${state.route === id ? "active" : ""}" title="${title}" ${state.route === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${title}</span>${id === "research" ? "<em>BETA</em>" : id === "watchlist" ? `<b class="nav-count">${state.watch.length}</b>` : ""}</a>`;
  $("#sidebar").innerHTML =
    `<a class="brand" href="#/overview"><img src="./favicon.svg" alt=""><div><strong>TWAVE<span style="color:var(--accent)">.</span></strong><small>台股整合研究台</small></div></a><button class="workspace" data-action="workspace"><span class="workspace-avatar">${icon("grid", 14)}</span><span><strong>個人研究工作區</strong><small>Personal workspace</small></span>${icon("down", 12)}</button><div class="nav-label">研究工作台</div><nav class="nav">${routes.map(link).join("")}</nav><div class="nav-label">我的空間</div><nav class="nav">${personal.map(link).join("")}</nav><div class="sidebar-bottom"><nav class="nav">${link(["data-quality", "資料品質", "database"])}${link(["settings", "設定與資料來源", "settings"])}</nav><button class="data-health" data-action="quality"><div class="data-health-title"><i class="dot"></i>官方資料・每日更新</div><p>GitHub Actions 驅動 ${icon("external", 9)}</p></button><button class="profile" data-action="settings"><div class="avatar">JE</div><div><strong>我的研究工作區</strong><small>本機個人設定</small></div>${icon("more", 16)}</button></div>`;
}
function topbar() {
  const title =
    [
      ...routes,
      ...personal,
      ["data-quality", "資料品質"],
      ["settings", "設定與資料來源"],
    ].find((r) => r[0] === state.route)?.[1] || "市場總覽";
  $("#topbar").innerHTML =
    `<button class="icon-btn mobile-menu" data-action="menu" aria-label="開啟選單">${icon("menu")}</button><div class="breadcrumb">工作台 ${icon("chevron", 10)}<span>${title}</span></div><button class="global-search" data-action="search">${icon("search", 15)}<span>搜尋股票、ETF 或代碼</span><kbd>⌘ K</kbd></button><div class="top-spacer"></div><button class="market-status" data-action="sources"><i class="dot"></i>日終行情 <span class="num">${market.observationDate.slice(5).replace("-", "/")}</span></button><div class="top-divider"></div><button class="icon-btn sun-btn" data-action="appearance" aria-label="介面設定">${icon("sun", 18)}</button><button class="icon-btn ${state.alerts.length ? "notify" : ""}" data-action="alerts" aria-label="價格警示">${icon("bell", 18)}</button><button class="avatar" data-action="settings" aria-label="個人設定">JE</button>`;
}
function footer() {
  const total = stocks.length;
  $("#footer").innerHTML =
    `<div class="footer-line"><span><i class="dot" style="width:4px;height:4px"></i>TWSE 官方日終資料 · ${market.observationDate} · ${n(total, 0)} 檔標的 · Asia/Taipei</span><span>僅供研究，非投資建議 <a href="https://github.com/jedieason/stock-integrated" target="_blank" rel="noopener">GitHub ${icon("external", 9)}</a></span></div>`;
}
function sparkline(values, color = "var(--accent)", fill = true) {
  if (values.length < 2) return "";
  const w = 200,
    h = 64,
    min = Math.min(...values),
    max = Math.max(...values),
    span = max - min || 1,
    points = values.map((v, i) => [
      (i / (values.length - 1)) * w,
      h - 5 - ((v - min) / span) * (h - 12),
    ]);
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${fill ? `<path d="${path} L${w},${h} L0,${h} Z" fill="${color}" opacity=".06"/>` : ""}<path d="${path}" stroke="${color}" stroke-width="1.7" vector-effect="non-scaling-stroke" fill="none"/></svg>`;
}
function indices() {
  return `<div class="index-grid">${["TAIEX", "0050", "2330", "00646"]
    .map((symbol) => {
      const s = stock(symbol);
      if (!s) return "";
      const b = barsFor(symbol).slice(-30);
      return `<button class="index-card" data-stock="${symbol}"><div class="index-top">${symbol === "TAIEX" ? "加權指數" : esc(s.name)} <span class="index-tag">${symbol === "TAIEX" ? "TAIEX" : symbol}</span></div><div class="index-price num">${n(s.price)}</div><div class="index-change num ${tone(s.pct)}"><span>${s.pct > 0 ? "↗" : "↘"} ${signed(s.change)}</span><span>${signed(s.pct)}%</span></div>${sparkline(
        b.map((x) => x.close),
        s.pct >= 0 ? "var(--up)" : "var(--down)",
      )}</button>`;
    })
    .join("")}</div>`;
}
function overview() {
  const report = Q.researchReport("TAIEX", barsFor("TAIEX"));
  return `${heading("市場總覽", "從市場全貌，找到下一個研究方向。", `<span class="badge optional">${icon("clock", 11)} ${market.observationDate.replaceAll("-", " / ")}</span>${button("台灣市場", "market", "globe")}${button("重新整理", "refresh", "refresh")}`)}<div class="tabs"><button class="tab active">總覽</button><button class="tab" data-action="breadth">市場廣度</button><a class="tab" href="#/compare">相對強弱</a><span class="tab-end"><i class="dot" style="width:4px;height:4px"></i>證交所最新可用日終資料</span></div>${indices()}<div class="overview-main">${chartPanel("TAIEX", false)}${watchPanel()}</div><div class="overview-bottom"><section class="panel"><div class="panel-head"><div class="title-line"><h2>市場熱力圖</h2><span class="badge">上市股票</span></div><a class="link-btn" href="#/heatmap">探索全市場 ${icon("arrow")}</a></div><div class="heatmap" data-heat="overview"></div>${heatLegend()}</section>${breadthPanel()}</div><div class="section-row"><section class="panel"><div class="panel-head"><div><h2>產業表現</h2><p>依可用市值加權・單日漲跌幅</p></div><a class="link-btn" href="#/macro">總經與輪動 ${icon("arrow")}</a></div>${sectorList(5)}</section><section class="panel insight-panel"><span class="insight-icon">${icon("spark", 19)}</span><div><div class="title-line"><h3>用證據，理解市場的下一步</h3></div><p>目前基準趨勢：<strong style="color:var(--text)">${esc(report.regime || "資料不足")}</strong>。將均線、動能與波動轉為可追溯的研究觀察，同時保留反方證據與失效條件。</p><button class="link-btn" data-action="research">開啟量化研究 ${icon("arrow")}</button><span class="badge" style="margin-top:14px">規則式研究 · 不需要 AI API 金鑰</span></div></section></div>`;
}
function chartPanel(symbol, large = true) {
  const s = stock(symbol) || { name: symbol, symbol };
  const b = barsFor(symbol),
    current = Q.last(b),
    price = current?.close ?? s.price,
    prev = b.length > 1 ? b[b.length - 2].close : null,
    change = prev ? price - prev : s.change,
    pc = prev ? (change / prev) * 100 : s.pct;
  return `<section class="panel chart-panel"><div class="chart-head"><div><div class="chart-title"><h2>${esc(s.name)}</h2><small>${esc(symbol === "TAIEX" ? "TAIEX" : symbol)} · ${state.interval === "D" ? "1D" : state.interval === "W" ? "1W" : "1M"} · TWSE</small><span class="badge">日終</span></div><div class="chart-price num"><strong>${n(price)}</strong><span class="${tone(change)}">${signed(change)} (${signed(pc)}%)</span></div><div class="chart-meta">${current?.date || s.date || market.observationDate} ${symbol === "TAIEX" ? "指數・單位：點" : "收盤・TWD"} · 未還原權息</div></div><div class="chart-controls"><div class="segmented">${["D", "W", "M"].map((t, i) => `<button data-interval="${t}" class="${state.interval === t ? "active" : ""}">${["日", "週", "月"][i]}</button>`).join("")}</div><button class="icon-btn" data-action="indicators" title="技術指標" aria-label="技術指標">${icon("filter", 16)}</button><button class="icon-btn" data-action="expand" aria-label="放大圖表" title="放大圖表">${icon("expand", 15)}</button></div></div><div class="chart-toolbar">${[
    ["ma5", "#cfac6f", "MA 5"],
    ["ma20", "#7395b1", "MA 20"],
    ["ma60", "#a38cbb", "MA 60"],
  ]
    .map(
      ([id, color, label]) =>
        `<button class="legend-item" data-indicator="${id}" style="opacity:${state.indicators.includes(id) ? 1 : 0.35}"><i class="legend-dot" style="background:${color}"></i>${label}</button>`,
    )
    .join(
      "",
    )}<div class="right"><button class="legend-item" data-action="chart-type">${icon(state.chartType === "candles" ? "candles" : "chart", 13)}${state.chartType === "candles" ? "K 線" : "線圖"}</button>${large ? `<button data-action="chart-export" title="下載圖表">${icon("download", 13)}</button>` : ""}</div></div><div class="chart-host ${large ? "large" : ""}" data-chart="${esc(symbol)}"></div>${large ? '<div class="mini-chart" data-indicator-chart></div>' : ""}<div class="chart-bottom"><div class="periods">${[
    [22, "1M"],
    [66, "3M"],
    [132, "6M"],
    [252, "1Y"],
    [9999, "全部"],
  ]
    .map(
      ([r, l]) =>
        `<button data-range="${r}" class="${state.range === r ? "active" : ""}">${l}</button>`,
    )
    .join(
      "",
    )}</div><span class="small">${large ? "滾輪縮放 · 拖曳平移 · " : ""}${n(b.length, 0)} 筆日線 <button data-action="chart-fit" title="重設範圍">${icon("expand", 10)}</button></span></div></section>`;
}
function watchPanel() {
  const a =
    state.watchTab === "watch"
      ? state.watch.map(stock).filter(Boolean)
      : [...stocks]
          .sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity))
          .slice(0, 7);
  return `<section class="panel watch-panel"><div class="panel-head"><h2>我的市場</h2><button class="icon-btn" data-action="add-watch" aria-label="新增自選股">${icon("plus", 16)}</button></div><div class="watch-tabs"><button data-watchtab="watch" class="${state.watchTab === "watch" ? "active" : ""}">自選清單 <span class="tiny muted">${state.watch.length}</span></button><button data-watchtab="movers" class="${state.watchTab === "movers" ? "active" : ""}">市場焦點</button></div><table class="watch-table"><thead><tr><th>標的</th><th>收盤價</th><th>漲跌幅</th></tr></thead><tbody>${a
    .slice(0, 7)
    .map(
      (s) =>
        `<tr data-stock="${s.symbol}" tabindex="0"><td><div class="stock-cell"><div class="stock-logo ${s.symbol === "2330" ? "tsmc" : ""}">${s.symbol === "2330" ? "tsmc" : s.symbol === "2317" ? "FOX" : s.symbol === "2454" ? "MTK" : s.type === "ETF" ? "ETF" : s.name.slice(0, 1)}</div><span class="stock-symbol num">${esc(s.symbol)}<span class="stock-name">${esc(s.name)}</span></span></div></td><td class="num">${n(s.price)}</td><td class="num ${tone(s.pct)}">${signed(s.pct)}%</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table>${a.length ? "" : empty("還沒有自選股", "按右上方的＋加入關注標的。")}<button class="watch-footer" data-action="watchlist">查看完整清單 ${icon("arrow", 12)}</button></section>`;
}
function breadth() {
  const universe = stocks.filter(
    (s) => s.type === "股票" && s.date === market.observationDate,
  );
  return {
    universe,
    up: universe.filter((s) => s.pct > 0).length,
    down: universe.filter((s) => s.pct < 0).length,
    flat: universe.filter((s) => s.pct === 0).length,
    missing: universe.filter((s) => s.pct == null).length,
  };
}
function breadthPanel() {
  const b = breadth(),
    total = b.up + b.down + b.flat,
    up = (b.up / total) * 100,
    down = (b.down / total) * 100,
    turn = b.universe.reduce((v, s) => v + (s.turnover || 0), 0);
  return `<section class="panel breadth-panel"><div class="panel-head"><h2>市場廣度</h2><span class="badge">上市股票</span></div><div class="breadth-main"><div class="breadth-donut" style="background:conic-gradient(var(--up) 0% ${up}%,var(--down) ${up}% ${up + down}%,#dce2e7 ${up + down}% 100%)"><div class="donut-label num"><strong>${n(up, 0)}<small style="font-size:11px">%</small></strong><span>上漲家數占比</span></div></div><div class="breadth-legend">${[
    ["上漲", b.up, "var(--up)"],
    ["下跌", b.down, "var(--down)"],
    ["平盤", b.flat, "#b7c1ca"],
  ]
    .map(
      ([l, v, c]) =>
        `<div><span class="legend-item"><i class="legend-dot" style="background:${c}"></i>${l}</span><strong class="num">${n(v, 0)}</strong></div>`,
    )
    .join(
      "",
    )}</div></div><div class="breadth-bar"><i style="background:var(--up);width:${up}%"></i><i style="background:var(--down);width:${down}%"></i><i style="background:#dce2e7;flex:1"></i></div><div class="breadth-foot"><div><span>漲跌家數比 A/D</span><strong class="num">${b.down ? n(b.up / b.down, 2) : "—"}</strong></div><div><span>股票成交金額</span><strong class="num">${n(turn / 1e8, 0)} <small style="font-size:9px;font-weight:400">億</small></strong></div><div><span>有效樣本</span><strong class="num">${total}</strong></div></div><div class="help-text" style="padding:0 18px 12px;font-size:8px">不含 ETF、上櫃與無漲跌資料 ${b.missing} 檔。</div></section>`;
}
function sectorData() {
  const groups = {};
  for (const s of stocks.filter(
    (s) =>
      s.type === "股票" &&
      s.marketCap &&
      s.pct != null &&
      s.date === market.observationDate,
  )) {
    const v = (groups[s.sector] ??= {
      sector: s.sector,
      cap: 0,
      total: 0,
      count: 0,
    });
    v.cap += s.marketCap;
    v.total += s.marketCap * s.pct;
    v.count++;
  }
  return Object.values(groups)
    .map((s) => ({ ...s, pct: s.total / s.cap }))
    .sort((a, b) => b.pct - a.pct);
}
function sectorList(count = 12) {
  const sectors = sectorData();
  const show =
      count === 5
        ? [...sectors.slice(0, 3), ...sectors.slice(-2)]
        : sectors.slice(0, count),
    max = Math.max(...sectors.map((s) => Math.abs(s.pct)), 1);
  return `<div class="sectors-list">${show.map((s) => `<button class="sector-row" style="width:100%" data-sector="${esc(s.sector)}"><span class="label">${esc(s.sector)}</span><span class="sector-track"><span style="width:${Math.max(2, (Math.abs(s.pct) / max) * 100)}%;background:${s.pct >= 0 ? "var(--up)" : "var(--down)"}"></span></span><span class="value num ${tone(s.pct)}">${signed(s.pct)}%</span></button>`).join("")}</div>`;
}
const heatColor = (v) =>
  v == null
    ? "#b4bdc3"
    : v >= 3
      ? "#b64f57"
      : v >= 1
        ? "#cf7479"
        : v > 0
          ? "#d89d9f"
          : v === 0
            ? "#a5afb8"
            : v > -1
              ? "#7fb4a5"
              : v > -3
                ? "#4e9d89"
                : "#25846e";
function heatLegend() {
  return `<div class="heat-legend"><span>面積：${state.heatSize === "marketCap" ? "市值" : "成交金額"} · 色彩：單日漲跌幅</span><div class="heat-scale">${[-3, -2, -1, 0, 1, 2, 3].map((v) => `<i style="background:${heatColor(v)}">${v > 0 ? "+" : ""}${v}%</i>`).join("")}</div></div>`;
}
function partition(items, x, y, w, h) {
  if (!items.length) return [];
  if (items.length === 1) return [{ item: items[0], x, y, w, h }];
  const total = items.reduce((s, a) => s + a.value, 0);
  let sum = 0,
    split = 1;
  for (let i = 0; i < items.length - 1; i++) {
    sum += items[i].value;
    split = i + 1;
    if (sum >= total / 2) break;
  }
  const a = items.slice(0, split),
    b = items.slice(split),
    fraction = a.reduce((s, a) => s + a.value, 0) / total;
  return w >= h
    ? [
        ...partition(a, x, y, w * fraction, h),
        ...partition(b, x + w * fraction, y, w * (1 - fraction), h),
      ]
    : [
        ...partition(a, x, y, w, h * fraction),
        ...partition(b, x, y + h * fraction, w, h * (1 - fraction)),
      ];
}
function drawHeatmaps() {
  for (const el of $$("[data-heat]")) {
    const full = el.dataset.heat === "full";
    const metric = state.heatSize;
    const arr = stocks
      .filter(
        (s) =>
          s.type === "股票" &&
          s[metric] > 0 &&
          s.date === market.observationDate &&
          (state.heatSector === "all" || s.sector === state.heatSector),
      )
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, full ? 130 : 55);
    const groups = {};
    for (const s of arr) {
      const g = (groups[s.sector] ??= { name: s.sector, value: 0, stocks: [] });
      g.value += s[metric];
      g.stocks.push({ ...s, value: s[metric] });
    }
    const w = el.clientWidth,
      h = el.clientHeight;
    el.innerHTML = partition(
      Object.values(groups).sort((a, b) => b.value - a.value),
      0,
      0,
      w,
      h,
    )
      .map(
        ({ item: g, x, y, w, h }) =>
          `<div class="heat-sector" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><div class="heat-sector-label">${esc(g.name)}</div>${partition(
            g.stocks,
            0,
            0,
            w - 2,
            Math.max(1, h - 18),
          )
            .map(
              ({ item: s, x, y, w, h }) =>
                `<button class="heat-stock" style="left:${x}px;top:${y + 16}px;width:${w}px;height:${h}px;background:${heatColor(s.pct)}" data-stock="${esc(s.symbol)}" title="${esc(s.symbol + " " + s.name)}｜${n(s.price)}｜${signed(s.pct)}%｜${metric === "marketCap" ? "市值" : "成交額"} ${compact(s[metric])}">${w > 35 && h > 22 ? `<strong style="font-size:${w > 150 && h > 100 ? 27 : w > 80 && h > 45 ? 17 : 11}px">${esc(s.symbol)}</strong>${h > 45 ? `<span>${w > 75 ? esc(s.name) : ""}</span>` : ""}${h > 32 ? `<small>${signed(s.pct)}%</small>` : ""}` : ""}</button>`,
            )
            .join("")}</div>`,
      )
      .join("");
  }
}
function drawCharts() {
  chartModels.clear();
  for (const el of $$("[data-chart]")) drawChart(el);
  for (const el of $$("[data-indicator-chart]")) drawIndicator(el);
}
function drawChart(el) {
  const symbol = el.dataset.chart,
    bars = Q.aggregate(barsFor(symbol), state.interval),
    w = 960,
    h = el.classList.contains("large") ? 470 : 303,
    left = 12,
    right = 75,
    top = 19,
    bottom = 28,
    vol =
      state.indicators.includes("volume") && bars.some((b) => b.volume != null)
        ? 55
        : 0,
    priceBottom = h - bottom - vol - 15,
    pw = w - left - right,
    ph = priceBottom - top;
  if (!bars.length) {
    el.innerHTML = `<div class="chart-empty"><div>此標的尚未回補歷史日線。<br><span class="small">目前可用收盤快照；可在資料品質頁查看核心標的歷史涵蓋。</span><br>${button("查看涵蓋範圍", "quality", "database", "small")}</div></div>`;
    return;
  }
  const count = Math.min(bars.length, Math.max(10, state.range)),
    end = Math.max(count, bars.length - state.pan),
    start = Math.max(0, end - count),
    visible = bars.slice(start, end),
    prices = bars.map((b) => b.close),
    averages = [
      [5, "#c8a16c", "ma5"],
      [20, "#7395b1", "ma20"],
      [60, "#a38cbb", "ma60"],
    ]
      .filter((x) => state.indicators.includes(x[2]))
      .map(([p, c, id]) => ({ p, c, id, values: Q.sma(prices, p) })),
    bb = state.indicators.includes("bb") ? Q.bollinger(prices) : null;
  const vals = visible.flatMap((b) => [b.low, b.high]);
  for (const a of averages)
    vals.push(...a.values.slice(start, end).filter((v) => v != null));
  if (bb)
    vals.push(
      ...bb.upper.slice(start, end).filter((v) => v != null),
      ...bb.lower.slice(start, end).filter((v) => v != null),
    );
  let lo = Math.min(...vals),
    hi = Math.max(...vals),
    pad = (hi - lo) * 0.12 || hi * 0.01;
  lo -= pad;
  hi += pad;
  const y = (v) =>
      state.log
        ? top +
          ((Math.log(hi) - Math.log(v)) /
            (Math.log(hi) - Math.log(Math.max(lo, 0.01)))) *
            ph
        : top + ((hi - v) / (hi - lo)) * ph,
    x = (i) => left + ((i + 0.5) / visible.length) * pw,
    bw = Math.max(1, (pw / visible.length) * 0.58),
    maxVol = Math.max(...visible.map((b) => b.volume || 0), 1);
  const grid = Array.from({ length: 6 }, (_, i) => {
    const pos = top + (ph * i) / 5,
      value = state.log
        ? Math.exp(
            Math.log(hi) -
              ((Math.log(hi) - Math.log(Math.max(lo, 0.01))) * i) / 5,
          )
        : hi - ((hi - lo) * i) / 5;
    return `<line x1="${left}" y1="${pos}" x2="${w - right}" y2="${pos}" stroke="#edf0f3" stroke-dasharray="3 4"/><text x="${w - right + 14}" y="${pos + 3}" fill="#9aa5b0" font-size="10">${n(value, hi > 100 ? 0 : 2)}</text>`;
  }).join("");
  const path = (values) => {
    let prev = false;
    return values
      .map((v, i) => {
        if (v == null) {
          prev = false;
          return "";
        }
        const p = `${prev ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`;
        prev = true;
        return p;
      })
      .join(" ");
  };
  const priceLine = path(visible.map((b) => b.close));
  const candle =
    state.chartType === "candles"
      ? visible
          .map((b, i) => {
            const color = b.close >= b.open ? "#d86e75" : "#4aa28e";
            return `<line x1="${x(i)}" x2="${x(i)}" y1="${y(b.high)}" y2="${y(b.low)}" stroke="${color}" stroke-width="1"/><rect x="${x(i) - bw / 2}" y="${Math.min(y(b.open), y(b.close))}" width="${bw}" height="${Math.max(1, Math.abs(y(b.close) - y(b.open)))}" fill="${color}" rx=".5"/>`;
          })
          .join("")
      : `<path d="${priceLine} L${x(visible.length - 1)} ${priceBottom} L${x(0)} ${priceBottom} Z" fill="url(#area-${symbol})"/><path d="${priceLine}" fill="none" stroke="#16877c" stroke-width="2"/>`;
  const volume = vol
    ? visible
        .map((b, i) =>
          b.volume == null
            ? ""
            : `<rect x="${x(i) - bw / 2}" y="${h - bottom - 9 - (b.volume / maxVol) * vol}" width="${bw}" height="${Math.max(0.5, (b.volume / maxVol) * vol)}" fill="${b.close >= b.open ? "#df9ba1" : "#8ec6b7"}" opacity=".68"/>`,
        )
        .join("")
    : "";
  const axis = Array.from({ length: Math.min(6, visible.length) }, (_, j) => {
    const i = Math.round((j * (visible.length - 1)) / 5);
    return `<text x="${x(i)}" y="${h - 10}" text-anchor="middle" fill="#9ba6b1" font-size="10">${visible[i].date.slice(5).replace("-", "/")}</text>`;
  }).join("");
  const close = Q.last(visible).close,
    cy = y(close),
    closeColor =
      Q.last(visible).close >= Q.last(visible).open ? "#d5656d" : "#3f9a85";
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(stock(symbol)?.name || symbol)}真實${state.interval === "D" ? "日" : state.interval === "W" ? "週" : "月"}線價格圖"><defs><linearGradient id="area-${symbol}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#16877c" stop-opacity=".13"/><stop offset="1" stop-color="#16877c" stop-opacity=".01"/></linearGradient><clipPath id="clip-${symbol}"><rect x="${left}" y="0" width="${pw}" height="${h - bottom}"/></clipPath></defs>${grid}<g clip-path="url(#clip-${symbol})">${bb ? [bb.upper, bb.lower].map((a) => `<path d="${path(a.slice(start, end))}" fill="none" stroke="#9db8b0" stroke-dasharray="4 3" opacity=".7"/>`).join("") : ""}${candle}${averages.map((a) => `<path d="${path(a.values.slice(start, end))}" fill="none" stroke="${a.c}" stroke-width="1.35"/>`).join("")}${volume}<line x1="${left}" x2="${w - right}" y1="${cy}" y2="${cy}" stroke="${closeColor}" stroke-dasharray="3 4" opacity=".6"/></g><rect x="${w - right + 3}" y="${cy - 9}" width="70" height="18" fill="${closeColor}" rx="3"/><text x="${w - right + 38}" y="${cy + 3}" fill="white" text-anchor="middle" font-size="10">${n(close, close > 1000 ? 0 : 2)}</text>${axis}${vol ? `<text x="${left + 4}" y="${h - bottom - vol - 9}" font-size="9" fill="#a1acb6">VOL</text>` : ""}<g class="crosshair" visibility="hidden"><line class="cross-x" y1="${top}" y2="${h - bottom}" stroke="#9aabb5" stroke-dasharray="4 4"/><line class="cross-y" x1="${left}" x2="${w - right}" stroke="#9aabb5" stroke-dasharray="4 4"/></g><text x="${left + 6}" y="${top + 28}" font-size="26" font-weight="600" fill="#203b4a" opacity=".035">TWAVE</text></svg><div class="chart-tooltip"></div>`;
  chartModels.set(el, { symbol, visible, x, y, w, h, start, bars });
  const svg = $("svg", el),
    tip = $(".chart-tooltip", el),
    cross = $(".crosshair", el);
  let drag = null,
    moved = false;
  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect(),
      px = ((e.clientX - r.left) / r.width) * w,
      py = ((e.clientY - r.top) / r.height) * h,
      i = Math.max(
        0,
        Math.min(
          visible.length - 1,
          Math.floor(((px - left) / pw) * visible.length),
        ),
      ),
      b = visible[i];
    cross.setAttribute("visibility", "visible");
    $(".cross-x", cross).setAttribute("x1", x(i));
    $(".cross-x", cross).setAttribute("x2", x(i));
    $(".cross-y", cross).setAttribute("y1", py);
    $(".cross-y", cross).setAttribute("y2", py);
    tip.style.display = "block";
    tip.style.left =
      Math.min(r.width - 162, Math.max(8, e.clientX - r.left + 15)) + "px";
    tip.style.top =
      Math.max(6, Math.min(r.height - 125, e.clientY - r.top - 110)) + "px";
    tip.innerHTML = `<strong class="num">${b.date}</strong><br>開 ${n(b.open)}　高 ${n(b.high)}<br>低 ${n(b.low)}　收 <b class="${tone(b.close - b.open)}">${n(b.close)}</b><br>成交量 ${b.volume == null ? "—" : compact(b.volume) + " 股"}`;
    if (drag != null && Math.abs(e.clientX - drag) > 8) moved = true;
  });
  svg.addEventListener("pointerleave", () => {
    cross.setAttribute("visibility", "hidden");
    tip.style.display = "none";
  });
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      state.range = Math.max(
        10,
        Math.min(
          bars.length,
          Math.round(
            Math.min(state.range, bars.length) * (e.deltaY > 0 ? 1.2 : 0.8),
          ),
        ),
      );
      drawCharts();
    },
    { passive: false },
  );
  svg.addEventListener("pointerdown", (e) => {
    drag = e.clientX;
    moved = false;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointerup", (e) => {
    if (drag != null && moved) {
      state.pan = Math.max(
        0,
        Math.min(
          bars.length - Math.min(state.range, bars.length),
          state.pan +
            Math.round(
              ((e.clientX - drag) / svg.clientWidth) *
                Math.min(state.range, bars.length),
            ),
        ),
      );
      drawCharts();
    }
    drag = null;
  });
}
function drawIndicator(el) {
  const bars = Q.aggregate(barsFor(state.symbol), state.interval),
    c = bars.map((b) => b.close),
    range = Math.min(state.range, c.length),
    end = Math.max(range, c.length - state.pan),
    start = Math.max(0, end - range),
    showMacd = state.indicators.includes("macd");
  if (!c.length) {
    el.innerHTML = "";
    return;
  }
  const values = showMacd ? Q.macd(c).histogram : Q.rsi(c),
    slice = values.slice(start, end),
    w = 960,
    h = 105,
    left = 16,
    right = 75,
    top = 20,
    pw = w - left - right,
    valid = slice.filter((v) => v != null);
  if (!valid.length) {
    el.innerHTML =
      '<div class="help-text" style="padding:15px">' +
      (showMacd ? "MACD" : "RSI") +
      " 暖機資料不足。</div>";
    return;
  }
  const min = showMacd ? Math.min(...valid, 0) : 0,
    max = showMacd ? Math.max(...valid, 0) : 100,
    yy = (v) => top + ((max - v) / (max - min || 1)) * 62;
  const chart = showMacd
    ? slice
        .map((v, i) =>
          v == null
            ? ""
            : `<rect x="${left + (i / slice.length) * pw}" y="${Math.min(yy(0), yy(v))}" width="${Math.max(1, (pw / slice.length) * 0.65)}" height="${Math.max(0.5, Math.abs(yy(v) - yy(0)))}" fill="${v >= 0 ? "#da8b91" : "#78b9a7"}"/>`,
        )
        .join("")
    : `<path d="${slice.map((v, i) => (v == null ? "" : `${i && slice[i - 1] != null ? "L" : "M"}${left + (i / (slice.length - 1 || 1)) * pw} ${yy(v)}`)).join(" ")}" stroke="#a38cbb" stroke-width="1.5" fill="none"/>`;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><text x="16" y="13" fill="#9ba5af" font-size="9">${showMacd ? "MACD (12, 26, 9) Histogram" : "RSI (14)"}　${n(Q.last(valid), 2)}</text>${(showMacd ? [0] : [30, 70]).map((v) => `<line x1="${left}" x2="${w - right}" y1="${yy(v)}" y2="${yy(v)}" stroke="#e8ecf0" stroke-dasharray="4 3"/><text x="${w - right + 10}" y="${yy(v) + 3}" font-size="9" fill="#a2adb6">${v}</text>`).join("")}${chart}</svg>`;
}
function charts() {
  const s = stock(state.symbol),
    f = features[state.symbol] || {},
    b = barsFor(state.symbol),
    stats =
      b.length > 1
        ? Q.metrics(
            b.map((x) => x.close),
            0,
            b.map((x) => x.date),
          )
        : null;
  return `${heading("技術圖表", "每一筆價格都有來源，每一個指標都有定義。", `${button("切換標的", "search", "search")}${button("建立警示", "new-alert", "bell")}`)}<div class="full-chart-layout"><div>${chartPanel(state.symbol)}${notice("提供真實日、週、月 K 線。均線與指標以完整歷史計算後裁切顯示；日線不轉製成盤中行情。")}</div><section class="panel"><div class="panel-head"><h2>${esc(s?.name || state.symbol)}・研究摘要</h2><button class="star-btn ${state.watch.includes(state.symbol) ? "is-star" : ""}" data-star="${esc(state.symbol)}" aria-label="加入或移除自選股">${icon("star", 17)}</button></div><div class="stock-stats">${[
    ["收盤快照", n(s?.price)],
    ["產業", esc(s?.sector || "—")],
    ["本益比", s?.pe ? n(s.pe) + " 倍" : "未提供"],
    ["股價淨值比", s?.pb ? n(s.pb) + " 倍" : "未提供"],
    ["殖利率", s?.yieldPct == null ? "未提供" : n(s.yieldPct) + "%"],
    ["市值", compact(s?.marketCap)],
    ["20 日均線", n(f.sma20)],
    ["60 日均線", n(f.sma60)],
    ["RSI (14)", n(f.rsi, 1)],
    ["20 日年化波動", f.vol == null ? "—" : n(f.vol * 100) + "%"],
    ["ATR (14)", n(f.atr)],
    ["區間最大回撤", pct(stats?.maxDrawdown)],
    ["歷史涵蓋", b.length + " 個交易日"],
  ]
    .map(
      ([k, v]) =>
        `<div class="stock-stat"><span>${k}</span><strong class="num">${v}</strong></div>`,
    )
    .join(
      "",
    )}</div><div style="padding:0 18px 17px">${button("產生量化研究", "research", "spark", "small")}<p class="help-text" style="margin-top:12px">估值日期 ${s?.valuationDate || "未提供"}。財報、預估 EPS 及法人共識尚未接入。</p></div></section></div>`;
}
function screened() {
  const f = state.filters;
  let arr = stocks.filter((s) => s.date === market.observationDate);
  if (f.search)
    arr = arr.filter((s) =>
      (s.symbol + s.name).toLowerCase().includes(f.search.toLowerCase()),
    );
  if (f.type && f.type !== "all") arr = arr.filter((s) => s.type === f.type);
  if (f.sector && f.sector !== "all")
    arr = arr.filter((s) => s.sector === f.sector);
  const rules = [];
  if (f.direction === "up") rules.push((s) => s.pct != null && s.pct > 0);
  if (f.direction === "down") rules.push((s) => s.pct != null && s.pct < 0);
  if (f.minPrice) rules.push((s) => s.price >= +f.minPrice);
  if (f.maxPE) rules.push((s) => s.pe != null && s.pe > 0 && s.pe <= +f.maxPE);
  if (f.minYield)
    rules.push((s) => s.yieldPct != null && s.yieldPct >= +f.minYield);
  if (f.minTurnover) rules.push((s) => s.turnover >= +f.minTurnover * 1e8);
  if (f.technical === "above60")
    rules.push(
      (s) =>
        features[s.symbol]?.sma60 != null && s.price > features[s.symbol].sma60,
    );
  if (f.technical === "rsi30")
    rules.push(
      (s) => features[s.symbol]?.rsi != null && features[s.symbol].rsi < 30,
    );
  if (f.technical === "rsi70")
    rules.push(
      (s) => features[s.symbol]?.rsi != null && features[s.symbol].rsi > 70,
    );
  if (rules.length)
    arr = arr.filter((s) =>
      state.screenLogic === "OR"
        ? rules.some((r) => r(s))
        : rules.every((r) => r(s)),
    );
  return arr.sort((a, b) => {
    const av = a[state.sort],
      bv = b[state.sort];
    if (av == null) return 1;
    if (bv == null) return -1;
    return (
      (typeof av === "string" ? av.localeCompare(bv, "zh-Hant") : av - bv) *
      (state.sortAsc ? 1 : -1)
    );
  });
}
function screener() {
  const f = state.filters,
    sectors = [...new Set(stocks.map((s) => s.sector))].sort();
  return `${heading("智慧選股", "把研究想法，轉成可檢驗的篩選條件。", `${button("匯出 CSV", "screen-export", "download")}${button("儲存篩選", "save-filter", "star")}`)}<section class="panel filter-panel"><div class="filter-grid"><label class="field"><span>搜尋標的</span><input data-filter="search" value="${esc(f.search || "")}" placeholder="代碼或公司名稱"></label><label class="field"><span>標的類型</span><select data-filter="type"><option value="all">全部上市標的</option>${["股票", "ETF"].map((v) => `<option ${f.type === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label class="field"><span>產業分類</span><select data-filter="sector"><option value="all">所有產業</option>${sectors.map((v) => `<option ${f.sector === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label><label class="field"><span>價格方向</span><select data-filter="direction"><option value="all">不限</option><option value="up" ${f.direction === "up" ? "selected" : ""}>今日上漲</option><option value="down" ${f.direction === "down" ? "selected" : ""}>今日下跌</option></select></label><label class="field"><span>技術訊號（歷史涵蓋標的）</span><select data-filter="technical"><option value="all">不限</option><option value="above60" ${f.technical === "above60" ? "selected" : ""}>站上 60 日均線</option><option value="rsi30" ${f.technical === "rsi30" ? "selected" : ""}>RSI 小於 30</option><option value="rsi70" ${f.technical === "rsi70" ? "selected" : ""}>RSI 大於 70</option></select></label>${[
    ["minPrice", "股價下限（元）", "例如 50"],
    ["maxPE", "本益比上限（倍）", "例如 20"],
    ["minYield", "殖利率下限（%）", "例如 3"],
    ["minTurnover", "成交額下限（億元）", "例如 1"],
  ]
    .map(
      ([k, l, p]) =>
        `<label class="field"><span>${l}</span><input type="number" min="0" step="any" data-filter="${k}" value="${esc(f[k] || "")}" placeholder="${p}"></label>`,
    )
    .join(
      "",
    )}<label class="field"><span>數值條件邏輯</span><select id="screen-logic"><option value="AND" ${state.screenLogic === "AND" ? "selected" : ""}>AND · 全部符合</option><option value="OR" ${state.screenLogic === "OR" ? "selected" : ""}>OR · 任一符合</option></select></label></div><div class="filter-footer"><div><span class="small muted">快速篩選</span>${button("高股息", "preset-dividend", "", "small")}${button("大型權值", "preset-cap", "", "small")}${button("趨勢向上", "preset-trend", "", "small")}</div><div>${button("讀取篩選", "load-filter", "", "small")}${button("重設條件", "reset-filter", "refresh", "small")}</div></div></section>${notice("缺少本益比、殖利率或歷史資料的標的，不會通過需要該欄位的條件。技術篩選目前涵蓋 " + Object.keys(features).filter((s) => s !== "TAIEX").length + " 檔核心標的；產業與名稱篩選先限定範圍，再套用 AND／OR 數值條件。")}<section class="panel"><div class="panel-head"><div class="title-line"><h2>篩選結果</h2><span class="badge" id="screen-count"></span></div><span class="small muted">${market.observationDate} · TWSE</span></div><div id="screen-results"></div></section>`;
}
function tableMarkup(arr, watch = false) {
  const size = 20,
    pages = Math.max(1, Math.ceil(arr.length / size));
  state.page = Math.min(state.page, pages);
  const shown = arr.slice((state.page - 1) * size, state.page * size);
  const cols = [
    ["symbol", "代碼／名稱"],
    ["price", "收盤價"],
    ["pct", "漲跌幅"],
    ["turnover", "成交金額"],
    ["marketCap", "市值"],
    ["pe", "本益比"],
    ["pb", "淨值比"],
    ["yieldPct", "殖利率"],
  ];
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th style="width:35px">${icon("star", 12)}</th>${cols.map(([k, l]) => `<th class="${k === "symbol" ? "name-col" : ""}"><button data-sort="${k}">${l} ${state.sort === k ? (state.sortAsc ? "↑" : "↓") : "↕"}</button></th>`).join("")}<th>圖表</th></tr></thead><tbody>${shown.map((s) => `<tr><td><button class="star-btn ${state.watch.includes(s.symbol) ? "is-star" : ""}" data-star="${s.symbol}" aria-label="${state.watch.includes(s.symbol) ? "移除" : "加入"} ${esc(s.name)} 自選股">${icon("star", 14)}</button></td><td class="name-col row-link" data-stock="${s.symbol}"><strong class="stock-symbol num">${s.symbol}</strong><span class="stock-name">${esc(s.name)}</span></td><td class="num">${n(s.price)}</td><td class="num ${tone(s.pct)}">${signed(s.pct)}%</td><td class="num">${compact(s.turnover)}</td><td class="num">${compact(s.marketCap)}</td><td class="num">${n(s.pe)}</td><td class="num">${n(s.pb)}</td><td class="num">${s.yieldPct == null ? "—" : n(s.yieldPct) + "%"}</td><td><button class="icon-btn" data-stock="${s.symbol}" aria-label="開啟 ${s.symbol} 圖表">${icon("chart", 15)}</button></td></tr>`).join("")}</tbody></table></div>${!arr.length ? empty("沒有符合的標的", "試著減少條件，或確認目前的資料涵蓋範圍。") : ""}<div class="table-foot"><span>${arr.length ? `${(state.page - 1) * size + 1}–${Math.min(state.page * size, arr.length)}` : "0"} ／ ${n(arr.length, 0)} 檔</span><div class="pagination"><button class="btn small" data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>上一頁</button><span class="num">${state.page} / ${pages}</span><button class="btn small" data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>下一頁</button></div></div>`;
}
function renderScreenResults() {
  if ($("#screen-results")) {
    $("#screen-results").innerHTML = tableMarkup(screened());
    $("#screen-count").textContent = screened().length + " 檔";
  }
}
function heatmapPage() {
  return `${heading("市場熱力圖", "一眼掌握資金分布，從產業深入到個股。", button("匯出市場資料", "screen-export", "download"))}<section class="panel"><div class="toolbar"><label>市場 <select id="heat-sector"><option value="all">所有上市產業</option>${[
    ...new Set(stocks.filter((s) => s.type === "股票").map((s) => s.sector)),
  ]
    .sort()
    .map(
      (s) =>
        `<option ${state.heatSector === s ? "selected" : ""}>${esc(s)}</option>`,
    )
    .join(
      "",
    )}</select></label><label>面積 <select id="heat-size"><option value="marketCap" ${state.heatSize === "marketCap" ? "selected" : ""}>市值</option><option value="turnover" ${state.heatSize === "turnover" ? "selected" : ""}>成交金額</option></select></label><span class="spacer"></span><span class="small muted">顏色：單日漲跌幅 · ${market.observationDate}</span></div><div class="panel-head"><h2>${state.heatSector === "all" ? "台灣上市市場" : esc(state.heatSector)}</h2><span class="small muted">點擊方塊開啟個股研究</span></div><div class="heatmap full" data-heat="full"></div>${heatLegend()}</section><div style="margin-top:17px">${notice("依面積顯示前 130 檔，按產業分組；市值以證交所普通股股數 × 收盤價估算。無市值／成交額的標的不參與對應面積編碼，未涵蓋上櫃市場。")}</div><div class="section-row">${breadthPanel()}<section class="panel"><div class="panel-head"><h2>產業相對表現</h2><span class="badge">1D</span></div>${sectorList(8)}</section></div>`;
}
function macroPage() {
  return `${heading("總經與輪動", "把台股放進更大的脈絡，追蹤利率、通膨與資產關係。", `<a class="btn" href="#/compare">${icon("chart", 14)}跨資產比較</a>`)}${notice("美國總經來自 FRED，各序列日期與發布頻率不同。年增率按去年同月比對，缺漏月份不補值。數據採最新修訂版本，不能直接用於點時總經策略回測；價格變化不等同因果關係。")}<div class="macro-grid">${
    Object.values(macro.series)
      .map((s) => {
        const values = s.values,
          a = Q.last(values),
          prev = values[values.length - 2],
          change = prev ? a.value - prev.value : null;
        const yoy = s.symbol === "CPIAUCSL" ? Q.yearOverYear(values) : null;
        return `<section class="panel macro-card"><div class="macro-card-head"><h3>${esc(s.name)}</h3><span class="badge">${esc(s.group)}</span></div><div class="macro-value num">${n(a.value, s.symbol === "DEXTAUS" ? 3 : 2)}<small>${esc(s.unit)}</small></div><div class="macro-change num">${s.symbol === "CPIAUCSL" ? (yoy != null ? "年增率 " + pct(yoy) : "年增率資料不足") : "較前次 " + signed(change, 3)} <span class="muted">· ${a.date}</span></div>${sparkline(
          values.slice(-90).map((x) => x.value),
          "#4b968a",
        )}<div class="macro-foot"><a href="${esc(s.source)}" target="_blank" rel="noopener">FRED · ${s.symbol} ${icon("external", 9)}</a><span>${["CPIAUCSL", "UNRATE", "FEDFUNDS"].includes(s.symbol) && Q.monthlyGaps(s.values).length ? "缺少 " + Q.monthlyGaps(s.values).length + " 個月份" : "最新修訂值"}</span></div></section>`;
      })
      .join("") ||
    empty(
      "總經來源暫時無法使用",
      "可在資料品質頁查看來源錯誤；系統不會產生替代數據。",
      button("查看資料品質", "quality"),
    )
  }</div><div class="section-row" style="margin-top:18px"><section class="panel"><div class="panel-head"><div><h2>台股產業輪動觀察</h2><p>當日市值加權報酬・非歷史輪動模型</p></div><span class="badge">1D</span></div>${sectorList(12)}</section><section class="panel"><div class="panel-head"><h2>殖利率曲線</h2><span class="badge">10Y − 2Y</span></div>${yieldCurve()}<div style="padding:17px">${notice("利差使用兩序列共同的最新觀察日。殖利率以百分點表示；負值代表該日 10 年期利率低於 2 年期。")}</div><div style="padding:0 18px 18px"><h3>美股行情涵蓋</h3><p class="help-text" style="margin-top:7px">NASDAQ、S&P 500 及美國個股尚未接入具再散布授權的來源。目前研究範圍以台股與公開總經資料為主。</p></div></section></div>`;
}
function yieldCurve() {
  const a = macro.series.DGS10?.values,
    b = macro.series.DGS2?.values;
  if (!a || !b) return empty("缺少利率資料", "需要 FRED DGS10 與 DGS2。");
  const bm = new Map(b.map((v) => [v.date, v.value])),
    common = a.filter((v) => bm.has(v.date)),
    latest = Q.last(common);
  if (!latest) return empty("沒有共同觀察日", "需等待來源更新。");
  const value = latest.value - bm.get(latest.date);
  return `<div style="padding:15px 22px"><div class="macro-value num">${signed(value)}<small>百分點</small></div><span class="small muted">${latest.date} · 美國公債 10Y − 2Y</span>${sparkline(
    common.slice(-180).map((v) => v.value - bm.get(v.date)),
    "#7395b1",
  )}</div>`;
}
function lineChart(lines, { height = 320, percent = false } = {}) {
  const w = 960,
    h = height,
    left = 45,
    right = 70,
    top = 24,
    bottom = 35,
    all = lines.flatMap((l) => l.values),
    min = Math.min(...all),
    max = Math.max(...all),
    pad = (max - min) * 0.12 || 1,
    lo = min - pad,
    hi = max + pad,
    y = (v) => top + ((hi - v) / (hi - lo)) * (h - top - bottom),
    length = Math.max(...lines.map((l) => l.values.length)),
    x = (i) => left + (i / (length - 1 || 1)) * (w - left - right);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="歷史資料比較圖">${Array.from(
    { length: 5 },
    (_, i) => {
      const val = hi - ((hi - lo) * i) / 4;
      return `<line x1="${left}" x2="${w - right}" y1="${y(val)}" y2="${y(val)}" stroke="#edf0f3" stroke-dasharray="3 4"/><text x="${w - right + 12}" y="${y(val) + 3}" font-size="10" fill="#9aa6af">${percent ? n(val * 100, 1) + "%" : compact(val)}</text>`;
    },
  ).join(
    "",
  )}${lines.map((l) => `<path d="${l.values.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ")}" fill="none" stroke="${l.color}" stroke-width="2"/>`).join("")}${Array.from(
    { length: Math.min(5, length) },
    (_, j) => {
      const i = Math.round((j * (length - 1)) / 4),
        date = lines[0].dates?.[i];
      return date
        ? `<text x="${x(i)}" y="${h - 10}" text-anchor="middle" font-size="10" fill="#9aa6af">${date.slice(0, 7)}</text>`
        : "";
    },
  ).join("")}</svg>`;
}
function comparePage() {
  const a = state.compare.map((s) => ({ symbol: s, bars: barsFor(s) })),
    maps = a.map((s) => new Map(s.bars.map((b) => [b.date, b.close]))),
    dates = a[0].bars
      .map((b) => b.date)
      .filter((d) => maps.every((m) => m.has(d))),
    colors = ["#16877c", "#a58bbc", "#759bbd"],
    lines = a.map((s, i) => ({
      name: stock(s.symbol)?.name || s.symbol,
      color: colors[i],
      dates,
      values: dates.map((d) => (maps[i].get(d) / maps[i].get(dates[0])) * 100),
    }));
  const ret = lines.map((l) => Q.dailyReturns(l.values));
  return `${heading("資產比較", "在相同交易日與同一貨幣基礎上，比較報酬與相關性。", button("匯出比較", "compare-export", "download"))}<section class="panel compare-body"><div class="compare-selects">${a.map((s, i) => `<label class="field"><span>比較標的 ${i + 1}</span><select data-compare="${i}">${stockOptions(s.symbol)}</select></label>`).join("")}<span class="badge">TWD · 起始值 = 100</span></div>${dates.length > 1 ? `<div class="chart-toolbar" style="border-top:1px solid var(--border);padding-left:0">${lines.map((l, i) => `<span class="legend-item"><i class="legend-dot" style="background:${l.color}"></i>${esc(l.name)} <strong class="num">${pct(Q.last(l.values) / 100 - 1)}</strong></span>`).join("")}</div><div class="compare-chart">${lineChart(lines, { height: 365 })}</div>` : empty("共同歷史資料不足", "選擇已完成回補的不同標的。")}</section><div class="section-row" style="margin-top:17px"><section class="panel"><div class="panel-head"><h2>報酬相關性</h2><span class="badge">Pearson · 日報酬</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>標的</th>${a.map((s) => `<th>${s.symbol}</th>`).join("")}</tr></thead><tbody>${a.map((s, i) => `<tr><td>${s.symbol}</td>${a.map((_, j) => `<td class="num">${n(Q.correlation(ret[i], ret[j]), 3)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="help-text" style="padding:13px 18px">${dates[0] || "—"} 至 ${Q.last(dates) || "—"} · ${dates.length} 個共同交易日。相關不代表因果。</p></section><section class="panel"><div class="panel-head"><h2>歷史風險比較</h2><span class="badge">價格報酬</span></div><div class="risk-table">${lines
    .map((l) => {
      const m = Q.metrics(l.values, 0, dates);
      return `<div class="risk-row"><strong>${esc(l.name)}</strong><span>波動 ${m?.volatility == null ? "—" : n(m.volatility * 100) + "%"} · 最大回撤 ${pct(m?.maxDrawdown)}</span></div>`;
    })
    .join(
      "",
    )}</div></section></div>${notice("僅使用共同交易日，不向前填入未發生的觀察。全部標的以新台幣報價；未含配息、除權調整與交易費用。")}`;
}

function backtestPage() {
  const saved = load("backtest", {}),
    alloc = saved.alloc || [
      ["0050", 60],
      ["2330", 20],
      ["00646", 20],
    ],
    allDates = barsFor("0050").map((b) => b.date);
  return `${heading("策略與投組回測", "把投資假設交給歷史驗證，同時看見成本與風險。", `${button("下載回測結果", "backtest-export", "download")}`)}${notice("使用真實未還原日線，計算價格報酬。訊號於收盤後確認，下一共同交易日開盤執行；不含配息、公司行動還原、漲跌停成交限制與零股流動性。結果不代表未來績效。", true)}<div class="backtest-layout"><form class="panel config-panel" id="backtest-form"><h3>設定研究假設</h3><label class="field"><span>策略規則</span><select name="strategy" id="bt-strategy">${[
    ["hold", "買入持有／資產配置"],
    ["trend", "均線趨勢：均線之上持有"],
    ["switch", "0050／2330 動能輪動"],
    ["vol", "波動率控制曝險"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${saved.strategy === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="field"><span>初始資金（TWD）</span><input name="initial" type="number" value="${saved.initial || 1000000}" min="1000" required></label><label class="field"><span>開始日期</span><input name="startDate" type="date" value="${saved.startDate || allDates[0] || ""}" min="${allDates[0] || ""}" max="${Q.last(allDates) || ""}" required></label><label class="field"><span>結束日期</span><input name="endDate" type="date" value="${saved.endDate || Q.last(allDates) || ""}" max="${Q.last(allDates) || ""}" required></label><div class="config-section"><h3>目標配置 <span class="tiny muted">可保留現金</span></h3>${alloc.map(([s, w], i) => `<div class="allocation-row"><select name="asset${i}" aria-label="配置標的 ${i + 1}">${stockOptions(s)}</select><input type="number" name="weight${i}" value="${w}" min="0" max="100" step=".1" aria-label="標的 ${i + 1} 權重百分比"></div>`).join("")}<div class="allocation-total"><span>權重合計</span><strong id="weight-total" class="num">100%</strong></div><p class="help-text" style="font-size:9px">輪動策略固定於 0050／2330 擇一，依前一日回看期間動能決定；其他策略使用上方配置。</p></div><label class="field"><span>回看期（交易日）</span><input name="lookback" type="number" min="2" max="200" value="${saved.lookback || 60}" required></label><label class="field"><span>再平衡</span><select name="rebalance"><option value="monthly" ${saved.rebalance !== "none" ? "selected" : ""}>每月首個共同交易日</option><option value="none" ${saved.rebalance === "none" ? "selected" : ""}>僅首次／訊號改變時</option></select></label><label class="field"><span>基準標的（未計成本）</span><select name="benchmark">${stockOptions(saved.benchmark || "0050")}</select></label><label class="field"><span>年化目標波動（%）</span><input name="targetVol" type="number" min="1" max="100" value="${saved.targetVol || 20}"></label><div class="config-section"><h3>可調整的執行成本</h3><div class="two-fields"><label class="field"><span>單邊手續費（%）</span><input type="number" name="fee" min="0" max="10" step=".0001" value="${saved.fee ?? 0.1425}"></label><label class="field"><span>統一賣出稅費（%）</span><input type="number" name="sellTax" min="0" max="10" step=".001" value="${saved.sellTax ?? 0.1}"></label><label class="field"><span>滑價（%）</span><input type="number" name="slippage" min="0" max="5" step=".001" value="${saved.slippage ?? 0.05}"></label><label class="field"><span>最低手續費（元）</span><input type="number" name="minFee" min="0" max="10000" value="${saved.minFee ?? 20}"></label></div><p class="help-text" style="font-size:9px">稅費是統一研究假設，請按標的與券商調整；不宣稱符合每種商品的實際稅率。</p></div><label class="field" style="grid-column:1/-1"><span>評估範圍</span><select name="evaluation"><option value="full">全部期間 · 描述性回測</option><option value="holdout" ${saved.evaluation === "holdout" ? "selected" : ""}>僅最後 30% 交易日 · 保留評估區</option></select></label><button class="btn primary run-backtest" type="submit">${icon("play", 14)}執行回測</button><p class="help-text config-notice" style="font-size:9px">整股數量，允許單股；現金不計利息。保留區不進行參數最佳化。</p></form><div class="results" id="backtest-results">${state.result ? backtestResults() : empty("讓數據回答你的假設", "設定資產配置與交易規則，執行可重現的歷史研究。")}</div></div>`;
}
function backtestResults() {
  const r = state.result,
    m = r.stats;
  if (!m) return empty("無法計算", "回測資料不足。");
  return `<div class="stat-grid">${[
    ["總報酬", pct(m.total), "扣除設定的交易成本"],
    ["年化報酬 CAGR", pct(m.cagr), r.dates.length + " 個共同交易日"],
    ["最大回撤", pct(m.maxDrawdown), "依每日收盤權益"],
    ["Sharpe ratio", n(m.sharpe), "無風險利率假設 0%"],
  ]
    .map(
      ([l, v, h]) =>
        `<div class="stat-card"><span>${l}</span><strong class="num ${l.includes("報酬") ? tone(m.total) : ""}">${v}</strong><small>${h}</small></div>`,
    )
    .join(
      "",
    )}</div><section class="panel"><div class="panel-head"><div><h2>回測結果</h2><p>${r.dates[0]} — ${Q.last(r.dates)} · ${r.trades.length} 筆成交</p></div><span class="badge green">真實歷史資料</span></div><div class="tabs result-tabs">${[
    ["equity", "資產曲線"],
    ["drawdown", "回撤"],
    ["monthly", "月報酬"],
    ["trades", "成交明細"],
    ["risk", "風險指標"],
  ]
    .map(
      ([id, l]) =>
        `<button class="tab ${state.resultTab === id ? "active" : ""}" data-resulttab="${id}">${l}</button>`,
    )
    .join(
      "",
    )}</div>${resultTabBody()}<div class="result-description">成本 ${n(r.cost, 0)} 元 · 累積成交額／初始資金 ${n(r.turnover, 2)} 倍 · 期末資產 ${n(Q.last(r.curve).value, 0)} 元。基準為不計費用的下一日開盤買入價格報酬。</div></section><div class="notice" style="margin-top:15px">${icon("info")}<div>期間為 ${esc(r.config.evaluation === "holdout" ? "最後 30% 保留評估區" : "全期間描述性回測")}。使用當前選定的存續標的，存在選樣偏誤；不含下市股。未作參數搜尋，尚未實作完整 walk-forward。</div></div>`;
}
function resultTabBody() {
  const r = state.result,
    dates = r.curve.map((x) => x.date);
  if (state.resultTab === "trades")
    return `<div class="table-scroll"><table class="data-table"><thead><tr>${["成交日／訊號日", "標的", "方向", "股數", "成交價", "費用＋稅", "現金餘額"].map((l) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${r.trades
      .slice(-60)
      .reverse()
      .map(
        (t) =>
          `<tr><td>${t.date}<span class="stock-name">${t.signalDate}</span></td><td>${t.symbol}</td><td class="${t.side === "BUY" ? "up" : "down"}">${t.side === "BUY" ? "買入" : "賣出"}</td><td class="num">${n(t.qty, 0)}</td><td class="num">${n(t.price, 3)}</td><td class="num">${n(t.commission + t.tax)}</td><td class="num">${n(t.cash, 0)}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><p class="help-text" style="padding:12px 18px">顯示最新 60 筆；下載 JSON 可取得全部明細。</p>`;
  if (state.resultTab === "risk") {
    const m = r.stats;
    return `<div class="risk-table">${[
      ["年化波動率", m.volatility == null ? "—" : n(m.volatility * 100) + "%"],
      ["Sortino ratio", n(m.sortino)],
      ["Calmar ratio", n(m.calmar)],
      ["Beta（相對基準）", n(r.beta, 3)],
      [
        "追蹤誤差（年化）",
        r.trackingError == null ? "—" : n(r.trackingError * 100) + "%",
      ],
      ["歷史 VaR 95%（單日）", n(m.var95 * 100) + "%"],
      ["歷史 Expected Shortfall 95%", n(m.es95 * 100) + "%"],
      ["平均市場曝險", n(Q.mean(r.curve.map((x) => x.exposure)) * 100) + "%"],
      ["基準總報酬", pct(r.benchmarkStats?.total)],
      ["相對基準報酬", pct(m.total - r.benchmarkStats.total)],
    ]
      .map(
        ([l, v]) =>
          `<div class="risk-row"><span>${l}</span><strong class="num">${v}</strong></div>`,
      )
      .join("")}</div>`;
  }
  if (state.resultTab === "monthly") {
    let prev = r.curve[0].value;
    const months = new Map();
    for (const p of r.curve) months.set(p.date.slice(0, 7), p.value);
    return `<div class="monthly-grid">${[...months]
      .map(([date, value]) => {
        const ret = value / prev - 1;
        prev = value;
        return `<div class="month-cell ${tone(ret)}" style="background:${ret >= 0 ? "var(--up-bg)" : "var(--down-bg)"}"><small>${date}</small><strong class="num">${pct(ret, 1)}</strong></div>`;
      })
      .join("")}</div>`;
  }
  if (state.resultTab === "drawdown")
    return `<div class="equity-chart">${lineChart([{ color: "#a78ab3", values: Q.drawdowns(r.curve.map((x) => x.value)), dates }], { height: 280, percent: true })}</div>`;
  return `<div class="chart-toolbar"><span class="legend-item"><i class="legend-dot" style="background:#16877c"></i>研究投組</span><span class="legend-item"><i class="legend-dot" style="background:#9aa8b9"></i>${esc(r.config.benchmark || "0050")} 基準</span></div><div class="equity-chart">${lineChart(
    [
      { color: "#16877c", dates, values: r.curve.map((x) => x.value) },
      { color: "#9aa8b9", dates, values: r.curve.map((x) => x.benchmark) },
    ],
    { height: 280 },
  )}</div>`;
}
function runBacktest(form) {
  try {
    const fd = new FormData(form),
      alloc = [0, 1, 2].map((i) => [
        fd.get("asset" + i),
        +fd.get("weight" + i),
      ]);
    const nonzero = alloc.filter((x) => x[1] > 0);
    if (new Set(nonzero.map((x) => x[0])).size !== nonzero.length)
      throw Error("同一標的只能設定一次，請合併權重。");
    const raw = Object.fromEntries(fd);
    raw.alloc = alloc;
    save("backtest", raw);
    const weights = Object.fromEntries(nonzero.map(([s, w]) => [s, w / 100])),
      symbols =
        raw.strategy === "switch" ? ["0050", "2330"] : Object.keys(weights);
    for (const s of symbols) {
      const issue = history.issues?.[s]?.find(
        (e) => e.code === "CORPORATE_ACTION_REVIEW_REQUIRED",
      );
      if (issue)
        throw Error(`${s} 在 ${issue.date} 有待確認公司行動，暫停回測。`);
    }
    let startDate = raw.startDate;
    if (raw.evaluation === "holdout") {
      const dates = barsFor(raw.benchmark).filter(
        (b) => b.date >= raw.startDate && b.date <= raw.endDate,
      );
      startDate = dates[Math.floor(dates.length * 0.7)]?.date || startDate;
    }
    if (startDate >= raw.endDate) throw Error("結束日期必須晚於開始日期。");
    state.result = Q.backtest(history.series, {
      weights,
      strategy: raw.strategy,
      initial: +raw.initial,
      startDate,
      endDate: raw.endDate,
      fee: +raw.fee / 100,
      sellTax: +raw.sellTax / 100,
      slippage: +raw.slippage / 100,
      minFee: +raw.minFee,
      rebalance: raw.rebalance,
      lookback: +raw.lookback,
      targetVol: +raw.targetVol / 100,
      benchmark: raw.benchmark,
      evaluation: raw.evaluation,
    });
    $("#backtest-results").innerHTML = backtestResults();
    toast("回測完成・" + state.result.trades.length + " 筆成交已計入成本");
  } catch (e) {
    toast(e.message);
    $("#backtest-results").innerHTML = notice(esc(e.message), true);
  }
}
function researchPage() {
  const symbol =
      state.symbol === "TAIEX" || barsFor(state.symbol).length
        ? state.symbol
        : "TAIEX",
    report = state.currentReport || Q.researchReport(symbol, barsFor(symbol));
  return `${heading("量化研究", "從資料到結論，保留每一步證據與不確定性。", `${button("研究紀錄", "report-history", "clock")}${button("下載報告", "report-export", "download")}${button("產生研究", "generate-report", "spark", "primary")}`)}${notice("目前為可離線執行的確定性研究引擎 baseline-trend-v1，未連接 LLM，也未載入你的原始七階段模型。分類規則：收盤價同時高於／低於 20 與 60 日均線，其餘為過渡整理。")}<div class="report-layout"><section class="panel report-main"><div class="report-tag">QUANTITATIVE RESEARCH · ${esc(report.version || "baseline-trend-v1")}</div><div class="report-title"><h2>${esc(stock(report.symbol)?.name || report.symbol)}研究觀察</h2><span class="badge amber">${report.status === "INSUFFICIENT_DATA" ? "歷史不足" : "部分證據"}</span></div><div class="report-meta">${esc(report.symbol)} · 資料截止 ${report.date || "—"} · TWSE · 不產生任意信心百分比</div>${
    report.status === "INSUFFICIENT_DATA"
      ? empty(
          "研究資料不足",
          "至少需要 60 個交易日，目前僅 " +
            report.features.observations +
            " 筆。",
        )
      : `<div class="report-section"><h3>市場狀態</h3><div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:9px">${[
          ["基準趨勢", report.regime],
          ["20 日動能", pct(report.features.momentum)],
          ["RSI (14)", n(report.features.rsi, 1)],
        ]
          .map(
            ([l, v]) =>
              `<div class="stat-card" style="background:#fafcfb"><span>${l}</span><strong style="font-size:${l === "基準趨勢" ? 18 : 23}px">${v}</strong></div>`,
          )
          .join(
            "",
          )}</div><p>這是一組對可觀察價格行為的描述，不代表已驗證的市場預測。${report.features.vol == null ? "" : `20 日歷史年化波動率 ${n(report.features.vol * 100)}%。`}</p></div><div class="report-section"><h3>支持證據</h3><div class="evidence-list">${report.evidence.map((t) => `<div class="evidence-item">${icon("check")}${esc(t)}</div>`).join("")}</div></div><div class="report-section"><h3>替代情境與反方證據</h3><p>${esc(report.alternative)} 單一價格訊號不能解釋市場變化的原因，仍需基本面、資金與事件資訊交叉檢查。</p></div><div class="report-section"><h3>可觀察的失效條件</h3><p>${esc(report.invalidation)} 此條件只用於重新檢查研究假設，並非自動交易指令。</p></div><div class="report-section"><h3>缺少的資訊</h3><div style="display:flex;flex-wrap:wrap;gap:7px">${report.missing.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div></div><div class="report-section"><h3>方法限制</h3><p>${report.limitations.map(esc).join("<br>")}</p></div>`
  }</section><div><section class="panel pipeline"><h3>S0–S7 研究流程</h3>${(report.stages || ["S0 研究範圍", "S1 資料讀取", "S2 歷史不足，停止分類"]).map((s, i) => `<div class="pipeline-step"><span>${i}</span>${esc(s.slice(3))}${icon("check")}</div>`).join("")}<p class="help-text" style="padding-top:16px;border-top:1px solid var(--border);margin-top:8px;font-size:9px">所有觀察皆由當前版本公式計算。報告可匯出 JSON，保留數值、版本與日期。</p></section><section class="panel" style="margin-top:16px;padding:19px"><h3>研究範圍</h3><select id="research-symbol" style="width:100%;margin-top:13px"><option value="TAIEX" ${symbol === "TAIEX" ? "selected" : ""}>TAIEX 加權指數</option>${stockOptions(symbol)}</select><p class="help-text" style="margin-top:12px">未使用修訂後總經資訊回推歷史交易訊號；尚未建立條件勝率或行情階段的預測模型。</p></section></div></div>`;
}
function watchlistPage() {
  let a = state.watch.map(stock).filter(Boolean);
  a.sort(
    (a, b) =>
      ((a[state.sort] ?? -Infinity) - (b[state.sort] ?? -Infinity)) *
      (state.sortAsc ? 1 : -1),
  );
  return `${heading("自選清單", "讓關注的標的，留在同一個研究工作區。", `${button("匯出清單", "watch-export", "download")}${button("新增標的", "add-watch", "plus", "primary")}`)}${indices()}<section class="panel"><div class="panel-head"><h2>我的自選股 <span class="badge">${a.length} 檔</span></h2><span class="small muted">自動儲存在此瀏覽器</span></div><div id="watch-results">${tableMarkup(a, true)}</div></section>`;
}
function alertsPage() {
  const checked = load("alertEvents", []);
  return `${heading("價格警示", "為研究假設設定清楚的觀察條件。", button("檢查目前條件", "evaluate-alerts", "refresh"))}${notice("這些警示在開啟網頁、載入最新日終快照或手動檢查時評估。支援啟用／停用與觸發去重，不提供關閉網頁後的背景推播，也不代表盤中穿越事件。")}<section class="panel"><div class="panel-head"><h2>建立新的觀察條件</h2><span class="badge">日終價格</span></div><form class="alert-form" id="alert-form"><label class="field"><span>標的</span><select name="symbol">${stockOptions(state.symbol, false)}</select></label><label class="field"><span>觸發條件</span><select name="direction"><option value="above">收盤價 ≥</option><option value="below">收盤價 ≤</option></select></label><label class="field"><span>目標價（TWD）</span><input name="price" type="number" min=".001" step="any" required placeholder="輸入價格"></label><button class="btn primary" type="submit">${icon("plus", 14)}新增警示</button></form></section><section class="panel" style="margin-top:18px"><div class="panel-head"><h2>我的價格警示</h2><span class="badge">${state.alerts.length} 個</span></div>${
    state.alerts.length
      ? `<div class="table-scroll"><table class="data-table"><thead><tr>${["標的", "條件", "目前收盤價", "狀態", "啟用", "移除"].map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${state.alerts
          .map((a) => {
            const s = stock(a.symbol),
              hit =
                s &&
                (a.direction === "above"
                  ? s.price >= a.price
                  : s.price <= a.price);
            return `<tr><td class="row-link" data-stock="${esc(a.symbol)}"><strong>${esc(a.symbol)}</strong><span class="stock-name">${esc(s?.name || "")}</span></td><td class="num">${a.direction === "above" ? "≥" : "≤"} ${n(a.price)}</td><td class="num">${n(s?.price)}</td><td><span class="badge ${a.active && hit ? "amber" : ""}">${!a.active ? "已停用" : hit ? "條件成立" : "監測中"}</span></td><td><button class="toggle ${a.active ? "on" : ""}" data-alert-toggle="${a.id}" aria-label="切換 ${esc(a.symbol)} 警示" aria-pressed="${a.active}"></button></td><td><button class="icon-btn" data-alert-delete="${a.id}" aria-label="刪除警示">${icon("trash", 14)}</button></td></tr>`;
          })
          .join("")}</tbody></table></div>`
      : empty(
          "還沒有價格警示",
          "選擇上方標的與目標價，建立你的第一個觀察條件。",
        )
  }</section><section class="panel" style="margin-top:18px"><div class="panel-head"><h2>觸發紀錄</h2><span class="small muted">依警示與觀察日去重</span></div>${
    checked.length
      ? `<div class="risk-table">${checked
          .slice(-15)
          .reverse()
          .map(
            (a) =>
              `<div class="risk-row"><span>${esc(a.date)} · ${esc(a.symbol)} ${a.direction === "above" ? "≥" : "≤"} ${n(a.target)}</span><strong class="num">收盤 ${n(a.price)}</strong></div>`,
          )
          .join("")}</div>`
      : empty("沒有觸發紀錄", "當可用收盤價符合條件時，會在此保存紀錄。")
  }</section>`;
}
function qualityPage() {
  const h = Object.entries(history.coverage || {}),
    errors = [
      ...(market.errors || []),
      ...(history.errors || []),
      ...(macro.errors || []),
    ],
    unique = [
      ...new Map(
        errors.map((e) => [e.source + (e.month || "") + e.code, e]),
      ).values(),
    ],
    gaps = h.reduce((s, [, c]) => s + (c.missingSessions?.length || 0), 0),
    age = Math.floor(
      (Date.now() - Date.parse(market.observationDate + "T00:00:00+08:00")) /
        86400000,
    );
  return `${heading("資料品質", "知道資料從哪裡來，也知道目前還缺少什麼。", `<a class="btn" href="https://github.com/jedieason/stock-integrated/actions" target="_blank" rel="noopener">${icon("external", 13)}更新執行紀錄</a>${button("重新載入", "refresh", "refresh")}`)}<div class="quality-grid">${[
    [
      "最新日終觀察",
      market.observationDate,
      age > 4 ? "STALE_DATA · 超過 4 個日曆日" : "最新可用日期，非即時行情",
    ],
    [
      "日線涵蓋",
      h.length + " 個標的",
      n(
        h.reduce((s, [, c]) => s + c.count, 0),
        0,
      ) + " 筆通過 OHLC 驗證的觀察",
    ],
    [
      "資料缺口／來源錯誤",
      gaps + " / " + unique.length,
      "缺口以加權指數實際交易日比對",
    ],
  ]
    .map(
      ([l, v, t]) =>
        `<div class="stat-card"><span>${l}</span><strong class="num" style="font-size:22px">${v}</strong><small>${t}</small></div>`,
    )
    .join(
      "",
    )}</div><section class="panel"><div class="panel-head"><h2>來源狀態與資料契約</h2><span class="badge">每日頻率</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>來源</th><th>最新觀察</th><th>最近成功擷取（台北）</th><th>涵蓋範圍</th><th>狀態</th></tr></thead><tbody><tr><td>TWSE / STOCK_DAY_ALL</td><td>${market.observationDate}</td><td>${localTime(market.ingestedAt)}</td><td>${stocks.length} 檔上市股票／ETF</td><td><span class="badge ${age > 4 ? "amber" : "green"}">${age > 4 ? "STALE_DATA" : "VALID"}</span></td></tr><tr><td>TWSE / 月份歷史查詢</td><td>${history.coverage?.TAIEX?.last || "—"}</td><td>${localTime(history.ingestedAt)}</td><td>${h.length} 個標的 · 要求 ${history.requestedMonths || 13} 個月</td><td><span class="badge ${unique.some((e) => e.month) ? "amber" : "green"}">${unique.some((e) => e.month) ? "PARTIAL_EVIDENCE" : "VALID"}</span></td></tr>${Object.values(
    macro.series,
  )
    .map(
      (s) =>
        `<tr><td>FRED / ${s.symbol}</td><td>${Q.last(s.values)?.date || "—"}</td><td>${localTime(s.ingestedAt)}</td><td>${s.values.length} 筆 · ${esc(s.unit)}</td><td><span class="badge ${macro.errors?.some((e) => e.source === s.symbol) || (["CPIAUCSL", "UNRATE", "FEDFUNDS"].includes(s.symbol) && Q.monthlyGaps(s.values).length) ? "amber" : "green"}">${macro.errors?.some((e) => e.source === s.symbol) ? "SOURCE_UNAVAILABLE" : ["CPIAUCSL", "UNRATE", "FEDFUNDS"].includes(s.symbol) && Q.monthlyGaps(s.values).length ? "PARTIAL_EVIDENCE" : "VALID"}</span></td></tr>`,
    )
    .join(
      "",
    )}<tr><td>TPEx 上櫃市場</td><td>—</td><td>—</td><td>尚未接入</td><td><span class="badge">MODEL_NOT_CONFIGURED</span></td></tr><tr><td>美股／預估財報／法人共識</td><td>—</td><td>—</td><td>需合適資料供應商</td><td><span class="badge">PERMISSION_RESTRICTED</span></td></tr></tbody></table></div></section><section class="panel" style="margin-top:18px"><div class="panel-head"><h2>歷史回補與欄位驗證</h2><span class="small muted">無效 OHLC 不進入分析資料</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>標的</th><th>起始日期</th><th>最後日期</th><th>交易日筆數</th><th>缺少交易日</th><th>驗證狀態</th></tr></thead><tbody>${h.map(([s, c]) => `<tr><td class="row-link" data-stock="${esc(s)}"><strong>${esc(s)}</strong><span class="stock-name">${esc(stock(s)?.name || "")}</span></td><td>${c.first || "—"}</td><td>${c.last || "—"}</td><td class="num">${c.count}</td><td class="num">${c.missingSessions.length}</td><td class="quality-status">${history.issues?.[s]?.length ? `<span class="badge amber">${esc(history.issues[s][0].code)}</span>` : c.count >= 120 ? '<span class="badge green">OHLC 通過 · ≥120 筆</span>' : '<span class="badge amber">HISTORICAL_COVERAGE_INSUFFICIENT</span>'}</td></tr>`).join("")}</tbody></table></div></section><div class="section-row" style="margin-top:18px"><section class="panel settings-card"><h2>尚未取得的資料</h2><p>上櫃行情、盤中資料、還原權息、財報發布時點、歷史成分股、籌碼、融資券與分析師預估尚未接入。報價缺少欄位不會自動補值；滾動指標不足暖機期時回傳空值。</p><div class="risk-row"><span>缺少本益比</span><strong>${stocks.filter((s) => s.pe == null).length} 檔</strong></div><div class="risk-row"><span>缺少市值</span><strong>${stocks.filter((s) => s.marketCap == null).length} 檔</strong></div><div class="risk-row"><span>缺少殖利率</span><strong>${stocks.filter((s) => s.yieldPct == null).length} 檔</strong></div></section><section class="panel settings-card"><h2>來源錯誤紀錄</h2>${unique.length ? `<div style="max-height:240px;overflow:auto">${unique.map((e) => `<div class="risk-row" style="display:block"><strong>${esc(e.source)} ${esc(e.month || "")}</strong><p style="font-size:9px;word-break:break-word">${esc(e.code)} · ${esc(e.message || "")}</p></div>`).join("")}</div>` : "<p>本次收集沒有記錄來源錯誤。</p>"}</section></div>${notice("來源未提供可驗證的發布時間時，publicationTimestamp 保留為 null；availableAt 使用擷取時間。這不代表原始發布時點，也不能重建財報或總經的歷史可得性。")}`;
}
function localTime(t) {
  return t
    ? new Date(t).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        hour12: false,
      })
    : "—";
}
function settingsPage() {
  return `${heading("設定與資料來源", "保留研究偏好，讓資料的邊界一目了然。")}<div class="settings-layout"><section class="panel settings-card"><h2>工作區偏好</h2><div class="settings-row"><span>介面</span><strong>淺色 · Light</strong></div><div class="settings-row"><span>語言</span><strong>繁體中文</strong></div><div class="settings-row"><span>顯示時區</span><strong>Asia / Taipei</strong></div><div class="settings-row"><span>台股漲跌配色</span><strong><span class="up">紅漲</span>／<span class="down">綠跌</span></strong></div><div class="settings-row"><span>預設市場</span><strong>台灣上市股票與 ETF</strong></div><div class="settings-row"><span>自選與警示備份</span><div>${button("匯出", "settings-export", "download", "small")} ${button("匯入", "settings-import", "upload", "small")}</div></div><div class="settings-row"><span>清除個人設定</span><button class="btn small danger" data-action="settings-reset">重設工作區</button></div><p class="help-text" style="margin-top:14px">自選股、警示、策略和研究紀錄保存在此瀏覽器。公開網站不會上傳你的個人持倉與設定。</p></section><section class="panel settings-card"><h2>更新與部署</h2><div class="settings-row"><span>程式庫</span><a href="https://github.com/jedieason/stock-integrated" target="_blank" rel="noopener">stock-integrated ${icon("external", 12)}</a></div><div class="settings-row"><span>資料工作流程</span><span class="badge green">GitHub Actions</span></div><div class="settings-row"><span>排程</span><strong>週一至週五 · 台北 17:15、20:15</strong></div><div class="settings-row"><span>最近擷取</span><strong style="font-size:10px">${localTime(market.ingestedAt)}</strong></div><div class="settings-row"><span>手動啟動資料更新</span><a class="btn small" href="https://github.com/jedieason/stock-integrated/actions/workflows/deploy.yml" target="_blank" rel="noopener">開啟 Actions ${icon("external", 12)}</a></div><p class="help-text" style="margin-top:14px">需使用 repo 管理者身分執行 Run workflow；前端不保存 GitHub Token。GitHub 排程可能延遲，日期以實際可用資料為準，休市日不生成觀察。</p></section><section class="panel settings-card"><h2>官方資料來源</h2>${[
    [
      "臺灣證券交易所",
      "日終行情、估值、公司資料與月份日線",
      "https://openapi.twse.com.tw/",
    ],
    [
      "TWSE 資料使用條款",
      "依官方資料使用與再散布規範",
      "https://www.twse.com.tw/zh/terms/terms.html",
    ],
    [
      "FRED · Federal Reserve Bank of St. Louis",
      "公債利率、CPI、失業率與匯率",
      "https://fred.stlouisfed.org/",
    ],
    [
      "FRED 使用條款",
      "各序列原始提供者及權利依來源標示",
      "https://fred.stlouisfed.org/legal/",
    ],
  ]
    .map(
      ([title, desc, url]) =>
        `<div class="settings-row"><div><strong>${title}</strong><p style="font-size:9px">${desc}</p></div><a href="${url}" target="_blank" rel="noopener" aria-label="開啟 ${title}">${icon("external", 14)}</a></div>`,
    )
    .join(
      "",
    )}</section><section class="panel settings-card"><h2>研究方法與產品設計</h2><p>以原創 TWAVE 介面整合圖表研究、選股、熱力圖與風險分析。功能參考 TradingView、Finviz、Koyfin 與 Portfolio Visualizer，未使用其專有程式碼、付費資料或圖像資產。</p><div class="settings-row"><span>圖表渲染</span><strong>原生 SVG · 無外部行情 SDK</strong></div><div class="settings-row"><span>量化研究</span><strong>baseline-trend-v1 · 規則式</strong></div><div class="settings-row"><span>付費 API 與交易</span><strong>未使用／未連接</strong></div><div class="settings-row"><span>完整方法與限制</span><a href="https://github.com/jedieason/stock-integrated/tree/main/docs" target="_blank" rel="noopener">查看文件 ${icon("external", 12)}</a></div><p class="help-text" style="margin-top:14px">GitHub Pages 提供公開靜態網頁，Actions 負責資料工作與部署，不充當登入驗證伺服器。無需 API 金鑰即可使用目前功能。</p></section></div>`;
}
function modal(title, body) {
  $("#overlay").innerHTML =
    `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><h2>${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="關閉">${icon("close", 17)}</button></div><div class="modal-body">${body}</div></div></div>`;
  setTimeout(() => $(".modal input,.modal button", document)?.focus(), 0);
}
function closeModal() {
  $("#overlay").innerHTML = "";
}
function searchModal(mode = "chart") {
  state.searchMode = mode;
  $("#overlay").innerHTML =
    `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="搜尋標的"><div class="modal-search">${icon("search", 20)}<input id="global-query" placeholder="輸入 2330、台積電或 ETF 代碼…" autocomplete="off"><button class="badge" data-action="close-modal">ESC</button></div><div class="search-results" id="search-results"></div><div class="modal-hint">${mode === "watch" ? "選取標的以加入自選清單" : "Enter 開啟第一個結果"} · 目前涵蓋台灣上市股票與 ETF · 自選設定儲存於此瀏覽器</div></div></div>`;
  searchResults("");
  $("#global-query").focus();
}
function searchResults(query) {
  const a = (
    !query
      ? ["TAIEX", ...state.watch].map(stock).filter(Boolean)
      : [stock("TAIEX"), ...stocks].filter(
          (s) =>
            s &&
            (s.symbol + s.name).toLowerCase().includes(query.toLowerCase()),
        )
  ).slice(0, 12);
  $("#search-results").innerHTML =
    a
      .map(
        (s) =>
          `<button class="search-result" data-search-stock="${esc(s.symbol)}"><div class="stock-logo ${s.symbol === "2330" ? "tsmc" : ""}">${s.type === "ETF" ? "ETF" : s.symbol === "TAIEX" ? "TW" : s.name.slice(0, 1)}</div><div class="result-name"><strong class="num">${esc(s.symbol)} <span style="font-weight:400;margin-left:7px">${esc(s.name)}</span></strong><small>TWSE · ${esc(s.sector)}</small></div><div class="result-price num">${n(s.price)}<small class="${tone(s.pct)}" style="color:var(--${tone(s.pct)})">${signed(s.pct)}%</small></div></button>`,
      )
      .join("") || empty("找不到標的", "目前未提供美股、上櫃或未上市標的。");
}
function download(name, data, type = "application/json") {
  const blob = new Blob(
      [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
      { type },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV(arr, name) {
  if (!arr.length) {
    toast("沒有可匯出的資料");
    return;
  }
  const keys = Object.keys(arr[0]),
    quote = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  download(
    name,
    "\ufeff" +
      [
        keys.map(quote).join(","),
        ...arr.map((a) => keys.map((k) => quote(a[k])).join(",")),
      ].join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
async function refresh() {
  toast("正在讀取最新可用資料…");
  try {
    await fetchData();
    render();
    toast("已載入 " + market.observationDate + " 日終資料");
  } catch (e) {
    toast("讀取失敗，保留目前資料。" + e.message);
  }
}
async function fetchData() {
  const response = await Promise.all(
    ["market", "history", "macro"].map(async (name) => {
      const r = await fetch(`./data/${name}.json?t=${Date.now()}`);
      if (!r.ok) throw Error(`${name}: HTTP ${r.status}`);
      return r.json();
    }),
  );
  const [m, h, ma] = response;
  if (!Array.isArray(m.stocks) || !h.series) throw Error("資料結構錯誤");
  market = m;
  history = h;
  macro = ma;
  stocks = market.stocks;
  features = Object.fromEntries(
    Object.entries(history.series).map(([s, b]) => [s, Q.features(b)]),
  );
  evaluateAlerts(false);
}
function evaluateAlerts(show = true) {
  let events = load("alertEvents", []),
    added = 0;
  for (const a of state.alerts) {
    const s = stock(a.symbol);
    if (!a.active || !s) continue;
    const hit =
      a.direction === "above" ? s.price >= a.price : s.price <= a.price;
    if (hit && !events.some((e) => e.alert === a.id && e.date === s.date)) {
      events.push({
        alert: a.id,
        symbol: a.symbol,
        date: s.date,
        price: s.price,
        target: a.price,
        direction: a.direction,
        evaluatedAt: new Date().toISOString(),
      });
      added++;
    }
  }
  save("alertEvents", events.slice(-300));
  if (show)
    toast(added ? `${added} 個新警示條件成立` : "檢查完成，沒有新的觸發事件");
}
function render() {
  if (!market) return;
  const requested =
    location.hash.replace(/^#\/?/, "").split("?")[0] || "overview";
  state.route = [...routes, ...personal, ["data-quality"], ["settings"]].some(
    (r) => r[0] === requested,
  )
    ? requested
    : "overview";
  sidebar();
  topbar();
  footer();
  const renderers = {
    overview,
    charts,
    screener,
    heatmap: heatmapPage,
    macro: macroPage,
    compare: comparePage,
    backtest: backtestPage,
    research: researchPage,
    watchlist: watchlistPage,
    alerts: alertsPage,
    "data-quality": qualityPage,
    settings: settingsPage,
  };
  try {
    $("#main").innerHTML = renderers[state.route]();
    document.title = `${[...routes, ...personal, ["data-quality", "資料品質"], ["settings", "設定與資料來源"]].find((r) => r[0] === state.route)?.[1]} — TWAVE`;
    drawCharts();
    drawHeatmaps();
    renderScreenResults();
    updateWeights();
  } catch (e) {
    console.error(e);
    $("#main").innerHTML =
      notice("頁面載入失敗：" + esc(e.message), true) +
      button("返回總覽", "overview");
  }
}
function updateWeights() {
  const form = $("#backtest-form");
  if (!form) return;
  const total = [0, 1, 2].reduce(
    (s, i) => s + +(form.elements["weight" + i]?.value || 0),
    0,
  );
  $("#weight-total").textContent = n(total, 1) + "%";
  $("#weight-total").style.color = total > 100 ? "var(--up)" : "var(--accent)";
}

const actions = {
  menu: () => $("#sidebar").classList.toggle("open"),
  search: () => searchModal(),
  "add-watch": () => searchModal("watch"),
  "close-modal": closeModal,
  overview: () => routeTo("overview"),
  quality: () => routeTo("data-quality"),
  sources: () => routeTo("data-quality"),
  settings: () => routeTo("settings"),
  appearance: () => routeTo("settings"),
  alerts: () => routeTo("alerts"),
  watchlist: () => routeTo("watchlist"),
  research: () => {
    state.currentReport = null;
    routeTo("research");
  },
  refresh: refresh,
  workspace: () =>
    modal(
      "個人研究工作區",
      "<p>TWAVE 將圖表、自選、選股與回測串聯在同一個工作區。所有個人設定儲存在此瀏覽器，可於設定頁匯出備份。</p>" +
        button("管理工作區設定", "settings", "settings", "primary"),
    ),
  market: () =>
    modal(
      "台灣市場涵蓋",
      "<h3>上市股票與 ETF</h3><p>目前使用 TWSE 公開日終行情，共 " +
        stocks.length +
        " 檔標的。包含加權指數與核心標的真實歷史日線。上櫃、美股與盤中資料尚未接入，不以其他市場的代理值替代。</p>" +
        button("查看完整資料涵蓋", "quality", "database", "primary"),
    ),
  breadth: () => {
    modal(
      "上市市場廣度",
      breadthPanel() +
        `<p style="margin-top:17px">樣本為 ${market.observationDate} 上市股票，排除 ETF、無有效漲跌值與未成交標的；不代表全部台灣市場。</p>`,
    );
  },
  "chart-type": () => {
    state.chartType = state.chartType === "candles" ? "line" : "candles";
    save("chartType", state.chartType);
    render();
  },
  "chart-fit": () => {
    state.range = 132;
    state.pan = 0;
    save("range", 132);
    render();
  },
  expand: () => {
    const panel = $(".chart-panel");
    panel?.classList.toggle("expand-chart");
    drawCharts();
  },
  indicators: () =>
    modal(
      "技術指標",
      `<p>指標由可用日線計算。暖機期不足時保持空值，不補造歷史值。</p>${[
        ["ma5", "SMA 5 · 短期均線"],
        ["ma20", "SMA 20 · 月均線"],
        ["ma60", "SMA 60 · 季均線"],
        ["bb", "Bollinger Bands · 20 日、2 倍標準差"],
        ["volume", "Volume · 成交股數"],
        ["macd", "MACD (12,26,9) · 取代 RSI 副圖"],
      ]
        .map(
          ([id, l]) =>
            `<label class="settings-row"><span>${l}</span><input type="checkbox" data-indicator-check="${id}" ${state.indicators.includes(id) ? "checked" : ""}></label>`,
        )
        .join(
          "",
        )}<label class="settings-row"><span>對數價格軸</span><input type="checkbox" id="log-scale" ${state.log ? "checked" : ""}></label><div class="modal-actions">${button("套用指標", "apply-indicators", "check", "primary")}</div>`,
    ),
  "apply-indicators": () => {
    state.indicators = $$("[data-indicator-check]:checked").map(
      (e) => e.dataset.indicatorCheck,
    );
    state.log = $("#log-scale").checked;
    save("indicators", state.indicators);
    closeModal();
    render();
  },
  "chart-export": () => {
    const el = $("[data-chart] svg");
    if (!el) {
      toast("目前沒有可匯出的圖表");
      return;
    }
    const copy = el.cloneNode(true);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    download(
      `TWAVE-${state.symbol}-${market.observationDate}.svg`,
      new XMLSerializer().serializeToString(copy),
      "image/svg+xml",
    );
  },
  "reset-filter": () => {
    state.filters = {};
    state.screenLogic = "AND";
    state.page = 1;
    render();
  },
  "preset-dividend": () => {
    state.filters = { type: "股票", minYield: 4, maxPE: 25 };
    state.screenLogic = "AND";
    state.page = 1;
    render();
  },
  "preset-cap": () => {
    state.filters = { type: "股票" };
    state.sort = "marketCap";
    state.sortAsc = false;
    state.page = 1;
    render();
  },
  "preset-trend": () => {
    state.filters = { technical: "above60" };
    state.screenLogic = "AND";
    state.page = 1;
    render();
  },
  "save-filter": () => {
    save("savedFilter", {
      filters: state.filters,
      logic: state.screenLogic,
      sort: state.sort,
      asc: state.sortAsc,
    });
    toast("已儲存目前篩選條件");
  },
  "load-filter": () => {
    const f = load("savedFilter", null);
    if (!f) {
      toast("尚未儲存篩選條件");
      return;
    }
    state.filters = f.filters;
    state.screenLogic = f.logic;
    state.sort = f.sort;
    state.sortAsc = f.asc;
    state.page = 1;
    render();
    toast("已讀取儲存的篩選");
  },
  "screen-export": () =>
    exportCSV(
      state.route === "screener" ? screened() : stocks.map((s) => ({ ...s })),
      `TWAVE-screen-${market.observationDate}.csv`,
    ),
  "watch-export": () =>
    exportCSV(
      state.watch.map(stock).filter(Boolean),
      `TWAVE-watchlist-${market.observationDate}.csv`,
    ),
  "compare-export": () => {
    const maps = state.compare.map(
        (s) => new Map(barsFor(s).map((b) => [b.date, b.close])),
      ),
      dates = barsFor(state.compare[0])
        .map((b) => b.date)
        .filter((d) => maps.every((m) => m.has(d)));
    exportCSV(
      dates.map((date) =>
        Object.fromEntries([
          ["date", date],
          ...state.compare.map((s, i) => [s, maps[i].get(date)]),
        ]),
      ),
      "TWAVE-asset-comparison.csv",
    );
  },
  "backtest-export": () =>
    state.result
      ? download("TWAVE-backtest.json", state.result)
      : toast("請先執行回測"),
  "generate-report": () => {
    state.currentReport = Q.researchReport(state.symbol, barsFor(state.symbol));
    if (state.currentReport.status !== "INSUFFICIENT_DATA") {
      state.reports.push(state.currentReport);
      state.reports = state.reports.slice(-30);
      save("reports", state.reports);
    }
    render();
    toast("研究流程完成，請檢查資料限制與失效條件");
  },
  "report-export": () =>
    download(
      "TWAVE-research-" + state.symbol + ".json",
      state.currentReport ||
        Q.researchReport(state.symbol, barsFor(state.symbol)),
    ),
  "report-history": () =>
    modal(
      "研究紀錄",
      state.reports.length
        ? state.reports
            .slice()
            .reverse()
            .map(
              (r, i) =>
                `<button class="settings-row" style="width:100%;text-align:left" data-report="${state.reports.length - i - 1}"><span>${esc(r.symbol)} · ${esc(r.date)}<small style="display:block">${localTime(r.generatedAt)}</small></span><strong>${esc(r.regime)}</strong></button>`,
            )
            .join("")
        : "<p>尚未儲存研究報告。按「產生研究」保存第一份報告。</p>",
    ),
  "evaluate-alerts": () => {
    evaluateAlerts();
    render();
  },
  "new-alert": () => {
    routeTo("alerts");
    setTimeout(() => $('[name="price"]')?.focus(), 0);
  },
  "settings-export": () =>
    download("TWAVE-workspace.json", {
      version: 1,
      watch: state.watch,
      alerts: state.alerts,
    }),
  "settings-import": () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 2000000) throw Error("備份檔過大");
        const d = JSON.parse(await file.text());
        if (
          d.version !== 1 ||
          !Array.isArray(d.watch) ||
          !Array.isArray(d.alerts) ||
          d.alerts.some(
            (a) =>
              typeof a.symbol !== "string" ||
              !Number.isFinite(a.price) ||
              a.price <= 0 ||
              !["above", "below"].includes(a.direction),
          )
        )
          throw Error("備份格式不符");
        state.watch = d.watch.filter((s) => typeof s === "string" && stock(s));
        state.alerts = d.alerts
          .slice(0, 100)
          .map((a) => ({
            id: crypto.randomUUID(),
            symbol: a.symbol,
            price: a.price,
            direction: a.direction,
            active: !!a.active,
          }));
        save("watch", state.watch);
        save("alerts", state.alerts);
        render();
        toast("已匯入自選股與警示");
      } catch (e) {
        toast("匯入失敗：" + e.message);
      }
    };
    input.click();
  },
  "settings-reset": () =>
    modal(
      "重設個人工作區",
      '<p>這會移除此瀏覽器中的自選股、警示、研究紀錄與策略偏好。官方行情檔案不受影響。你可以先匯出備份。</p><div class="modal-actions">' +
        button("取消", "close-modal") +
        button("確認重設", "confirm-reset", "", "primary") +
        "</div>",
    ),
  "confirm-reset": () => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("twave:")) localStorage.removeItem(key);
    location.reload();
  },
};

document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]");
  if (action) {
    const id = action.dataset.action;
    if (actions[id]) {
      if (["settings", "quality", "alerts", "overview"].includes(id))
        closeModal();
      actions[id]();
    }
    return;
  }
  const star = e.target.closest("[data-star]");
  if (star) {
    const s = star.dataset.star;
    if (s === "TAIEX") {
      toast("加權指數已固定於市場總覽");
      return;
    }
    state.watch = state.watch.includes(s)
      ? state.watch.filter((x) => x !== s)
      : [...state.watch, s];
    save("watch", state.watch);
    render();
    toast(state.watch.includes(s) ? "已加入自選清單" : "已移出自選清單");
    return;
  }
  const result = e.target.closest("[data-search-stock]");
  if (result) {
    const s = result.dataset.searchStock;
    closeModal();
    if (state.searchMode === "watch") {
      if (s === "TAIEX") {
        toast("加權指數已固定於總覽");
        return;
      }
      if (!state.watch.includes(s)) state.watch.push(s);
      save("watch", state.watch);
      render();
      toast("已加入 " + s + " 自選股");
    } else openStock(s);
    return;
  }
  const stockEl = e.target.closest("[data-stock]");
  if (stockEl) {
    openStock(stockEl.dataset.stock);
    return;
  }
  const range = e.target.closest("[data-range]");
  if (range) {
    state.range = +range.dataset.range;
    state.pan = 0;
    save("range", state.range);
    render();
    return;
  }
  const interval = e.target.closest("[data-interval]");
  if (interval) {
    state.interval = interval.dataset.interval;
    state.pan = 0;
    save("interval", state.interval);
    render();
    return;
  }
  const indicator = e.target.closest("[data-indicator]");
  if (indicator) {
    const id = indicator.dataset.indicator;
    state.indicators = state.indicators.includes(id)
      ? state.indicators.filter((x) => x !== id)
      : [...state.indicators, id];
    save("indicators", state.indicators);
    render();
    return;
  }
  const wt = e.target.closest("[data-watchtab]");
  if (wt) {
    state.watchTab = wt.dataset.watchtab;
    render();
    return;
  }
  const sort = e.target.closest("[data-sort]");
  if (sort) {
    state.sortAsc = state.sort === sort.dataset.sort ? !state.sortAsc : false;
    state.sort = sort.dataset.sort;
    state.page = 1;
    state.route === "screener" ? renderScreenResults() : render();
    return;
  }
  const page = e.target.closest("[data-page]");
  if (page && !page.disabled) {
    state.page = +page.dataset.page;
    state.route === "screener" ? renderScreenResults() : render();
    return;
  }
  const sector = e.target.closest("[data-sector]");
  if (sector) {
    state.heatSector = sector.dataset.sector;
    routeTo("heatmap");
    return;
  }
  const tab = e.target.closest("[data-resulttab]");
  if (tab) {
    state.resultTab = tab.dataset.resulttab;
    $("#backtest-results").innerHTML = backtestResults();
    return;
  }
  const alertToggle = e.target.closest("[data-alert-toggle]");
  if (alertToggle) {
    const a = state.alerts.find(
      (a) => a.id === alertToggle.dataset.alertToggle,
    );
    if (a) {
      a.active = !a.active;
      save("alerts", state.alerts);
      render();
    }
    return;
  }
  const alertDelete = e.target.closest("[data-alert-delete]");
  if (alertDelete) {
    state.alerts = state.alerts.filter(
      (a) => a.id !== alertDelete.dataset.alertDelete,
    );
    save("alerts", state.alerts);
    render();
    return;
  }
  const r = e.target.closest("[data-report]");
  if (r) {
    state.currentReport = state.reports[+r.dataset.report];
    state.symbol = state.currentReport.symbol;
    closeModal();
    render();
    return;
  }
  if (e.target.classList.contains("modal-backdrop")) closeModal();
  if (e.target.closest(".sidebar a")) $("#sidebar").classList.remove("open");
});
function openStock(s) {
  state.symbol = s;
  state.pan = 0;
  state.currentReport = null;
  save("symbol", s);
  routeTo("charts");
}
document.addEventListener("input", (e) => {
  if (e.target.id === "global-query") searchResults(e.target.value.trim());
  if (e.target.dataset.filter !== undefined) {
    state.filters[e.target.dataset.filter] = e.target.value;
    state.page = 1;
    save("filters", state.filters);
    renderScreenResults();
  }
  if (e.target.name?.startsWith("weight")) updateWeights();
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "screen-logic") {
    state.screenLogic = t.value;
    state.page = 1;
    renderScreenResults();
  }
  if (t.dataset.filter !== undefined) {
    state.filters[t.dataset.filter] = t.value;
    save("filters", state.filters);
    state.page = 1;
    renderScreenResults();
  }
  if (t.id === "heat-sector") {
    state.heatSector = t.value;
    drawHeatmaps();
  }
  if (t.id === "heat-size") {
    state.heatSize = t.value;
    render();
  }
  if (t.dataset.compare !== undefined) {
    state.compare[+t.dataset.compare] = t.value;
    render();
  }
  if (t.id === "research-symbol") {
    state.symbol = t.value;
    state.currentReport = null;
    save("symbol", t.value);
    render();
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "backtest-form") {
    e.preventDefault();
    runBacktest(e.target);
  }
  if (e.target.id === "alert-form") {
    e.preventDefault();
    const fd = new FormData(e.target),
      price = +fd.get("price"),
      symbol = fd.get("symbol");
    if (!price || price <= 0 || !stock(symbol)) {
      toast("請輸入有效的價格與標的");
      return;
    }
    state.alerts.push({
      id: crypto.randomUUID(),
      symbol,
      direction: fd.get("direction"),
      price,
      active: true,
      createdAt: new Date().toISOString(),
    });
    save("alerts", state.alerts);
    evaluateAlerts(false);
    render();
    toast("已建立價格警示");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    $(".expand-chart")?.classList.remove("expand-chart");
    $("#sidebar").classList.remove("open");
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    searchModal();
  }
  if (
    e.key === "/" &&
    !["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
  ) {
    e.preventDefault();
    searchModal();
  }
  if (e.key === "Enter" && e.target.id === "global-query")
    $("[data-search-stock]")?.click();
  if (e.key === "Enter" && e.target.dataset.stock)
    openStock(e.target.dataset.stock);
  if (e.key === "Tab" && $(".modal")) {
    const focusable = $$("button,input,select,a[href]", $(".modal")).filter(
        (x) => !x.disabled,
      ),
      first = focusable[0],
      last = Q.last(focusable);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
window.addEventListener("hashchange", () => {
  state.page = 1;
  closeModal();
  render();
  window.scrollTo(0, 0);
});
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    drawHeatmaps();
  }, 120);
});
try {
  await fetchData();
  render();
} catch (e) {
  console.error(e);
  $("#main").innerHTML =
    `<div class="empty">${icon("database", 32)}<h1>暫時無法讀取市場資料</h1><p>${esc(e.message)}。請確認 data 目錄已產生，並使用 HTTP 伺服器啟動網站。</p>${button("重新載入", "refresh", "refresh", "primary")}<p><a href="https://github.com/jedieason/stock-integrated/actions" target="_blank" rel="noopener">查看 GitHub Actions 更新狀態 ${icon("external", 12)}</a></p></div>`;
}
