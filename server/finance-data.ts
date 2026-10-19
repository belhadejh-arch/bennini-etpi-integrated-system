import { readFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";

export class FinanceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let schemaReady: Promise<void> | null = null;
export function prepareFinanceSchema(pool: pg.Pool) {
  if (!schemaReady) {
    schemaReady = pool.query(readFileSync(path.resolve("server/finance-schema.sql"), "utf8"))
      .then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export function positiveId(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new FinanceError(400, "المعرّف المحدد غير صالح.");
  return id;
}

export const customerInvoiceSelect = `
  SELECT ci.id, ci.customer_id, ci.invoice_number, ci.invoice_date::text,
    COALESCE((SELECT SUM(i.total_cost) FROM inventory_items i WHERE i.customer_invoice_id = ci.id), 0) AS amount,
    (c.id IS NOT NULL) AS paid, c.id AS cheque_id, c.cheque_number, c.status AS cheque_status,
    c.issue_date::text AS cheque_date, ci.created_by_name, ci.created_at
  FROM customer_invoices ci
  LEFT JOIN cheque_customer_invoices link ON link.invoice_id = ci.id AND link.active
  LEFT JOIN cheques c ON c.id = link.cheque_id AND c.status <> 'cancelled'
`;

export const financeAccountSelect = `
  SELECT a.*,
    COALESCE(inv.invoice_total, 0) AS invoice_total,
    COALESCE(inv.paid_total, 0) AS paid_total,
    COALESCE(inv.invoice_total - inv.paid_total, 0) AS unpaid_total,
    COALESCE(t.deposits, 0) AS deposits, COALESCE(t.withdrawals, 0) AS withdrawals,
    COALESCE(t.interest_total, 0) AS interest_total,
    COALESCE(t.deposits - t.withdrawals, 0) AS balance
  FROM finance_accounts a
  LEFT JOIN LATERAL (
    SELECT SUM(i.total_cost) AS invoice_total,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM cheque_customer_invoices link JOIN cheques c ON c.id = link.cheque_id
        WHERE link.invoice_id = i.customer_invoice_id AND link.active AND c.status <> 'cancelled'
      ) THEN i.total_cost ELSE 0 END) AS paid_total
    FROM inventory_items i WHERE i.customer_id = a.id
  ) inv ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS deposits,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS withdrawals,
      SUM(ROUND(amount * interest_rate / 100, 2)) AS interest_total
    FROM transactions WHERE account_id = a.id
  ) t ON TRUE
`;

export async function resolveTransactionAccount(
  client: pg.PoolClient, body: Record<string, unknown>,
  current?: { account_id: number | string | null; interest_rate: number | string },
) {
  const accountId = positiveId(body.accountId !== undefined ? body.accountId : current?.account_id);
  const interestRate = Number(body.interestRate ?? current?.interest_rate ?? 0);
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
    throw new FinanceError(400, "نسبة الفائدة يجب أن تكون بين 0 و100.");
  }
  if (!accountId) {
    if (interestRate !== 0) throw new FinanceError(400, "الفائدة متاحة في حسابات الشركاء فقط.");
    return { accountId: null, interestRate: 0, party: null };
  }
  const account = await client.query("SELECT name, kind FROM finance_accounts WHERE id = $1 FOR SHARE", [accountId]);
  if (!account.rowCount) throw new FinanceError(400, "الحساب المالي المحدد غير موجود.");
  if (account.rows[0].kind !== "partner" && interestRate !== 0) throw new FinanceError(400, "الفائدة متاحة في حسابات الشركاء فقط.");
  return { accountId, interestRate, party: String(account.rows[0].name) };
}

export async function ensureCustomerInvoice(
  client: pg.PoolClient,
  customerId: number | null,
  invoiceNumber: string,
  invoiceDate: string,
  actor: { clerk_user_id: string; name: string },
) {
  if (customerId === null) return null;
  if (!invoiceNumber.trim()) throw new FinanceError(400, "أدخل رقم الفاتورة المرتبطة بالزبون.");
  const account = await client.query("SELECT id FROM finance_accounts WHERE id = $1 AND kind = 'customer' FOR UPDATE", [customerId]);
  if (!account.rowCount) throw new FinanceError(400, "اختر زبوناً مسجلاً في التسيير المالي.");
  const result = await client.query(`
    INSERT INTO customer_invoices (customer_id, invoice_number, normalized_invoice_number, invoice_date, created_by_id, created_by_name)
    VALUES ($1, $2, LOWER(BTRIM($2)), $3, $4, $5)
    ON CONFLICT (customer_id, normalized_invoice_number) DO UPDATE SET invoice_number = EXCLUDED.invoice_number
    RETURNING id
  `, [customerId, invoiceNumber.trim(), invoiceDate, actor.clerk_user_id, actor.name]);
  const invoiceId = Number(result.rows[0].id);
  const settled = await client.query("SELECT 1 FROM cheque_customer_invoices WHERE invoice_id = $1 AND active", [invoiceId]);
  if (settled.rowCount) throw new FinanceError(409, "الفاتورة مرتبطة بشيك؛ أزل ربطها من الشيك قبل تعديل مبلغها أو إضافة مشتريات إليها.");
  return invoiceId;
}

export async function synchronizeChequeInvoices(
  client: pg.PoolClient, chequeId: number, customerId: number, invoiceIds: number[], status: string,
) {
  if (!invoiceIds.length || invoiceIds.length > 100 || new Set(invoiceIds).size !== invoiceIds.length) {
    throw new FinanceError(400, "اختر من فاتورة واحدة إلى 100 فاتورة دون تكرار.");
  }
  const account = await client.query("SELECT id FROM finance_accounts WHERE id = $1 AND kind = 'customer' FOR UPDATE", [customerId]);
  if (!account.rowCount) throw new FinanceError(400, "الزبون المحدد غير موجود.");
  const invoices = await client.query(`
    SELECT id, invoice_number FROM customer_invoices
    WHERE customer_id = $1 AND id = ANY($2::bigint[]) ORDER BY id FOR UPDATE
  `, [customerId, invoiceIds]);
  if (invoices.rowCount !== invoiceIds.length) throw new FinanceError(400, "كل الفواتير يجب أن تنتمي إلى الزبون المختار.");
  const hasPurchases = await client.query(`
    SELECT COUNT(DISTINCT customer_invoice_id)::int AS total FROM inventory_items
    WHERE customer_invoice_id = ANY($1::bigint[])
  `, [invoiceIds]);
  if (Number(hasPurchases.rows[0].total) !== invoiceIds.length) throw new FinanceError(400, "إحدى الفواتير لا تحتوي على مشتريات.");
  if (status !== "cancelled") {
    const conflict = await client.query(`
      SELECT 1 FROM cheque_customer_invoices WHERE invoice_id = ANY($1::bigint[]) AND active AND cheque_id <> $2
    `, [invoiceIds, chequeId]);
    if (conflict.rowCount) throw new FinanceError(409, "إحدى الفواتير مرتبطة بشيك آخر. حدّث قائمة الفواتير ثم أعد المحاولة.");
  }
  await client.query("DELETE FROM cheque_customer_invoices WHERE cheque_id = $1", [chequeId]);
  await client.query(`
    INSERT INTO cheque_customer_invoices (cheque_id, invoice_id, active)
    SELECT $1, id, $3 FROM unnest($2::bigint[]) id
  `, [chequeId, invoiceIds, status !== "cancelled"]);
  await client.query("UPDATE cheques SET customer_id = $1, invoice_id = NULL, invoice_number = $2 WHERE id = $3",
    [customerId, invoices.rows.map((invoice) => invoice.invoice_number).join("، "), chequeId]);
}
