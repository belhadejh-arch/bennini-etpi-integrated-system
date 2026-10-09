import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createHmac, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import multer from "multer";
import cors from "cors";
import pg from "pg";
import { allSectionIds, type SectionId } from "../shared/sections";
import {
  effectivePermissions,
  hasPermission,
  permissionActions,
  type MemberCapabilities,
  type MemberPermissions,
  type PermissionAction,
} from "../shared/access";

const { Pool } = pg;
const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("NEON_DATABASE_URL or DATABASE_URL is required.");
const pool = new Pool({
  connectionString: databaseUrl,
  onConnect: async (client) => {
    await client.query("SET search_path TO bennini, public");
  },
});
const app = express();
const port = Number(process.env.PORT ?? 5000);
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET is required.");
const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
const scrypt = promisify(scryptCallback);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

type Member = {
  clerk_user_id: string;
  email: string | null;
  name: string;
  role: string;
  active: boolean;
  allowed_sections: string[];
  role_name?: string;
  permissions?: MemberPermissions;
  capabilities?: MemberCapabilities;
};

type AuthenticatedRequest = Request & {
  member?: Member;
};

const adminSections = [...allSectionIds];
let memberSchemaPromise: Promise<void> | null = null;
let auditLogSchemaPromise: Promise<void> | null = null;
let notificationSchemaPromise: Promise<void> | null = null;

function serialLookup(serial: string) {
  return createHmac("sha256", sessionSecret!).update(`serial:${serial}`).digest("hex");
}

async function hashSerial(serial: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(serial, salt, 64) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifySerial(serial: string, encoded: string) {
  const [saltHex, hashHex] = encoded.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(serial, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function issueSession(memberId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = Buffer.from(JSON.stringify({ memberId, expiresAt })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret!).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function sessionMemberId(req: Request) {
  const bearer = req.header("authorization")?.match(/^Bearer ([\w.-]+)$/)?.[1];
  const cookies = req.header("cookie") ?? "";
  const sessionCookie = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith("bennini_session="));
  const token = bearer ?? sessionCookie?.slice("bennini_session=".length);
  if (!token) return null;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;
  const expected = createHmac("sha256", sessionSecret!).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { memberId?: unknown; expiresAt?: unknown };
    if (typeof parsed.memberId !== "string" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now() / 1000) return null;
    return parsed.memberId;
  } catch {
    return null;
  }
}

function constantTimeTextMatch(supplied: string, expected: string) {
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function ensureNotificationSchema() {
  if (!notificationSchemaPromise) {
    notificationSchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        member_id TEXT NOT NULL REFERENCES members(clerk_user_id) ON DELETE CASCADE,
        notification_id TEXT NOT NULL,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (member_id, notification_id)
      );
    `).then(() => undefined);
  }
  return notificationSchemaPromise;
}

function ensureAuditLogSchema() {
  if (!auditLogSchemaPromise) {
    auditLogSchemaPromise = pool.query(`
      ALTER TABLE audit_logs
        ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'system',
        ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'other',
        ADD COLUMN IF NOT EXISTS entity_id TEXT,
        ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
      UPDATE audit_logs SET section = CASE
        WHEN action ILIKE '%ميداني%' OR action ILIKE '%الميدان%' THEN 'field'
        WHEN action ILIKE '%مالي%' THEN 'finance'
        WHEN action ILIKE '%شراء%' OR action ILIKE '%مخزون%' THEN 'inventory'
        WHEN action ILIKE '%شيك%' THEN 'cheques'
        WHEN action ILIKE '%كراء%' THEN 'rentals'
        WHEN action ILIKE '%مركبة%' OR action ILIKE '%آلية%' OR action ILIKE '%صيانة%' THEN 'machinery'
        WHEN action ILIKE '%صلاحيات%' OR action ILIKE '%مدير الأول%' THEN 'users'
        ELSE section
      END WHERE section = 'system';
      UPDATE audit_logs SET event_type = CASE
        WHEN action ILIKE '%إرفاق%' THEN 'attachment'
        WHEN action ILIKE '%حذف%' THEN 'delete'
        WHEN action ILIKE '%صلاحيات%' THEN 'permissions'
        WHEN action ILIKE '%مراجعة%' OR action ILIKE '%إعادة%' THEN 'review'
        WHEN action ILIKE '%تعديل%' THEN 'update'
        WHEN action ILIKE '%تسجيل%' OR action ILIKE '%تهيئة%' THEN 'create'
        ELSE event_type
      END WHERE event_type = 'other';
      CREATE TABLE IF NOT EXISTS audit_log_notes (
        audit_log_id BIGINT PRIMARY KEY REFERENCES audit_logs(id) ON DELETE CASCADE,
        notes TEXT NOT NULL DEFAULT '',
        updated_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
        updated_by_name TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS audit_logs_section_created_idx ON audit_logs (section, created_at DESC);
      CREATE INDEX IF NOT EXISTS audit_logs_type_created_idx ON audit_logs (event_type, created_at DESC);
    `).then(() => undefined);
  }
  return auditLogSchemaPromise;
}

function ensureMemberSchema() {
  if (!memberSchemaPromise) {
    memberSchemaPromise = pool.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS role_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE members ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL
        DEFAULT '{"uploadFiles":true,"viewFinancialData":true,"manageOperations":true}'::jsonb;
    `).then(() => undefined);
  }
  return memberSchemaPromise;
}

const paymentMethods = ["نقداً", "شيك", "تحويل بنكي"] as const;
const rentalStatuses = ["active", "completed", "cancelled"] as const;
const transactionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.presentation",
      "text/plain",
      "text/csv",
      "application/csv",
      "text/markdown",
      "text/rtf",
      "application/rtf",
    ]);
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set([
      ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif",
      ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp",
      ".txt", ".csv", ".md", ".rtf",
    ]);
    if (!allowedExtensions.has(extension) || (!allowedTypes.has(file.mimetype) && file.mimetype !== "application/octet-stream")) {
      callback(new Error("نوع الملف غير مدعوم. استخدم PDF أو صورة أو مستنداً نصياً أو ملف Office."));
      return;
    }
    callback(null, true);
  },
}).array("files", 5);

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

async function loadMember(req: AuthenticatedRequest, res: Response): Promise<Member | null> {
  await ensureMemberSchema();
  const memberId = sessionMemberId(req);
  if (!memberId) {
    fail(res, 401, "يلزم تسجيل الدخول.");
    return null;
  }

  const result = await pool.query<Member>(
    "SELECT clerk_user_id, email, name, role, active, allowed_sections, role_name, permissions, capabilities FROM members WHERE clerk_user_id = $1",
    [memberId],
  );

  if (result.rowCount === 0) {
    fail(res, 401, "يلزم تسجيل الدخول.");
    return null;
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
    await ensureAuditLogSchema();
    next();
  } catch (error) {
    console.error("Authentication check failed:", error);
    fail(res, 500, "تعذر التحقق من صلاحية الحساب.");
  }
}

function requireSection(section: SectionId) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const member = req.member;
    if (!hasPermission(member, section, "view")) {
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

function requirePermission(section: SectionId, action: PermissionAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!hasPermission(req.member, section, action)) {
      fail(res, 403, "لا تملك الصلاحية المطلوبة لتنفيذ هذه العملية.");
      return;
    }
    next();
  };
}

function requireAnyPermission(section: SectionId, ...actions: PermissionAction[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!actions.some((action) => hasPermission(req.member, section, action))) {
      fail(res, 403, "لا تملك الصلاحية المطلوبة لتنفيذ هذه العملية.");
      return;
    }
    next();
  };
}

function requireFileUpload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.member?.role !== "admin" && req.member?.capabilities?.uploadFiles === false) {
    fail(res, 403, "ليس لديك صلاحية رفع الملفات والصور.");
    return;
  }
  next();
}

type AuditEventType = "create" | "update" | "delete" | "review" | "attachment" | "permissions" | "note" | "setup" | "other";
type AuditEventOptions = {
  section: SectionId | "system";
  eventType: AuditEventType;
  entityId?: string | number | null;
  data?: Record<string, unknown>;
};

async function writeAudit(
  member: Member,
  action: string,
  details: string,
  event: AuditEventOptions,
) {
  await ensureAuditLogSchema();
  await pool.query(
    `INSERT INTO audit_logs
      (action, details, performed_by_id, performed_by_name, section, event_type, entity_id, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [action, details, member.clerk_user_id, member.name, event.section, event.eventType,
      event.entityId == null ? null : String(event.entityId), JSON.stringify(event.data ?? {})],
  );
}

async function writeAuditWithClient(
  client: pg.PoolClient,
  member: Member,
  action: string,
  details: string,
  event: AuditEventOptions,
) {
  await client.query(
    `INSERT INTO audit_logs
      (action, details, performed_by_id, performed_by_name, section, event_type, entity_id, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [action, details, member.clerk_user_id, member.name, event.section, event.eventType,
      event.entityId == null ? null : String(event.entityId), JSON.stringify(event.data ?? {})],
  );
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

type RentalInput = {
  equipment: string;
  clientOrOwner: string;
  startDate: string;
  endDate: string;
  ratePeriod: "daily" | "monthly";
  rentalRate: number;
  duration: number;
  totalAmount: number;
  paidAmount: number;
  status: (typeof rentalStatuses)[number];
  notes: string;
};

function validRental(body: Record<string, unknown>, existing?: Partial<RentalInput>): RentalInput | null {
  const equipment = String(body.equipment ?? existing?.equipment ?? "").trim();
  const clientOrOwner = String(body.clientOrOwner ?? existing?.clientOrOwner ?? "").trim();
  const startDate = body.startDate ?? existing?.startDate;
  const endDate = body.endDate ?? existing?.endDate;
  const ratePeriod = body.ratePeriod ?? existing?.ratePeriod ?? "daily";
  const rentalRate = Number(body.rentalRate ?? existing?.rentalRate ?? 0);
  const paidAmount = Number(body.paidAmount ?? existing?.paidAmount ?? 0);
  const status = body.status ?? existing?.status ?? "active";
  const notes = String(body.notes ?? existing?.notes ?? "").trim();
  if (!equipment || equipment.length > 200 || !clientOrOwner || clientOrOwner.length > 200 ||
      !validIsoDate(startDate) || !validIsoDate(endDate) || endDate < startDate ||
      !["daily", "monthly"].includes(String(ratePeriod)) ||
      !Number.isFinite(rentalRate) || rentalRate < 0 ||
      !Number.isFinite(paidAmount) || paidAmount < 0 ||
      !rentalStatuses.includes(status as (typeof rentalStatuses)[number]) || notes.length > 5000) return null;
  const days = Math.max(1, Math.round(
    (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000,
  ));
  const duration = ratePeriod === "monthly" ? Math.ceil(days / 30) : days;
  const totalAmount = Math.round(duration * rentalRate * 100) / 100;
  if (paidAmount > totalAmount) return null;
  return {
    equipment, clientOrOwner, startDate, endDate,
    ratePeriod: ratePeriod as RentalInput["ratePeriod"],
    rentalRate, duration, totalAmount, paidAmount,
    status: status as RentalInput["status"], notes,
  };
}

let rentalSchemaPromise: Promise<void> | null = null;

function ensureRentalSchema() {
  if (!rentalSchemaPromise) {
    rentalSchemaPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS rentals (
      id BIGSERIAL PRIMARY KEY,
      equipment TEXT NOT NULL,
      client_or_owner TEXT NOT NULL,
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      end_date DATE NOT NULL,
      total_amount NUMERIC(16, 2) NOT NULL CHECK (total_amount >= 0),
      paid_amount NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      status TEXT NOT NULL DEFAULT 'active',
      rate_period TEXT NOT NULL DEFAULT 'daily',
      rental_rate NUMERIC(16, 2) NOT NULL DEFAULT 0,
      duration INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE rentals
      ADD COLUMN IF NOT EXISTS rate_period TEXT NOT NULL DEFAULT 'daily',
      ADD COLUMN IF NOT EXISTS rental_rate NUMERIC(16, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS rental_attachments (
      id BIGSERIAL PRIMARY KEY,
      rental_id BIGINT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_data BYTEA NOT NULL,
      uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
      uploaded_by_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS rentals_end_date_idx ON rentals (end_date);
    CREATE INDEX IF NOT EXISTS rental_attachments_rental_idx ON rental_attachments (rental_id, created_at);
  `).then(() => undefined);
  }
  return rentalSchemaPromise;
}

async function requireRentalSchema(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureRentalSchema();
    next();
  } catch (error) {
    console.error("Rental database setup failed:", error);
    fail(res, 503, "قاعدة بيانات الكراء غير جاهزة. يرجى المحاولة لاحقاً.");
  }
}

let fieldExpenseSchemaPromise: Promise<void> | null = null;

function ensureFieldExpenseSchema() {
  if (!fieldExpenseSchemaPromise) {
    fieldExpenseSchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS field_expenses (
        id BIGSERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
        site_name TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        fuel_liters NUMERIC(10, 2),
        notes TEXT NOT NULL DEFAULT '',
        review_status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by_id TEXT REFERENCES members(clerk_user_id),
        reviewed_by_name TEXT,
        reviewed_at TIMESTAMPTZ,
        review_notes TEXT NOT NULL DEFAULT '',
        created_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
        created_by_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE field_expenses
        ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS reviewed_by_id TEXT REFERENCES members(clerk_user_id),
        ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS review_notes TEXT NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS field_expense_attachments (
        id BIGSERIAL PRIMARY KEY,
        field_expense_id BIGINT NOT NULL REFERENCES field_expenses(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_data BYTEA NOT NULL,
        uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
        uploaded_by_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS field_expenses_review_created_idx ON field_expenses (review_status, created_at DESC);
      CREATE INDEX IF NOT EXISTS field_expense_attachments_expense_idx ON field_expense_attachments (field_expense_id, created_at);
    `).then(() => undefined).catch((error) => {
      fieldExpenseSchemaPromise = null;
      throw error;
    });
  }
  return fieldExpenseSchemaPromise;
}

async function requireFieldExpenseSchema(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureFieldExpenseSchema();
    next();
  } catch (error) {
    console.error("Field expense database setup failed:", error);
    fail(res, 503, "قاعدة بيانات مصاريف الميدان غير جاهزة. يرجى المحاولة لاحقاً.");
  }
}

let machinerySchemaPromise: Promise<void> | null = null;

function ensureMachinerySchema() {
  if (!machinerySchemaPromise) {
    machinerySchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS machinery (
        id BIGSERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'working',
        hours_worked INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE machinery ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS machinery_spare_parts (
        id BIGSERIAL PRIMARY KEY,
        machinery_id BIGINT NOT NULL REFERENCES machinery(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        buy_price NUMERIC(16, 2) NOT NULL CHECK (buy_price >= 0),
        supplier TEXT NOT NULL DEFAULT '',
        invoice_number TEXT NOT NULL DEFAULT '',
        installation_date DATE,
        stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0 AND stock_quantity <= quantity),
        repair_expense NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (repair_expense >= 0),
        notes TEXT NOT NULL DEFAULT '',
        recorded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
        recorded_by_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS machinery_spare_part_attachments (
        id BIGSERIAL PRIMARY KEY,
        spare_part_id BIGINT NOT NULL REFERENCES machinery_spare_parts(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL CHECK (file_size > 0),
        file_data BYTEA NOT NULL,
        uploaded_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
        uploaded_by_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS machinery_spare_parts_machine_date_idx
        ON machinery_spare_parts (machinery_id, installation_date DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS machinery_spare_part_attachments_part_idx
        ON machinery_spare_part_attachments (spare_part_id, created_at);
    `).then(() => undefined);
  }
  return machinerySchemaPromise;
}

async function requireMachinerySchema(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureMachinerySchema();
    next();
  } catch (error) {
    console.error("Machinery database setup failed:", error);
    fail(res, 503, "قاعدة بيانات المركبات والآليات غير جاهزة. يرجى المحاولة لاحقاً.");
  }
}

let recordNotesSchemaPromise: Promise<void> | null = null;

function ensureRecordNotesSchema() {
  if (!recordNotesSchemaPromise) {
    recordNotesSchemaPromise = Promise.all([
      ensureMachinerySchema(),
      pool.query("ALTER TABLE members ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''"),
      pool.query(`
        CREATE TABLE IF NOT EXISTS audit_log_notes (
          audit_log_id BIGINT PRIMARY KEY REFERENCES audit_logs(id) ON DELETE CASCADE,
          notes TEXT NOT NULL DEFAULT '',
          updated_by_id TEXT NOT NULL REFERENCES members(clerk_user_id),
          updated_by_name TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`),
    ]).then(() => undefined);
  }
  return recordNotesSchemaPromise;
}

async function requireRecordNotesSchema(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureRecordNotesSchema();
    next();
  } catch (error) {
    console.error("Record notes database setup failed:", error);
    fail(res, 503, "قاعدة بيانات الملاحظات غير جاهزة. يرجى المحاولة لاحقاً.");
  }
}

const inventoryItemSelect = `
  SELECT i.id, i.name, i.quantity, i.remaining_quantity, i.buy_price, i.total_cost,
    i.sale_price, COALESCE(s.name, i.supplier) AS supplier,
    COALESCE(pi.invoice_number, i.invoice_number) AS invoice_number,
    i.supplier_id, i.invoice_id, i.recorded_by_id, i.recorded_by_name,
    i.purchase_date, i.notes, i.created_at,
    CASE WHEN i.sale_price IS NULL THEN NULL
      ELSE i.quantity * i.sale_price - i.total_cost END AS expected_profit,
    COALESCE(m.sold_quantity, 0)::int AS sold_quantity,
    COALESCE(m.used_quantity, 0)::int AS used_quantity,
    COALESCE(m.realized_profit, 0) AS realized_profit,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size', a.file_size
      ) ORDER BY a.created_at, a.id)
      FROM inventory_attachments a WHERE a.inventory_item_id = i.id
    ), '[]'::json) AS attachments
  FROM inventory_items i
  LEFT JOIN suppliers s ON s.id = i.supplier_id
  LEFT JOIN purchase_invoices pi ON pi.id = i.invoice_id
  LEFT JOIN (
    SELECT im.inventory_item_id,
      SUM(im.quantity) FILTER (WHERE im.movement_type = 'sale') AS sold_quantity,
      SUM(im.quantity) FILTER (WHERE im.movement_type = 'use') AS used_quantity,
      SUM(CASE WHEN im.movement_type = 'sale'
        THEN im.quantity * (im.unit_price - item.buy_price) ELSE 0 END) AS realized_profit
    FROM inventory_movements im
    JOIN inventory_items item ON item.id = im.inventory_item_id
    GROUP BY im.inventory_item_id
  ) m ON m.inventory_item_id = i.id`;

const inventorySummaryQuery = `
  WITH movement_totals AS (
    SELECT im.inventory_item_id,
      SUM(im.quantity) FILTER (WHERE im.movement_type = 'sale') AS sold_quantity,
      SUM(im.quantity) FILTER (WHERE im.movement_type = 'use') AS used_quantity,
      SUM(CASE WHEN im.movement_type = 'sale'
        THEN im.quantity * (im.unit_price - item.buy_price) ELSE 0 END) AS realized_profit
    FROM inventory_movements im
    JOIN inventory_items item ON item.id = im.inventory_item_id
    GROUP BY im.inventory_item_id
  )
  SELECT COUNT(*)::int AS item_count,
    COALESCE(SUM(i.quantity), 0)::bigint AS purchased_quantity,
    COALESCE(SUM(i.remaining_quantity), 0)::bigint AS remaining_quantity,
    COALESCE(SUM(COALESCE(m.sold_quantity, 0)), 0)::bigint AS sold_quantity,
    COALESCE(SUM(COALESCE(m.used_quantity, 0)), 0)::bigint AS used_quantity,
    COALESCE(SUM(i.total_cost), 0) AS total_cost,
    COALESCE(SUM(i.remaining_quantity * i.buy_price), 0) AS stock_value,
    COALESCE(SUM(CASE WHEN i.sale_price IS NULL THEN 0
      ELSE i.quantity * i.sale_price - i.total_cost END), 0) AS expected_profit,
    COALESCE(SUM(COALESCE(m.realized_profit, 0)), 0) AS realized_profit
  FROM inventory_items i
  LEFT JOIN movement_totals m ON m.inventory_item_id = i.id`;

function uploadFiles(req: Request, res: Response, next: NextFunction) {
  transactionUpload(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof Error ? error.message : "تعذر رفع المستند.";
    return fail(res, error instanceof multer.MulterError ? 400 : 415, message);
  });
}

function validInventoryPurchase(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const supplier = typeof body.supplier === "string" ? body.supplier.trim() : "";
  const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const quantity = Number(body.quantity);
  const buyPrice = Number(body.buyPrice);
  const salePrice = Number(body.salePrice);
  const purchaseDate = body.purchaseDate;
  const maxMoney = 99999999999999.99;
  if (!name || name.length > 200 || !supplier || supplier.length > 200 ||
      invoiceNumber.length > 120 || notes.length > 5000 ||
      !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000000 ||
      !Number.isFinite(buyPrice) || buyPrice < 0 || buyPrice > maxMoney ||
      !Number.isFinite(salePrice) || salePrice < 0 || salePrice > maxMoney ||
      quantity * buyPrice > maxMoney || quantity * salePrice > maxMoney ||
      (purchaseDate !== undefined && !validIsoDate(purchaseDate))) {
    return null;
  }
  return { name, supplier, invoiceNumber, notes, quantity, buyPrice, salePrice, purchaseDate };
}

const chequeStatuses = ["pending", "paid", "cancelled"] as const;
const maxChequeAmount = 99999999999999.99;

function validCheque(body: Record<string, unknown>, current?: Record<string, unknown>) {
  const field = (key: string) => body[key] !== undefined ? body[key] : current?.[key];
  const chequeNumber = typeof field("chequeNumber") === "string" ? String(field("chequeNumber")).trim() : "";
  const invoiceNumber = typeof field("invoiceNumber") === "string" ? String(field("invoiceNumber")).trim() : "";
  const rawInvoiceId = field("invoiceId");
  const invoiceId = rawInvoiceId === null || rawInvoiceId === undefined || rawInvoiceId === ""
    ? null
    : Number(rawInvoiceId);
  const beneficiary = typeof field("beneficiary") === "string" ? String(field("beneficiary")).trim() : "";
  const bank = typeof field("bank") === "string" ? String(field("bank")).trim() : "";
  const notes = typeof field("notes") === "string" ? String(field("notes")).trim() : "";
  const amount = Number(field("amount"));
  const issueDate = field("issueDate");
  const dueDate = field("dueDate");
  const status = field("status") ?? "pending";

  if (!chequeNumber || chequeNumber.length > 120 ||
      invoiceNumber.length > 120 || !beneficiary || beneficiary.length > 200 ||
      (invoiceId !== null && (!Number.isSafeInteger(invoiceId) || invoiceId <= 0)) ||
      bank.length > 200 || notes.length > 5000 ||
      !Number.isFinite(amount) || amount <= 0 || amount > maxChequeAmount ||
      !validIsoDate(issueDate) || !validIsoDate(dueDate) || dueDate < issueDate ||
      !chequeStatuses.includes(status as (typeof chequeStatuses)[number])) {
    return null;
  }

  return { chequeNumber, invoiceNumber, invoiceId, beneficiary, bank, amount, issueDate, dueDate, status, notes };
}

async function ensureSupplierInvoice(
  client: pg.PoolClient,
  supplierName: string,
  invoiceNumber: string,
  invoiceDate: string | null,
  member: Member,
): Promise<{ supplierId: number | null; invoiceId: number | null }> {
  const supplier = supplierName.trim();
  const invoice = invoiceNumber.trim();
  if (!supplier) return { supplierId: null, invoiceId: null };

  const supplierResult = await client.query(
    `INSERT INTO suppliers (name, normalized_name)
     VALUES ($1, LOWER(BTRIM($1)))
     ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [supplier],
  );
  const supplierId = Number(supplierResult.rows[0].id);
  if (!invoice) return { supplierId, invoiceId: null };

  const invoiceResult = await client.query(
    `INSERT INTO purchase_invoices
       (supplier_id, invoice_number, normalized_invoice_number, invoice_date, recorded_by_id, recorded_by_name)
     VALUES ($1, $2, LOWER(BTRIM($2)), $3, $4, $5)
     ON CONFLICT (supplier_id, normalized_invoice_number)
     DO UPDATE SET invoice_date = COALESCE(purchase_invoices.invoice_date, EXCLUDED.invoice_date)
     RETURNING id`,
    [supplierId, invoice, invoiceDate, member.clerk_user_id, member.name],
  );
  return { supplierId, invoiceId: Number(invoiceResult.rows[0].id) };
}

async function resolveChequeInvoice(
  client: pg.PoolClient,
  invoiceId: number | null,
  invoiceNumber: string,
): Promise<{ invoiceId: number | null; invoiceNumber: string } | null> {
  if (invoiceId === null) return { invoiceId: null, invoiceNumber };
  const result = await client.query(
    "SELECT id, invoice_number FROM purchase_invoices WHERE id = $1",
    [invoiceId],
  );
  if (!result.rowCount) return null;
  return {
    invoiceId: Number(result.rows[0].id),
    invoiceNumber: result.rows[0].invoice_number,
  };
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

app.get("/api/auth/status", async (_req, res) => {
  try {
    const result = await pool.query("SELECT EXISTS (SELECT 1 FROM members WHERE role = 'admin' AND serial_hash IS NOT NULL) AS configured");
    res.json({ administratorConfigured: result.rows[0].configured === true, bootstrapAvailable: Boolean(bootstrapToken) });
  } catch (error) {
    console.error("Authentication status check failed:", error);
    fail(res, 503, "قاعدة البيانات غير متاحة.");
  }
});

app.post("/api/auth/bootstrap", async (req: Request, res: Response) => {
  if (!bootstrapToken || bootstrapToken.length < 32) return fail(res, 503, "إعداد المدير الأول غير متاح.");
  const suppliedToken = typeof req.body?.bootstrapToken === "string" ? req.body.bootstrapToken : "";
  if (!constantTimeTextMatch(suppliedToken, bootstrapToken)) return fail(res, 401, "بيانات التهيئة غير صحيحة.");
  const requestedSerial = typeof req.body?.serial === "string" ? req.body.serial.trim() : "";
  if (!/^\d{6}$/.test(requestedSerial)) return fail(res, 400, "أدخل رقم المدير المكوّن من ستة أرقام.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bennini-initial-admin-setup'))");
    const existing = await client.query<Member & { serial_hash: string | null }>(
      `SELECT clerk_user_id, email, name, role, active, allowed_sections, role_name, permissions, capabilities, serial_hash
       FROM members WHERE role = 'admin' AND serial_hash IS NULL
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
    );
    const alreadyConfigured = await client.query(
      "SELECT 1 FROM members WHERE role = 'admin' AND serial_hash IS NOT NULL LIMIT 1",
    );
    if (alreadyConfigured.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 409, "تم إعداد حساب المدير مسبقاً.");
    }

    const requestedLookup = serialLookup(requestedSerial);
    const serialInUse = await client.query("SELECT 1 FROM members WHERE serial_lookup = $1 LIMIT 1", [requestedLookup]);
    if (serialInUse.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 409, "رقم الدخول مستخدم بالفعل. اختر رقماً آخر.");
    }

    const serial = requestedSerial;
    let saved: Member | undefined;
    const lookup = serialLookup(serial);
    const hash = await hashSerial(serial);
    if (existing.rowCount) {
      const updated = await client.query<Member>(
        `UPDATE members SET serial_lookup = $1, serial_hash = $2, active = TRUE, role = 'admin',
          allowed_sections = $3, role_name = CASE WHEN role_name = '' THEN 'مدير النظام' ELSE role_name END,
          updated_at = NOW()
         WHERE clerk_user_id = $4 AND serial_lookup IS NULL
         RETURNING clerk_user_id, email, name, role, active, allowed_sections, role_name, permissions, capabilities`,
        [lookup, hash, adminSections, existing.rows[0].clerk_user_id],
      );
      if (updated.rowCount) saved = updated.rows[0];
    } else {
      const inserted = await client.query<Member>(
        `INSERT INTO members
           (clerk_user_id, email, serial_lookup, serial_hash, name, role, active, allowed_sections, role_name)
         VALUES ($1, NULL, $2, $3, 'مدير النظام', 'admin', TRUE, $4, 'مدير النظام')
         ON CONFLICT (serial_lookup) DO NOTHING
         RETURNING clerk_user_id, email, name, role, active, allowed_sections, role_name, permissions, capabilities`,
        [randomUUID(), lookup, hash, adminSections],
      );
      if (inserted.rowCount) saved = inserted.rows[0];
    }
    if (!saved) {
      await client.query("ROLLBACK");
      return fail(res, 503, "تعذر إنشاء رقم المدير. أعد المحاولة.");
    }
    await writeAuditWithClient(client, saved, "تهيئة المدير الأول", "تم إنشاء رقم الدخول الأول للمدير.",
      { section: "system", eventType: "setup", entityId: saved.clerk_user_id });
    await client.query("COMMIT");
    res.status(201).json({ member: saved, serial });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Initial administrator setup failed:", error);
    fail(res, 500, "تعذر تهيئة حساب المدير.");
  } finally {
    client.release();
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const serial = typeof req.body?.serial === "string" ? req.body.serial : "";
  try {
    const validFormat = /^\d{6}$/.test(serial);
    const result = validFormat
      ? await pool.query<Member & { serial_hash: string }>(
        `SELECT clerk_user_id, email, name, role, active, allowed_sections, role_name, permissions, capabilities, serial_hash
         FROM members WHERE serial_lookup = $1 LIMIT 1`,
        [serialLookup(serial)],
      )
      : { rows: [], rowCount: 0 };
    const candidate = result.rows[0];
    const validCode = candidate ? await verifySerial(serial, candidate.serial_hash) : false;
    if (!candidate || !validCode || !candidate.active) {
      return fail(res, 401, "رقم الدخول غير صحيح أو الحساب موقوف.");
    }

    const token = issueSession(candidate.clerk_user_id);
    const { serial_hash: _serialHash, ...publicMember } = candidate;
    const nativeClient = req.header("x-app-client") === "native";
    if (nativeClient) {
      res.json({ token, member: publicMember });
    } else {
      res.cookie("bennini_session", token, {
        httpOnly: true,
        secure: req.secure,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });
      res.json({ member: publicMember });
    }
  } catch (error) {
    console.error("Member sign-in failed:", error);
    fail(res, 500, "تعذر تسجيل الدخول حالياً.");
  }
});

app.get("/api/auth/session", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const member = await loadMember(req, res);
    if (!member) return;
    if (!member.active) return fail(res, 403, "الحساب موقوف.");
    res.json({ member });
  } catch (error) {
    console.error("Session check failed:", error);
    fail(res, 500, "تعذر التحقق من الجلسة.");
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("bennini_session", { httpOnly: true, secure: _req.secure, sameSite: "lax", path: "/" });
  res.json({ ok: true });
});

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

app.get("/api/notifications", authenticate, async (req: AuthenticatedRequest, res) => {
  const member = req.member!;
  const canSeeField = hasPermission(member, "field", "view");
  const canReviewField = hasPermission(member, "field", "edit");
  const canSeeTransactions = hasPermission(member, "finance", "view");
  const canSeeCheques = hasPermission(member, "cheques", "view");
  const canSeeRentals = hasPermission(member, "rentals", "view");
  const canSeeInventory = hasPermission(member, "inventory", "view");
  const canSeeMachinery = hasPermission(member, "machinery", "view");
  const canSeeAllField = member.role === "admin" || member.role === "finance";

  try {
    await Promise.all([
      ensureNotificationSchema(),
      canSeeField ? ensureFieldExpenseSchema() : Promise.resolve(),
      canSeeRentals ? ensureRentalSchema() : Promise.resolve(),
      canSeeMachinery ? ensureMachinerySchema() : Promise.resolve(),
    ]);

    const sources: Array<Promise<{ rows: Array<Record<string, unknown>> }>> = [];
    if (canSeeCheques) {
      sources.push(pool.query(`
        SELECT 'cheque_due' AS type, id AS record_id, cheque_number AS label,
          due_date::text AS date_value, due_date - CURRENT_DATE AS days_left, created_at
        FROM cheques
        WHERE status = 'pending' AND due_date <= CURRENT_DATE + 7
        ORDER BY due_date ASC, id ASC LIMIT 30
      `));
    }
    if (canSeeRentals) {
      sources.push(pool.query(`
        SELECT 'rental_ending' AS type, id AS record_id, equipment AS label,
          end_date::text AS date_value, end_date - CURRENT_DATE AS days_left, created_at
        FROM rentals
        WHERE status = 'active' AND end_date <= CURRENT_DATE + 7
        ORDER BY end_date ASC, id ASC LIMIT 30
      `));
    }
    if (canSeeTransactions) {
      sources.push(pool.query(`
        SELECT 'new_expense' AS type, id AS record_id, party AS label,
          reason AS detail, created_at
        FROM transactions
        WHERE type = 'expense' AND created_at >= NOW() - INTERVAL '7 days'
          AND recorded_by_id <> $1
        ORDER BY created_at DESC, id DESC LIMIT 20
      `, [member.clerk_user_id]));
    }
    if (canSeeField && canSeeAllField) {
      sources.push(pool.query(`
        SELECT 'field_operation' AS type, id AS record_id, category AS label,
          site_name AS detail, created_by_name, created_at
        FROM field_expenses
        WHERE created_at >= NOW() - INTERVAL '7 days' AND created_by_id <> $1
        ORDER BY created_at DESC, id DESC LIMIT 20
      `, [member.clerk_user_id]));
    }
    if (canReviewField && canSeeAllField) {
      sources.push(pool.query(`
        SELECT 'field_review' AS type, id AS record_id, category AS label,
          site_name AS detail, created_by_name, created_at
        FROM field_expenses
        WHERE review_status = 'pending' AND created_by_id <> $1
        ORDER BY created_at DESC, id DESC LIMIT 50
      `, [member.clerk_user_id]));
    }
    if (canSeeInventory) {
      sources.push(pool.query(`
        SELECT 'low_inventory' AS type, id AS record_id, name AS label,
          remaining_quantity, quantity, created_at
        FROM inventory_items
        WHERE quantity > 0
          AND remaining_quantity <= GREATEST(1, CEIL(quantity * 0.2))
        ORDER BY remaining_quantity ASC, name ASC LIMIT 30
      `));
    }
    if (canSeeMachinery) {
      sources.push(pool.query(`
        SELECT 'low_spare_part' AS type, id AS record_id, name AS label,
          stock_quantity, quantity, created_at
        FROM machinery_spare_parts
        WHERE quantity > 0 AND stock_quantity <= GREATEST(1, CEIL(quantity * 0.2))
        ORDER BY stock_quantity ASC, name ASC LIMIT 30
      `));
    }

    const groups = await Promise.all(sources);
    const notifications = groups.flatMap((group) => group.rows).map((row) => {
      const type = String(row.type);
      const recordId = Number(row.record_id);
      let section: SectionId;
      let view: string | undefined;
      let title: string;
      let message: string;
      switch (type) {
        case "cheque_due": {
          section = "cheques";
          const days = Number(row.days_left);
          title = `اقتراب استحقاق الشيك ${String(row.label)}`;
          message = days < 0 ? `متأخر منذ ${Math.abs(days)} يوم` : days === 0 ? "يستحق اليوم" : `يستحق خلال ${days} ${days === 1 ? "يوم" : "أيام"}`;
          break;
        }
        case "rental_ending": {
          section = "rentals";
          const days = Number(row.days_left);
          title = `اقتراب نهاية كراء ${String(row.label)}`;
          message = days < 0 ? `انتهى منذ ${Math.abs(days)} يوم` : days === 0 ? "ينتهي اليوم" : `ينتهي خلال ${days} ${days === 1 ? "يوم" : "أيام"}`;
          break;
        }
        case "new_expense":
          section = "finance";
          title = `مصروف جديد: ${String(row.label)}`;
          message = String(row.detail || "أضيفت عملية مصروف جديدة.");
          break;
        case "field_operation":
          section = "field";
          title = `عملية ميدانية جديدة من ${String(row.created_by_name)}`;
          message = `${String(row.label)} · ${String(row.detail)}`;
          break;
        case "field_review":
          section = "field";
          title = `عملية تحتاج إلى مراجعة: ${String(row.label)}`;
          message = `الموقع: ${String(row.detail)} · أرسلها ${String(row.created_by_name)}`;
          break;
        case "low_inventory":
          section = "inventory";
          view = "stock";
          title = `انخفاض مخزون ${String(row.label)}`;
          message = `المتبقي ${Number(row.remaining_quantity)} من أصل ${Number(row.quantity)}.`;
          break;
        default:
          section = "machinery";
          view = "spare-parts";
          title = `انخفاض مخزون قطعة ${String(row.label)}`;
          message = `المتبقي ${Number(row.stock_quantity)} من أصل ${Number(row.quantity)}.`;
      }
      return {
        id: `${type}:${recordId}`,
        type,
        title,
        message,
        section,
        view,
        recordId,
        createdAt: row.created_at,
      };
    }).sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
      .slice(0, 100);

    const readRows = notifications.length
      ? await pool.query(
        "SELECT notification_id FROM notification_reads WHERE member_id = $1 AND notification_id = ANY($2::text[])",
        [member.clerk_user_id, notifications.map((item) => item.id)],
      )
      : { rows: [] as Array<{ notification_id: string }> };
    const readIds = new Set(readRows.rows.map((row) => row.notification_id));
    const items = notifications.map((item) => ({ ...item, read: readIds.has(item.id) }));
    res.json({ items, unreadCount: items.filter((item) => !item.read).length });
  } catch (error) {
    console.error("Notification list failed:", error);
    fail(res, 500, "تعذر تحميل الإشعارات.");
  }
});

app.post("/api/notifications/read", authenticate, async (req: AuthenticatedRequest, res) => {
  const member = req.member!;
  const notificationIds: unknown = req.body?.notificationIds;
  if (!Array.isArray(notificationIds) || notificationIds.length < 1 || notificationIds.length > 100 ||
      notificationIds.some((id) => typeof id !== "string" || !/^[a-z_]+:\d+$/.test(id))) {
    return fail(res, 400, "قائمة الإشعارات غير صالحة.");
  }
  try {
    await ensureNotificationSchema();
    await pool.query(
      `INSERT INTO notification_reads (member_id, notification_id)
       SELECT $1, unnest($2::text[])
       ON CONFLICT (member_id, notification_id) DO UPDATE SET read_at = NOW()`,
      [member.clerk_user_id, notificationIds],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Notification read update failed:", error);
    fail(res, 500, "تعذر تحديث حالة الإشعارات.");
  }
});

app.get("/api/dashboard", authenticate, requireSection("dashboard"), async (req: AuthenticatedRequest, res) => {
  try {
    const member = req.member!;
    const canSeeFinance = hasPermission(member, "finance", "view");
    const canSeeInventory = hasPermission(member, "inventory", "view");
    const canSeeCheques = hasPermission(member, "cheques", "view");
    const canSeeRentals = hasPermission(member, "rentals", "view");
    const canSeeField = hasPermission(member, "field", "view");
    const canSeeAllField = member.role === "admin" || member.role === "finance";
    if (canSeeField || canSeeFinance) await ensureFieldExpenseSchema();
    const fieldExpenseTotal = canSeeFinance
      ? " + COALESCE((SELECT SUM(amount) FROM field_expenses), 0)"
      : "";
    const fieldQuery = canSeeField
      ? pool.query(
         `SELECT id, category, amount, site_name, details, created_by_id, created_by_name, created_at, fuel_liters, review_status, notes
         FROM field_expenses ${canSeeAllField ? "" : "WHERE created_by_id = $1"}
         ORDER BY created_at DESC LIMIT 5`,
        canSeeAllField ? [] : [member.clerk_user_id],
      )
      : Promise.resolve({ rows: [] });
    const [cash, purchases, inventory, cheques, rentals, recent, field] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'income'), 0) AS income,
          COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'expense'), 0)
            ${fieldExpenseTotal} AS outgoing
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
        SELECT id, type, amount, party, reason, notes, transaction_date AS date, recorded_by_name AS recorded_by
        FROM transactions ORDER BY transaction_date DESC, created_at DESC LIMIT 6
      `),
      fieldQuery,
    ]);

    const incoming = Number(cash.rows[0].income);
    const outgoing = Number(cash.rows[0].outgoing);
    res.json({
      stats: {
        incoming: canSeeFinance ? incoming : 0,
        outgoing: canSeeFinance ? outgoing : 0,
        balance: canSeeFinance ? incoming - outgoing : 0,
        purchases: canSeeFinance && canSeeInventory ? Number(purchases.rows[0].total) : 0,
        inventoryValue: canSeeFinance && canSeeInventory ? Number(inventory.rows[0].total) : 0,
        pendingCheques: canSeeFinance && canSeeCheques ? Number(cheques.rows[0].pending_amount) : 0,
        pendingChequeCount: canSeeCheques ? Number(cheques.rows[0].pending_count) : 0,
        dueCheques: canSeeFinance && canSeeCheques ? Number(cheques.rows[0].due_amount) : 0,
        dueChequeCount: canSeeCheques ? Number(cheques.rows[0].due_count) : 0,
        rentalRemaining: canSeeFinance && canSeeRentals ? Number(rentals.rows[0].remaining) : 0,
      },
      recentOperations: canSeeFinance ? recent.rows : [],
      fieldExpenses: field.rows.map((expense) => ({
        ...expense,
        amount: canSeeFinance ? expense.amount : null,
      })),
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
  const search = typeof query.q === "string" ? query.q.trim() : "";

  if (search.length > 200) return fail(res, 400, "عبارة البحث أطول من الحد المسموح.");
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
  if (search) {
    const pattern = value(`%${search}%`);
    where.push(`(
      t.id::text ILIKE ${pattern} OR t.party ILIKE ${pattern} OR t.reason ILIKE ${pattern} OR
      t.notes ILIKE ${pattern} OR t.recorded_by_name ILIKE ${pattern} OR t.transaction_date::text ILIKE ${pattern} OR
      (CASE t.type WHEN 'income' THEN 'دخل income' ELSE 'مصروف expense' END) ILIKE ${pattern} OR
      t.payment_method ILIKE ${pattern}
    )`);
  }
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

app.get("/api/inventory", authenticate, requireSection("inventory"), async (req, res) => {
  const query = req.query;
  const name = typeof query.name === "string" ? query.name.trim() : "";
  const supplier = typeof query.supplier === "string" ? query.supplier.trim() : "";
  const invoice = typeof query.invoice === "string" ? query.invoice.trim() : "";
  const from = typeof query.from === "string" ? query.from : "";
  const to = typeof query.to === "string" ? query.to : "";
  const minPrice = typeof query.minPrice === "string" ? query.minPrice : "";
  const maxPrice = typeof query.maxPrice === "string" ? query.maxPrice : "";
  const minSalePrice = typeof query.minSalePrice === "string" ? query.minSalePrice : "";
  const maxSalePrice = typeof query.maxSalePrice === "string" ? query.maxSalePrice : "";
  const stock = typeof query.stock === "string" ? query.stock : "";
  const focusId = typeof query.focusId === "string" ? Number(query.focusId) : null;
  const maxMoney = 99999999999999.99;

  if (focusId !== null && (!Number.isSafeInteger(focusId) || focusId <= 0)) return fail(res, 400, "رقم السلعة غير صالح.");
  if (name.length > 200 || supplier.length > 200 || invoice.length > 120) return fail(res, 400, "قيمة البحث أطول من الحد المسموح.");
  if (from && !validIsoDate(from)) return fail(res, 400, "تاريخ البداية غير صالح.");
  if (to && !validIsoDate(to)) return fail(res, 400, "تاريخ النهاية غير صالح.");
  if (from && to && from > to) return fail(res, 400, "تاريخ البداية يجب أن يسبق تاريخ النهاية.");
  if (minPrice && (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0 || Number(minPrice) > maxMoney)) return fail(res, 400, "الحد الأدنى للسعر غير صالح.");
  if (maxPrice && (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0 || Number(maxPrice) > maxMoney)) return fail(res, 400, "الحد الأعلى للسعر غير صالح.");
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) return fail(res, 400, "الحد الأدنى للسعر أكبر من الحد الأعلى.");
  if (minSalePrice && (!Number.isFinite(Number(minSalePrice)) || Number(minSalePrice) < 0 || Number(minSalePrice) > maxMoney)) return fail(res, 400, "الحد الأدنى لسعر البيع غير صالح.");
  if (maxSalePrice && (!Number.isFinite(Number(maxSalePrice)) || Number(maxSalePrice) < 0 || Number(maxSalePrice) > maxMoney)) return fail(res, 400, "الحد الأعلى لسعر البيع غير صالح.");
  if (minSalePrice && maxSalePrice && Number(minSalePrice) > Number(maxSalePrice)) return fail(res, 400, "الحد الأدنى لسعر البيع أكبر من الحد الأعلى.");
  if (stock && !["available", "empty"].includes(stock)) return fail(res, 400, "حالة المخزون غير صالحة.");

  const where: string[] = [];
  const values: unknown[] = [];
  const value = (item: unknown) => {
    values.push(item);
    return `$${values.length}`;
  };
  if (name) where.push(`i.name ILIKE ${value(`%${name}%`)}`);
  if (supplier) where.push(`i.supplier ILIKE ${value(`%${supplier}%`)}`);
  if (invoice) where.push(`i.invoice_number ILIKE ${value(`%${invoice}%`)}`);
  if (from) where.push(`i.purchase_date >= ${value(from)}::date`);
  if (to) where.push(`i.purchase_date <= ${value(to)}::date`);
  if (minPrice) where.push(`i.buy_price >= ${value(minPrice)}`);
  if (maxPrice) where.push(`i.buy_price <= ${value(maxPrice)}`);
  if (minSalePrice) where.push(`i.sale_price >= ${value(minSalePrice)}`);
  if (maxSalePrice) where.push(`i.sale_price <= ${value(maxSalePrice)}`);
  if (stock === "available") where.push("i.remaining_quantity > 0");
  if (stock === "empty") where.push("i.remaining_quantity = 0");
  if (focusId !== null) where.push(`i.id = ${value(focusId)}`);

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Math.max(1, Math.min(100000, Number.parseInt(String(query.page ?? "1"), 10) || 1));
  const pageSize = 25;
  try {
    const [items, count, summary] = await Promise.all([
      pool.query(
        `${inventoryItemSelect} ${clause}
         ORDER BY i.purchase_date DESC, i.created_at DESC, i.id DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, pageSize, (page - 1) * pageSize],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM inventory_items i ${clause}`, values),
      pool.query(inventorySummaryQuery),
    ]);
    res.json({ items: items.rows, total: count.rows[0].total, page, pageSize, summary: summary.rows[0] });
  } catch (error) {
    console.error("Inventory search failed:", error);
    fail(res, 500, "تعذر تحميل بيانات المشتريات والمخزون.");
  }
});

app.post("/api/inventory", authenticate, requireSection("inventory"), requirePermission("inventory", "create"), async (req: AuthenticatedRequest, res) => {
  const purchase = validInventoryPurchase(req.body ?? {});
  if (!purchase) return fail(res, 400, "تحقق من اسم السلعة والكمية والأسعار والمورد وتاريخ الشراء.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const member = req.member!;
    const links = await ensureSupplierInvoice(
      client,
      purchase.supplier,
      purchase.invoiceNumber,
      typeof purchase.purchaseDate === "string" ? purchase.purchaseDate : null,
      member,
    );
    const result = await client.query(
      `INSERT INTO inventory_items
        (name, quantity, remaining_quantity, buy_price, total_cost, sale_price, supplier, invoice_number,
         supplier_id, invoice_id, purchase_date, notes, recorded_by_id, recorded_by_name)
       VALUES ($1, $2, $2, $3, $2 * $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10, $11, $12)
       RETURNING id`,
      [purchase.name, purchase.quantity, purchase.buyPrice, purchase.salePrice, purchase.supplier,
        purchase.invoiceNumber, links.supplierId, links.invoiceId, purchase.purchaseDate ?? null,
        purchase.notes, member.clerk_user_id, member.name],
    );
    const item = await client.query(`${inventoryItemSelect} WHERE i.id = $1`, [result.rows[0].id]);
    await writeAuditWithClient(client, member, "تسجيل عملية شراء", `${purchase.name} — ${purchase.quantity} قطعة من ${purchase.supplier} بقيمة ${purchase.quantity * purchase.buyPrice} دج.`,
      { section: "inventory", eventType: "create", entityId: result.rows[0].id, data: { name: purchase.name, quantity: purchase.quantity, supplier: purchase.supplier, totalCost: purchase.quantity * purchase.buyPrice } });
    await client.query("COMMIT");
    res.status(201).json({ item: item.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Inventory purchase creation failed:", error);
    fail(res, 500, "تعذر تسجيل عملية الشراء.");
  } finally {
    client.release();
  }
});

app.patch("/api/inventory/:id", authenticate, requireSection("inventory"), requirePermission("inventory", "edit"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const purchase = validInventoryPurchase(req.body ?? {});
  if (!Number.isSafeInteger(id) || id <= 0 || !purchase || !validIsoDate(purchase.purchaseDate)) {
    return fail(res, 400, "بيانات الشراء غير صالحة.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id, name, supplier FROM inventory_items WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "عملية الشراء غير موجودة.");
    }
    const movements = await client.query(
      "SELECT COALESCE(SUM(quantity), 0)::int AS quantity FROM inventory_movements WHERE inventory_item_id = $1",
      [id],
    );
    if (purchase.quantity < Number(movements.rows[0].quantity)) {
      await client.query("ROLLBACK");
      return fail(res, 409, "لا يمكن تخفيض الكمية إلى أقل من الكمية المباعة أو المستعملة.");
    }
    const links = await ensureSupplierInvoice(
      client,
      purchase.supplier,
      purchase.invoiceNumber,
      typeof purchase.purchaseDate === "string" ? purchase.purchaseDate : null,
      req.member!,
    );
    await client.query(
      `UPDATE inventory_items SET name = $1, quantity = $2, remaining_quantity = $2 - $3,
        buy_price = $4, total_cost = $2 * $4, sale_price = $5, supplier = $6,
        invoice_number = $7, supplier_id = $8, invoice_id = $9, purchase_date = $10, notes = $11
       WHERE id = $12`,
      [purchase.name, purchase.quantity, movements.rows[0].quantity, purchase.buyPrice, purchase.salePrice,
        purchase.supplier, purchase.invoiceNumber, links.supplierId, links.invoiceId,
        purchase.purchaseDate, purchase.notes, id],
    );
    const item = await client.query(`${inventoryItemSelect} WHERE i.id = $1`, [id]);
    await writeAuditWithClient(client, req.member!, "تعديل بيانات شراء", `تحديث بيانات السلعة ${purchase.name}، رقم ${id}.`,
      { section: "inventory", eventType: "update", entityId: id, data: { name: purchase.name, previousSupplier: existing.rows[0].supplier, supplier: purchase.supplier, quantity: purchase.quantity } });
    await client.query("COMMIT");
    res.json({ item: item.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Inventory purchase update failed:", error);
    fail(res, 500, "تعذر تعديل بيانات الشراء.");
  } finally {
    client.release();
  }
});

app.post("/api/inventory/:id/movements", authenticate, requireSection("inventory"), requirePermission("inventory", "create"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const { type, quantity, unitPrice, movementDate } = req.body ?? {};
  const counterparty = typeof req.body?.counterparty === "string" ? req.body.counterparty.trim() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
  const parsedQuantity = Number(quantity);
  const parsedUnitPrice = unitPrice === undefined || unitPrice === null || unitPrice === "" ? null : Number(unitPrice);
  if (!Number.isSafeInteger(id) || id <= 0 || !["sale", "use"].includes(type) ||
      !Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 1000000000 ||
      counterparty.length > 200 || notes.length > 5000 ||
      (movementDate !== undefined && !validIsoDate(movementDate)) ||
      (type === "sale" && (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice! < 0 || parsedQuantity * parsedUnitPrice! > 99999999999999.99)) ||
      (type === "use" && parsedUnitPrice !== null)) {
    return fail(res, 400, "بيانات حركة المخزون غير صالحة.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const item = await client.query(
      "SELECT id, name, remaining_quantity FROM inventory_items WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!item.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "السلعة غير موجودة.");
    }
    if (parsedQuantity > Number(item.rows[0].remaining_quantity)) {
      await client.query("ROLLBACK");
      return fail(res, 409, "الكمية المطلوبة أكبر من المخزون المتبقي.");
    }
    const member = req.member!;
    const movement = await client.query(
      `INSERT INTO inventory_movements
        (inventory_item_id, movement_type, quantity, unit_price, counterparty, movement_date, notes, recorded_by_id, recorded_by_name)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9)
       RETURNING id, inventory_item_id, movement_type, quantity, unit_price, counterparty, movement_date, notes, recorded_by_name, created_at`,
      [id, type, parsedQuantity, type === "sale" ? parsedUnitPrice : null, counterparty,
        movementDate ?? null, notes, member.clerk_user_id, member.name],
    );
    await client.query(
      "UPDATE inventory_items SET remaining_quantity = remaining_quantity - $1 WHERE id = $2",
      [parsedQuantity, id],
    );
    const action = type === "sale" ? "تسجيل بيع من المخزون" : "تسجيل استعمال من المخزون";
    await writeAuditWithClient(client, member, action, `${item.rows[0].name} — ${parsedQuantity} قطعة.`,
      { section: "inventory", eventType: "create", entityId: movement.rows[0].id, data: { inventoryItemId: id, itemName: item.rows[0].name, movementType: type, quantity: parsedQuantity, unitPrice: parsedUnitPrice, counterparty } });
    await client.query("COMMIT");
    res.status(201).json({ movement: movement.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Inventory movement creation failed:", error);
    fail(res, 500, "تعذر تسجيل حركة المخزون.");
  } finally {
    client.release();
  }
});

app.get("/api/inventory/:id/movements", authenticate, requireSection("inventory"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم السلعة غير صالح.");
  try {
    const result = await pool.query(
      `SELECT id, inventory_item_id, movement_type, quantity, unit_price, counterparty,
        movement_date, notes, recorded_by_name, created_at
       FROM inventory_movements WHERE inventory_item_id = $1
       ORDER BY movement_date DESC, created_at DESC, id DESC`,
      [id],
    );
    res.json({ movements: result.rows });
  } catch (error) {
    console.error("Inventory movement history failed:", error);
    fail(res, 500, "تعذر تحميل سجل حركة المخزون.");
  }
});

app.get("/api/purchase-invoices", authenticate, async (req: AuthenticatedRequest, res) => {
  const member = req.member!;
  if (!hasPermission(member, "inventory", "view") && !hasPermission(member, "cheques", "view")) {
    return fail(res, 403, "ليس لديك صلاحية الوصول إلى الفواتير.");
  }
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (search.length > 120) return fail(res, 400, "عبارة البحث أطول من الحد المسموح.");
  try {
    const result = await pool.query(
      `SELECT pi.id, pi.invoice_number, pi.invoice_date::text AS invoice_date,
          s.name AS supplier_name, COUNT(DISTINCT i.id)::int AS purchase_count
       FROM purchase_invoices pi
       JOIN suppliers s ON s.id = pi.supplier_id
       LEFT JOIN inventory_items i ON i.invoice_id = pi.id
       WHERE ($1 = '' OR pi.invoice_number ILIKE '%' || $1 || '%' OR s.name ILIKE '%' || $1 || '%')
       GROUP BY pi.id, s.name
       ORDER BY pi.invoice_date DESC NULLS LAST, pi.created_at DESC, pi.id DESC
       LIMIT 100`,
      [search],
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error("Purchase invoice list failed:", error);
    fail(res, 500, "تعذر تحميل الفواتير المسجلة.");
  }
});

app.get("/api/cheques", authenticate, requireSection("cheques"), async (req, res) => {
  const query = req.query;
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const status = typeof query.status === "string" ? query.status : "";
  const focusId = typeof query.focusId === "string" ? Number(query.focusId) : null;
  const from = typeof query.from === "string" ? query.from : "";
  const to = typeof query.to === "string" ? query.to : "";
  if (search.length > 200) return fail(res, 400, "عبارة البحث أطول من الحد المسموح.");
  if (focusId !== null && (!Number.isSafeInteger(focusId) || focusId <= 0)) return fail(res, 400, "رقم الشيك غير صالح.");
  if ((from && !validIsoDate(from)) || (to && !validIsoDate(to)) || (from && to && from > to)) {
    return fail(res, 400, "نطاق تاريخ الاستحقاق غير صالح.");
  }
  if (status && !chequeStatuses.includes(status as (typeof chequeStatuses)[number])) {
    return fail(res, 400, "حالة الشيك غير صالحة.");
  }

  const page = Math.max(1, Math.min(100000, Number.parseInt(String(query.page ?? "1"), 10) || 1));
  const pageSize = 25;
  const values: unknown[] = [];
  const where: string[] = [];
  const value = (item: unknown) => {
    values.push(item);
    return `$${values.length}`;
  };
  if (search) {
    const pattern = value(`%${search}%`);
    where.push(`(
      c.cheque_number ILIKE ${pattern} OR c.invoice_number ILIKE ${pattern} OR
      c.beneficiary ILIKE ${pattern} OR c.bank ILIKE ${pattern} OR
      (CASE c.status
        WHEN 'pending' THEN 'قيد الانتظار pending'
        WHEN 'paid' THEN 'مدفوع paid'
        WHEN 'cancelled' THEN 'ملغى cancelled'
      END) ILIKE ${pattern}
    )`);
  }
  if (status) where.push(`c.status = ${value(status)}`);
  if (from) where.push(`c.due_date >= ${value(from)}::date`);
  if (to) where.push(`c.due_date <= ${value(to)}::date`);
  if (focusId !== null) where.push(`c.id = ${value(focusId)}`);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pagination = [...values, pageSize, (page - 1) * pageSize];

  try {
    const [items, count, alerts] = await Promise.all([
      pool.query(
        `SELECT c.id, c.cheque_number, c.invoice_id,
          COALESCE(pi.invoice_number, c.invoice_number) AS invoice_number,
          s.name AS invoice_supplier_name, c.amount, c.beneficiary, c.bank,
          c.issue_date, c.due_date, c.status, c.notes, c.recorded_by_id,
          c.recorded_by_name, c.created_at,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size', a.file_size
            ) ORDER BY a.created_at, a.id)
            FROM cheque_attachments a WHERE a.cheque_id = c.id
          ), '[]'::json) AS attachments
         FROM cheques c
         LEFT JOIN purchase_invoices pi ON pi.id = c.invoice_id
         LEFT JOIN suppliers s ON s.id = pi.supplier_id
         ${clause}
         ORDER BY CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END,
           c.due_date ASC, c.created_at DESC, c.id DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        pagination,
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM cheques c ${clause}`, values),
      pool.query(`
        SELECT COUNT(*)::int AS total,
          COALESCE(json_agg(json_build_object(
            'id', id, 'cheque_number', cheque_number, 'beneficiary', beneficiary,
            'amount', amount, 'due_date', due_date,
            'days_until_due', due_date - CURRENT_DATE
          ) ORDER BY due_date ASC, id ASC) FILTER (WHERE id IS NOT NULL), '[]'::json) AS items
        FROM (
          SELECT id, cheque_number, beneficiary, amount, due_date
          FROM cheques
          WHERE status = 'pending' AND due_date <= CURRENT_DATE + 7
          ORDER BY due_date ASC, id ASC
          LIMIT 5
        ) due
      `),
    ]);
    res.json({
      items: items.rows,
      total: count.rows[0].total,
      page,
      pageSize,
      dueAlertCount: Number(alerts.rows[0].total),
      dueAlerts: alerts.rows[0].items,
    });
  } catch (error) {
    console.error("Cheque search failed:", error);
    fail(res, 500, "تعذر تحميل سجل الشيكات.");
  }
});

app.post("/api/cheques", authenticate, requireSection("cheques"), requirePermission("cheques", "create"), async (req: AuthenticatedRequest, res) => {
  const cheque = validCheque(req.body ?? {});
  if (!cheque) return fail(res, 400, "تحقق من رقم الشيك والمبلغ والمستفيد والبنك والتواريخ والحالة.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const invoice = await resolveChequeInvoice(client, cheque.invoiceId, cheque.invoiceNumber);
    if (!invoice) {
      await client.query("ROLLBACK");
      return fail(res, 400, "الفاتورة المحددة غير موجودة.");
    }
    const member = req.member!;
    const result = await client.query(
      `INSERT INTO cheques
        (cheque_number, invoice_id, invoice_number, amount, beneficiary, bank, issue_date, due_date, status,
         notes, recorded_by_id, recorded_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, cheque_number, invoice_id, invoice_number, amount, beneficiary, bank,
         issue_date, due_date, status, notes, recorded_by_id, recorded_by_name, created_at`,
      [cheque.chequeNumber, invoice.invoiceId, invoice.invoiceNumber, cheque.amount, cheque.beneficiary,
        cheque.bank, cheque.issueDate, cheque.dueDate, cheque.status, cheque.notes,
        member.clerk_user_id, member.name],
    );
    await writeAuditWithClient(client, member, "تسجيل شيك", `تسجيل الشيك رقم ${cheque.chequeNumber} بقيمة ${cheque.amount} دج.`,
      { section: "cheques", eventType: "create", entityId: result.rows[0].id, data: { chequeNumber: cheque.chequeNumber, invoiceNumber: invoice.invoiceNumber, invoiceId: invoice.invoiceId, amount: cheque.amount, beneficiary: cheque.beneficiary } });
    await client.query("COMMIT");
    res.status(201).json({ item: { ...result.rows[0], attachments: [] } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cheque creation failed:", error);
    fail(res, 500, "تعذر تسجيل الشيك.");
  } finally {
    client.release();
  }
});

app.patch("/api/cheques/:id", authenticate, requireSection("cheques"), requirePermission("cheques", "edit"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم الشيك غير صالح.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT cheque_number AS "chequeNumber", invoice_number AS "invoiceNumber",
        invoice_id AS "invoiceId", amount,
        beneficiary, bank, issue_date::text AS "issueDate", due_date::text AS "dueDate", status, notes
       FROM cheques WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "الشيك غير موجود.");
    }
    const cheque = validCheque(req.body ?? {}, existing.rows[0]);
    if (!cheque) {
      await client.query("ROLLBACK");
      return fail(res, 400, "بيانات الشيك غير صالحة.");
    }
    const invoice = await resolveChequeInvoice(client, cheque.invoiceId, cheque.invoiceNumber);
    if (!invoice) {
      await client.query("ROLLBACK");
      return fail(res, 400, "الفاتورة المحددة غير موجودة.");
    }
    const result = await client.query(
      `UPDATE cheques SET cheque_number = $1, invoice_id = $2, invoice_number = $3, amount = $4,
        beneficiary = $5, bank = $6, issue_date = $7, due_date = $8, status = $9, notes = $10
       WHERE id = $11
       RETURNING id, cheque_number, invoice_id, invoice_number, amount, beneficiary, bank,
         issue_date, due_date, status, notes, recorded_by_id, recorded_by_name, created_at`,
      [cheque.chequeNumber, invoice.invoiceId, invoice.invoiceNumber, cheque.amount, cheque.beneficiary,
        cheque.bank, cheque.issueDate, cheque.dueDate, cheque.status, cheque.notes, id],
    );
    await writeAuditWithClient(client, req.member!, "تعديل بيانات شيك", `تحديث بيانات الشيك رقم ${cheque.chequeNumber}.`,
      { section: "cheques", eventType: "update", entityId: id, data: { chequeNumber: cheque.chequeNumber, amount: cheque.amount, beneficiary: cheque.beneficiary, status: cheque.status } });
    await client.query("COMMIT");
    res.json({ item: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cheque update failed:", error);
    fail(res, 500, "تعذر تعديل بيانات الشيك.");
  } finally {
    client.release();
  }
});

app.delete("/api/cheques/:id", authenticate, requireSection("cheques"), requirePermission("cheques", "delete"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم الشيك غير صالح.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM cheques WHERE id = $1 RETURNING cheque_number",
      [id],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "الشيك غير موجود.");
    }
    await writeAuditWithClient(client, req.member!, "حذف شيك", `حذف الشيك رقم ${result.rows[0].cheque_number}.`,
      { section: "cheques", eventType: "delete", entityId: id, data: { chequeNumber: result.rows[0].cheque_number } });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cheque deletion failed:", error);
    fail(res, 500, "تعذر حذف الشيك.");
  } finally {
    client.release();
  }
});

app.post("/api/cheques/:id/attachments", authenticate, requireSection("cheques"), requireAnyPermission("cheques", "create", "edit"), requireFileUpload, uploadFiles, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!Number.isSafeInteger(id) || id <= 0 || files.length === 0) return fail(res, 400, "اختر مستنداً واحداً على الأقل.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cheque = await client.query("SELECT cheque_number FROM cheques WHERE id = $1 FOR UPDATE", [id]);
    if (!cheque.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "الشيك غير موجود.");
    }
    const count = await client.query(
      "SELECT COUNT(*)::int AS total FROM cheque_attachments WHERE cheque_id = $1",
      [id],
    );
    if (Number(count.rows[0].total) + files.length > 5) {
      await client.query("ROLLBACK");
      return fail(res, 400, "الحد الأقصى هو خمسة مرفقات لكل شيك.");
    }
    const member = req.member!;
    const saved = [];
    for (const file of files) {
      const result = await client.query(
        `INSERT INTO cheque_attachments
          (cheque_id, file_name, mime_type, file_size, file_data, uploaded_by_id, uploaded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, file_name, mime_type, file_size`,
        [id, path.basename(file.originalname), file.mimetype, file.size, file.buffer, member.clerk_user_id, member.name],
      );
      saved.push(result.rows[0]);
    }
    await writeAuditWithClient(client, member, "إرفاق مستند بشيك", `إرفاق ${files.length} مستند بالشيك ${cheque.rows[0].cheque_number}.`,
      { section: "cheques", eventType: "attachment", entityId: id, data: { chequeNumber: cheque.rows[0].cheque_number, fileCount: files.length } });
    await client.query("COMMIT");
    res.status(201).json({ attachments: saved });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cheque attachment upload failed:", error);
    fail(res, 500, "تعذر حفظ مرفقات الشيك.");
  } finally {
    client.release();
  }
});

app.get("/api/cheque-attachments/:id", authenticate, requireSection("cheques"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم المستند غير صالح.");
  try {
    const result = await pool.query(
      "SELECT file_name, mime_type, file_data FROM cheque_attachments WHERE id = $1",
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
    console.error("Cheque attachment read failed:", error);
    fail(res, 500, "تعذر فتح مرفق الشيك.");
  }
});

app.get("/api/rentals", requireRentalSchema, authenticate, requireSection("rentals"), async (req, res) => {
  const focusId = typeof req.query.focusId === "string" ? Number(req.query.focusId) : null;
  if (focusId !== null && (!Number.isSafeInteger(focusId) || focusId <= 0)) return fail(res, 400, "رقم عقد الكراء غير صالح.");
  try {
    const [items, alerts] = await Promise.all([
      pool.query(`
        SELECT r.id, r.equipment, r.client_or_owner, r.start_date::text, r.end_date::text,
          r.total_amount, r.paid_amount, GREATEST(r.total_amount - r.paid_amount, 0) AS remaining,
          r.status, r.rate_period, r.rental_rate, r.duration, r.notes, r.created_at,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size', a.file_size
            ) ORDER BY a.created_at, a.id)
            FROM rental_attachments a WHERE a.rental_id = r.id
          ), '[]'::json) AS attachments
        FROM rentals r ${focusId === null ? "" : "WHERE r.id = $1"}
        ORDER BY CASE WHEN r.status = 'active' THEN 0 ELSE 1 END, r.end_date ASC, r.id DESC
      `, focusId === null ? [] : [focusId]),
      pool.query(`
        SELECT COUNT(*)::int AS total,
          COALESCE(json_agg(json_build_object(
            'id', id, 'equipment', equipment, 'client_or_owner', client_or_owner,
            'end_date', end_date, 'days_until_end', end_date - CURRENT_DATE
          ) ORDER BY end_date ASC, id ASC) FILTER (WHERE id IS NOT NULL), '[]'::json) AS items
        FROM (
          SELECT id, equipment, client_or_owner, end_date
          FROM rentals WHERE status = 'active' AND end_date <= CURRENT_DATE + 7
          ORDER BY end_date ASC, id ASC LIMIT 8
        ) due
      `),
    ]);
    res.json({ items: items.rows, dueAlertCount: Number(alerts.rows[0].total), dueAlerts: alerts.rows[0].items });
  } catch (error) {
    console.error("Rental list failed:", error);
    fail(res, 500, "تعذر تحميل سجل الكراء.");
  }
});

app.post("/api/rentals", requireRentalSchema, authenticate, requireSection("rentals"), requirePermission("rentals", "create"), async (req: AuthenticatedRequest, res) => {
  const rental = validRental(req.body ?? {});
  if (!rental) return fail(res, 400, "تحقق من بيانات الكراء والتواريخ والسعر والمبلغ المدفوع.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO rentals
        (equipment, client_or_owner, start_date, end_date, total_amount, paid_amount, status,
         rate_period, rental_rate, duration, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [rental.equipment, rental.clientOrOwner, rental.startDate, rental.endDate, rental.totalAmount,
        rental.paidAmount, rental.status, rental.ratePeriod, rental.rentalRate, rental.duration, rental.notes],
    );
    await writeAuditWithClient(client, req.member!, "تسجيل عقد كراء",
      `${rental.equipment} لصالح ${rental.clientOrOwner} بقيمة ${rental.totalAmount} دج.`,
      { section: "rentals", eventType: "create", entityId: result.rows[0].id, data: { equipment: rental.equipment, clientOrOwner: rental.clientOrOwner, totalAmount: rental.totalAmount } });
    await client.query("COMMIT");
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Rental creation failed:", error);
    fail(res, 500, "تعذر تسجيل عملية الكراء.");
  } finally {
    client.release();
  }
});

app.patch("/api/rentals/:id", requireRentalSchema, authenticate, requireSection("rentals"), requirePermission("rentals", "edit"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم عقد الكراء غير صالح.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT equipment, client_or_owner AS "clientOrOwner", start_date::text AS "startDate",
        end_date::text AS "endDate", rate_period AS "ratePeriod", rental_rate AS "rentalRate",
        paid_amount AS "paidAmount", status, notes FROM rentals WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "عقد الكراء غير موجود.");
    }
    const rental = validRental(req.body ?? {}, existing.rows[0]);
    if (!rental) {
      await client.query("ROLLBACK");
      return fail(res, 400, "بيانات الكراء غير صالحة. يجب ألا يتجاوز المدفوع الإجمالي.");
    }
    await client.query(
      `UPDATE rentals SET equipment = $1, client_or_owner = $2, start_date = $3, end_date = $4,
        total_amount = $5, paid_amount = $6, status = $7, rate_period = $8, rental_rate = $9,
        duration = $10, notes = $11 WHERE id = $12`,
      [rental.equipment, rental.clientOrOwner, rental.startDate, rental.endDate, rental.totalAmount,
        rental.paidAmount, rental.status, rental.ratePeriod, rental.rentalRate, rental.duration, rental.notes, id],
    );
    await writeAuditWithClient(client, req.member!, "تعديل عقد كراء", `تحديث عقد الكراء رقم ${id}.`,
      { section: "rentals", eventType: "update", entityId: id, data: { equipment: rental.equipment, clientOrOwner: rental.clientOrOwner, totalAmount: rental.totalAmount, paidAmount: rental.paidAmount } });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Rental update failed:", error);
    fail(res, 500, "تعذر تعديل بيانات الكراء.");
  } finally {
    client.release();
  }
});

app.delete("/api/rentals/:id", requireRentalSchema, authenticate, requireSection("rentals"), requirePermission("rentals", "delete"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم عقد الكراء غير صالح.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM rentals WHERE id = $1 RETURNING equipment, client_or_owner, total_amount",
      [id],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "عقد الكراء غير موجود.");
    }
    await writeAuditWithClient(client, req.member!, "حذف عقد كراء", `حذف عقد كراء ${result.rows[0].equipment}.`,
      { section: "rentals", eventType: "delete", entityId: id, data: { equipment: result.rows[0].equipment, clientOrOwner: result.rows[0].client_or_owner, totalAmount: result.rows[0].total_amount } });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Rental deletion failed:", error);
    fail(res, 500, "تعذر حذف عقد الكراء.");
  } finally {
    client.release();
  }
});

app.post("/api/rentals/:id/attachments", requireRentalSchema, authenticate, requireSection("rentals"), requireAnyPermission("rentals", "create", "edit"), requireFileUpload, uploadFiles, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!Number.isSafeInteger(id) || id <= 0 || files.length === 0) return fail(res, 400, "اختر مستنداً واحداً على الأقل.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rental = await client.query("SELECT equipment FROM rentals WHERE id = $1 FOR UPDATE", [id]);
    if (!rental.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "عقد الكراء غير موجود.");
    }
    const count = await client.query("SELECT COUNT(*)::int AS total FROM rental_attachments WHERE rental_id = $1", [id]);
    if (Number(count.rows[0].total) + files.length > 5) {
      await client.query("ROLLBACK");
      return fail(res, 400, "الحد الأقصى هو خمسة مرفقات لكل عقد كراء.");
    }
    const member = req.member!;
    const attachments = [];
    for (const file of files) {
      const saved = await client.query(
        `INSERT INTO rental_attachments
          (rental_id, file_name, mime_type, file_size, file_data, uploaded_by_id, uploaded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, file_name, mime_type, file_size`,
        [id, path.basename(file.originalname), file.mimetype, file.size, file.buffer, member.clerk_user_id, member.name],
      );
      attachments.push(saved.rows[0]);
    }
    await writeAuditWithClient(client, member, "إرفاق مستند بعقد كراء",
      `إرفاق ${files.length} مستند بعقد ${rental.rows[0].equipment}.`,
      { section: "rentals", eventType: "attachment", entityId: id, data: { equipment: rental.rows[0].equipment, fileCount: files.length } });
    await client.query("COMMIT");
    res.status(201).json({ attachments });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Rental attachment upload failed:", error);
    fail(res, 500, "تعذر حفظ مرفقات عقد الكراء.");
  } finally {
    client.release();
  }
});

app.get("/api/rental-attachments/:id", requireRentalSchema, authenticate, requireSection("rentals"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم المستند غير صالح.");
  try {
    const result = await pool.query("SELECT file_name, mime_type, file_data FROM rental_attachments WHERE id = $1", [id]);
    if (!result.rowCount) return fail(res, 404, "المستند غير موجود.");
    const attachment = result.rows[0];
    const inline = attachment.mime_type === "application/pdf" || attachment.mime_type.startsWith("image/");
    const safeName = encodeURIComponent(String(attachment.file_name).replace(/[\r\n"]/g, ""));
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(Buffer.from(attachment.file_data));
  } catch (error) {
    console.error("Rental attachment read failed:", error);
    fail(res, 500, "تعذر فتح مرفق عقد الكراء.");
  }
});

const machinerySparePartSelect = `
  SELECT p.id, p.machinery_id, m.code AS machinery_code, m.name AS machinery_name,
    p.name, p.quantity, p.buy_price, COALESCE(s.name, p.supplier) AS supplier,
    COALESCE(pi.invoice_number, p.invoice_number) AS invoice_number,
    p.supplier_id, p.invoice_id,
    p.installation_date::text AS installation_date, p.stock_quantity, p.repair_expense,
    p.notes, p.recorded_by_name, p.created_at,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size', a.file_size
      ) ORDER BY a.created_at)
      FROM machinery_spare_part_attachments a WHERE a.spare_part_id = p.id
    ), '[]'::json) AS attachments
  FROM machinery_spare_parts p
  JOIN machinery m ON m.id = p.machinery_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN purchase_invoices pi ON pi.id = p.invoice_id`;

const recordNoteTargets = {
  transaction: { section: "finance", table: "transactions", label: "العملية المالية", memberId: false },
  inventory: { section: "inventory", table: "inventory_items", label: "سلعة المخزون", memberId: false },
  inventoryMovement: { section: "inventory", table: "inventory_movements", label: "حركة المخزون", memberId: false },
  cheque: { section: "cheques", table: "cheques", label: "الشيك", memberId: false },
  rental: { section: "rentals", table: "rentals", label: "عقد الكراء", memberId: false },
  fieldExpense: { section: "field", table: "field_expenses", label: "مصروف الميدان", memberId: false },
  machinery: { section: "machinery", table: "machinery", label: "المركبة أو الآلية", memberId: false },
  machinerySparePart: { section: "machinery", table: "machinery_spare_parts", label: "قطعة الغيار", memberId: false },
  member: { section: "users", table: "members", label: "العضو", memberId: true },
  auditNote: { section: "audit", table: "audit_log_notes", label: "ملاحظة سجل التدقيق", memberId: false },
} as const;

app.patch("/api/record-notes/:entity/:id", requireRecordNotesSchema, authenticate, async (req: AuthenticatedRequest, res) => {
  const entity = req.params.entity as keyof typeof recordNoteTargets;
  const target = recordNoteTargets[entity];
  const rawId = decodeURIComponent(req.params.id);
  const member = req.member!;
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : null;
  if (!target) return fail(res, 404, "نوع السجل غير مدعوم.");
  if (notes === null || notes.length > 5000) return fail(res, 400, "الملاحظة غير صالحة أو تتجاوز 5000 حرف.");

  if (target.memberId) {
    if (member.role !== "admin") return fail(res, 403, "ملاحظات الأعضاء متاحة للمدير فقط.");
    if (!/^user_[A-Za-z0-9_-]{1,120}$/.test(rawId)) return fail(res, 400, "معرّف العضو غير صالح.");
  } else {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم السجل غير صالح.");
    if (!hasPermission(member, target.section, "edit")) {
      return fail(res, 403, "ليس لديك صلاحية الوصول إلى هذا القسم.");
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let result;
    if (target.memberId) {
      result = await client.query(
        "UPDATE members SET notes = $1, updated_at = NOW() WHERE clerk_user_id = $2 RETURNING notes",
        [notes, rawId],
      );
    } else if (entity === "auditNote") {
      const auditLog = await client.query("SELECT id FROM audit_logs WHERE id = $1", [Number(rawId)]);
      if (!auditLog.rowCount) {
        await client.query("ROLLBACK");
        return fail(res, 404, "سجل التدقيق غير موجود.");
      }
      result = await client.query(
        `INSERT INTO audit_log_notes (audit_log_id, notes, updated_by_id, updated_by_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (audit_log_id) DO UPDATE
           SET notes = EXCLUDED.notes, updated_by_id = EXCLUDED.updated_by_id,
               updated_by_name = EXCLUDED.updated_by_name, updated_at = NOW()
         RETURNING notes`,
        [Number(rawId), notes, member.clerk_user_id, member.name],
      );
    } else if (entity === "fieldExpense" && member.role !== "admin") {
      result = await client.query(
        "UPDATE field_expenses SET notes = $1 WHERE id = $2 AND created_by_id = $3 RETURNING notes",
        [notes, Number(rawId), member.clerk_user_id],
      );
    } else {
      result = await client.query(
        `UPDATE ${target.table} SET notes = $1 WHERE id = $2 RETURNING notes`,
        [notes, Number(rawId)],
      );
    }
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      if (entity === "fieldExpense" && member.role !== "admin") {
        return fail(res, 403, "يمكنك تعديل ملاحظات المصاريف التي سجلتها فقط.");
      }
      return fail(res, 404, "السجل غير موجود.");
    }
    await writeAuditWithClient(client, member, "تعديل ملاحظات سجل", `${target.label} رقم ${rawId}.`,
      { section: entity === "auditNote" ? "audit" : target.section, eventType: "note", entityId: rawId, data: { entity } });
    await client.query("COMMIT");
    res.json({ notes: result.rows[0].notes });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Record note update failed:", error);
    fail(res, 500, "تعذر حفظ الملاحظة.");
  } finally {
    client.release();
  }
});

app.get("/api/machinery", requireMachinerySchema, authenticate, requireSection("machinery"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.code, m.name, m.category, m.status, m.hours_worked, m.notes,
        COUNT(p.id)::int AS repair_count,
        COALESCE(SUM(p.quantity * p.buy_price + p.repair_expense), 0) AS total_expenses
      FROM machinery m
      LEFT JOIN machinery_spare_parts p ON p.machinery_id = m.id
      GROUP BY m.id ORDER BY m.code, m.id`);
    res.json({ items: result.rows });
  } catch (error) {
    console.error("Machinery list failed:", error);
    fail(res, 500, "تعذر تحميل قائمة المركبات والآليات.");
  }
});

app.post("/api/machinery", requireMachinerySchema, authenticate, requireSection("machinery"), requirePermission("machinery", "create"), async (req: AuthenticatedRequest, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
  if (!code || code.length > 80 || !name || name.length > 200 || category.length > 120 || notes.length > 5000) {
    return fail(res, 400, "أدخل رقماً تعريفياً واسماً صالحين للمركبة أو الآلية.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO machinery (code, name, category, notes) VALUES ($1, $2, $3, $4)
       RETURNING id, code, name, category, status, hours_worked, notes`,
      [code, name, category, notes],
    );
    await writeAuditWithClient(client, req.member!, "تسجيل مركبة أو آلية", `${name} — ${code}.`,
      { section: "machinery", eventType: "create", entityId: result.rows[0].id, data: { code, name, category } });
    await client.query("COMMIT");
    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return fail(res, 409, "الرقم التعريفي مستخدم من قبل.");
    console.error("Machinery creation failed:", error);
    fail(res, 500, "تعذر تسجيل المركبة أو الآلية.");
  } finally {
    client.release();
  }
});

app.get("/api/machinery/spare-parts", requireMachinerySchema, authenticate, requireSection("machinery"), async (req, res) => {
  const machineryId = req.query.machineryId === undefined ? null : Number(req.query.machineryId);
  const focusId = typeof req.query.focusId === "string" ? Number(req.query.focusId) : null;
  if (machineryId !== null && (!Number.isSafeInteger(machineryId) || machineryId <= 0)) {
    return fail(res, 400, "رقم المركبة أو الآلية غير صالح.");
  }
  if (focusId !== null && (!Number.isSafeInteger(focusId) || focusId <= 0)) {
    return fail(res, 400, "رقم قطعة الغيار غير صالح.");
  }
  try {
    const where: string[] = [];
    const values: number[] = [];
    if (machineryId !== null) {
      values.push(machineryId);
      where.push(`p.machinery_id = $${values.length}`);
    }
    if (focusId !== null) {
      values.push(focusId);
      where.push(`p.id = $${values.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await pool.query(
      `${machinerySparePartSelect} ${clause} ORDER BY p.installation_date DESC NULLS LAST, p.created_at DESC LIMIT 300`,
      values,
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error("Machinery spare part list failed:", error);
    fail(res, 500, "تعذر تحميل سجل قطع الغيار والإصلاحات.");
  }
});

app.post("/api/machinery/spare-parts", requireMachinerySchema, authenticate, requireSection("machinery"), requirePermission("machinery", "create"), async (req: AuthenticatedRequest, res) => {
  const body = req.body ?? {};
  const machineryId = Number(body.machineryId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const supplier = typeof body.supplier === "string" ? body.supplier.trim() : "";
  const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const quantity = Number(body.quantity);
  const buyPrice = Number(body.buyPrice);
  const stockQuantity = Number(body.stockQuantity);
  const repairExpense = Number(body.repairExpense ?? 0);
  const installationDate = body.installationDate === "" || body.installationDate == null ? null : body.installationDate;
  const maxAmount = 99999999999999;
  if (!Number.isSafeInteger(machineryId) || machineryId <= 0 ||
      !name || name.length > 200 || supplier.length > 200 || invoiceNumber.length > 120 ||
      (invoiceNumber && !supplier) || notes.length > 5000 ||
      !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000 ||
      !Number.isFinite(buyPrice) || buyPrice < 0 || buyPrice > maxAmount ||
      !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > quantity ||
      !Number.isFinite(repairExpense) || repairExpense < 0 || repairExpense > maxAmount ||
      (installationDate !== null && !validIsoDate(installationDate))) {
    return fail(res, 400, "تحقق من اسم القطعة والكميات والأسعار والتاريخ.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const machine = await client.query("SELECT id, name FROM machinery WHERE id = $1", [machineryId]);
    if (!machine.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "المركبة أو الآلية المحددة غير موجودة.");
    }
    const member = req.member!;
    const links = await ensureSupplierInvoice(
      client,
      supplier,
      invoiceNumber,
      null,
      member,
    );
    const result = await client.query(
      `INSERT INTO machinery_spare_parts
        (machinery_id, name, quantity, buy_price, supplier, invoice_number, supplier_id, invoice_id,
         installation_date, stock_quantity, repair_expense, notes, recorded_by_id, recorded_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [machineryId, name, quantity, buyPrice, supplier, invoiceNumber, links.supplierId, links.invoiceId,
        installationDate, stockQuantity, repairExpense, notes, member.clerk_user_id, member.name],
    );
    await writeAuditWithClient(client, member, "تسجيل قطعة غيار أو إصلاح", `${name} لآلية ${machine.rows[0].name}.`,
      { section: "machinery", eventType: "create", entityId: result.rows[0].id, data: { machineryId, machineName: machine.rows[0].name, name, quantity, supplier, totalCost: quantity * buyPrice + repairExpense } });
    await client.query("COMMIT");
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Machinery spare part creation failed:", error);
    fail(res, 500, "تعذر تسجيل قطعة الغيار أو الإصلاح.");
  } finally {
    client.release();
  }
});

app.post("/api/machinery/spare-parts/:id/attachments", requireMachinerySchema, authenticate, requireSection("machinery"), requireAnyPermission("machinery", "create", "edit"), requireFileUpload, uploadFiles, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!Number.isSafeInteger(id) || id <= 0 || files.length === 0) return fail(res, 400, "اختر مستنداً واحداً على الأقل.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const part = await client.query("SELECT id, name FROM machinery_spare_parts WHERE id = $1 FOR UPDATE", [id]);
    if (!part.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "سجل قطعة الغيار غير موجود.");
    }
    const count = await client.query(
      "SELECT COUNT(*)::int AS total FROM machinery_spare_part_attachments WHERE spare_part_id = $1",
      [id],
    );
    if (Number(count.rows[0].total) + files.length > 5) {
      await client.query("ROLLBACK");
      return fail(res, 400, "الحد الأقصى هو خمسة مرفقات لكل سجل صيانة.");
    }
    const member = req.member!;
    const saved = [];
    for (const file of files) {
      const result = await client.query(
        `INSERT INTO machinery_spare_part_attachments
          (spare_part_id, file_name, mime_type, file_size, file_data, uploaded_by_id, uploaded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, file_name, mime_type, file_size`,
        [id, path.basename(file.originalname), file.mimetype, file.size, file.buffer, member.clerk_user_id, member.name],
      );
      saved.push(result.rows[0]);
    }
    await writeAuditWithClient(client, member, "إرفاق مستند بسجل صيانة", `إرفاق ${files.length} مستند بقطعة ${part.rows[0].name}.`,
      { section: "machinery", eventType: "attachment", entityId: id, data: { sparePart: part.rows[0].name, fileCount: files.length } });
    await client.query("COMMIT");
    res.status(201).json({ attachments: saved });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Machinery spare part attachment upload failed:", error);
    fail(res, 500, "تعذر حفظ مستندات سجل الصيانة.");
  } finally {
    client.release();
  }
});

app.get("/api/machinery/spare-part-attachments/:id", requireMachinerySchema, authenticate, requireSection("machinery"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم المستند غير صالح.");
  try {
    const result = await pool.query(
      "SELECT file_name, mime_type, file_data FROM machinery_spare_part_attachments WHERE id = $1",
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
    console.error("Machinery spare part attachment read failed:", error);
    fail(res, 500, "تعذر فتح المستند.");
  }
});

const attachmentDeleteTargets: Partial<Record<SectionId, {
  table: string;
  parentColumn: string;
  label: string;
}>> = {
  finance: { table: "transaction_attachments", parentColumn: "transaction_id", label: "العملية المالية" },
  inventory: { table: "inventory_attachments", parentColumn: "inventory_item_id", label: "عملية الشراء" },
  cheques: { table: "cheque_attachments", parentColumn: "cheque_id", label: "الشيك" },
  rentals: { table: "rental_attachments", parentColumn: "rental_id", label: "عقد الكراء" },
  field: { table: "field_expense_attachments", parentColumn: "field_expense_id", label: "العملية الميدانية" },
  machinery: { table: "machinery_spare_part_attachments", parentColumn: "spare_part_id", label: "سجل قطعة الغيار أو الإصلاح" },
};

app.delete("/api/attachments/:section/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  const section = req.params.section as SectionId;
  const target = attachmentDeleteTargets[section];
  if (!target) return fail(res, 404, "قسم المرفقات غير موجود.");
  const member = req.member!;
  if (!hasPermission(member, section, "view")) return fail(res, 403, "ليس لديك صلاحية الوصول إلى هذا القسم.");
  if (!hasPermission(member, section, "delete")) return fail(res, 403, "لا تملك صلاحية حذف المرفقات في هذا القسم.");

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم المرفق غير صالح.");

  try {
    if (section === "rentals") await ensureRentalSchema();
    if (section === "field") await ensureFieldExpenseSchema();
    if (section === "machinery") await ensureMachinerySchema();
  } catch (error) {
    console.error("Attachment schema initialization failed:", error);
    return fail(res, 503, "تعذر تجهيز قاعدة بيانات المرفقات.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = section === "field" && member.role !== "admin" && member.role !== "finance"
      ? await client.query(
        `DELETE FROM ${target.table} a USING field_expenses e
         WHERE a.id = $1 AND a.${target.parentColumn} = e.id AND e.created_by_id = $2
         RETURNING a.${target.parentColumn} AS record_id, a.file_name`,
        [id, member.clerk_user_id],
      )
      : await client.query(
        `DELETE FROM ${target.table} WHERE id = $1
         RETURNING ${target.parentColumn} AS record_id, file_name`,
        [id],
      );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "المرفق غير موجود أو لا يمكن الوصول إليه.");
    }
    const { record_id: recordId, file_name: fileName } = result.rows[0];
    await writeAuditWithClient(
      client,
      member,
      "حذف مرفق",
      `حذف الملف ${fileName} من ${target.label} رقم ${recordId}.`,
      { section, eventType: "delete", entityId: recordId, data: { fileName, attachmentId: id } },
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Attachment deletion failed:", error);
    fail(res, 500, "تعذر حذف المرفق.");
  } finally {
    client.release();
  }
});

app.get("/api/sections/:section", authenticate, async (req: AuthenticatedRequest, res) => {
  const section = req.params.section as SectionId;
  if (!allSectionIds.includes(section)) return fail(res, 404, "القسم غير موجود.");
  if (!hasPermission(req.member, section, "view")) {
    return fail(res, 403, "ليس لديك صلاحية الوصول إلى هذا القسم.");
  }

  try {
    const focusId = typeof req.query.focusId === "string" ? Number(req.query.focusId) : null;
    if (focusId !== null && (!Number.isSafeInteger(focusId) || focusId <= 0)) return fail(res, 400, "رقم السجل غير صالح.");
    const queries: Partial<Record<SectionId, string>> = {
      finance: `SELECT id, type, amount, party, reason, payment_method, transaction_date AS date, recorded_by_name
        FROM transactions ORDER BY transaction_date DESC, created_at DESC LIMIT 100`,
      inventory: `SELECT id, name, quantity, remaining_quantity, buy_price, total_cost, supplier, invoice_number, purchase_date
        FROM inventory_items ORDER BY created_at DESC LIMIT 100`,
      cheques: `SELECT id, cheque_number, invoice_number, amount, beneficiary, bank, issue_date, due_date, status, notes
        FROM cheques ORDER BY due_date ASC LIMIT 100`,
      rentals: `SELECT id, equipment, client_or_owner, start_date, end_date, total_amount, paid_amount,
        GREATEST(total_amount - paid_amount, 0) AS remaining, status, rate_period, rental_rate, duration, notes
        FROM rentals ORDER BY end_date ASC LIMIT 100`,
      field: `SELECT id, category, amount, site_name, details, created_by_name, created_at, fuel_liters
        FROM field_expenses ORDER BY created_at DESC LIMIT 100`,
      machinery: "SELECT id, code, name, category, status, hours_worked, notes FROM machinery ORDER BY code LIMIT 100",
      audit: `SELECT a.id, a.action, a.details, a.performed_by_name, a.created_at,
          COALESCE(n.notes, '') AS notes
        FROM audit_logs a LEFT JOIN audit_log_notes n ON n.audit_log_id = a.id
        ORDER BY a.created_at DESC LIMIT 100`,
    };
    const canSeeAllField = req.member?.role === "admin" || req.member?.role === "finance";
    let query = queries[section];
    if (!query) return res.json({ items: [] });
    const values: unknown[] = [];
    if (section === "field" && !canSeeAllField) {
      values.push(req.member?.clerk_user_id);
      query = query.replace("FROM field_expenses", "FROM field_expenses WHERE created_by_id = $1");
    }
    if (focusId !== null) {
      const insertion = section === "finance" ? "transactions" : null;
      if (!insertion) return fail(res, 400, "لا يدعم هذا القسم فتح سجل محدد من الإشعار.");
      const hasWhere = query.includes(" WHERE ");
      const marker = `$${values.length + 1}`;
      query = query.replace("FROM transactions", `FROM transactions${hasWhere ? " AND" : " WHERE"} id = ${marker}`);
      values.push(focusId);
      query = query.replace(/LIMIT \d+$/, "LIMIT 1");
    }
    const result = await pool.query(
      query,
      values,
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error(`Section query failed for ${section}:`, error);
    fail(res, 500, "تعذر تحميل بيانات القسم.");
  }
});

app.post("/api/transactions", authenticate, requireSection("finance"), requirePermission("finance", "create"), async (req: AuthenticatedRequest, res) => {
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
    await writeAuditWithClient(client, member, "تسجيل عملية مالية", `${type === "income" ? "دخل" : "مصروف"} بقيمة ${amount} دج.`,
      { section: "finance", eventType: "create", entityId: result.rows[0].id, data: { type, amount, party: party.trim(), reason: String(reason ?? "").trim(), paymentMethod } });
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

app.patch("/api/transactions/:id", authenticate, requireSection("finance"), requirePermission("finance", "edit"), async (req: AuthenticatedRequest, res) => {
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
    await writeAuditWithClient(client, req.member!, "تعديل عملية مالية", `تحديث العملية رقم ${id}.`,
      { section: "finance", eventType: "update", entityId: id, data: { type, amount, party: party.trim(), reason: String(reason ?? "").trim(), paymentMethod } });
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

app.delete("/api/transactions/:id", authenticate, requireSection("finance"), requirePermission("finance", "delete"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم العملية غير صالح.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(574382910)");
    const result = await client.query("DELETE FROM transactions WHERE id = $1 RETURNING id, type, amount, party, reason");
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "العملية المالية غير موجودة.");
    }
    await recalculateCashBalances(client);
    await writeAuditWithClient(client, req.member!, "حذف عملية مالية", `حذف العملية رقم ${id}.`,
      { section: "finance", eventType: "delete", entityId: id, data: result.rows[0] });
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

app.post("/api/transactions/:id/attachments", authenticate, requireSection("finance"), requireAnyPermission("finance", "create", "edit"), requireFileUpload, uploadFiles, async (req: AuthenticatedRequest, res) => {
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
    await writeAuditWithClient(client, member, "إرفاق مستند بعملية مالية", `إرفاق ${files.length} مستند للعملية رقم ${id}.`,
      { section: "finance", eventType: "attachment", entityId: id, data: { fileCount: files.length } });
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

app.post("/api/inventory/:id/attachments", authenticate, requireSection("inventory"), requireAnyPermission("inventory", "create", "edit"), requireFileUpload, uploadFiles, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!Number.isSafeInteger(id) || id <= 0 || files.length === 0) return fail(res, 400, "اختر مستنداً واحداً على الأقل.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const item = await client.query("SELECT id, name FROM inventory_items WHERE id = $1 FOR UPDATE", [id]);
    if (!item.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "عملية الشراء غير موجودة.");
    }
    const count = await client.query(
      "SELECT COUNT(*)::int AS total FROM inventory_attachments WHERE inventory_item_id = $1",
      [id],
    );
    if (Number(count.rows[0].total) + files.length > 5) {
      await client.query("ROLLBACK");
      return fail(res, 400, "الحد الأقصى هو خمسة مستندات لكل عملية شراء.");
    }
    const member = req.member!;
    const saved = [];
    for (const file of files) {
      const result = await client.query(
        `INSERT INTO inventory_attachments
          (inventory_item_id, file_name, mime_type, file_size, file_data, uploaded_by_id, uploaded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, file_name, mime_type, file_size`,
        [id, path.basename(file.originalname), file.mimetype, file.size, file.buffer, member.clerk_user_id, member.name],
      );
      saved.push(result.rows[0]);
    }
    await writeAuditWithClient(client, member, "إرفاق مستند بعملية شراء", `إرفاق ${files.length} مستند للسلعة ${item.rows[0].name}.`,
      { section: "inventory", eventType: "attachment", entityId: id, data: { itemName: item.rows[0].name, fileCount: files.length } });
    await client.query("COMMIT");
    res.status(201).json({ attachments: saved });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Inventory attachment upload failed:", error);
    fail(res, 500, "تعذر حفظ مستندات الشراء.");
  } finally {
    client.release();
  }
});

app.get("/api/inventory-attachments/:id", authenticate, requireSection("inventory"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم المستند غير صالح.");
  try {
    const result = await pool.query(
      "SELECT file_name, mime_type, file_data FROM inventory_attachments WHERE id = $1",
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
    console.error("Inventory attachment read failed:", error);
    fail(res, 500, "تعذر فتح المستند.");
  }
});

app.get("/api/field-expenses", requireFieldExpenseSchema, authenticate, requireSection("field"), async (req: AuthenticatedRequest, res) => {
  try {
    const member = req.member!;
    const focusId = typeof req.query.focusId === "string" ? Number(req.query.focusId) : null;
    if (focusId !== null && (!Number.isSafeInteger(focusId) || focusId <= 0)) return fail(res, 400, "رقم المصروف غير صالح.");
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (member.role !== "admin" && member.role !== "finance") {
      values.push(member.clerk_user_id);
      conditions.push(`f.created_by_id = $${values.length}`);
    }
    if (focusId !== null) {
      values.push(focusId);
      conditions.push(`f.id = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT f.id, f.category, f.amount, f.site_name, f.details, f.notes, f.fuel_liters,
        f.created_by_id, f.created_by_name, f.created_at, f.review_status,
        f.reviewed_by_name, f.reviewed_at, f.review_notes,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size', a.file_size
          ) ORDER BY a.created_at, a.id)
          FROM field_expense_attachments a WHERE a.field_expense_id = f.id
        ), '[]'::json) AS attachments
       FROM field_expenses f ${where}
       ORDER BY CASE WHEN f.review_status = 'pending' THEN 0 ELSE 1 END, f.created_at DESC, f.id DESC
       LIMIT 200`,
      values,
    );
    const pending = await pool.query(
      `SELECT COUNT(*)::int AS count FROM field_expenses ${member.role === "admin" || member.role === "finance" ? "WHERE review_status = 'pending'" : "WHERE created_by_id = $1 AND review_status = 'pending'"}`,
      member.role === "admin" || member.role === "finance" ? [] : [member.clerk_user_id],
    );
    res.json({ items: result.rows, pendingCount: Number(pending.rows[0].count) });
  } catch (error) {
    console.error("Field expense list failed:", error);
    fail(res, 500, "تعذر تحميل سجل مصاريف الميدان.");
  }
});

app.post("/api/field-expenses", requireFieldExpenseSchema, authenticate, requireSection("field"), requirePermission("field", "create"), async (req: AuthenticatedRequest, res) => {
  const { category, amount, siteName, details, fuelLiters, notes } = req.body ?? {};
  const categoryText = typeof category === "string" ? category.trim() : "";
  const siteText = typeof siteName === "string" ? siteName.trim() : "";
  const numericAmount = Number(amount);
  const liters = fuelLiters === undefined || fuelLiters === null || fuelLiters === "" ? null : Number(fuelLiters);
  if (!categoryText || categoryText.length > 120 || !siteText || siteText.length > 200 ||
      !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 99999999999999.99 ||
      (categoryText === "مازوت" && liters === null) ||
      (liters !== null && (!Number.isFinite(liters) || liters <= 0 || liters > 99999999)) ||
      String(details ?? "").length > 3000 || String(notes ?? "").length > 5000) {
    return fail(res, 400, "أدخل نوع العملية والموقع والمبلغ والكمية بشكل صحيح.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const member = req.member!;
    const result = await client.query(
      `INSERT INTO field_expenses
        (category, amount, site_name, details, fuel_liters, notes, created_by_id, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, category, amount, site_name, details, notes, fuel_liters,
         created_by_id, created_by_name, created_at, review_status`,
      [categoryText, numericAmount, siteText, String(details ?? "").trim(), liters,
        String(notes ?? "").trim(), member.clerk_user_id, member.name],
    );
    await writeAuditWithClient(client, member, "تسجيل مصروف ميداني",
      `${categoryText} بقيمة ${numericAmount} دج في ${siteText}.`,
      { section: "field", eventType: "create", entityId: result.rows[0].id, data: { category: categoryText, amount: numericAmount, siteName: siteText, fuelLiters: liters, details: String(details ?? "").trim() } });
    await client.query("COMMIT");
    res.status(201).json({ item: { ...result.rows[0], attachments: [] } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Field expense creation failed:", error);
    fail(res, 500, "تعذر حفظ المصروف الميداني.");
  } finally {
    client.release();
  }
});

app.patch("/api/field-expenses/:id/review", requireFieldExpenseSchema, authenticate, requireSection("field"), requirePermission("field", "edit"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  const reviewNotes = typeof req.body?.reviewNotes === "string" ? req.body.reviewNotes.trim() : "";
  if (!Number.isSafeInteger(id) || id <= 0 || !["pending", "reviewed"].includes(status) || reviewNotes.length > 1000) {
    return fail(res, 400, "بيانات مراجعة المصروف غير صالحة.");
  }
  const member = req.member!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE field_expenses SET review_status = $1,
        reviewed_by_id = CASE WHEN $1 = 'reviewed' THEN $2 ELSE NULL END,
        reviewed_by_name = CASE WHEN $1 = 'reviewed' THEN $3 ELSE NULL END,
        reviewed_at = CASE WHEN $1 = 'reviewed' THEN NOW() ELSE NULL END,
        review_notes = $4
       WHERE id = $5 RETURNING id`,
      [status, member.clerk_user_id, member.name, reviewNotes, id],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "المصروف الميداني غير موجود.");
    }
    await writeAuditWithClient(client, member, status === "reviewed" ? "مراجعة مصروف ميداني" : "إعادة مصروف للمراجعة",
      `مراجعة العملية رقم ${id}${reviewNotes ? `: ${reviewNotes}` : ""}.`,
      { section: "field", eventType: "review", entityId: id, data: { status, reviewNotes } });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Field expense review update failed:", error);
    fail(res, 500, "تعذر تحديث حالة مراجعة المصروف.");
  } finally {
    client.release();
  }
});

app.post("/api/field-expenses/:id/attachments", requireFieldExpenseSchema, authenticate, requireSection("field"), requireAnyPermission("field", "create", "edit"), requireFileUpload, uploadFiles, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!Number.isSafeInteger(id) || id <= 0 || !files.length) return fail(res, 400, "اختر صورة أو وثيقة واحدة على الأقل.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const expense = await client.query(
      "SELECT created_by_id FROM field_expenses WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!expense.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "عملية المصروف غير موجودة.");
    }
    const member = req.member!;
    if (member.role !== "admin" && member.role !== "finance" && expense.rows[0].created_by_id !== member.clerk_user_id) {
      await client.query("ROLLBACK");
      return fail(res, 403, "لا يمكنك إرفاق مستند بعملية سجلها مستخدم آخر.");
    }
    const count = await client.query(
      "SELECT COUNT(*)::int AS total FROM field_expense_attachments WHERE field_expense_id = $1",
      [id],
    );
    if (Number(count.rows[0].total) + files.length > 5) {
      await client.query("ROLLBACK");
      return fail(res, 400, "الحد الأقصى هو خمسة مرفقات لكل عملية.");
    }
    const attachments = [];
    for (const file of files) {
      const saved = await client.query(
        `INSERT INTO field_expense_attachments
          (field_expense_id, file_name, mime_type, file_size, file_data, uploaded_by_id, uploaded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, file_name, mime_type, file_size`,
        [id, path.basename(file.originalname), file.mimetype, file.size, file.buffer, member.clerk_user_id, member.name],
      );
      attachments.push(saved.rows[0]);
    }
    await client.query(
      `UPDATE field_expenses SET review_status = 'pending',
        reviewed_by_id = NULL, reviewed_by_name = NULL, reviewed_at = NULL, review_notes = ''
       WHERE id = $1`,
      [id],
    );
    await writeAuditWithClient(client, member, "إرفاق وثيقة بمصروف ميداني", `إرفاق ${files.length} ملفات بالعملية رقم ${id}.`,
      { section: "field", eventType: "attachment", entityId: id, data: { fileCount: files.length } });
    await client.query("COMMIT");
    res.status(201).json({ attachments });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Field expense attachment upload failed:", error);
    fail(res, 500, "تعذر حفظ صور الفواتير والوصولات.");
  } finally {
    client.release();
  }
});

app.get("/api/field-expense-attachments/:id", requireFieldExpenseSchema, authenticate, requireSection("field"), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, "رقم المرفق غير صالح.");
  try {
    const result = await pool.query(
      `SELECT a.file_name, a.mime_type, a.file_data, e.created_by_id
       FROM field_expense_attachments a
       JOIN field_expenses e ON e.id = a.field_expense_id
       WHERE a.id = $1`,
      [id],
    );
    if (!result.rowCount) return fail(res, 404, "المرفق غير موجود.");
    const attachment = result.rows[0];
    const member = req.member!;
    if (member.role !== "admin" && member.role !== "finance" && attachment.created_by_id !== member.clerk_user_id) {
      return fail(res, 404, "المرفق غير موجود.");
    }
    const inline = attachment.mime_type === "application/pdf" || attachment.mime_type.startsWith("image/");
    const safeName = encodeURIComponent(String(attachment.file_name).replace(/[\r\n"]/g, ""));
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(Buffer.from(attachment.file_data));
  } catch (error) {
    console.error("Field expense attachment read failed:", error);
    fail(res, 500, "تعذر فتح المرفق.");
  }
});

app.get("/api/members", requireRecordNotesSchema, authenticate, requireSection("users"), async (req: AuthenticatedRequest, res) => {
  const result = await pool.query(
    "SELECT clerk_user_id, COALESCE(email, '') AS email, name, role, role_name, active, allowed_sections, permissions, capabilities, notes, created_at, (serial_hash IS NOT NULL) AS has_serial FROM members ORDER BY created_at",
  );
  const isAdmin = req.member?.role === "admin";
  res.json({
    members: result.rows.map((item) => ({
      clerk_user_id: item.clerk_user_id,
      email: item.email,
      name: item.name,
      role: item.role,
      role_name: item.role_name,
      active: item.active,
      has_serial: item.has_serial,
      created_at: item.created_at,
      ...(isAdmin ? {
        allowed_sections: item.allowed_sections,
        notes: item.notes,
        capabilities: item.capabilities ?? {},
        permissions: effectivePermissions({
          ...(item as Member),
          capabilities: { uploadFiles: true, viewFinancialData: true, manageOperations: true },
        }),
      } : {}),
    })),
  });
});

app.post("/api/members", authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const roleName = typeof req.body?.roleName === "string" ? req.body.roleName.trim() : "";
  const role = typeof req.body?.role === "string" ? req.body.role : "viewer";
  const roles = new Set(["finance", "field", "supervisor", "viewer"]);
  if (name.length < 2 || name.length > 100 || !roles.has(role) || roleName.length > 80) {
    return fail(res, 400, "أدخل اسماً صحيحاً واختر نوع حساب صالحاً.");
  }
  const labels: Record<string, string> = {
    finance: "الإدارة المالية",
    field: "رئيس أشغال",
    supervisor: "مشرف",
    viewer: "عضو",
  };
  const safeRoleName = roleName || labels[role];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let serial = "";
    let created: Member | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      serial = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const result = await client.query<Member>(
        `INSERT INTO members
           (clerk_user_id, email, serial_lookup, serial_hash, name, role, active, allowed_sections, role_name, permissions)
         VALUES ($1, NULL, $2, $3, $4, $5, TRUE, ARRAY['dashboard']::text[], $6, '{}'::jsonb)
         ON CONFLICT (serial_lookup) DO NOTHING
         RETURNING clerk_user_id, email, name, role, active, allowed_sections, role_name, permissions, capabilities`,
        [randomUUID(), serialLookup(serial), await hashSerial(serial), name, role, safeRoleName],
      );
      if (result.rowCount) {
        created = result.rows[0];
        break;
      }
    }
    if (!created) {
      await client.query("ROLLBACK");
      return fail(res, 503, "تعذر توليد رقم دخول فريد. أعد المحاولة.");
    }
    await writeAuditWithClient(client, req.member!, "إنشاء حساب عضو", `تم إنشاء حساب ${name}.`,
      { section: "users", eventType: "create", entityId: created.clerk_user_id, data: { role, roleName: safeRoleName } });
    await client.query("COMMIT");
    res.status(201).json({ member: created, serial });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Member creation failed:", error);
    fail(res, 500, "تعذر إنشاء حساب العضو.");
  } finally {
    client.release();
  }
});

app.patch("/api/members/:id", authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const { active, permissions, capabilities, roleName } = req.body ?? {};
  if (targetId === req.member?.clerk_user_id) return fail(res, 400, "لا يمكن تعديل صلاحيات حساب المدير الحالي.");
  if (typeof active !== "boolean" || typeof roleName !== "string" ||
      !roleName.trim() || roleName.trim().length > 80 ||
      !permissions || typeof permissions !== "object" || Array.isArray(permissions) ||
      !capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    return fail(res, 400, "بيانات الصلاحيات غير صالحة.");
  }
  const cleanPermissions: MemberPermissions = Object.fromEntries(
    allSectionIds.map((section) => [
        section,
        { view: false, create: false, edit: false, delete: false },
      ]),
  ) as MemberPermissions;
  const cleanCapabilities: Required<MemberCapabilities> = {
    uploadFiles: (capabilities as MemberCapabilities).uploadFiles === true,
    viewFinancialData: (capabilities as MemberCapabilities).viewFinancialData === true,
    manageOperations: (capabilities as MemberCapabilities).manageOperations === true,
  };
  if (Object.keys(capabilities as object).some((key) =>
    !["uploadFiles", "viewFinancialData", "manageOperations"].includes(key),
  ) || Object.values(capabilities as Record<string, unknown>).some((value) => typeof value !== "boolean")) {
    return fail(res, 400, "إحدى الصلاحيات الإضافية غير صالحة.");
  }
  for (const [section, raw] of Object.entries(permissions as Record<string, unknown>)) {
    if (!allSectionIds.includes(section as SectionId) || !raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fail(res, 400, "قائمة الصلاحيات تحتوي على بيانات غير صالحة.");
    }
    const sectionRules = raw as Record<string, unknown>;
    for (const [action, allowed] of Object.entries(sectionRules)) {
      if (!permissionActions.includes(action as (typeof permissionActions)[number]) || typeof allowed !== "boolean") {
        return fail(res, 400, "إحدى صلاحيات القسم غير صالحة.");
      }
    }
    const rules = Object.fromEntries(
      permissionActions.map((action) => [action, sectionRules[action] === true]),
    );
    if (section === "users" && (rules.create || rules.edit || rules.delete)) {
      return fail(res, 400, "يمكن منح صلاحية عرض المستخدمين فقط؛ إدارتهم متاحة للمدير.");
    }
    if (section === "audit" && (rules.create || rules.delete)) {
      return fail(res, 400, "سجل التدقيق يدعم العرض وتعديل الملاحظات فقط.");
    }
    if (rules.create || rules.edit || rules.delete) rules.view = true;
    cleanPermissions[section as SectionId] = rules;
  }
  cleanPermissions.dashboard = { view: true, create: false, edit: false, delete: false };
  const sections = allSectionIds.filter((section) => cleanPermissions[section]?.view === true);
  if (!sections.includes("dashboard")) sections.push("dashboard");
  const safeRoleName = roleName.trim();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE members SET active = $1, allowed_sections = $2, role_name = $3,
        permissions = $4::jsonb, capabilities = $5::jsonb, updated_at = NOW()
       WHERE clerk_user_id = $6
       RETURNING clerk_user_id, email, name, role, role_name, active, allowed_sections, permissions, capabilities, created_at`,
      [active, sections, safeRoleName, JSON.stringify(cleanPermissions), JSON.stringify(cleanCapabilities), targetId],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "العضو غير موجود.");
    }
    await writeAuditWithClient(client, req.member!, "تعديل صلاحيات عضو", `تحديث الوصول للحساب ${result.rows[0].email}.`,
      { section: "users", eventType: "permissions", entityId: targetId, data: { email: result.rows[0].email, active, roleName: safeRoleName, permissions: cleanPermissions, capabilities: cleanCapabilities } });
    await client.query("COMMIT");
    res.json({ member: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Member permission update failed:", error);
    fail(res, 500, "تعذر تحديث صلاحيات العضو.");
  } finally {
    client.release();
  }
});

app.get("/api/audit", authenticate, requireSection("audit"), async (req: AuthenticatedRequest, res) => {
  try {
    await ensureAuditLogSchema();
    const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
    const section = typeof req.query.section === "string" ? req.query.section : "";
    const eventType = typeof req.query.type === "string" ? req.query.type : "";
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    const page = Math.max(1, Math.min(100000, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
    const pageSize = 50;
    const validSections = new Set<string>([...allSectionIds, "system"]);
    const validEventTypes = new Set<AuditEventType>([
      "create", "update", "delete", "review", "attachment", "permissions", "note", "setup", "other",
    ]);
    if ((section && !validSections.has(section)) ||
        (eventType && !validEventTypes.has(eventType as AuditEventType)) ||
        (from && !validIsoDate(from)) || (to && !validIsoDate(to)) ||
        (from && to && from > to)) {
      return fail(res, 400, "قيم البحث أو التصفية غير صالحة.");
    }

    const conditions: string[] = [];
    const values: unknown[] = [];
    const addCondition = (condition: (parameter: string) => string, value: unknown) => {
      values.push(value);
      conditions.push(condition(`$${values.length}`));
    };
    if (search) {
      addCondition((parameter) =>
        `(a.action ILIKE ${parameter} OR a.details ILIKE ${parameter} OR a.performed_by_name ILIKE ${parameter} OR a.data::text ILIKE ${parameter} OR a.entity_id ILIKE ${parameter})`,
      `%${search}%`);
    }
    if (section) addCondition((parameter) => `a.section = ${parameter}`, section);
    if (eventType) addCondition((parameter) => `a.event_type = ${parameter}`, eventType);
    if (from) addCondition((parameter) => `a.created_at >= ${parameter}::date`, from);
    if (to) addCondition((parameter) => `a.created_at < (${parameter}::date + INTERVAL '1 day')`, to);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;
    const [items, count] = await Promise.all([
      pool.query(
        `SELECT a.id, a.action, a.details, a.performed_by_id, a.performed_by_name,
          a.section, a.event_type, a.entity_id, a.data, a.created_at,
          COALESCE(n.notes, '') AS notes
         FROM audit_logs a LEFT JOIN audit_log_notes n ON n.audit_log_id = a.id
         ${where}
         ORDER BY a.created_at DESC, a.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
        values,
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs a ${where}`, values),
    ]);
    res.json({ items: items.rows, total: count.rows[0].total, page, pageSize });
  } catch (error) {
    console.error("Audit log search failed:", error);
    fail(res, 500, "تعذر تحميل سجل التدقيق.");
  }
});

const webRoot = path.resolve(process.cwd(), "dist");
if (existsSync(webRoot)) {
  app.use(express.static(webRoot, { index: false }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webRoot, "index.html"));
  });
}

async function startServer() {
  try {
    await pool.query("CREATE SCHEMA IF NOT EXISTS bennini");
    const schema = readFileSync(path.resolve(process.cwd(), "server/schema.sql"), "utf8");
    await pool.query(schema);
    app.listen(port, "0.0.0.0", () => {
      console.log(`Bennini API and web app listening on port ${port}`);
    });
  } catch (error) {
    console.error("Application startup failed while preparing the PostgreSQL schema:", error);
    process.exitCode = 1;
  }
}

void startServer();
