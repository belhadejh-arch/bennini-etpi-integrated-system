import { useState, useEffect, useMemo } from "react";
import { History, Search, Filter, ShieldCheck, Clock, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";

export interface AuditRecord {
  id?: string;
  userName: string;
  userId: string;
  action: string;
  section: string;
  details: string;
  timestamp: string;
}

export function AuditLogModule() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("الكل");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditRecord);
        setLogs(records);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "auditLogs");
      },
    );

    return () => unsub();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase());
      const matchSection = sectionFilter === "الكل" || log.section === sectionFilter;
      return matchSearch && matchSection;
    });
  }, [logs, search, sectionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#07152f]">
            سجل العمليات المركزي غير القابل للتعديل (Audit Log) 📜
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            توثيق شفاف ولحظي لكل عملية إضافة، تعديل، أو حذف تتم في النظام مع اسم المنفذ والتاريخ
            والوقت.
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المستخدم، الإجراء، أو التفاصيل..."
            className="pr-10"
          />
        </div>

        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-xs font-bold text-foreground outline-none"
        >
          <option value="الكل">كل الأقسام</option>
          <option value="التسيير المالي">التسيير المالي</option>
          <option value="المشتريات والمخزون">المشتريات والمخزون</option>
          <option value="إدارة الشيكات">إدارة الشيكات</option>
          <option value="الكراء والآليات">الكراء والآليات</option>
          <option value="المركبات والآليات">المركبات والآليات</option>
          <option value="قطع الغيار">قطع الغيار</option>
          <option value="تطبيق رئيس الأشغال">تطبيق رئيس الأشغال</option>
          <option value="المستخدمون والصلاحيات">المستخدمون والصلاحيات</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-[#05326f] text-white">
              <tr>
                <th className="px-4 py-3.5 font-bold">المستخدم المنفذ</th>
                <th className="px-4 py-3.5 font-bold">نوع العملية / الإجراء</th>
                <th className="px-4 py-3.5 font-bold">القسم المعني</th>
                <th className="px-4 py-3.5 font-bold">التفاصيل والبيانات المرتبطة</th>
                <th className="px-4 py-3.5 font-bold text-left">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {filteredLogs.map((log) => {
                const dateObj = new Date(log.timestamp);
                const formattedTime = dateObj.toLocaleTimeString("ar-DZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                const formattedDate = dateObj.toLocaleDateString("ar-DZ", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-[#07152f]">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-[#083c7a]" />
                        {log.userName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#083c7a]">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs">{log.action}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">
                      {log.section}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-800">{log.details}</td>
                    <td className="px-4 py-3.5 text-left text-xs font-mono text-muted-foreground">
                      <span className="block font-bold text-slate-700">{formattedTime}</span>
                      <span>{formattedDate}</span>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    لا توجد عمليات مسجلة مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
