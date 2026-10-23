# TWAVE · 台股整合研究台

以台股為主的淺色個人量化研究網站，整合 TradingView 式圖表研究、Finviz 式選股／熱力圖、Koyfin 式跨資產脈絡及 Portfolio Visualizer 式回測。採原創 SVG 與 UI，沒有使用這些平台的專有程式碼、付費資料或品牌資產。

**網站：<https://jedieason.github.io/stock-integrated/>**  
**資料與部署：GitHub Actions；個人設定：瀏覽器 localStorage。**

## 啟動

需要 Node.js 22+、Python 3.12+、curl。前端執行不依賴 npm 套件；Playwright 僅供開發測試。

```sh
git clone https://github.com/jedieason/stock-integrated.git
cd stock-integrated
npm ci
npm run dev
# 開啟 http://127.0.0.1:5173
```

```sh
npm test                         # 指標、回測與資料轉接測試
node scripts/validate-data.mjs    # 驗證已收集的真實資料
npm run build                    # 產生 dist/
python3 scripts/update_data.py   # 官方資料更新及缺少月份回補
# 進階：python3 scripts/update_data.py --months 24
npx playwright install chromium
npm run test:e2e                 # 桌面／手機端到端測試
```

## 已實作

| 頁面 | 可使用功能 |
|---|---|
| 市場總覽 | 加權指數與核心 ETF／個股、廣度、產業表現、自選清單 |
| 技術圖表 | 真實日／週／月 K 線、線圖、十字線、縮放平移、均線、布林帶、RSI／MACD、SVG 匯出 |
| 智慧選股 | 產業、價格、估值、殖利率、成交額與核心標的技術條件、AND／OR、排序、分頁、儲存、CSV |
| 市場熱力圖 | 真實市值／成交額面積、產業分組、漲跌配色、標的連動 |
| 總經與輪動 | FRED 利率、CPI、失業率、匯率與共同日期殖利率利差；台股單日產業相對表現 |
| 資產比較 | 共同交易日、指數化 100、日報酬相關性、波動與回撤 |
| 策略與投組回測 | 持有配置、均線趨勢、0050／2330 動能輪動、波動曝險、次日開盤、費用、稅費假設、交易明細、保留評估區 |
| 量化研究 | baseline-trend-v1 確定性 S0–S7 流程、證據、替代情境、失效條件、JSON 與本機研究紀錄 |
| 自選與警示 | 持久化清單、日終價格條件、啟用停用、按警示／日期去重、JSON 備份 |
| 資料品質與設定 | 日期、涵蓋、欄位缺漏、交易日缺口、錯誤、來源與使用條款 |

## 資料範圍

初次收集包含 1,319 檔上市股票／ETF、15 個指數／核心標的各 256 筆日線（2025-10-01 至 2026-10-22），以及 6 組公開 FRED 總經序列。這是初次資料版本的範圍，後續數量與日期以網站／JSON 為準。每日行情不是即時報價。

GitHub Actions 於平日台北時間 **17:15、20:15** 擷取資料，執行測試後部署 Pages；GitHub 排程可能延遲。休市時保留最近有效觀察，不生成交易日。使用者可於 Actions 手動執行。

## 重要邊界

- 此版本是 GitHub Pages＋批次資料引擎，沒有常駐 FastAPI、PostgreSQL、登入伺服器或券商交易連線。
- 僅上市，不將 TWSE 冒充 TPEx。美股個股／NASDAQ 指數、盤中、法人共識與點時財報未接入。00646 為台灣上市的新台幣 ETF，不是美元 S&P 500 指數本身。
- 回測使用未還原價格，**不含股利、除權息與拆分還原**；大幅參考價調整將標記並限制回測。統一賣出稅費必須自行調整，不保證符合每種商品／券商規則。
- 研究規則是明確標示的基準模型，**不是你的七階段 Skill，也不是 LLM 預測**。未驗證情境勝率，沒有任意信心百分比。
- FRED 為最新修訂資料，禁止當作歷史點時資料回測。網站開啟時才評估個人警示，沒有背景推播。

詳細設計、公式、限制與續作順序見 [docs/PROGRESS.md](docs/PROGRESS.md)、[docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md)。
