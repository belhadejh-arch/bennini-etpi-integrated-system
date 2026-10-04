import { useState, useMemo, useEffect } from "react";
import { Truck, Plus, Search, Eye, FileText, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface RentalItem {
  id?: string;
  equipment: string; // الشيء المؤجر
  clientOrOwner: string; // اسم المستأجر / المؤجر
  startDate: string; // تاريخ البداية
  endDate: string; // تاريخ النهاية
  duration: string; // المدة
  rate: string; // السعر اليومي / الشهري
  totalAmount: number; // المبلغ الإجمالي
  paidAmount: number; // المدفوع
  remainingAmount: number; // المتبقي (الإجمالي - المدفوع)
  status: "نشط" | "ينتهي قريباً" | "مكتمل"; // حالة الكراء
  contractFile: string; // العقد المرفق
}

export function RentalModule() {
  const { profile, recordAuditLog, hasPermission } = useAuth();
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewContract, setPreviewContract] = useState<string | null>(null);

  // New rental state
  const [newEquipment, setNewEquipment] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newTotal, setNewTotal] = useState<number>(0);
  const [newPaid, setNewPaid] = useState<number>(0);

  useEffect(() => {
    const q = query(collection(db, "rentals"), orderBy("startDate", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as RentalItem[];
        setRentals(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "rentals");
      },
    );

    return () => unsub();
  }, []);

  const activeRentalsCount = useMemo(() => {
    return rentals.filter((r) => r.status === "نشط" || r.status === "ينتهي قريباً").length;
  }, [rentals]);

  const totalRemainingToCollect = useMemo(() => {
    return rentals.reduce((sum, r) => sum + r.remainingAmount, 0);
  }, [rentals]);

  const totalRevenue = useMemo(() => {
    return rentals.reduce((sum, r) => sum + r.paidAmount, 0);
  }, [rentals]);

  const filteredRentals = useMemo(() => {
    return rentals.filter((item) => {
      const matchSearch =
        item.equipment.toLowerCase().includes(search.toLowerCase()) ||
        item.clientOrOwner.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "الكل" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rentals, search, statusFilter]);

  const handleAddRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipment || !newClient || !newTotal) return;

    const remaining = Number(newTotal) - Number(newPaid);
    const newRentalData = {
      equipment: newEquipment,
      clientOrOwner: newClient,
      startDate: newStartDate || "2026-10-05",
      endDate: newEndDate || "2026-11-05",
      duration: newDuration || "شهر",
      rate: newRate || "سعر تفاوضي",
      totalAmount: Number(newTotal),
      paidAmount: Number(newPaid),
      remainingAmount: remaining,
      status: "نشط",
      contractFile: `عقد_${newEquipment.replace(/\s+/g, "_")}.pdf`,
      createdBy: profile?.uid || "user",
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "rentals"), newRentalData);
      await recordAuditLog(
        "إبرام عقد كراء",
        "الكراء والآليات",
        `إبرام عقد كراء ${newEquipment} مع ${newClient} بقيمة ${Number(newTotal).toLocaleString()} دج`,
      );
      setIsModalOpen(false);
      setNewEquipment("");
      setNewClient("");
      setNewTotal(0);
      setNewPaid(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "rentals");
    }
  };

  const handleDeleteRental = async (id: string, equip: string) => {
    if (!hasPermission("canDeleteRecords")) {
      alert("عذراً، ليس لديك صلاحية حذف عقود الكراء.");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف عقد كراء: ${equip}؟`)) return;

    try {
      await deleteDoc(doc(db, "rentals", id));
      await recordAuditLog("حذف عقد كراء", "الكراء والآليات", `حذف عقد كراء ${equip}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rentals/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#07152f]">قسم الكراء وتسيير الآليات 🏗️</h2>
          <p className="text-xs text-muted-foreground mt-1">
            متابعة الآليات والعتاد الثقيل المؤجر، تتبع المدفوعات والمتبقي، وتواريخ انتهاء العقود.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#083c7a] hover:bg-[#05326f] text-white font-bold gap-2"
        >
          <Plus className="h-4 w-4" /> إبرام عقد كراء جديد
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">عقود الكراء النشطة حالياً</span>
          <div className="mt-2 text-2xl font-black text-[#083c7a]">
            {activeRentalsCount} آليات مؤجرة
          </div>
          <p className="mt-1 text-xs text-emerald-600 font-semibold">
            تعمل في مختلف ورشات المشاريع
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">المبالغ المحصلة فعلياً</span>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            {totalRevenue.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-muted-foreground">مداخيل إيجار العتاد الثقيل</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">المتبقي قيد التحصيل</span>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {totalRemainingToCollect.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-amber-700">مستحقات واجبة السداد عند انتهاء المدة</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الآلية، المستأجر أو رقم العقد..."
            className="pr-9"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border bg-slate-100 p-0.5 text-xs font-bold">
          {(["الكل", "نشط", "ينتهي قريباً", "مكتمل"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                statusFilter === st
                  ? "bg-[#083c7a] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Rental Table with all exact prompt fields */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-right text-sm">
            <thead className="bg-[#05326f] text-white">
              <tr>
                <th className="px-3.5 py-3 font-bold">الشيء المؤجر</th>
                <th className="px-3.5 py-3 font-bold">اسم المستأجر / المؤجر</th>
                <th className="px-3.5 py-3 font-bold">تاريخ البداية</th>
                <th className="px-3.5 py-3 font-bold">تاريخ النهاية</th>
                <th className="px-3.5 py-3 font-bold">المدة</th>
                <th className="px-3.5 py-3 font-bold">السعر</th>
                <th className="px-3.5 py-3 font-bold">المبلغ الإجمالي</th>
                <th className="px-3.5 py-3 font-bold">المدفوع</th>
                <th className="px-3.5 py-3 font-bold">المتبقي</th>
                <th className="px-3.5 py-3 font-bold">حالة الكراء</th>
                <th className="px-3.5 py-3 font-bold text-center">العقد المرفق</th>
                <th className="px-3.5 py-3 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRentals.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-3.5 font-bold text-[#07152f] flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#083c7a]" />
                    {r.equipment}
                  </td>
                  <td className="px-3.5 py-3.5 font-medium">{r.clientOrOwner}</td>
                  <td className="px-3.5 py-3.5 text-xs text-muted-foreground">{r.startDate}</td>
                  <td className="px-3.5 py-3.5 text-xs text-muted-foreground">{r.endDate}</td>
                  <td className="px-3.5 py-3.5 font-medium text-xs">{r.duration}</td>
                  <td className="px-3.5 py-3.5 text-xs text-muted-foreground">{r.rate}</td>
                  <td className="px-3.5 py-3.5 font-bold text-[#083c7a]">
                    {r.totalAmount.toLocaleString()} دج
                  </td>
                  <td className="px-3.5 py-3.5 font-semibold text-emerald-700">
                    {r.paidAmount.toLocaleString()} دج
                  </td>
                  <td className="px-3.5 py-3.5 font-bold text-amber-700">
                    {r.remainingAmount.toLocaleString()} دج
                  </td>
                  <td className="px-3.5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        r.status === "نشط"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "ينتهي قريباً"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.status === "نشط" && <CheckCircle2 className="h-3 w-3" />}
                      {r.status === "ينتهي قريباً" && <Clock className="h-3 w-3" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3.5 text-center">
                    <button
                      onClick={() => setPreviewContract(r.contractFile)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0555a8] hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      معاينة العقد
                    </button>
                  </td>
                  <td className="px-3.5 py-3.5 text-center">
                    {hasPermission("canDeleteRecords") && r.id && (
                      <button
                        onClick={() => handleDeleteRental(r.id!, r.equipment)}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                        title="حذف العقد"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Rental Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">إبرام عقد كراء آلية جديد 🏗️</h3>
            <p className="text-xs text-muted-foreground mt-1">
              يتم حساب المبلغ المتبقي آلياً بناءً على الإجمالي والمدفوع.
            </p>

            <form onSubmit={handleAddRental} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">الشيء المؤجر</label>
                <Input
                  required
                  placeholder="مثال: حفارة CAT 320، رافعة 25 طن، شاحنة..."
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  اسم المستأجر أو المؤجر
                </label>
                <Input
                  required
                  placeholder="اسم المؤسسة أو المقاول"
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">تاريخ البداية</label>
                  <Input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">تاريخ النهاية</label>
                  <Input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">المدة</label>
                  <Input
                    placeholder="مثال: 30 يوماً / شهران"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    السعر المتفق عليه
                  </label>
                  <Input
                    placeholder="مثال: 45,000 دج / يوم"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    المبلغ الإجمالي (دج)
                  </label>
                  <Input
                    type="number"
                    required
                    value={newTotal || ""}
                    onChange={(e) => setNewTotal(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    المبلغ المدفوع (دج)
                  </label>
                  <Input
                    type="number"
                    value={newPaid || ""}
                    onChange={(e) => setNewPaid(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-[#083c7a]">
                <strong>المبلغ المتبقي المحسوب آلياً: </strong>
                {(Number(newTotal) - Number(newPaid)).toLocaleString()} دج
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-[#083c7a] text-white font-bold">
                  حفظ العقد وتسجيل الكراء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract Preview Modal */}
      {previewContract && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <FileText className="h-16 w-16 mx-auto text-[#083c7a]" />
            <h4 className="mt-3 text-lg font-bold text-[#07152f]">معاينة عقد الكراء القانوني</h4>
            <p className="mt-1 text-sm text-muted-foreground font-mono">{previewContract}</p>
            <div className="mt-4 rounded-xl border border-dashed border-border p-4 bg-slate-50 text-xs text-right space-y-1">
              <p>• عقد كراء آليات معتمد بين شركة BENNINI ETPI والطرف المستأجر.</p>
              <p>• يتضمن شروط الصيانة، الوقود، التأمين على العتاد، وجدول الدفعات.</p>
            </div>
            <Button
              onClick={() => setPreviewContract(null)}
              className="mt-6 w-full bg-[#083c7a] text-white"
            >
              إغلاق المعاينة
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
