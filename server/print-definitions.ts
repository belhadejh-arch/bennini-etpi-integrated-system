import type { SectionId } from "../shared/sections";
import type { PrintColumn } from "../shared/printing";

const col = (key: string, label: string, numeric = false, sum = false): PrintColumn => ({ key, label, numeric, sum });
const money = (key: string, label: string, sum = true) => col(key, label, true, sum);
export type PrintDefinition = { section: SectionId; sql: string; columns: PrintColumn[] };
const id = col("id", "الرقم");
export const printDefinitions: Record<string, PrintDefinition> = {
  finance: {
    section: "finance",
    sql: `SELECT t.id,t.type,t.amount,t.party,t.reason,t.payment_method,t.transaction_date::text AS date,
      a.name AS account,t.account_id,t.interest_rate,ROUND(t.amount*t.interest_rate/100,2) AS interest_amount,
      t.recorded_by_name,t.notes FROM transactions t LEFT JOIN finance_accounts a ON a.id=t.account_id`,
    columns: [id,col("date","التاريخ"),col("type","نوع العملية"),col("account","الحساب"),col("party","الجهة"),
      col("reason","السبب"),money("amount","المبلغ (دج)"),col("payment_method","طريقة الدفع"),
      money("interest_rate","نسبة الفائدة %",false),money("interest_amount","الفائدة (دج)"),
      col("recorded_by_name","سجله"),col("notes","ملاحظات")],
  },
  inventory: {
    section: "inventory",
    sql: `SELECT id,name,quantity,remaining_quantity,buy_price,sale_price,total_cost,supplier,invoice_number,
      purchase_date::text,recorded_by_name,notes FROM inventory_items`,
    columns: [id,col("name","السلعة"),col("quantity","الكمية",true,true),col("remaining_quantity","المتبقي",true,true),
      money("buy_price","سعر الشراء (دج)",false),money("sale_price","سعر البيع (دج)",false),money("total_cost","التكلفة (دج)"),
      col("supplier","المورد"),col("invoice_number","رقم الفاتورة"),col("purchase_date","تاريخ الشراء"),col("recorded_by_name","سجله"),col("notes","ملاحظات")],
  },
  movements: {
    section: "inventory",
    sql: `SELECT v.id,i.name,v.movement_type,v.quantity,v.unit_price,v.quantity*v.unit_price AS total,
      v.counterparty,v.movement_date::text,v.recorded_by_name,v.notes
      FROM inventory_movements v JOIN inventory_items i ON i.id=v.inventory_item_id`,
    columns: [id,col("name","السلعة"),col("movement_type","الحركة"),col("quantity","الكمية",true,true),money("unit_price","سعر الوحدة (دج)",false),
      money("total","الإجمالي (دج)"),col("counterparty","الجهة"),col("movement_date","التاريخ"),col("recorded_by_name","سجله"),col("notes","ملاحظات")],
  },
  cheques: {
    section: "cheques",
    sql: `SELECT id,cheque_number,invoice_number,amount,beneficiary,bank,issue_date::text,due_date::text,status,notes FROM cheques`,
    columns: [id,col("cheque_number","رقم الشيك"),col("invoice_number","الفاتورة"),money("amount","المبلغ (دج)"),col("beneficiary","المستفيد"),
      col("bank","البنك"),col("issue_date","تاريخ الإصدار"),col("due_date","الاستحقاق"),col("status","الحالة"),col("notes","ملاحظات")],
  },
  rentals: {
    section: "rentals",
    sql: `SELECT r.id,COALESCE(m.name,r.equipment) AS equipment,r.client_or_owner,r.start_date::text,r.end_date::text,
      r.rate_period,r.rental_rate,r.duration,r.total_amount,r.paid_amount,r.total_amount-r.paid_amount AS remaining,
      r.status,r.notes,r.daily_shifts,r.created_by_name FROM rentals r LEFT JOIN machinery m ON m.id=r.machinery_id`,
    columns: [id,col("equipment","الآلة"),col("client_or_owner","المستأجر / المؤجر"),col("start_date","البداية"),col("end_date","النهاية"),
      col("rate_period","طريقة الاحتساب"),col("duration_label","مدة الكراء"),money("rental_rate","السعر (دج)",false),
      money("total_amount","الإجمالي (دج)"),money("paid_amount","المدفوع (دج)"),money("remaining","المتبقي (دج)"),
      col("status","الحالة"),col("created_by_name","سجله"),col("notes","ملاحظات")],
  },
  machinery: {
    section: "machinery",
    sql: `SELECT m.id,m.code,m.name,m.category,m.status,m.hours_worked,m.notes,
      COALESCE(p.total,0)+COALESCE(f.total,0)+COALESCE(r.total,0) AS total_expenses,
      COALESCE(f.repair_count,0) AS repair_count
      FROM machinery m
      LEFT JOIN (SELECT machinery_id,SUM(quantity*buy_price+repair_expense) AS total FROM machinery_spare_parts GROUP BY machinery_id) p ON p.machinery_id=m.id
      LEFT JOIN (SELECT machinery_id,SUM(amount) AS total,COUNT(*) FILTER(WHERE category IN ('قطع غيار','إصلاح آلية')) AS repair_count
        FROM field_expenses GROUP BY machinery_id) f ON f.machinery_id=m.id
      LEFT JOIN (SELECT machinery_id,SUM(total_amount) AS total FROM rentals GROUP BY machinery_id) r ON r.machinery_id=m.id`,
    columns: [id,col("code","الرقم التعريفي"),col("name","الآلة"),col("category","الفئة"),col("status","الحالة"),col("hours_worked","ساعات العمل",true,true),
      col("repair_count","عدد الإصلاحات",true,true),money("driver_total_cost","راتب السائق المستحق (دج)"),
      money("total_expenses","إجمالي التكاليف (دج)"),col("notes","ملاحظات")],
  },
  drivers: {
    section: "machinery",
    sql: `SELECT d.id,m.code,m.name,d.driver_name,d.monthly_salary,d.start_date::text,d.end_date::text,d.created_by_name
      FROM machinery_driver_assignments d JOIN machinery m ON m.id=d.machinery_id`,
    columns: [id,col("code","رمز الآلة"),col("name","الآلة"),col("driver_name","السائق"),money("monthly_salary","الراتب الشهري (دج)",false),
      col("start_date","البداية"),col("end_date","النهاية"),col("created_by_name","سجله")],
  },
  parts: {
    section: "machinery",
    sql: `SELECT p.id,m.name AS machinery,p.name,p.quantity,p.buy_price,p.stock_quantity,p.repair_expense,
      p.supplier,p.invoice_number,p.installation_date::text,p.notes FROM machinery_spare_parts p JOIN machinery m ON m.id=p.machinery_id`,
    columns: [id,col("machinery","الآلة"),col("name","القطعة"),col("quantity","الكمية",true,true),money("buy_price","سعر الشراء (دج)",false),
      col("stock_quantity","المخزون",true,true),money("repair_expense","تكلفة الإصلاح (دج)"),col("supplier","المورد"),col("invoice_number","الفاتورة"),col("installation_date","تاريخ التركيب"),col("notes","ملاحظات")],
  },
  field: {
    section: "field",
    sql: `SELECT f.id,COALESCE(m.name,'') AS machinery,f.category,f.amount,f.site_name,f.details,f.fuel_liters,
      f.created_by_id,f.created_by_name,f.created_at::text,f.review_status,f.reviewed_by_name,f.review_notes,f.notes
      FROM field_expenses f LEFT JOIN machinery m ON m.id=f.machinery_id`,
    columns: [id,col("machinery","الآلة"),col("category","النوع"),money("amount","المبلغ (دج)"),col("site_name","الموقع"),
      col("details","التفاصيل"),col("fuel_liters","الوقود (لتر)",true,true),col("created_by_name","سجله"),col("created_at","التاريخ"),
      col("review_status","المراجعة"),col("reviewed_by_name","راجعه"),col("review_notes","ملاحظات المراجعة"),col("notes","ملاحظات")],
  },
  users: {
    section: "users",
    sql: `SELECT clerk_user_id AS id,name,role,role_name,active,allowed_sections,permissions,capabilities,notes,created_at::text
      FROM members WHERE deleted_at IS NULL`,
    columns: [id,col("name","الاسم"),col("role","الدور"),col("role_name","المسمى"),col("active","التفعيل"),
      col("allowed_sections","الأقسام"),col("permissions","الصلاحيات"),col("capabilities","الإمكانات"),col("notes","ملاحظات"),col("created_at","تاريخ الإنشاء")],
  },
  audit: {
    section: "audit",
    sql: `SELECT a.id,a.action,a.details,a.performed_by_name,a.created_at::text,COALESCE(n.notes,'') AS notes
      FROM audit_logs a LEFT JOIN audit_log_notes n ON n.audit_log_id=a.id`,
    columns: [id,col("action","العملية"),col("details","التفاصيل"),col("performed_by_name","المنفذ"),col("created_at","التاريخ"),col("notes","ملاحظات")],
  },
  customerInvoices: {
    section: "finance",
    sql: `SELECT ci.id,ci.customer_id,a.name AS customer,a.phone,a.address,ci.invoice_number,ci.invoice_date::text,
      COALESCE((SELECT SUM(i.total_cost) FROM inventory_items i WHERE i.customer_invoice_id=ci.id),0) AS amount,
      CASE WHEN EXISTS(SELECT 1 FROM cheque_customer_invoices l JOIN cheques c ON c.id=l.cheque_id
        WHERE l.invoice_id=ci.id AND l.active AND c.status<>'cancelled') THEN 'paid' ELSE 'unpaid' END AS status
      FROM customer_invoices ci JOIN finance_accounts a ON a.id=ci.customer_id`,
    columns: [id,col("invoice_number","رقم الفاتورة"),col("invoice_date","تاريخ الفاتورة"),col("customer","الزبون"),col("phone","الهاتف"),col("address","العنوان"),money("amount","الإجمالي (دج)"),col("status","حالة التسديد")],
  },
  supplierInvoices: {
    section: "inventory",
    sql: `SELECT p.id,p.invoice_number,p.invoice_date::text,s.name AS supplier,
      COALESCE((SELECT SUM(i.total_cost) FROM inventory_items i WHERE i.invoice_id=p.id),0) +
      COALESCE((SELECT SUM(x.quantity*x.buy_price+x.repair_expense) FROM machinery_spare_parts x WHERE x.invoice_id=p.id),0) AS amount,
      p.recorded_by_name FROM purchase_invoices p JOIN suppliers s ON s.id=p.supplier_id`,
    columns: [id,col("invoice_number","رقم الفاتورة"),col("invoice_date","التاريخ"),col("supplier","المورد"),money("amount","الإجمالي (دج)"),col("recorded_by_name","سجله")],
  },
};
