/* Browser-only layout regression. All /api/ responses are intercepted fixtures:
 * no login bypass in application code, credentials, database reads or writes.
 * Run against the built, running development app:
 *   node scripts/test-workspace-layout.cjs
 */
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const puppeteer = require("puppeteer-core");

const base = process.env.LAYOUT_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const output = "generated-artifacts/workspace-layout";
const footer = "يتم إظهار الأقسام حسب الصلاحيات التي يحددها المدير.";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const member = {
  clerk_user_id: "layout-fixture", name: "حساب اختبار العرض", role: "admin",
  active: true, allowed_sections: [], language: "ar", appearance: "dark",
};
const dashboard = {
  stats: { incoming: 100, outgoing: 10, balance: 90, purchases: 0, inventoryValue: 0,
    pendingCheques: 0, pendingChequeCount: 0, dueCheques: 0, dueChequeCount: 0, rentalRemaining: 0 },
  recentOperations: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1, type: "income", amount: 100, party: `عملية اختبار ${i + 1}`,
    reason: "بيانات متصفح مؤقتة", date: "2026-10-23", recorded_by: "اختبار", notes: "",
  })),
  fieldExpenses: [],
};

async function main() {
  mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || execSync("command -v chromium").toString().trim(),
    headless: true, defaultViewport: null,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1366,768"],
  });
  const results = [];
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/")) return void request.continue();
      // Fail closed: never pass an API request to a real business backend.
      const body = url.pathname === "/api/auth/session" ? { member }
        : url.pathname === "/api/dashboard" ? dashboard
        : url.pathname === "/api/notifications" ? { unreadCount: 0, items: [] } : {};
      void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(base, { waitUntil: "networkidle0" });
    await page.waitForFunction((text) => document.body.innerText.includes(text), {}, footer);
    await page.evaluate(() => document.fonts.ready);

    async function inspect(label) {
      await sleep(150);
      const metrics = await page.evaluate(() => window.benniniViewportMetrics());
      assert.ok(metrics.root, `${label}: root exists`);
      assert.ok(Math.abs(metrics.root.height - Math.min(metrics.innerHeight, metrics.visualViewport?.height || Infinity)) <= 1,
        `${label}: root fits available web viewport`);
      assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}: no document horizontal overflow`);
      assert.ok(metrics.scrollHeight <= metrics.innerHeight + 1, `${label}: document does not exceed viewport`);
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden",
        `${label}: body overflow is not masked`);

      if (metrics.sidebar) {
        assert.ok(metrics.sidebar.bottom <= metrics.innerHeight + 1, `${label}: sidebar fits`);
        assert.ok(metrics.account.top >= 0 && metrics.account.bottom <= metrics.innerHeight,
          `${label}: full account footer is visible`);
        assert.ok(await page.evaluate(() => {
          const account = document.querySelector('[data-testid="workspace-account"]');
          const r = account.getBoundingClientRect();
          return account.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), `${label}: footer is not covered`);
        const nav = await page.$('[data-testid="workspace-sidebar-scroll"]');
        await nav.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        assert.ok(await nav.evaluate((element) => {
          const last = [...element.querySelectorAll("button")].at(-1);
          const area = element.getBoundingClientRect(), r = last.getBoundingClientRect();
          return r.top >= area.top - 1 && r.bottom <= area.bottom + 1;
        }), `${label}: last sidebar link is reachable`);
      }

      const scrollResult = await page.evaluate((text) => {
        const content = document.querySelector('[data-testid="workspace-content"]');
        const scroll = [...content.querySelectorAll("div")].find((element) =>
          /auto|scroll/.test(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 5 && element.clientHeight > 100);
        if (!scroll) throw new Error("No main vertical scroll container");
        scroll.scrollTop = scroll.scrollHeight;
        return new Promise((resolve) => requestAnimationFrame(() => {
          const last = [...content.querySelectorAll("div")].find((e) =>
            e.childElementCount === 0 && e.textContent === text);
          const r = last.getBoundingClientRect(), area = scroll.getBoundingClientRect();
          resolve({
            top: r.top, bottom: r.bottom, scrollBottom: area.bottom,
            reachable: r.top >= area.top - 1 && r.bottom <= area.bottom + 1 &&
              r.bottom <= innerHeight + 1,
            horizontalOverflow: scroll.scrollWidth > scroll.clientWidth + 1,
          });
        }));
      }, footer);
      assert.ok(scrollResult.reachable, `${label}: final page content is reachable: ${JSON.stringify(scrollResult)}`);
      assert.equal(scrollResult.horizontalOverflow, false, `${label}: main content has no horizontal overflow`);
      await page.screenshot({ path: `${output}/${label}.png` });
      results.push({ label, ...metrics, mainScroll: scrollResult });
      console.log(`PASS ${label}: inner/client/scroll/root height = ${metrics.innerHeight}/${metrics.clientHeight}/${metrics.scrollHeight}/${metrics.root.height}`);
    }

    for (const [width, height] of [[1280, 800], [1366, 768], [1920, 1080], [1024, 500], [1280, 400], [1366, 768], [800, 600], [402, 874]]) {
      await page.setViewport({ width, height });
      await inspect(`${width}x${height}-${results.length}`);
      if (width < 960) {
        await page.click('[aria-label="فتح قائمة الأقسام"]');
        await inspect(`drawer-${width}x${height}-${results.length}`);
        const separation = await page.evaluate(() => ({
          accountBottom: document.querySelector('[data-testid="workspace-account"]').getBoundingClientRect().bottom,
          barTop: document.querySelector('[data-testid="workspace-bottom-navigation"]').getBoundingClientRect().top,
        }));
        assert.ok(separation.accountBottom <= separation.barTop, "Drawer footer is above mobile bottom navigation");
        await page.click('[data-testid="workspace-sidebar"] [aria-label="إغلاق القائمة"]');
      }
    }
    // Native CDP window-state transitions in Chromium, not a Windows/Websktop test.
    await page.setViewport(null);
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    for (const state of ["normal", "minimized", "normal", "maximized", "normal", "fullscreen", "normal"]) {
      await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: state } });
      await sleep(150);
      const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
      assert.equal(bounds.windowState, state, `Chromium native state ${state}`);
      if (state !== "minimized") await inspect(`chromium-${state}-${results.length}`);
    }
    assert.deepEqual(errors, [], "No browser runtime errors");
    writeFileSync(`${output}/metrics.json`, JSON.stringify({ engine: "Headless Chromium / Linux", fixtures: true, results }, null, 2));
    console.log(`Layout checks passed. Screenshots and metrics: ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
