export const sections = [
  { id: "dashboard", label: "الرئيسية", shortLabel: "الرئيسية" },
  { id: "finance", label: "التسيير المالي", shortLabel: "المالية" },
  { id: "inventory", label: "المشتريات والمخزون", shortLabel: "المخزون" },
  { id: "cheques", label: "إدارة الشيكات", shortLabel: "الشيكات" },
  { id: "rentals", label: "الكراء", shortLabel: "الكراء" },
  { id: "machinery", label: "العتاد والآليات", shortLabel: "الآليات" },
  { id: "field", label: "مصاريف الميدان", shortLabel: "الميدان" },
  { id: "users", label: "المستخدمون والصلاحيات", shortLabel: "الأعضاء" },
  { id: "audit", label: "سجل التدقيق", shortLabel: "السجل" },
] as const;

export type SectionId = (typeof sections)[number]["id"];

export const allSectionIds = sections.map((section) => section.id) as SectionId[];

export const sectionIcons: Record<SectionId, string> = {
  dashboard: "layout-dashboard",
  finance: "wallet",
  inventory: "boxes",
  cheques: "receipt",
  rentals: "building-2",
  machinery: "truck",
  field: "hard-hat",
  users: "users",
  audit: "history",
};
