import type { Express, RequestHandler } from "express";
import type pg from "pg";
import type { AuthenticatedRequest, Member, AuditEventOptions } from "./index";
import { hasPermission } from "../shared/access";
import type { SectionId } from "../shared/sections";
import { FinanceError, customerInvoiceSelect, financeAccountSelect, positiveId } from "./finance-data";

type Dependencies = {
  pool: pg.Pool;
  authenticate: RequestHandler;
  requireSection: (section: SectionId) => RequestHandler;
  requirePermission: (section: SectionId, action: "create" | "edit") => RequestHandler;
  audit: (client: pg.PoolClient, member: Member, action: string, details: string, event: AuditEventOptions) => Promise<void>;
  machinery: () => Promise<unknown[]>;
};

export function registerFinanceRoutes(app: Express, deps: Dependencies) {
  const { pool, authenticate, requireSection, requirePermission, audit, machinery } = deps;
  const failed = (res: Parameters<RequestHandler>[1], error: unknown) => {
    if (error instanceof FinanceError) return res.status(error.status).json({ error: error.message });
    if ((error as { code?: string })?.code === "23505") return res.status(409).json({ error: "حساب الدخول المحدد مرتبط بشريك آخر." });
    console.error("Finance account operation failed:", error);
    return res.status(500).json({ error: "تعذر إتمام عملية الحساب المالي. يرجى المحاولة لاحقاً." });
  };
  const customerAccess = (member: Member) => ["finance", "inventory", "cheques"].some((section) =>
    hasPermission(member, section as SectionId, "view"));
  const accountJson = (row: Record<string, unknown>) => ({ ...row, id: Number(row.id) });
  const invoiceJson = (row: Record<string, unknown>) => ({
    ...row, id: Number(row.id), customer_id: Number(row.customer_id),
    cheque_id: row.cheque_id == null ? null : Number(row.cheque_id),
  });

  app.get("/api/finance/accounts", authenticate, async (req: AuthenticatedRequest, res) => {
    const member = req.member!;
    const kind = String(req.query.kind ?? "");
    if (!["customer", "partner"].includes(kind)) return res.status(400).json({ error: "اختر قسم الزبائن أو الشركاء." });
    if ((kind === "customer" && !customerAccess(member)) || (kind === "partner" && !hasPermission(member, "finance", "view"))) {
      return res.status(403).json({ error: "ليس لديك صلاحية عرض هذه الحسابات." });
    }
    try {
      if (member.role === "partner") {
        const result = await pool.query(`${financeAccountSelect} WHERE a.kind = 'partner' AND a.member_id = $1 AND a.kind = $2 ORDER BY a.name, a.id`, [member.clerk_user_id, kind]);
        return res.json({ items: result.rows.map(accountJson) });
      }
      if (!hasPermission(member, "finance", "view")) {
        const result = await pool.query("SELECT id, name FROM finance_accounts WHERE kind = $1 ORDER BY name, id", [kind]);
        return res.json({ items: result.rows.map(accountJson) });
      }
      const result = await pool.query(`${financeAccountSelect} WHERE a.kind = $1 ORDER BY a.name, a.id`, [kind]);
      res.json({ items: result.rows.map(accountJson) });
    } catch (error) { failed(res, error); }
  });

  app.get("/api/finance/partner-members", authenticate, requireSection("finance"), async (req: AuthenticatedRequest, res) => {
    if (req.member!.role === "partner") return res.status(403).json({ error: "لا يمكنك عرض حسابات دخول الشركاء الآخرين." });
    try {
      const result = await pool.query("SELECT clerk_user_id, name FROM members WHERE role = 'partner' AND deleted_at IS NULL ORDER BY name");
      res.json({ items: result.rows });
    } catch (error) { failed(res, error); }
  });

  app.get("/api/finance/accounts/:id", authenticate, requireSection("finance"), async (req: AuthenticatedRequest, res) => {
    try {
      const id = positiveId(req.params.id);
      const member = req.member!;
      const account = await pool.query(`${financeAccountSelect} WHERE a.id = $1 ${member.role === "partner" ? "AND a.member_id = $2 AND a.kind = 'partner'" : ""}`,
        member.role === "partner" ? [id, member.clerk_user_id] : [id]);
      if (!account.rowCount) return res.status(404).json({ error: "الحساب غير موجود أو غير متاح لك." });
      const [transactions, invoices] = await Promise.all([
        pool.query(`
          SELECT t.id, t.type, t.amount, t.party, t.reason, t.payment_method, t.transaction_date::text AS date,
            t.account_id, t.interest_rate, ROUND(t.amount * t.interest_rate / 100, 2) AS interest_amount,
            t.recorded_by_name, t.recorded_by_id, t.notes, t.created_at,
            COALESCE((SELECT json_agg(json_build_object(
              'id', id, 'file_name', file_name, 'mime_type', mime_type, 'file_size', file_size
            ) ORDER BY created_at, id) FROM transaction_attachments WHERE transaction_id = t.id), '[]'::json) AS attachments
          FROM transactions t WHERE t.account_id = $1 ORDER BY t.transaction_date DESC, t.id DESC
        `, [id]),
        pool.query(`${customerInvoiceSelect} WHERE ci.customer_id = $1
          AND EXISTS (SELECT 1 FROM inventory_items i WHERE i.customer_invoice_id = ci.id)
          ORDER BY ci.invoice_date DESC, ci.id DESC`, [id]),
      ]);
      res.json({ account: accountJson(account.rows[0]), transactions: transactions.rows, invoices: invoices.rows.map(invoiceJson) });
    } catch (error) { failed(res, error); }
  });

  for (const method of ["post", "patch"] as const) {
    app[method](method === "post" ? "/api/finance/accounts" : "/api/finance/accounts/:id",
      authenticate, requireSection("finance"), requirePermission("finance", method === "post" ? "create" : "edit"),
      async (req: AuthenticatedRequest, res) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const name = String(req.body?.name ?? "").trim();
          const phone = String(req.body?.phone ?? "").trim();
          const address = String(req.body?.address ?? "").trim();
          const notes = String(req.body?.notes ?? "").trim();
          let memberId: string | null | undefined = req.body?.memberId === undefined
            ? undefined : req.body.memberId ? String(req.body.memberId) : null;
          if (!name || name.length > 200 || phone.length > 100 || address.length > 1000 || notes.length > 5000) {
            throw new FinanceError(400, "أدخل اسم الحساب وبيانات الاتصال ضمن الحدود المسموحة.");
          }
          let kind = String(req.body?.kind ?? "");
          let id = method === "patch" ? positiveId(req.params.id) : null;
          if (id) {
            const existing = await client.query("SELECT kind, member_id FROM finance_accounts WHERE id = $1 FOR UPDATE", [id]);
            if (!existing.rowCount) throw new FinanceError(404, "الحساب غير موجود.");
            kind = existing.rows[0].kind;
            if (memberId === undefined) memberId = existing.rows[0].member_id;
          }
          memberId ??= null;
          if (req.body?.memberId !== undefined && !["admin", "finance"].includes(req.member!.role)) {
            throw new FinanceError(403, "ربط حساب الدخول بالشريك متاح للإدارة فقط.");
          }
          if (!["customer", "partner"].includes(kind) || (kind !== "partner" && memberId)) throw new FinanceError(400, "نوع الحساب غير صالح.");
          if (memberId) {
            const member = await client.query("SELECT clerk_user_id FROM members WHERE clerk_user_id = $1 AND role = 'partner' AND deleted_at IS NULL FOR UPDATE", [memberId]);
            if (!member.rowCount) throw new FinanceError(400, "اختر حساب دخول بدور شريك.");
          }
          const result = id
            ? await client.query(`UPDATE finance_accounts SET name=$1,phone=$2,address=$3,notes=$4,member_id=$5,updated_at=NOW() WHERE id=$6 RETURNING id`, [name, phone, address, notes, memberId, id])
            : await client.query(`INSERT INTO finance_accounts (kind,name,phone,address,notes,member_id,created_by_id,created_by_name)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
              [kind, name, phone, address, notes, memberId, req.member!.clerk_user_id, req.member!.name]);
          id = Number(result.rows[0].id);
          await audit(client, req.member!, method === "post" ? "إضافة حساب مالي" : "تعديل حساب مالي", name,
            { section: "finance", eventType: method === "post" ? "create" : "update", entityId: id, data: { kind, memberId } });
          await client.query("COMMIT");
          const item = await pool.query(`${financeAccountSelect} WHERE a.id = $1`, [id]);
          res.status(method === "post" ? 201 : 200).json({ account: accountJson(item.rows[0]) });
        } catch (error) {
          await client.query("ROLLBACK");
          failed(res, error);
        } finally { client.release(); }
      });
  }

  app.get("/api/finance/customer-invoices", authenticate, async (req: AuthenticatedRequest, res) => {
    if (!customerAccess(req.member!) || req.member!.role === "partner") return res.status(403).json({ error: "ليس لديك صلاحية عرض فواتير الزبائن." });
    try {
      const customerId = positiveId(req.query.customerId);
      const chequeId = positiveId(req.query.chequeId);
      if (!customerId) throw new FinanceError(400, "اختر الزبون أولاً.");
      const result = await pool.query(`${customerInvoiceSelect}
        WHERE ci.customer_id = $1 AND (c.id IS NULL OR c.id = $2)
          AND EXISTS (SELECT 1 FROM inventory_items i WHERE i.customer_invoice_id = ci.id)
        ORDER BY ci.invoice_date DESC, ci.id DESC`, [customerId, chequeId]);
      res.json({ items: result.rows.map(invoiceJson) });
    } catch (error) { failed(res, error); }
  });

  app.get("/api/finance/machinery", authenticate, requireSection("finance"), async (req: AuthenticatedRequest, res) => {
    if (req.member!.role === "partner") return res.status(403).json({ error: "حساب الشريك مخصص لحساباته فقط." });
    try { res.json({ items: await machinery() }); } catch (error) { failed(res, error); }
  });
}
