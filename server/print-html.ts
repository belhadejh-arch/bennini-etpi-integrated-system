import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrintColumn, PrintOptions, PrintReport } from "../shared/printing";

export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g,(char) =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
const enums: Record<string,Record<string,string>> = {
  type:{income:"دخل / قبض",expense:"خرج / دفع"},
  status:{active:"جاري",completed:"منتهٍ",cancelled:"ملغى",pending:"قيد الانتظار",paid:"مدفوع",unpaid:"غير مدفوع",available:"متاح",maintenance:"صيانة",rented:"مؤجر"},
  rate_period:{daily:"يومي",monthly:"شهري",shift:"بالوردية"},
  movement_type:{sale:"بيع",use:"استخدام"},review_status:{pending:"قيد المراجعة",reviewed:"تمت المراجعة"},
  role:{admin:"مدير",finance:"إدارة مالية",field:"ميدان",supervisor:"مشرف",partner:"شريك",pending:"قيد التفعيل"},
  language:{ar:"العربية",fr:"الفرنسية"},appearance:{light:"فاتح",dark:"داكن",system:"حسب النظام"},
};
function cell(row: Record<string,unknown>, column: PrintColumn) {
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return column.key === "end_date" ? "غير محدد" : "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (column.numeric && Number.isFinite(Number(value))) return new Intl.NumberFormat("ar-DZ",{maximumFractionDigits:4}).format(Number(value));
  if (Array.isArray(value)) return escapeHtml(value.join("، "));
  if (typeof value === "object") return escapeHtml(JSON.stringify(value,null,2));
  return escapeHtml(enums[column.key]?.[String(value)] ?? value);
}
function totals(columns: PrintColumn[], rows: Record<string,unknown>[]) {
  const sums = columns.filter((column) => column.sum);
  return sums.length ? `<div class="totals">${sums.map((column) => {
    const total = rows.reduce((sum,row) => sum+Number(row[column.key] ?? 0),0);
    return `<div><span>${escapeHtml(column.label)}</span><strong>${cell({value:total},{key:"value",label:"",numeric:true})}</strong></div>`;
  }).join("")}</div>` : "";
}
function table(title: string, columns: PrintColumn[], rows: Record<string,unknown>[]) {
  // Column bands repeat the record number; wide schemas never crop or omit columns.
  const bands: PrintColumn[][] = [];
  const identity = columns.find((column) => column.key === "id");
  if (columns.length <= 8) bands.push(columns);
  else for (let offset=identity ? 1:0;offset<columns.length;offset+=6) {
    bands.push([...(identity ? [identity] : []),...columns.slice(offset,offset+6)]);
  }
  return `<section><h2>${escapeHtml(title)}</h2>${rows.length ? bands.map((band,index) =>
    `${bands.length>1 ? `<p class="muted">مجموعة الأعمدة ${index+1} / ${bands.length} — ${rows.length} سجل</p>` : ""}
    <table><thead><tr>${band.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${band.map((column) => `<td>${cell(row,column)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
  ).join("") : "<p>لا توجد سجلات ضمن النطاق المحدد.</p>"}${totals(columns,rows)}</section>`;
}

export function renderPrintHtml(report: PrintReport, options: PrintOptions, assets?: {logo:string;font:string}) {
  const logo = assets?.logo ?? readFileSync(path.resolve("app/assets/brand-mark-cropped.png")).toString("base64");
  const font = assets?.font ?? readFileSync(path.resolve("app/assets/fonts/Changa.ttf")).toString("base64");
  const single = report.rows.length === 1 && report.key !== "dashboard";
  const row = report.rows[0];
  const receipt = single && report.key === "finance";
  const title = receipt ? (row.type === "income" ? "وصل قبض" : "وصل دفع") : report.title;
  const main = single ? `<section class="record"><h2>${escapeHtml(title)} — ${escapeHtml(row.id)}</h2>
    <table><tbody>${report.columns.map((column) => `<tr><th>${escapeHtml(column.label)}</th><td>${cell(row,column)}</td></tr>`).join("")}</tbody></table></section>` :
    table(report.title,report.columns,report.rows);
  const details = report.rows.map((item) => (item._details ?? []).map((part) => table(part.title,part.columns,part.rows)).join("")).join("");
  let financialSummary = "";
  if (report.key === "finance") {
    const income=report.rows.filter((item) => item.type==="income").reduce((sum,item) => sum+Number(item.amount),0);
    const outgoing=report.rows.filter((item) => item.type==="expense").reduce((sum,item) => sum+Number(item.amount),0);
    financialSummary=totals([{key:"income",label:"الدخل (دج)",sum:true,numeric:true},
      {key:"outgoing",label:"الخرج (دج)",sum:true,numeric:true},{key:"balance",label:"الصافي (دج)",sum:true,numeric:true}],
    [{income,outgoing,balance:income-outgoing}]);
  }
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — BENNINI ETPI</title>
  <style>@font-face{font-family:Changa;src:url(data:font/ttf;base64,${font}) format('truetype');font-weight:100 900;font-display:block}
  @page{size:${options.paper} ${options.landscape ? "landscape":"portrait"};margin:12mm}
  *{box-sizing:border-box}body{font-family:Changa,sans-serif;color:#132c48;background:white;margin:0;direction:rtl;font-size:11px;line-height:1.65}
  .toolbar{position:sticky;top:0;display:flex;flex-wrap:wrap;gap:12px;padding:12px;background:#eaf0f8;border-bottom:1px solid #bacbde;z-index:3}
  button{font:inherit;padding:9px 20px;background:#103b83;color:white;border:0;border-radius:7px;cursor:pointer}
  .paper{max-width:${options.landscape ? "1180":"840"}px;margin:20px auto;padding:18px}
  header{display:flex;align-items:center;gap:18px;background:#0b3380;color:#fff;padding:18px;border-bottom:4px solid #ffd000;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  header img{width:78px;height:68px;object-fit:contain}header h1{font-size:21px;margin:0}header p{margin:0;color:#fff}
  h2{font-size:14px;margin:16px 0 8px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:12px}
  th,td{padding:7px;border:1px solid #b6c7db;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
  th{background:#e7eef9;font-weight:700}thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid;page-break-inside:avoid}
  .record th{width:30%;text-align:right}.totals{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;break-inside:avoid}
  .totals>div{border:1px solid #bccce0;border-top:3px solid #e1b000;padding:9px;min-width:130px;flex:1}.totals span,.totals strong{display:block}
  .muted,footer{color:#425775;font-size:10px}footer{margin-top:20px;border-top:1px solid #bbb;padding-top:10px}
  @media print{.toolbar{display:none!important}.paper{max-width:none;margin:0;padding:0}body{font-size:9pt}h2{break-after:avoid}header{break-inside:avoid}}
  @media(max-width:600px){.paper{padding:8px}th,td{padding:4px;font-size:10px}header h1{font-size:17px}}
  </style></head><body><div class="toolbar">
  <button onclick="document.fonts.ready.then(()=>window.print())">طباعة / حفظ PDF</button>
  <span>يمكن اختيار الطابعة والنسخ والورق والاتجاه من نافذة الطباعة. لحفظ PDF اختر «حفظ بتنسيق PDF».</span></div>
  <main class="paper"><header><img alt="BENNINI ETPI" src="data:image/png;base64,${logo}"><div><h1>BENNINI ETPI</h1>
  <p>${escapeHtml(title)}</p></div></header><p class="muted">إعداد: ${escapeHtml(report.generatedBy)} · ${escapeHtml(report.generatedAt)} · السجلات: ${report.rows.length}</p>
  ${main}${financialSummary}${details}${receipt ? "<p>توقيع المستلم: ____________________ &nbsp; توقيع المسؤول: ____________________</p>":""}
  <footer>BENNINI ETPI · البيانات حسب النطاق المحدد وقت إعداد المستند. المبالغ بالدينار الجزائري ما لم يُذكر غير ذلك.</footer>
  </main></body></html>`;
}
