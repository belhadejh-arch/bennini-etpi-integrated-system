import type pg from "pg";
import type { Member } from "./index";
import { hasPermission } from "../shared/access";
import { printLabels, type PrintReport, type PrintRow, type PrintTable } from "../shared/printing";
import { rentalCalculation } from "../shared/rental-calculation";
import { FinanceError } from "./finance-data";
import { printDefinitions } from "./print-definitions";
import { driverCostsByMachinery } from "./machinery-costs";

const financialKeys = new Set(["amount","buy_price","sale_price","total_cost","total","monthly_salary","repair_expense",
  "rental_rate","total_amount","paid_amount","remaining","interest_rate","interest_amount","incoming","outgoing","balance",
  "driver_total_cost","total_expenses","invoice_total","invoice_paid","invoice_unpaid"]);
export function availablePrintReports(member: Member) {
  return Object.entries(printLabels).filter(([key]) => {
    if (member.role === "partner") return ["dashboard","finance","partners","notifications","profile"].includes(key);
    const section = printDefinitions[key]?.section ?? (["customers","partners"].includes(key) ? "finance" : "dashboard");
    return hasPermission(member, section, "view");
  }).map(([key,title]) => ({ key,title }));
}

export type NotificationPrintLoader = (member:Member)=>Promise<Record<string,unknown>[]>;
export async function loadPrintReport(pool: pg.Pool, member: Member, key: string, accountId?: number, notifications?:NotificationPrintLoader): Promise<PrintReport> {
  if (!availablePrintReports(member).some((report) => report.key === key)) throw new FinanceError(403, "لا تملك صلاحية طباعة هذا التقرير.");
  let rows: PrintRow[] = [];
  let columns = printDefinitions[key]?.columns ?? [];
  if(key==="notifications"){
    rows=(await notifications?.(member)??[]) as PrintRow[];
    columns=[{key:"id",label:"الرقم"},{key:"title",label:"العنوان"},{key:"message",label:"التفاصيل"},{key:"createdAt",label:"التاريخ"},{key:"read",label:"مقروء"}];
  }else if(key==="profile"){
    rows=[{id:member.clerk_user_id,name:member.name,role:member.role,active:member.active,language:member.language??"ar",appearance:member.appearance??"light"}];
    columns=[{key:"name",label:"الاسم"},{key:"role",label:"الدور"},{key:"active",label:"التفعيل"},{key:"language",label:"اللغة"},{key:"appearance",label:"المظهر"}];
  }else if (key === "customers" || key === "partners") {
    rows = (await pool.query(`
      SELECT a.id,a.name,a.phone,a.address,a.notes,
        COALESCE(SUM(t.amount) FILTER(WHERE t.type='income'),0) AS incoming,
        COALESCE(SUM(t.amount) FILTER(WHERE t.type='expense'),0) AS outgoing,
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END),0) AS balance,
        COALESCE(SUM(ROUND(t.amount*t.interest_rate/100,2)),0) AS interest_amount
      FROM finance_accounts a LEFT JOIN transactions t ON t.account_id=a.id
      WHERE a.kind=$1 ${member.role === "partner" ? "AND a.member_id=$2" : ""}
      GROUP BY a.id ORDER BY a.name,a.id
    `, member.role === "partner" ? ["partner",member.clerk_user_id] : [key === "customers" ? "customer" : "partner"])).rows;
    columns = [{key:"id",label:"الرقم"},{key:"name",label:"الحساب"},{key:"phone",label:"الهاتف"},{key:"address",label:"العنوان"},
      ...[["incoming","إجمالي الدخل (دج)"],["outgoing","إجمالي الخرج (دج)"],["balance","الرصيد (دج)"],["interest_amount","الفائدة (دج)"]]
        .map(([key,label]) => ({key,label,numeric:true,sum:true})),{key:"notes",label:"ملاحظات"}];
  } else if (key === "dashboard") {
    columns = [{key:"metric",label:"المؤشر"},{key:"value",label:"القيمة",numeric:true}];
    const add = (id: string, metric: string, value: unknown) => rows.push({id,metric,value});
    if (hasPermission(member,"finance","view")) {
      const partner = member.role === "partner";
      const result = await pool.query(`SELECT COALESCE(SUM(t.amount) FILTER(WHERE t.type='income'),0) AS incoming,
        COALESCE(SUM(t.amount) FILTER(WHERE t.type='expense'),0) AS outgoing
        FROM transactions t ${partner ? "JOIN finance_accounts a ON a.id=t.account_id WHERE a.member_id=$1 AND a.kind='partner'" : ""}`,
      partner ? [member.clerk_user_id] : []);
      const income = Number(result.rows[0].incoming);
      let outgoing = Number(result.rows[0].outgoing);
      if (!partner) outgoing += Number((await pool.query("SELECT COALESCE(SUM(amount),0) AS amount FROM field_expenses")).rows[0].amount);
      add("income","إجمالي الدخل (دج)",income); add("outgoing","إجمالي الخرج (دج)",outgoing); add("balance","الرصيد (دج)",income-outgoing);
      if (!partner && hasPermission(member,"inventory","view")) {
        const data = (await pool.query("SELECT COALESCE(SUM(total_cost),0) AS purchases,COALESCE(SUM(remaining_quantity*buy_price),0) AS stock FROM inventory_items")).rows[0];
        add("purchases","إجمالي المشتريات (دج)",data.purchases); add("stock","قيمة المخزون (دج)",data.stock);
      }
      if (!partner && hasPermission(member,"rentals","view")) {
        add("rentals","متبقي الكراء (دج)",(await pool.query("SELECT COALESCE(SUM(GREATEST(total_amount-paid_amount,0)),0) AS amount FROM rentals")).rows[0].amount);
      }
    }
    if (member.role !== "partner" && hasPermission(member,"cheques","view")) {
      const data = (await pool.query("SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount FROM cheques WHERE status='pending'")).rows[0];
      add("cheques","عدد الشيكات المعلقة",data.count);
      if (hasPermission(member,"finance","view")) add("chequeAmount","قيمة الشيكات المعلقة (دج)",data.amount);
    }
    if (!rows.length) {
      add("access","عدد الأقسام المتاحة",availablePrintReports(member).length);
    }
  } else {
    const definition = printDefinitions[key];
    if (!definition) throw new FinanceError(404, "التقرير غير موجود.");
    let sql = definition.sql;
    const clauses: string[] = [];
    const params: unknown[] = [];
    const where = (expression: string, value: unknown) => { params.push(value); clauses.push(`${expression}=$${params.length}`); };
    if (key === "finance" && member.role === "partner") where("a.member_id",member.clerk_user_id);
    if (key === "field" && !["admin","finance"].includes(member.role)) where("f.created_by_id",member.clerk_user_id);
    if (accountId) {
      if (key === "finance") where("t.account_id",accountId);
      else if (key === "customerInvoices") where("ci.customer_id",accountId);
    }
    if (clauses.length) sql += ` ${sql.includes(" WHERE ") ? "AND" : "WHERE"} ${clauses.join(" AND ")}`;
    rows = (await pool.query(sql,params)).rows;
  }
  if (accountId && (key === "partners" || key === "customers")) rows = rows.filter((row) => String(row.id) === String(accountId));
  if (key === "machinery") {
    const assignments=await pool.query("SELECT machinery_id,monthly_salary,start_date::text,end_date::text FROM machinery_driver_assignments");
    const costs=driverCostsByMachinery(assignments.rows);
    rows.forEach((row)=>{
      row.driver_total_cost=costs.get(Number(row.id))??0;
      row.total_expenses=Number(row.total_expenses)+Number(row.driver_total_cost);
    });
  }
  if(key==="customers") {
    const invoiceTotals=await pool.query(`SELECT i.customer_id,SUM(i.total_cost) AS invoice_total,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM cheque_customer_invoices l JOIN cheques c ON c.id=l.cheque_id
        WHERE l.invoice_id=i.customer_invoice_id AND l.active AND c.status<>'cancelled') THEN i.total_cost ELSE 0 END) AS invoice_paid
      FROM inventory_items i WHERE i.customer_id IS NOT NULL GROUP BY i.customer_id`);
    const totals=new Map(invoiceTotals.rows.map((row)=>[String(row.customer_id),row]));
    rows.forEach((row)=>{
      row.invoice_total=Number(totals.get(String(row.id))?.invoice_total??0);
      row.invoice_paid=Number(totals.get(String(row.id))?.invoice_paid??0);
      row.invoice_unpaid=Number(row.invoice_total)-Number(row.invoice_paid);
    });
    columns=[...columns,...[["invoice_total","إجمالي الفواتير (دج)"],["invoice_paid","الفواتير المسددة (دج)"],["invoice_unpaid","الفواتير غير المسددة (دج)"]]
      .map(([key,label])=>({key,label,numeric:true,sum:true}))];
  }
  // Numeric sorting remains stable for paginated sections without imposing any row limit.
  rows.sort((a,b) => String(a.id).localeCompare(String(b.id), "en", {numeric:true}));
  if (member.capabilities?.viewFinancialData === false && member.role !== "admin" && member.role !== "partner") {
    columns = columns.filter((column) => !financialKeys.has(column.key));
    rows = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !financialKeys.has(key))) as PrintRow);
  }
  return {key,title:printLabels[key],columns,rows,generatedAt:new Date().toISOString(),generatedBy:member.name};
}

export async function addPrintDetails(pool: pg.Pool, report: PrintReport, member: Member) {
  const canMoney = member.role === "admin" || member.capabilities?.viewFinancialData !== false;
  const queryRows = async (sql: string, id: string | number) => (await pool.query(sql,[id])).rows;
  for (const row of report.rows) {
    const details: PrintTable[] = [];
    if (report.key === "rentals") {
      const calculation = rentalCalculation(String(row.start_date), row.end_date ? String(row.end_date) : null,
        row.rate_period as "daily"|"monthly"|"shift",Number(row.rental_rate ?? 0),row.daily_shifts as []);
      row.duration_label = row.rate_period === "shift" ? `${calculation.days} يوم · ${calculation.totalShifts} وردية` :
        `${row.duration} ${row.rate_period === "monthly" ? "شهر" : "يوم"}`;
      if (row.rate_period === "shift") details.push({
        title:`الورديات اليومية — عقد ${row.id}`,
        columns:[{key:"date",label:"التاريخ"},{key:"shifts",label:"الورديات",numeric:true,sum:true},{key:"holiday",label:"عطلة"},
          ...(canMoney ? [{key:"amount",label:"المبلغ (دج)",numeric:true,sum:true}] : [])],
        rows:calculation.rows.map((day) => ({...day,amount:Math.round(day.shifts*Number(row.rental_rate)*100)/100})),
      });
    }
    if (["customerInvoices","supplierInvoices"].includes(report.key)) {
      const customer = report.key === "customerInvoices";
      const items = await queryRows(`SELECT name,quantity,buy_price,total_cost,sale_price,notes FROM inventory_items
        WHERE ${customer ? "customer_invoice_id" : "invoice_id"}=$1 ORDER BY id`,row.id);
      if (!customer) items.push(...await queryRows(`SELECT name,quantity,buy_price,quantity*buy_price+repair_expense AS total_cost,
        NULL AS sale_price,notes FROM machinery_spare_parts WHERE invoice_id=$1 ORDER BY id`,row.id));
      details.push({title:`بنود الفاتورة ${row.invoice_number}`,columns:[
        {key:"name",label:"السلعة"},{key:"quantity",label:"الكمية",numeric:true,sum:true},
        ...(canMoney ? [{key:"buy_price",label:"سعر الوحدة (دج)",numeric:true},{key:"total_cost",label:"الإجمالي (دج)",numeric:true,sum:true}] : []),
        {key:"notes",label:"ملاحظات"}],rows:items});
    }
    if (report.key === "customers" || report.key === "partners") {
      const transactions = await queryRows(`SELECT id,type,amount,reason,payment_method,transaction_date::text AS date,
        interest_rate,ROUND(amount*interest_rate/100,2) AS interest_amount,notes FROM transactions WHERE account_id=$1 ORDER BY transaction_date,id`,row.id);
      details.push({title:`كشف حساب ${row.name}`,columns:printDefinitions.finance.columns.filter((column) =>
        !["party","account","recorded_by_name"].includes(column.key)),rows:transactions});
      if (report.key === "customers") {
        const invoices = await queryRows(`SELECT ci.invoice_number,ci.invoice_date::text,
          COALESCE((SELECT SUM(total_cost) FROM inventory_items i WHERE i.customer_invoice_id=ci.id),0) AS amount
          FROM customer_invoices ci WHERE customer_id=$1 ORDER BY invoice_date,id`,row.id);
        details.push({title:"فواتير الحساب",columns:[{key:"invoice_number",label:"الفاتورة"},{key:"invoice_date",label:"التاريخ"},{key:"amount",label:"المبلغ (دج)",numeric:true,sum:true}],rows:invoices});
      }
    }
    row._details = details;
    // Private/raw storage fields are never part of printable JSON.
    delete row.daily_shifts;
  }
  return report;
}
