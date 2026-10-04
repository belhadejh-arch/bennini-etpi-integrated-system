import { useState, useEffect } from "react";
import {
  HardHat,
  Camera,
  Send,
  Fuel,
  Wrench,
  ShoppingBag,
  FileCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Sun,
  User,
  History,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot, addDoc, query, orderBy, limit } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export type ExpenseCategory =
  "مازوت وقود" | "قطع غيار" | "مشتريات ميدانية" | "إصلاح آلية" | "أجور سريعة" | "أخرى";

export interface FieldExpenseRecord {
  id: string;
  category: ExpenseCategory;
  amount: number;
  fuelLiters?: number;
  siteName: string;
  details?: string;
  notes?: string;
  receiptPhotoUrl?: string;
  status?: string;
  createdByName?: string;
  createdAt: string;
}

export function FieldMobilePortal() {
  const { profile, recordAuditLog } = useAuth();
  const [activeTab, setActiveTab] = useState<"expense" | "history" | "tasks">("expense");
  const [recentExpenses, setRecentExpenses] = useState<FieldExpenseRecord[]>([]);

  // Form states
  const [category, setCategory] = useState<ExpenseCategory>("مازوت وقود");
  const [amount, setAmount] = useState<number>(50000);
  const [fuelLiters, setFuelLiters] = useState<number>(200);
  const [siteName, setSiteName] = useState("ورشة الطريق الولائي رقم 14 - البليدة");
  const [details, setDetails] = useState("تزويد الحفارة والشاحنات بالمازوت للعمل المسائي");
  const [notes, setNotes] = useState("");
  const [photoAttached, setPhotoAttached] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Sync real-time field expenses
  useEffect(() => {
    const q = query(collection(db, "fieldExpenses"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecentExpenses(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "fieldExpenses");
      },
    );

    return () => unsub();
  }, []);

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !siteName) return;

    setSubmitting(true);
    try {
      const newExpense = {
        category,
        amount: Number(amount),
        fuelLiters: category === "مازوت وقود" ? Number(fuelLiters) : 0,
        siteName,
        details: details || "مصروف ميداني",
        notes: notes || "تم التسجيل من تطبيق الهاتف لرئيس الأشغال",
        receiptPhotoUrl: photoAttached ? "وصل_ميداني_مرفق.jpg" : "",
        status: "معتمد", // Directly synced and approved into central system
        createdBy: profile?.uid || "site_foreman",
        createdByName: profile?.name || "رئيس الأشغال",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "fieldExpenses"), newExpense);

      // Also automatically record in central financial transactions so administration never needs manual re-entry!
      await addDoc(collection(db, "transactions"), {
        type: "مصروف",
        amount: Number(amount),
        party: siteName,
        reason: `${category}: ${details}${category === "مازوت وقود" ? ` (${fuelLiters} لتر)` : ""}`,
        date: new Date().toISOString().split("T")[0] ?? "2026-10-04",
        paymentMethod: "نقداً",
        balanceAfter: 12840000 - Number(amount),
        notes: `مزامنة آلية فورية من تطبيق رئيس الأشغال (${profile?.name || "رئيس الورشة"})`,
        receiptName: photoAttached ? "وصل_ميداني_مرفق.jpg" : "وصل_سريع.pdf",
        createdBy: profile?.uid || "site_foreman",
        createdByName: profile?.name || "رئيس الأشغال",
        createdAt: new Date().toISOString(),
      });

      // Audit Log
      await recordAuditLog(
        "تسجيل مصروف ميداني",
        "تطبيق رئيس الأشغال",
        `قام ${profile?.name || "رئيس الأشغال"} بتسجيل ${category} بقيمة ${amount.toLocaleString()} دج في ${siteName}`,
      );

      setSubmitting(false);
      setSuccessToast(true);
      setNotes("");
      setPhotoAttached(false);
      setTimeout(() => setSuccessToast(false), 4000);
    } catch (err) {
      setSubmitting(false);
      handleFirestoreError(err, OperationType.CREATE, "fieldExpenses");
    }
  };

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-[32px] border-4 border-slate-800 bg-[#f8fafc] shadow-2xl">
      {/* Mobile Curved Gradient Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#07152f] via-[#083c7a] to-[#0555a8] px-6 pt-7 pb-8 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#f5b41e] bg-slate-900 font-bold text-base text-white">
              {profile?.name ? profile.name.slice(0, 2) : "ر أ"}
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                {profile?.name || "رئيس الأشغال الميداني"}
              </h3>
              <p className="text-[11px] text-blue-200">
                {profile?.role || "رئيس ورشة"} • متصل بالنظام المركزي
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> مزامنة حية
          </span>
        </div>

        {/* Current Site Card */}
        <div className="mt-4 rounded-xl bg-white/10 p-3 backdrop-blur border border-white/15">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-bold text-[#f5b41e]">
              <HardHat className="h-3.5 w-3.5" /> ورشة الطريق الولائي رقم 14
            </span>
            <span className="text-blue-100 flex items-center gap-1 text-[11px]">
              <Sun className="h-3 w-3 text-[#f5b41e]" /> 24°C البليدة
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-white px-2 py-1 text-xs font-bold shadow-xs">
        <button
          onClick={() => setActiveTab("expense")}
          className={`flex-1 py-2 text-center rounded-lg transition-colors ${
            activeTab === "expense"
              ? "bg-[#083c7a] text-white"
              : "text-muted-foreground hover:bg-slate-50"
          }`}
        >
          تسجيل مصروف جديد ⚡
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-center rounded-lg transition-colors ${
            activeTab === "history"
              ? "bg-[#083c7a] text-white"
              : "text-muted-foreground hover:bg-slate-50"
          }`}
        >
          العمليات المتزامنة ({recentExpenses.length})
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 min-h-[480px]">
        {successToast && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            تم تسجيل المصروف ومزامنته فورياً مع الإدارة المركزية والمالية!
          </div>
        )}

        {/* Form Tab */}
        {activeTab === "expense" && (
          <form onSubmit={handleSubmitExpense} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                نوع المصروف الميداني
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "مازوت وقود", label: "مازوت / وقود", icon: Fuel },
                  { id: "قطع غيار", label: "قطع غيار", icon: Wrench },
                  { id: "إصلاح آلية", label: "إصلاح آلية", icon: Wrench },
                  { id: "مشتريات ميدانية", label: "مشتريات ورشة", icon: ShoppingBag },
                  { id: "أجور سريعة", label: "أجور يومية", icon: User },
                  { id: "أخرى", label: "مصاريف أخرى", icon: HardHat },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = category === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategory(item.id as ExpenseCategory)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                        active
                          ? "border-[#083c7a] bg-[#083c7a] text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 mb-1 ${active ? "text-[#f5b41e]" : "text-[#083c7a]"}`}
                      />
                      <span className="text-[10px] font-bold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fuel liters if fuel category is selected */}
            {category === "مازوت وقود" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  كمية المازوت المعبأة (باللتر)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={fuelLiters || ""}
                    onChange={(e) => setFuelLiters(Number(e.target.value))}
                    className="bg-white font-black text-amber-900"
                    placeholder="200"
                  />
                  <span className="text-xs font-bold text-amber-900">لتر</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                المبلغ الإجمالي (دج)
              </label>
              <Input
                type="number"
                required
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="bg-white h-11 text-base font-black text-[#083c7a]"
                placeholder="مثال: 50000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">الورشة / الموقع</label>
              <Input
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="bg-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">تفاصيل المصروف</label>
              <Input
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="مثال: تزويد الحفارة والشاحنات..."
                className="bg-white text-xs"
              />
            </div>

            {/* Camera / Receipt button */}
            <button
              type="button"
              onClick={() => setPhotoAttached(!photoAttached)}
              className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
                photoAttached
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-slate-300 bg-white text-slate-600 hover:border-[#083c7a]"
              }`}
            >
              <Camera className="h-5 w-5 text-[#083c7a]" />
              <span className="text-xs font-bold">
                {photoAttached
                  ? "✓ تم إرفاق صورة الوصل / الفاتورة"
                  : "تصوير أو إرفاق وصل المحطة / الفاتورة"}
              </span>
            </button>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-[#f5b41e] hover:bg-[#e4a515] text-[#07152f] font-black text-sm shadow-md gap-2"
            >
              <Send className="h-4 w-4" />{" "}
              {submitting ? "جاري الإرسال والمزامنة..." : "إرسال ومزامنة فورية"}
            </Button>
          </form>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">
              جميع المصاريف التي قمت بتسجيلها والتي ظهرت فوراً في لوحة الإدارة المالية:
            </p>
            {recentExpenses.map((exp) => (
              <div key={exp.id} className="rounded-xl border border-border bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#083c7a] flex items-center gap-1">
                    {exp.category === "مازوت وقود" ? (
                      <Fuel className="h-3.5 w-3.5" />
                    ) : (
                      <Wrench className="h-3.5 w-3.5" />
                    )}
                    {exp.category} {exp.fuelLiters ? `(${exp.fuelLiters} لتر)` : ""}
                  </span>
                  <span className="font-black text-slate-900">
                    {exp.amount.toLocaleString()} دج
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{exp.details}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-slate-100">
                  <span>{new Date(exp.createdAt).toLocaleTimeString("ar-DZ")}</span>
                  <span className="text-emerald-700 font-bold">✓ تمت المزامنة</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
