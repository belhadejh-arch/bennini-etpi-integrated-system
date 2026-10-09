import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import multer from "multer";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import cors from "cors";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pg from "pg";
import { allSectionIds, type SectionId } from "../shared/sections";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
const port = Number(process.env.PORT ?? 5000);
const bootstrapEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();

app.disable("x-powered-by");
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

type Member = {
  clerk_user_id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  allowed_sections: string[];
};

type AuthenticatedRequest = Request & {
  member?: Member;
};

const adminSections = [...allSectionIds];
const paymentMethods = ["نقداً", "شيك", "تحويل بنكي"] as const;
const transactionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx", ".xls", ".xlsx"]);
    if (!allowedTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      callback(new Error("نوع الملف غير مدعوم. استخدم PDF أو صورة أو مستند Office."));
      return;
    }
    callback(null, true);
  },
}).array("files", 5);

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

async function loadMember(req: AuthenticatedRequest, res: Response): Promise<Member | null> {
  const auth = getAuth(req);
  if (!auth.userId) {
    fail(res, 401, "يلزم تسجيل الدخول.");
    return null;
  }

  let result = await pool.query<Member>(
    "SELECT clerk_user_id, email, name, role, active, allowed_sections FROM members WHERE clerk_user_id = $1",
    [auth.userId],
  );

  if (result.rowCount === 0) {
    const identity = await clerkClient.users.getUser(auth.userId);
    const primaryEmail = identity.emailAddresses.find(
      (address) => address.id === identity.primaryEmailAddressId,
    );
    const email = primaryEmail?.emailAddress.trim().toLowerCase();
    const verified = primaryEmail?.verification?.status === "verified";

    if (!email || !verified) {
      fail(res, 403, "يجب تأكيد البريد الإلكتروني قبل طلب الوصول.");
      return null;
    }

    const isFirstAdmin = bootstrapEmail !== undefined && email === bootstrapEmail;
    const inserted = await pool.query<Member>(
      `INSERT INTO members (clerk_user_id, email, name, role, active, allowed_sections)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (clerk_user_id) DO UPDATE SET email = EXCLUDED.email
       RETURNING clerk_user_id, email, name, role, active, allowed_sections`,
      [
        auth.userId,
        email,
        [identity.firstName, identity.lastName].filter(Boolean).join(" ") || email,
        isFirstAdmin ? "admin" : "pending",
        isFirstAdmin,
        isFirstAdmin ? adminSections : [],
      ],
    );
    result = inserted;

    if (isFirstAdmin) {
      await pool.query(
        "INSERT INTO audit_logs (action, details, performed_by_id, performed_by_name) VALUES ($1, $2, $3, $4)",
        ["تهيئة المدير الأول", "تم إنشاء حساب المدير الأول بعد التحقق من بريده.", auth.userId, email],
      );
    }
  }

  const member = result.rows[0];
  req.member = member;
  return member;
}

async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const member = await loadMember(req, res);
    if (!member) return;
    if (!member.active) {
      fail(res, 403, "الحساب قيد انتظار تفعيل المدير.");
      return;
    }
    next();
  } catch (error) {
    console.error("Authentication check failed:", error);
    fail(res, 500, "تعذر التحقق من صلاحية الحساب.");
  }
}

function requireSection(section: SectionId) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const member = req.member;
    if (!member || (member.role !== "admin" && !member.allowed_sections.includes(section))) {
      fail(res, 403, "ليس لديك صلاحية الوصول إلى هذا القسم.");
      return;
    }
    next();
  };
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.member?.role !== "admin") {
    fail(res, 403, "هذه العملية متاحة للمدير فقط.");
    return;
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.member?.role !== "admin" && !roles.includes(req.member?.role ?? "")) {
      fail(res, 403, "دور الحساب لا يسمح بتسجيل هذا النوع من العمليات.");
      return;
    }
    next();
  };
}

async function writeAudit(member: Member, action: string, details: string) {
  await pool.query(
    "INSERT INTO audit_logs (action, details, performed_by_id, performed_by_name) VALUES ($1, $2, $3, $4)",
    [action, details, member.clerk_user_id, member.name],
  );
}

async function writeAuditWithClient(client: pg.PoolClient, member: Member, action: string, details: string) {
  await client.query(
    "INSERT INTO audit_logs (action, details, performed_by_id, performed_by_name) VALUES ($1, $2, $3, $4)",
    [action, details, member.clerk_user_id, member.name],
  );
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function uploadFiles(req: Request, res: Response, next: NextFunction) {
  transactionUpload(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof Error ? error.message : "تعذر رفع المستند.";
    return fail(res, error instanceof multer.MulterError ? 400 : 415, message);
  });
}

async function recalculateCashBalances(client: pg.PoolClient) {
  await client.query(
    `WITH balances AS (
       SELECT id,
         SUM(CASE WHEN payment_method = 'نقداً'
           THEN CASE WHEN type = 'income' THEN amount ELSE -amount END
           ELSE 0 END)
         OVER (ORDER BY transaction_date ASC, created_at ASC, id ASC
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance
       FROM transactions
     )
     UPDATE transactions AS target
     SET cash_balance_after = balances.balance
     FROM balances
     WHERE target.id = balances.id`,
  );
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch {
    fail(res, 503, "قاعدة البيانات غير متاحة.");
  }
});

app.get("/api/me", async (req: AuthenticatedRequest, res) => {
  try {
    const member = await loadMember(req, res);
    if (!member) return;
    if (!member.active) {
      res.status(403).json({
        error: "الحساب قيد انتظار تفعيل المدير.",
        pending: true,
        member,
      });
      return;
    }
    res.json({ member });
  } catch (error) {
    console.error("Failed to load member:", error);
    fail(res, 500, "تعذر تحميل بيانات العضو.");
  }
});

app.get("/api/dashboard", authenticate, requireSection("dashboard"), async (_req, res) => {
  try {
    const [cash, purchases, inventory, cheques, rentals, recent, field] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'income'), 0) AS income,
          COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'expense'), 0)
            + COALESCE((SELECT SUM(amount) FROM field_expenses), 0) AS outgoing
      `),
      pool.query("SELECT COALESCE(SUM(total_cost), 0) AS total FROM inventory_items"),
      pool.query("SELECT COALESCE(SUM(remaining_quantity * buy_price), 0) AS total FROM inventory_items"),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_amount,
          COUNT(*) FILTER (WHERE status = 'pending' AND due_date <= CURRENT_DATE)::int AS due_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending' AND due_date <= CURRENT_DATE), 0) AS due_amount
        FROM cheques
      `),
      pool.query("SELECT COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) AS remaining FROM rentals"),
      pool.query(`
        SELECT id, type, amount, party, reason, transaction_date AS date, recorded_by_name AS recorded_by
        FROM transactions ORDER BY transaction_date DESC, created_at DESC LIMIT 6
      `),
      pool.query(`
        SELECT id, category, amount, site_name, details, created_by_name, created_at, fuel_liters
        FROM field_expenses ORDER BY created_at DESC LIMIT 5
      `),
    ]);

    const incoming = Number(cash.rows[0].income);
    const outgoing = Number(cash.rows[0].outgoing);
    res.json({
      stats: {
        incoming,
        outgoing,
        balance: incoming - outgoing,
        purchases: Number(purchases.rows[0].total),
        inventoryValue: Number(inventory.rows[0].total),
        pendingCheques: Number(cheques.rows[0].pending_amount),
        pendingChequeCount: Number(cheques.rows[0].pending_count),
        dueCheques: Number(cheques.rows[0].due_amount),
        dueChequeCount: Number(cheques.rows[0].due_count),
        rentalRemaining: Number(rentals.rows[0].remaining),
      },
      recentOperations: recent.rows,
      fieldExpenses: field.rows,
    });
  } catch (error) {
    console.error("Dashboard query failed:", error);
    fail(res, 500, "تعذر تحميل ملخص الصفحة الرئيسية.");
  }
});

app.get("/api/transactions", authenticate, requireSection("finance"), async (req, res) => {
  const query = req.query;
  const where: string[] = [];
  const values: unknown[] = [];
  const value = (item: unknown) => {
    values.push(item);
    return `$${values.length}`;
  };
  const type = typeof query.type === "string" ? query.type : "";
  const method = typeof query.paymentMethod === "string" ? query.paymentMethod : "";
  const from = typeof query.from === "string" ? query.from : "";
  const to = typeof query.to === "string" ? query.to : "";
  const minAmount = typeof query.minAmount === "string" ? query.minAmount : "";
  const maxAmount = typeof query.maxAmount === "string" ? query.maxAmount : "";
  const party = typeof query.party === "string" ? query.party.trim() : "";
  const recorder = typeof query.recorder === "string" ? query.recorder.trim() : "";

  if (type && !["income", "expense"].includes(type)) return fail(res, 400, "نوع العملية غير صالح.");
  if (method && !paymentMethods.includes(method as (typeof paymentMethods)[number])) return fail(res, 400, "طريقة الدفع غير صالحة.");
  if (from && !validIsoDate(from)) return fail(res, 400, "تاريخ البداية غير صالح.");
  if (to && !validIsoDate(to)) return fail(res, 400, "تاريخ النهاية غير صالح.");
  if (minAmount && (!Number.isFinite(Number(minAmount)) || Number(minAmount) < 0)) return fail(res, 400, "الحد الأدنى للمبلغ غير صالح.");
  if (maxAmount && (!Number.isFinite(Number(maxAmount)) || Number(maxAmount) < 0)) return fail(res, 400, "الحد الأعلى للمبلغ غير صالح.");
  if (from && to && from > to) return fail(res, 400, "تاريخ البداية يجب أن يسبق تاريخ النهاية.");
  if (minAmount && maxAmount && Number(minAmount) > Number(maxAmount)) return fail(res, 400, "الحد الأدنى للمبلغ أكبر من الحد الأعلى.");

  if (type) where.push(`t.type = ${value(type)}`);
  if (method) where.push(`t.payment_method = ${value(method)}`);
  if (from) where.push(`t.transaction_date >= ${value(from)}::date`);
  if (to) where.push(`t.transaction_date <= ${value(to)}::date`);
  if (minAmount) where.push(`t.amount >= ${value(minAmount)}`);
  if (maxAmount) where.push(`t.amount <= ${value(maxAmount)}`);
  if (party) where.push(`t.party ILIKE ${value(`%${party}%`)}`);
  if (recorder) where.push(`t.recorded_by_name ILIKE ${value(`%${recorder}%`)}`);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, Math.min(100000, Number.parseInt(String(query.page ?? "1"), 10) || 1));
  const pageSize = 25;
  const pageValues = [...values, pageSize, (page - 1) * pageSize];
  try {
    const [result, count, balance] = await Promise.all([
      pool.query(
        `SELECT t.id, t.type, t.amount, t.party, t.reason, t.payment_method, t.transaction_date AS date,
          t.cash_balance_after, t.notes, t.recorded_by_id, t.recorded_by_name, t.created_at, t.updated_at,
          COALESCE((SELECT json_agg(json_build_object(
            'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size', a.file_size
          ) ORDER BY a.created_at) FROM transaction_attachments a WHERE a.transaction_id = t.id), '[]'::json) AS attachments
         FROM transactions t ${clause}
         ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        pageValues,
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM transactions t ${clause}`, values),
      pool.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS amount
         FROM transactions WHERE payment_method = 'نقداً'`,
      ),
    ]);
    res.json({ items: result.rows, total: count.rows[0].total, page, pageSize, cashBalance: Number(balance.rows[0].amount) });
  } catch (error) {
    console.error("Transaction search failed:", error);
    fail(res, 500, "تعذر تحميل العمليات المالية.");
  }
});

app.get("/api/sections/:section", authenticate, async (req: AuthenticatedRequest, res) => {
  const section = req.params.section as SectionId;
  if (!allSectionIds.includes(section)) return fail(res, 404, "القسم غير موجود.");
  if (section === "users" || section === "audit") {
    if (req.member?.role !== "admin") return fail(res, 403, "هذه الصفحة متاحة للمدير فقط.");
  } else if (req.member?.role !== "admin" && !req.member?.allowed_sections.includes(section)) {
    return fail(res, 403, "ليس لديك صلاحية الوصول إلى هذا القسم.");
  }

  try {
    const queries: Partial<Record<SectionId, string>> = {
      finance: `SELECT id, type, amount, party, reason, payment_method, transaction_date AS date, recorded_by_name
        FROM transactions ORDER BY transaction_date DESC, created_at DESC LIMIT 100`,
      inventory: `SELECT id, name, quantity, remaining_quantity, buy_price, total_cost, supplier, invoice_number, purchase_date
        FROM inventory_items ORDER BY created_at DESC LIMIT 100`,
      cheques: `SELECT id, cheque_number, invoice_number, amount, beneficiary, bank, issue_date, due_date, status, notes
        FROM cheques ORDER BY due_date ASC LIMIT 100`,
      rentals: `SELECT id, equipment, client_or_owner, start_date, end_date, total_amount, paid_amount,
        GREATEST(total_amount - paid_amount, 0) AS remaining, status FROM rentals ORDER BY end_date ASC LIMIT 100`,
      field: `SELECT id, category, amount, site_name, details, created_by_name, created_at, fuel_liters
        FROM field_expenses ORDER BY created_at DESC LIMIT 100`,
      machinery: "SELECT id, code, name, category, status, hours_worked FROM machinery ORDER BY code LIMIT 100",
      audit: `SELECT id, action, details, performed_by_name, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100`,
    };
    const query = queries[section];
    if (!query) return res.json({ items: [] });
    const result = await pool.query(query);
    res.json({ items: result.rows });
  } catch (error) {
    console.error(`Section query failed for ${section}:`, error);
    fail(res, 500, "تعذر تحميل بيانات القسم.");
  }
});

app.post("/api/transactions", authenticate, requireSection("finance"), requireRole("finance"), async (req: AuthenticatedRequest, res) => {
  const { type, amount, party, reason, paymentMethod, transactionDate, notes } = req.body ?? {};
  if (!["income", "expense"].includes(type) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 ||
      typeof party !== "string" || !party.trim() || !paymentMethods.includes(paymentMethod) ||
      (transactionDate !== undefined && !validIsoDate(transactionDate))) {
    return fail(res, 400, "أدخل نوع العملية والمبلغ والجهة وطريقة الدفع والتاريخ بشكل صحيح.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(574382910)");
    const member = req.member!;
    const result = await client.query(
      `INSERT INTO transactions (type, amount, party, reason, payment_method, transaction_date, notes, recorded_by_id, recorded_by_name)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9)
       RETURNING id`,
      [type, amount, party.trim(), String(reason ?? "").trim(), paymentMethod, transactionDate ?? null, String(notes ?? "").trim(), member.clerk_user_id, member.name],
    );
    await recalculateCashBalances(client);
    const item = await client.query(
      `SELECT id, type, amount, party, reason, payment_method, transaction_date AS date, cash_balance_after,
        notes, recorded_by_id, recorded_by_name, created_at, updated_at
       FROM transactions WHERE id = $1`,
      [result.rows[0].id],
    );
    await writeAuditWithClient(client, member, "تسجيل عملية مالية", `${type === "income" ? "دخل" : "مصروف"} بقيمة ${amount} دج.`);
    await client.query("COMMIT");
    res.status(201).json({ item: item.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transaction creation failed:", error);
    fail(res, 500, "تعذر حفظ العملية المالية.");
  } finally {
    client.release();
  }
});

app.patch("/api/transactions/:id", authenticate, requireSection("finance"), requireRole("finance"), async (req: AuthenticatedRequest, res) => {
  const { type, amount, party, reason, paymentMethod, transactionDate, notes } = req.body ?? {};
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !["income", "expense"].includes(type) ||
      !Number.isFinite(Number(amount)) || Number(amount) <= 0 || typeof party !== "string" || !party.trim() ||
      !paymentMethods.includes(paymentMethod) || !validIsoDate(transactionDate)) {
    return fail(res, 400, "بيانات العملية المالية غير صالحة.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(574382910)");
    const result = await client.query(
      `UPDATE transactions SET type = $1, amount = $2, party = $3, reason = $4, payment_method = $5,
        transaction_date = $6, notes = $7, updated_at = NOW()
       WHERE id = $8 RETURNING id`,
      [type, amount, party.trim(), String(reason ?? "").trim(), paymentMethod, transactionDate, String(notes ?? "").trim(), id],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "العملية المالية غير موجودة.");
    }
    await recalculateCashBalances(client);
    const item = await client.query(
      `SELECT id, type, amount, party, reason, payment_method, transaction_date AS date, cash_balance_after,
        notes, recorded_by_id, recorded_by_name, created_at, updated_at
       FROM transactions WHERE id = $1`,
      [id],
    );
    await writeAuditWithClient(client, req.member!, "تعديل عملية مالية", `تحديث العملية رقم ${id}.`);
    await client.query("COMMIT");
    res.json({ item: item.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transaction update failed:", error);
    fail(res, 500, "تعذر تعديل العملية المالية.");
  } finally {
    client.release();
  }
});

app.delete("/api/transactions/:id", authenticate, requireSection("finance"), requireAdmin, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم العملية غير صالح.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(574382910)");
    const result = await client.query("DELETE FROM transactions WHERE id = $1 RETURNING id", [id]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "العملية المالية غير موجودة.");
    }
    await recalculateCashBalances(client);
    await writeAuditWithClient(client, req.member!, "حذف عملية مالية", `حذف العملية رقم ${id}.`);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transaction deletion failed:", error);
    fail(res, 500, "تعذر حذف العملية المالية.");
  } finally {
    client.release();
  }
});

app.post("/api/transactions/:id/attachments", authenticate, requireSection("finance"), requireRole("finance"), uploadFiles, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!Number.isSafeInteger(id) || id <= 0 || files.length === 0) return fail(res, 400, "اختر مستنداً واحداً على الأقل.");
  const member = req.member!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM transactions WHERE id = $1 FOR UPDATE", [id]);
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "العملية المالية غير موجودة.");
    }
    const saved = [];
    for (const file of files) {
      const result = await client.query(
        `INSERT INTO transaction_attachments
          (transaction_id, file_name, mime_type, file_size, file_data, uploaded_by_id, uploaded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, file_name, mime_type, file_size`,
        [id, path.basename(file.originalname), file.mimetype, file.size, file.buffer, member.clerk_user_id, member.name],
      );
      saved.push(result.rows[0]);
    }
    await writeAuditWithClient(client, member, "إرفاق مستند بعملية مالية", `إرفاق ${files.length} مستند للعملية رقم ${id}.`);
    await client.query("COMMIT");
    res.status(201).json({ attachments: saved });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Transaction attachment upload failed:", error);
    fail(res, 500, "تعذر حفظ المستندات.");
  } finally {
    client.release();
  }
});

app.get("/api/transaction-attachments/:id", authenticate, requireSection("finance"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم المستند غير صالح.");
  try {
    const result = await pool.query(
      `SELECT file_name, mime_type, file_data FROM transaction_attachments WHERE id = $1`,
      [id],
    );
    if (!result.rowCount) return fail(res, 404, "المستند غير موجود.");
    const attachment = result.rows[0];
    const inline = attachment.mime_type === "application/pdf" || attachment.mime_type.startsWith("image/");
    const safeName = encodeURIComponent(String(attachment.file_name).replace(/[\r\n"]/g, ""));
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(Buffer.from(attachment.file_data));
  } catch (error) {
    console.error("Transaction attachment read failed:", error);
    fail(res, 500, "تعذر فتح المستند.");
  }
});

app.post("/api/field-expenses", authenticate, requireSection("field"), requireRole("field", "supervisor"), async (req: AuthenticatedRequest, res) => {
  const { category, amount, siteName, details, fuelLiters } = req.body ?? {};
  if (typeof category !== "string" || !category.trim() || typeof siteName !== "string" ||
      !siteName.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return fail(res, 400, "أدخل الفئة والورشة والمبلغ بشكل صحيح.");
  }
  try {
    const member = req.member!;
    const result = await pool.query(
      `INSERT INTO field_expenses (category, amount, site_name, details, fuel_liters, created_by_id, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, amount, site_name, details, created_by_name, created_at, fuel_liters`,
      [category.trim(), amount, siteName.trim(), String(details ?? "").trim(), fuelLiters ? Number(fuelLiters) : null, member.clerk_user_id, member.name],
    );
    await writeAudit(member, "تسجيل مصروف ميداني", `${category.trim()} بقيمة ${amount} دج.`);
    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error("Field expense creation failed:", error);
    fail(res, 500, "تعذر حفظ المصروف الميداني.");
  }
});

app.get("/api/members", authenticate, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT clerk_user_id, email, name, role, active, allowed_sections, created_at FROM members ORDER BY created_at",
  );
  res.json({ members: result.rows });
});

app.patch("/api/members/:id", authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const { active, allowedSections, role } = req.body ?? {};
  if (targetId === req.member?.clerk_user_id) return fail(res, 400, "لا يمكن تعديل صلاحيات حساب المدير الحالي.");
  if (typeof active !== "boolean" || !Array.isArray(allowedSections) ||
      !allowedSections.every((section) => allSectionIds.includes(section))) {
    return fail(res, 400, "بيانات الصلاحيات غير صالحة.");
  }
  const safeRole = ["finance", "field", "supervisor", "viewer"].includes(role) ? role : "viewer";
  const sections = [...new Set(["dashboard", ...allowedSections.filter((section) => section !== "users" && section !== "audit")])];
  try {
    const result = await pool.query(
      `UPDATE members SET active = $1, allowed_sections = $2, role = $3, updated_at = NOW()
       WHERE clerk_user_id = $4
       RETURNING clerk_user_id, email, name, role, active, allowed_sections, created_at`,
      [active, sections, safeRole, targetId],
    );
    if (!result.rowCount) return fail(res, 404, "العضو غير موجود.");
    await writeAudit(req.member!, "تعديل صلاحيات عضو", `تحديث الوصول للحساب ${result.rows[0].email}.`);
    res.json({ member: result.rows[0] });
  } catch (error) {
    console.error("Member permission update failed:", error);
    fail(res, 500, "تعذر تحديث صلاحيات العضو.");
  }
});

app.get("/api/audit", authenticate, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, action, details, performed_by_name, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100",
  );
  res.json({ items: result.rows });
});

const webRoot = path.resolve(process.cwd(), "dist");
if (existsSync(webRoot)) {
  app.use(express.static(webRoot, { index: false }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webRoot, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Bennini API and web app listening on port ${port}`);
});
