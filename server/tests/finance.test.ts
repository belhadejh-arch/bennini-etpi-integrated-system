import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import express, { type RequestHandler } from "express";
import pg from "pg";
import { hasPermission } from "../../shared/access";
import { registerFinanceRoutes } from "../finance-routes";
import {
  ensureCustomerInvoice, synchronizeChequeInvoices, resolveTransactionAccount,
  customerInvoiceSelect, financeAccountSelect,
} from "../finance-data";
import type { AuthenticatedRequest, Member } from "../index";

test("partners cannot acquire other sections or writes through saved permissions", () => {
  const partner = { role: "partner", allowed_sections: ["finance", "users", "inventory"],
    permissions: { finance: { view: true, create: true }, users: { view: true } } };
  assert.equal(hasPermission(partner, "finance", "view"), true);
  assert.equal(hasPermission(partner, "finance", "create"), false);
  assert.equal(hasPermission(partner, "users", "view"), false);
  assert.equal(hasPermission(partner, "inventory", "view"), false);
});

test("financial accounts and cheque allocations use real isolated PostgreSQL records", {
  skip: !(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL),
}, async (t) => {
  // Only this randomly named, self-created schema is mutated and removed.
  const schema = `test_finance_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^test_finance_[a-f0-9]{32}$/);
  const pool = new pg.Pool({
    connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL,
    onConnect: async (client) => { await client.query(`SET search_path TO ${schema}, public`); },
  });
  const actor: Member = { clerk_user_id: "test-admin", name: "Test administrator", email: null, role: "admin", active: true, allowed_sections: [] };
  let listener: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(readFileSync("server/schema.sql", "utf8"));
    // Simulate an older external deployment missing later ledger metadata.
    await pool.query("ALTER TABLE transactions DROP COLUMN notes, DROP COLUMN updated_at");
    await pool.query(readFileSync("server/finance-schema.sql", "utf8"));
    await pool.query("SELECT notes, updated_at, account_id, interest_rate FROM transactions LIMIT 0");
    await pool.query(`INSERT INTO members(clerk_user_id,name,role,active)
      VALUES ('test-admin','Test administrator','admin',TRUE),('test-partner-a','Partner A','partner',TRUE),('test-partner-b','Partner B','partner',TRUE)`);
    const result = await pool.query(`
      INSERT INTO finance_accounts(kind,name,member_id,created_by_id,created_by_name)
      VALUES ('customer','Customer A',NULL,'test-admin','Test administrator'),
        ('customer','Customer B',NULL,'test-admin','Test administrator'),
        ('partner','Partner A','test-partner-a','test-admin','Test administrator'),
        ('partner','Partner B','test-partner-b','test-admin','Test administrator')
      RETURNING id,kind,name,member_id
    `);
    const [customerA, customerB, partnerA, partnerB] = result.rows;
    const client = await pool.connect();
    let invoice1: number;
    let invoice2: number;
    let foreignInvoice: number;
    try {
      invoice1 = (await ensureCustomerInvoice(client, Number(customerA.id), "INV-001", "2026-01-01", actor))!;
      invoice2 = (await ensureCustomerInvoice(client, Number(customerA.id), "INV-002", "2026-01-02", actor))!;
      foreignInvoice = (await ensureCustomerInvoice(client, Number(customerB.id), "INV-001", "2026-01-01", actor))!;
      await client.query(`INSERT INTO inventory_items(name,quantity,remaining_quantity,buy_price,total_cost,customer_id,customer_invoice_id)
        VALUES ('Item 1',2,2,100,200,$1,$2),('Item 2',1,1,300,300,$1,$3),('Foreign item',1,1,700,700,$4,$5)`,
        [customerA.id, invoice1, invoice2, customerB.id, foreignInvoice]);
      await client.query(`INSERT INTO transactions(type,amount,party,reason,payment_method,account_id,interest_rate,recorded_by_id,recorded_by_name)
        VALUES ('income',1000,'Partner A','Deposit','نقداً',$1,5,'test-admin','Test administrator'),
          ('expense',100,'Partner A','Withdrawal','نقداً',$1,2,'test-admin','Test administrator'),
          ('income',9999,'Partner B','Private deposit','نقداً',$2,10,'test-admin','Test administrator')`, [partnerA.id, partnerB.id]);
    } finally { client.release(); }

    const cash = async () => Number((await pool.query("SELECT SUM(CASE WHEN type='income' THEN amount ELSE -amount END) AS total FROM transactions WHERE payment_method='نقداً'")).rows[0].total);
    const originalCash = await cash();
    const cheque = await pool.query(`INSERT INTO cheques(cheque_number,amount,beneficiary,bank,issue_date,due_date,status)
      VALUES ('TEST-CHEQUE',500,'Customer A','Bank','2026-01-01','2026-02-01','pending') RETURNING id`);
    const chequeId = Number(cheque.rows[0].id);
    const allocate = async (ids: number[], status = "pending", customer = Number(customerA.id)) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await synchronizeChequeInvoices(client, chequeId, customer, ids, status);
        await client.query("UPDATE cheques SET status=$1 WHERE id=$2", [status, chequeId]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    };
    const invoiceRows = async () => (await pool.query(`${customerInvoiceSelect} WHERE ci.customer_id=$1 ORDER BY ci.id`, [customerA.id])).rows;

    await t.test("one cheque settles multiple customer invoices without changing cash", async () => {
      await allocate([invoice1, invoice2]);
      assert.deepEqual((await invoiceRows()).map((row) => row.paid), [true, true]);
      assert.equal(await cash(), originalCash);
      const summary = (await pool.query(`${financeAccountSelect} WHERE a.id=$1`, [customerA.id])).rows[0];
      assert.equal(Number(summary.paid_total), 500);
      assert.equal(Number(summary.unpaid_total), 0);
    });
    await t.test("editing invoice selection automatically releases omitted invoices", async () => {
      await allocate([invoice2]);
      assert.deepEqual((await invoiceRows()).map((row) => row.paid), [false, true]);
    });
    await t.test("a second active cheque cannot settle an already assigned invoice", async () => {
      const other = await pool.query(`INSERT INTO cheques(cheque_number,amount,beneficiary,issue_date,due_date,status)
        VALUES ('TEST-OTHER',300,'Customer A','2026-01-01','2026-02-01','pending') RETURNING id`);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await assert.rejects(synchronizeChequeInvoices(client, Number(other.rows[0].id), Number(customerA.id), [invoice2], "pending"), /بشيك آخر/);
      } finally {
        await client.query("ROLLBACK");
        client.release();
        await pool.query("DELETE FROM cheques WHERE id=$1", [other.rows[0].id]);
      }
    });
    await t.test("foreign customer invoices and duplicates are rejected atomically", async () => {
      await assert.rejects(allocate([foreignInvoice]), /تنتمي/);
      await assert.rejects(allocate([invoice2, invoice2]), /تكرار/);
      assert.deepEqual((await invoiceRows()).map((row) => row.paid), [false, true]);
    });
    await t.test("paid invoice values cannot be changed by adding purchase lines", async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await assert.rejects(ensureCustomerInvoice(client, Number(customerA.id), "INV-002", "2026-01-02", actor), /مرتبطة بشيك/);
      } finally { await client.query("ROLLBACK"); client.release(); }
    });
    await t.test("cancelling a cheque makes its invoices unpaid", async () => {
      await allocate([invoice1, invoice2], "cancelled");
      assert.deepEqual((await invoiceRows()).map((row) => row.paid), [false, false]);
    });
    await t.test("deleting a cheque releases every linked invoice", async () => {
      await allocate([invoice1, invoice2], "paid");
      await pool.query("DELETE FROM cheques WHERE id=$1", [chequeId]);
      assert.deepEqual((await invoiceRows()).map((row) => row.paid), [false, false]);
      assert.equal(await cash(), originalCash);
    });
    await t.test("each partner operation has its own interest percentage", async () => {
      const summary = (await pool.query(`${financeAccountSelect} WHERE a.id=$1`, [partnerA.id])).rows[0];
      assert.equal(Number(summary.deposits), 1000);
      assert.equal(Number(summary.withdrawals), 100);
      assert.equal(Number(summary.balance), 900);
      assert.equal(Number(summary.interest_total), 52);
      const client = await pool.connect();
      try {
        assert.equal((await resolveTransactionAccount(client, { accountId: partnerA.id, interestRate: 7.5 })).interestRate, 7.5);
        await assert.rejects(resolveTransactionAccount(client, { accountId: customerA.id, interestRate: 7.5 }), /الشركاء/);
      } finally { client.release(); }
    });

    const app = express();
    app.use(express.json());
    // Auth injection is confined to this isolated test server, never the app.
    const authenticate: RequestHandler = (req: AuthenticatedRequest, _res, next) => {
      const user = req.header("x-test-member") ?? actor.clerk_user_id;
      req.member = user === actor.clerk_user_id ? actor : { ...actor, role: "partner", clerk_user_id: user };
      next();
    };
    registerFinanceRoutes(app, {
      pool, authenticate,
      requireSection: (section) => (req: AuthenticatedRequest, res, next) =>
        hasPermission(req.member, section, "view") ? next() : res.status(403).end(),
      requirePermission: (section, action) => (req: AuthenticatedRequest, res, next) =>
        hasPermission(req.member, section, action) ? next() : res.status(403).end(),
      audit: async () => {}, machinery: async () => [],
    });
    listener = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => listener!.once("listening", resolve));
    const address = listener.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const request = (path: string, options: RequestInit = {}) =>
      fetch(`${base}${path}`, { ...options, headers: { "x-test-member": "test-partner-a", "Content-Type": "application/json", ...options.headers } });
    await t.test("administrator account creation returns a selectable numeric account ID", async () => {
      const response = await request("/finance/accounts", {
        method: "POST", headers: { "x-test-member": actor.clerk_user_id },
        body: JSON.stringify({ kind: "customer", name: "New customer", phone: "000", address: "Test address", notes: "Test" }),
      });
      assert.equal(response.status, 201);
      const result = await response.json();
      assert.equal(typeof result.account.id, "number");
      assert.equal(result.account.name, "New customer");
    });
    await t.test("editing partner contact details preserves the linked login when omitted", async () => {
      const response = await request(`/finance/accounts/${partnerA.id}`, {
        method: "PATCH", headers: { "x-test-member": actor.clerk_user_id },
        body: JSON.stringify({ name: "Partner A updated", phone: "000", notes: "Updated", address: "" }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).account.member_id, "test-partner-a");
    });
    await t.test("a partner only receives their own account and cannot guess another ID", async () => {
      const list = await (await request("/finance/accounts?kind=partner")).json();
      assert.deepEqual(list.items.map((item: { id: number | string }) => Number(item.id)), [Number(partnerA.id)]);
      assert.equal((await request(`/finance/accounts/${partnerB.id}`)).status, 404);
      assert.equal((await request(`/finance/accounts/${customerA.id}`)).status, 404);
      const detail = await (await request(`/finance/accounts/${partnerA.id}`)).json();
      assert.equal(detail.transactions.length, 2);
      assert.equal(Number(detail.account.interest_total), 52);
    });
    await t.test("partner role cannot list member logins, machine finances or create accounts", async () => {
      assert.equal((await request("/finance/partner-members")).status, 403);
      assert.equal((await request("/finance/machinery")).status, 403);
      assert.equal((await request("/finance/accounts", { method: "POST", body: JSON.stringify({ kind: "partner", name: "Other" }) })).status, 403);
    });
  } finally {
    if (listener) await new Promise<void>((resolve) => listener!.close(() => resolve()));
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  }
});
