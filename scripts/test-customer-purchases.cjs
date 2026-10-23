/**
 * Real HTTP/SQL regression test. Creates a disposable local PostgreSQL cluster,
 * starts the real API with test-only credentials, and never uses a saved DB URL.
 * Requires PostgreSQL binaries and Chromium on PATH; no application auth bypass.
 */
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { createServer } = require("node:net");
const pg = require("pg");
const puppeteer = require("puppeteer-core");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve) => {
  const server = createServer();
  server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
});

async function main() {
  const root = mkdtempSync(`${tmpdir()}/purchase-regression-`);
  const data = `${root}/db`;
  const dbPort = await freePort();
  const port = await freePort();
  const connectionString = `postgresql://purchase_test@127.0.0.1:${dbPort}/postgres`;
  const env = { ...process.env, NEON_DATABASE_URL: connectionString, DATABASE_URL: connectionString,
    SESSION_SECRET: "isolated-test-session-secret-not-for-real-use",
    ADMIN_BOOTSTRAP_TOKEN: "isolated-test-bootstrap-token-not-for-real-use", PORT: String(port), NODE_ENV: "test" };
  let service, browser, pool, started = false, logs = "", token = "";
  const base = `http://127.0.0.1:${port}`;
  const checks = [];
  async function api(path, method = "GET", body, expected = 200) {
    const response = await fetch(`${base}/api${path}`, { method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const json = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(json)}`);
    return json;
  }
  try {
    execFileSync("initdb", ["-D", data, "-A", "trust", "-U", "purchase_test", "--no-locale", "--encoding=UTF8"], { stdio: "pipe" });
    execFileSync("pg_ctl", ["-D", data, "-l", `${root}/postgres.log`, "-o", `-p ${dbPort} -h 127.0.0.1 -k ${root}`, "-w", "start"], { stdio: "pipe" });
    started = true;
    service = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/index.ts"], { env, stdio: ["ignore", "pipe", "pipe"] });
    service.stdout.on("data", (data) => { logs = (logs + data).slice(-30000); });
    service.stderr.on("data", (data) => { logs = (logs + data).slice(-30000); });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await fetch(`${base}/api/auth/status`)).ok; } catch {}
      if (ready) break;
      await sleep(300);
    }
    assert.ok(ready, `Test API failed to start:\n${logs}`);
    await api("/auth/bootstrap", "POST", { bootstrapToken: env.ADMIN_BOOTSTRAP_TOKEN, serial: "876543" }, 201);
    token = (await api("/auth/login", "POST", { serial: "876543" })).token;
    const a = (await api("/finance/accounts", "POST", { kind: "customer", name: "زبون الاختبار الأول" }, 201)).account;
    const b = (await api("/finance/accounts", "POST", { kind: "customer", name: "زبون الاختبار الثاني" }, 201)).account;
    const searchResult = await api("/finance/accounts?kind=customer&q=" + encodeURIComponent(b.name));
    assert.deepEqual(searchResult.items.map((item) => item.id), [b.id], "Customer lookup filters by the searched name");
    const draft = { name: "سلعة الاختبار", supplier: "مورد الاختبار", invoiceNumber: "INV-TOTAL-1",
      totalPurchase: "1000.25", totalSale: "1500.75", paymentStatus: "unpaid", purchaseDate: "2026-10-22",
      notes: "ملاحظات محفوظة", customerId: a.id };
    const first = (await api("/inventory", "POST", draft, 201)).item;
    assert.equal(Number(first.total_cost), 1000.25);
    assert.equal(Number(first.total_sale), 1500.75);
    assert.equal(Number(first.expected_profit), 500.5);
    const account = (id) => api(`/finance/accounts/${id}`);
    let snapshot = await account(a.id);
    for (const [field, value] of Object.entries({ purchase_total: 1000.25, sale_total: 1500.75, profit_total: 500.5, paid_total: 0, unpaid_total: 1500.75 })) {
      assert.equal(Number(snapshot.account[field]), value, field);
    }
    assert.equal(snapshot.purchases[0].supplier, draft.supplier);
    assert.equal(snapshot.purchases[0].notes, draft.notes);
    assert.equal(snapshot.purchases[0].invoice_number, draft.invoiceNumber);
    assert.equal(snapshot.purchases[0].purchase_date, draft.purchaseDate);
    assert.equal(Number(snapshot.invoices[0].amount), 1500.75);
    checks.push("Real purchase creation, ID linkage, exact totals and complete customer details");
    const second = (await api("/inventory", "POST", { ...draft, invoiceNumber: "INV-TOTAL-2", totalPurchase: "200", totalSale: "350", paymentStatus: "paid" }, 201)).item;
    snapshot = await account(a.id);
    assert.equal(Number(snapshot.account.paid_total), 350);
    assert.equal(Number(snapshot.account.unpaid_total), 1500.75);
    await api(`/finance/accounts/${b.id}/purchases/${first.id}/payment`, "PATCH", { paymentStatus: "paid" }, 404);
    await api(`/finance/accounts/${a.id}/purchases/${first.id}/payment`, "PATCH", { paymentStatus: "invalid" }, 400);
    await api(`/finance/accounts/${a.id}/purchases/${first.id}/payment`, "PATCH", { paymentStatus: "paid" });
    snapshot = await account(a.id);
    assert.equal(Number(snapshot.account.paid_total), 1850.75);
    assert.equal(Number(snapshot.account.unpaid_total), 0);
    assert.ok(snapshot.invoices.every((invoice) => invoice.paid));
    await api(`/finance/accounts/${a.id}/purchases/${first.id}/payment`, "PATCH", { paymentStatus: "unpaid" });
    checks.push("Paid/unpaid status persists, updates summaries and cannot target another customer");
    await api(`/inventory/${first.id}`, "PATCH", { ...draft, customerId: b.id, totalPurchase: "1100.25", totalSale: "1700.75", invoiceNumber: "INV-EDIT" });
    snapshot = await account(a.id);
    assert.equal(snapshot.purchases.length, 1);
    assert.equal(Number(snapshot.account.purchase_total), 200);
    assert.equal(Number(snapshot.account.paid_total), 350);
    snapshot = await account(b.id);
    assert.equal(Number(snapshot.account.sale_total), 1700.75);
    assert.equal(Number(snapshot.account.profit_total), 600.5);
    await api(`/inventory/${first.id}`, "DELETE");
    assert.deepEqual((await account(b.id)).purchases, []);
    assert.equal(Number((await account(b.id)).account.unpaid_total), 0);
    await api(`/inventory/${second.id}`, "DELETE");
    assert.equal(Number((await account(a.id)).account.paid_total), 0);
    checks.push("Editing/reassigning/deleting recalculates both customer accounts without duplicate entries");
    for (const invalid of [{ totalPurchase: "" }, { totalSale: "" }, { totalSale: -1 }, { totalPurchase: "1.001" }, { paymentStatus: "bad" }, { customerId: null }]) {
      await api("/inventory", "POST", { ...draft, ...invalid }, 400);
    }
    const legacy = (await api("/inventory", "POST", { name: "شراء قديم", supplier: "مورد قديم", quantity: 3, buyPrice: 10,
      salePrice: 20, invoiceNumber: "OLD-1", customerId: a.id, purchaseDate: "2026-10-22" }, 201)).item;
    assert.equal(Number((await account(a.id)).account.invoice_total), 30);
    const upgraded = (await api(`/inventory/${legacy.id}`, "PATCH", { ...draft, name: "سجل قديم معدل", totalPurchase: "36", totalSale: "90", invoiceNumber: "OLD-1" })).item;
    assert.equal(upgraded.quantity, 3);
    assert.equal(upgraded.remaining_quantity, 3);
    await api(`/inventory/${legacy.id}/movements`, "POST", { type: "use", quantity: 1, movementDate: "2026-10-22" }, 201);
    await api(`/inventory/${legacy.id}`, "PATCH", { ...draft, totalPurchase: "39.01", totalSale: "93", invoiceNumber: "OLD-1" });
    const inventorySnapshot = await api(`/inventory?focusId=${legacy.id}`);
    const afterMovement = inventorySnapshot.items[0];
    assert.equal(afterMovement.quantity, 3);
    assert.equal(afterMovement.remaining_quantity, 2);
    assert.equal(Number(inventorySnapshot.summary.stock_value), 26.01, "Legacy fractional costs keep exact remaining stock value");
    await api(`/inventory/${legacy.id}`, "DELETE", undefined, 409);
    checks.push("Historical quantities, stock movements and legacy invoice amounts remain compatible");
    const cheque = await api("/cheques", "POST", { chequeNumber: "TEST-CHEQUE", amount: 93, beneficiary: "اختبار",
      bank: "بنك الاختبار", issueDate: "2026-10-22", dueDate: "2026-10-30", status: "pending",
      customerId: a.id, invoiceIds: [Number(afterMovement.customer_invoice_id)] }, 201);
    assert.ok(cheque);
    assert.equal(Number((await account(a.id)).account.paid_total), 93);
    await api(`/finance/accounts/${a.id}/purchases/${legacy.id}/payment`, "PATCH", { paymentStatus: "unpaid" }, 409);
    const directPaid = (await api("/inventory", "POST", { ...draft, invoiceNumber: "DIRECT-PAID", paymentStatus: "paid" }, 201)).item;
    await api("/cheques", "POST", { chequeNumber: "DUPLICATE-PAY", amount: 1500.75, beneficiary: "اختبار", bank: "بنك",
      issueDate: "2026-10-22", dueDate: "2026-10-30", status: "pending", customerId: a.id,
      invoiceIds: [Number(directPaid.customer_invoice_id)] }, 409);
    checks.push("Cheque settlement remains authoritative and duplicate direct/cheque payment is rejected");
    pool = new pg.Pool({ connectionString, onConnect: (client) => client.query("SET search_path TO bennini,public").then(() => {}) });
    assert.equal(Number((await pool.query("SELECT COUNT(*) FROM transactions")).rows[0].count), 0, "Status changes must not invent cash movements");
    execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--test", "server/tests/finance.test.ts", "server/tests/printing.test.ts", "server/tests/schema-recovery.test.ts"],
      { env, stdio: "pipe", timeout: 120000 });
    checks.push("Existing finance, printing and schema-recovery regression suites pass on real PostgreSQL");

    // The normal built UI is served by the managed workflow. Forward every API
    // call to this disposable backend using its legitimately issued session.
    browser = await puppeteer.launch({ executablePath: execFileSync("which", ["chromium"]).toString().trim(),
      headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/")) return void request.continue();
      try {
        const response = await fetch(`${base}${url.pathname}${url.search}`, { method: request.method(),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          ...(!["GET", "HEAD"].includes(request.method()) ? { body: request.postData() } : {}) });
        await request.respond({ status: response.status, contentType: response.headers.get("content-type") || "application/json", body: Buffer.from(await response.arrayBuffer()) });
      } catch (error) { await request.abort(); errors.push(error.message); }
    });
    const web = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    await page.goto(`${web}/section/inventory`, { waitUntil: "networkidle0" });
    const clickText = async (text) => {
      await page.waitForFunction((text) => [...document.querySelectorAll("[tabindex],button,[role=button]")].some((el) => el.textContent.trim() === text), {}, text);
      await page.evaluate((text) => [...document.querySelectorAll("[tabindex],button,[role=button]")].find((el) => el.textContent.trim() === text).click(), text);
    };
    const fill = async (label, value) => {
      const selector = `input[aria-label="${label}"]`;
      await page.waitForSelector(selector);
      await page.click(selector, { clickCount: 3 }); await page.type(selector, value);
    };
    // Exact action label is deliberately asserted: this is the real form.
    await clickText("تسجيل عملية شراء");
    await fill("اسم السلعة *", "شراء من الواجهة");
    await fill("المورد *", "مورد الواجهة");
    await fill("رقم الفاتورة *", "UI-1");
    await fill("إجمالي الشراء (دج) *", "100.25");
    await fill("إجمالي البيع (دج) *", "150.75");
    assert.equal(await page.$('input[aria-label="الكمية *"]'), null);
    assert.equal(await page.$('input[aria-label*="سعر الشراء للوحدة"]'), null);
    const profit = await page.$eval('[aria-label="الفائدة المحسوبة"]', (el) => ({ value: el.textContent, color: getComputedStyle(el).color }));
    assert.ok(profit.value.replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit)).match(/50[.,٫]5/), `Exact live profit: ${profit.value}`);
    const channels = profit.color.match(/\d+/g).map(Number);
    assert.ok(channels[1] > channels[0] && channels[1] > channels[2], "Live profit is green");
    assert.equal(await page.$('[aria-label="الفائدة المحسوبة"] input'), null);
    await clickText("إضافة زبون جديد");
    await fill("اسم الزبون الجديد", "زبون الواجهة الجديد");
    await fill("هاتف الزبون", "0500000000");
    await clickText("حفظ الزبون والعودة للشراء");
    await page.waitForFunction(() => !document.body.innerText.includes("تسجيل زبون جديد"));
    assert.equal(await page.$eval('input[aria-label="اسم السلعة *"]', (el) => el.value), "شراء من الواجهة");
    const output = "generated-artifacts/customer-purchases";
    mkdirSync(output, { recursive: true });
    for (const [width, height] of [[1366, 768], [402, 874]]) {
      await page.setViewport({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "Purchase form fits the viewport");
      // Chromium fullPage captures are horizontally displaced on this RTL root.
      // Capture the actual viewport; scrolling stays inside the app's ScrollView.
      await page.$eval('input[aria-label="اسم السلعة *"]', (el) => el.scrollIntoView({ block: "center" }));
      await page.screenshot({ path: `${output}/form-${width}.jpg` });
    }
    await clickText("حفظ عملية الشراء");
    await page.waitForFunction(() => !document.querySelector('input[aria-label="اسم السلعة *"]'));
    const uiCustomer = (await api("/finance/accounts?kind=customer&q=" + encodeURIComponent("زبون الواجهة الجديد"))).items[0];
    assert.deepEqual((await api("/finance/accounts?kind=customer&q=0500000000")).items.map((item) => item.id), [uiCustomer.id]);
    snapshot = await account(uiCustomer.id);
    assert.equal(snapshot.purchases[0].name, "شراء من الواجهة");
    assert.equal(Number(snapshot.account.profit_total), 50.5);
    for (const [width, height] of [[1366, 768], [402, 874]]) {
      await page.setViewport({ width, height });
      await page.goto(`${web}/section/finance?area=customers&customerId=${uiCustomer.id}`, { waitUntil: "networkidle0" });
      await page.waitForSelector(`[data-testid="customer-purchase-${snapshot.purchases[0].id}"]`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "No horizontal overflow");
      await page.$eval(`[data-testid="customer-purchase-${snapshot.purchases[0].id}"]`, (el) => el.scrollIntoView({ block: "center" }));
      await page.screenshot({ path: `${output}/customer-${width}.jpg` });
    }
    await page.click(`[aria-label="تسجيل تسديد الشراء ${snapshot.purchases[0].id}"]`);
    await page.waitForFunction(() => document.body.innerText.includes("تغيير إلى غير مدفوعة"));
    assert.equal(Number((await account(uiCustomer.id)).account.unpaid_total), 0);
    assert.deepEqual(errors, []);
    checks.push("Real browser: totals-only form, live profit, inline customer creation, draft preservation, save and mobile payment");
    writeFileSync(`${output}/checks.json`, JSON.stringify(checks, null, 2));
    console.log(checks.map((line) => `PASS: ${line}`).join("\n"));
  } catch (error) {
    console.error(error);
    if (error.stdout) console.error(error.stdout.toString().slice(-10000));
    if (error.stderr) console.error(error.stderr.toString());
    console.error("Isolated API log tail:\n" + logs.slice(-10000));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (pool) await pool.end();
    if (service) { service.kill("SIGTERM"); await sleep(500); }
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
