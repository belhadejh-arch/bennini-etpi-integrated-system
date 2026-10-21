export type PrintColumn = { key: string; label: string; numeric?: boolean; sum?: boolean };
export type PrintTable = { title: string; columns: PrintColumn[]; rows: Record<string, unknown>[] };
export type PrintRow = Record<string, unknown> & { id: string | number; _details?: PrintTable[] };
export type PrintReport = {
  key: string; title: string; columns: PrintColumn[]; rows: PrintRow[];
  generatedAt: string; generatedBy: string;
};
export type PrintOptions = { paper: "A4" | "A3" | "Letter"; landscape: boolean; ids?: string[] };
export const printLabels: Record<string, string> = {
  dashboard: "الملخص المالي والإحصائي", finance: "العمليات المالية ووصولات الدفع",
  customers: "حسابات الزبائن", partners: "حسابات الشركاء",
  customerInvoices: "فواتير الزبائن", supplierInvoices: "فواتير المشتريات",
  inventory: "المشتريات والمخزون", movements: "حركة المخزون",
  cheques: "سجل الشيكات", rentals: "عقود الكراء والورديات",
  machinery: "سجل المركبات والآليات", drivers: "تاريخ السائقين",
  parts: "قطع الغيار والإصلاحات", field: "مصاريف الميدان",
  users: "المستخدمون والصلاحيات", audit: "سجل التدقيق",
  notifications: "الإشعارات", profile: "بيانات حسابي",
};
