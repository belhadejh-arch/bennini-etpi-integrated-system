/* Optional end-to-end check against a running development app.
 * Uses a disposable member, machinery and rentals; never changes existing records.
 * Run: node scripts/test-rental-workflow.cjs
 */
const assert = require("node:assert/strict");
const { createHmac, randomBytes, randomInt, randomUUID, scryptSync } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const pg = require("pg");
const WebSocket = require("ws");

async function main() {
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const db = new pg.Client({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });
  const memberId = `test-rental-${randomUUID()}`;
  const profile = mkdtempSync(path.join(os.tmpdir(), "rental-browser-"));
  let browser, ws, machineId, closeBrowser;
  const rentalIds = [];
  await db.connect();
  try {
    await db.query("SET search_path TO bennini, public");
    let serial, lookup;
    do {
      serial = String(randomInt(100000, 1000000));
      lookup = createHmac("sha256", process.env.SESSION_SECRET).update(`serial:${serial}`).digest("hex");
    } while ((await db.query("SELECT 1 FROM members WHERE serial_lookup=$1", [lookup])).rowCount);
    const salt = randomBytes(16);
    const hash = `${salt.toString("hex")}:${scryptSync(serial, salt, 64).toString("hex")}`;
    await db.query(`INSERT INTO members(clerk_user_id,name,role,active,serial_lookup,serial_hash)
      VALUES ($1,'اختبار الكراء المؤقت','admin',TRUE,$2,$3)`, [memberId, lookup, hash]);
    const login = await fetch(`${base}/api/auth/login`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serial }) });
    assert.equal(login.status, 200, "Normal serial login");
    const { token } = await login.json();
    const api = async (route, body, method = "POST") => {
      const result = await fetch(`${base}/api${route}`, { method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: result.status, body: await result.json() };
    };
    const machine = await api("/machinery", { code: memberId, name: "آلة اختبار الورديات" });
    assert.equal(machine.status, 201);
    machineId = machine.body.item.id;
    const data = { machineryId: machineId, equipment: "آلة اختبار الورديات", clientOrOwner: "اختبار مؤقت",
      startDate: "2026-10-01", endDate: "2026-10-05", ratePeriod: "shift",
      rentalRate: 1000, paidAmount: 500, status: "active", dailyShifts: [
        { date: "2026-10-01", shifts: 1.5 }, { date: "2026-10-02", shifts: 0, holiday: true },
      ] };
    const created = await api("/rentals", data);
    assert.equal(created.status, 201);
    const id = created.body.id;
    rentalIds.push(id);
    const read = async () => (await api(`/rentals?focusId=${id}`, undefined, "GET")).body.items[0];
    let saved = await read();
    assert.equal(Number(saved.total_amount), 4500);
    assert.equal(Number(saved.remaining), 4000);
    assert.deepEqual(saved.daily_shifts, data.dailyShifts);
    assert.equal((await api(`/rentals/${id}`, { status: "completed" }, "PATCH")).status, 200);
    saved = await read();
    assert.deepEqual(saved.daily_shifts, data.dailyShifts, "Status-only edit preserves daily shifts");
    assert.equal((await api(`/rentals/${id}`, { endDate: "2026-09-01" }, "PATCH")).status, 400);
    assert.equal((await api(`/rentals/${id}`, { endDate: null, status: "completed" }, "PATCH")).status, 200);
    saved = await read();
    assert.equal(saved.end_date, null);
    assert.equal(saved.status, "active");
    await api(`/rentals/${id}`, data, "PATCH");
    console.log("Authenticated API: create, reopen, update, date validation and ongoing status passed.");

    browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage",
      "--remote-debugging-port=9223", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
    let version;
    for (let i = 0; i < 60; i++) {
      try { version = await (await fetch("http://127.0.0.1:9223/json/version")).json(); break; }
      catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    assert.ok(version, "Chromium starts");
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
    let seq = 0;
    const pending = new Map();
    ws.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if(message.method==="Page.javascriptDialogOpening"){
        ws.send(JSON.stringify({id:++seq,method:"Page.handleJavaScriptDialog",params:{accept:true},sessionId:message.sessionId}));
        return;
      }
      if (!message.id) return;
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    });
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++seq;
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Browser operation timed out: ${method}`));},15000);
      pending.set(id, { resolve, reject,timer });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    closeBrowser=()=>call("Browser.close");
    const target = await call("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await call("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    const cdp = (method, params) => call(method, params, sessionId);
    const evaluate = async (expression) => {
      const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true,userGesture:true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = async (expression) => {
      for (let i = 0; i < 100; i++) {
        if (await evaluate(expression)) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`UI condition timed out: ${expression}`);
    };
    const clickText = async (text) => {
      const clicked = await evaluate(`(() => {
        const el = [...document.querySelectorAll('div,button')].find(e =>
          e.textContent === ${JSON.stringify(text)} && (e.getAttribute('role') === 'button' || e.tabIndex === 0));
        if (!el) return false; el.click(); return true;
      })()`);
      assert.ok(clicked, `Click ${text}`);
    };
    await cdp("Page.enable");
    await cdp("Page.addScriptToEvaluateOnNewDocument", { source:
      `localStorage.setItem("bennini_session_token", ${JSON.stringify(token)});` });
    await cdp("Page.navigate", { url: `${base}/section/rentals?focusId=${id}` });
    await wait(`document.body.innerText.includes("تعديل البيانات")`);
    await clickText("تعديل البيانات");
    await wait(`document.body.innerText.includes("تطبيق على كل الأيام")`);
    assert.ok(await evaluate(`document.body.innerText.includes("سعر الوردية (دج)")`));
    assert.equal(await evaluate(`document.querySelectorAll('input[aria-label^="عدد الورديات"]').length`), 5);
    const changeInput = async (selector, text) => {
      await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)});
        e.focus(); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        set.call(e,${JSON.stringify(text)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.blur(); })()`);
    };
    await changeInput('input[aria-label="عدد الورديات 2026-10-01"]', "1.75");
    await wait(`document.querySelector('input[aria-label="عدد الورديات 2026-10-01"]').value === "1.75"`);
    await clickText("حفظ التعديلات");
    await wait(`!document.body.innerText.includes("تطبيق على كل الأيام")`);
    assert.equal((await read()).daily_shifts.find((row) => row.date === "2026-10-01").shifts, 1.75);
    await clickText("تعديل البيانات");
    await wait(`document.body.innerText.includes("تطبيق على كل الأيام")`);
    assert.equal(await evaluate(`document.querySelector('input[aria-label="عدد الورديات 2026-10-01"]').value`), "1.75");
    for (const width of [375, 768, 1366]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await new Promise((r) => setTimeout(r, 100));
      assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`), `No horizontal overflow at ${width}px`);
    }
    console.log("Signed-in browser: daily custom edit, save/reopen and responsive widths 375/768/1366 passed.");
    await clickText("إغلاق النموذج");
    await wait(`document.body.innerText.includes("تعديل البيانات")`);
    assert.ok(await evaluate(`(() => {
        const label=[...document.querySelectorAll('div,span')].find(e=>e.textContent==='إدارة الكراء'&&e.children.length===0);
      return !!label && getComputedStyle(label).fontFamily.includes('Changa');
    })()`),"Changa is applied to rendered text");
    await evaluate(`(()=>{const buttons=[...document.querySelectorAll('[aria-label="طباعة"]')];buttons[buttons.length-1].click()})()`);
    await wait(`document.body.innerText.includes("الطباعة والتقارير")`);
    await wait(`(() => {
      const button=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent==="معاينة والطباعة");
      return !!button && button.getAttribute("aria-disabled")!=="true" && !button.hasAttribute("disabled");
    })()`);
    await clickText("معاينة والطباعة");
    let previewTarget;
    for(let i=0;i<100;i++){
      const targets=await call("Target.getTargets");
      previewTarget=targets.targetInfos.find((info)=>info.type==="page"&&info.targetId!==target.targetId&&info.title.includes("عقود الكراء"));
      if(previewTarget)break;
      await new Promise((r)=>setTimeout(r,100));
    }
    assert.ok(previewTarget,"Real print preview opens");
    const previewSession=await call("Target.attachToTarget",{targetId:previewTarget.targetId,flatten:true});
    const previewCall=(method,params)=>call(method,params,previewSession.sessionId);
    const content=await previewCall("Runtime.evaluate",{expression:"document.body.innerText",returnByValue:true});
    assert.ok(content.result.value.includes("الورديات اليومية"));
    assert.ok(content.result.value.includes("2026-10-05"));
    assert.ok(content.result.value.includes("1.75")||content.result.value.includes("١٫٧٥"));
    await previewCall("Runtime.evaluate",{expression:"document.fonts.ready",awaitPromise:true});
    const pdf=await previewCall("Page.printToPDF",{printBackground:true,preferCSSPageSize:true});
    const pdfBuffer=Buffer.from(pdf.data,"base64");
    assert.ok(pdfBuffer.subarray(0,5).toString()==="%PDF-");
    assert.ok(pdfBuffer.length>10000,"PDF contains embedded fonts and logo");
    await call("Target.closeTarget",{targetId:previewTarget.targetId});
    console.log("Printing browser: selected rental preview includes daily shifts; a real PDF was generated successfully.");
  } finally {
    if (rentalIds.length) await db.query("DELETE FROM rentals WHERE id=ANY($1::bigint[])", [rentalIds]);
    if (machineId) await db.query("DELETE FROM machinery WHERE id=$1", [machineId]);
    await db.query("DELETE FROM audit_logs WHERE performed_by_id=$1", [memberId]);
    await db.query("DELETE FROM members WHERE clerk_user_id=$1", [memberId]);
    await db.end();
    try{await closeBrowser?.();}catch{}
    if (ws) ws.close();
    if (browser && browser.exitCode===null) { browser.kill("SIGTERM"); await new Promise((r) => browser.once("exit", r)); }
    try {rmSync(profile, { recursive: true, force: true, maxRetries:10,retryDelay:200 });}
    catch {console.warn("Temporary browser profile could not be removed immediately.");}
  }
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
