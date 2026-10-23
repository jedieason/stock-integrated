import { test, expect } from "@playwright/test";
test("overview displays actual dated data and no application errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "市場總覽", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-chart] svg")).toBeVisible();
  await expect(page.locator("[data-heat] .heat-stock").first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("search opens a real stock chart and daily/weekly controls work", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="search"]').click();
  await page.locator("#global-query").fill("2330");
  await page.locator('[data-search-stock="2330"]').click();
  await expect(
    page.getByRole("heading", { name: "技術圖表", exact: true }),
  ).toBeVisible();
  await page.locator('[data-interval="W"]').click();
  await expect(page.locator(".chart-title")).toContainText("1W");
  await page.locator('[data-interval="D"]').click();
  await expect(page.locator(".chart-title")).toContainText("1D");
});
test("screener respects missing fields and exports results", async ({
  page,
}) => {
  await page.goto("/#/screener");
  await page.locator('[data-filter="search"]').fill("2330");
  await expect(page.locator("#screen-count")).toHaveText("1 檔");
  await expect(page.locator("#screen-results")).toContainText("台積電");
  await page.locator('[data-filter="maxPE"]').fill("0.01");
  await expect(page.locator("#screen-count")).toHaveText("0 檔");
});
test("portfolio backtest runs and provides dated trades", async ({ page }) => {
  await page.goto("/#/backtest");
  await page.getByRole("button", { name: "執行回測", exact: true }).click();
  await expect(page.locator("#backtest-results")).toContainText("真實歷史資料");
  await page.locator('[data-resulttab="trades"]').click();
  await expect(
    page.locator("#backtest-results table tbody tr").first(),
  ).toBeVisible();
});
test("alerts persist after reload and show condition evaluation", async ({
  page,
}) => {
  await page.goto("/#/alerts");
  await page.locator('#alert-form [name="symbol"]').selectOption("2330");
  await page.locator('#alert-form [name="price"]').fill("1");
  await page.locator('#alert-form button[type="submit"]').click();
  await expect(page.locator("main")).toContainText("條件成立");
  await page.reload();
  await expect(page.locator("main")).toContainText("條件成立");
});
test("all research pages render without error and fit the viewport", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "heatmap",
    "macro",
    "compare",
    "research",
    "watchlist",
    "data-quality",
    "settings",
  ]) {
    await page.goto("/#/" + route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("頁面載入失敗");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
