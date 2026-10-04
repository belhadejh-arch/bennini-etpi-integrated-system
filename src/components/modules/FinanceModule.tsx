import { useState, useMemo, useEffect } from "react";
import {
  WalletCards,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  FileCheck,
  Download,
  Eye,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface Transaction {
  id: string;
  type: "دخل" | "خرج";
  amount: number;
  party: string; // المصدر / الجهة المستفيدة
  reason: string; // سبب العملية
  date: string;
  paymentMethod: "نقداً" | "شيك" | "تحويل";
  balanceAfter: number; // المبلغ المتبقي في الصندوق
  receiptName: string; // المرفقات: وصل / فاتورة
  createdBy?: string;
  createdByName?: string;
}

export function FinanceModule() {
  const { profile, recordAuditLog, hasPermission } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"الكل" | "دخل" | "خرج">("الكل");
  const [filterMethod, setFilterMethod] = useState<string>("الكل");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  // New transaction form state
  const [newType, setNewType] = useState<"دخل" | "خرج">("دخل");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newParty, setNewParty] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newMethod, setNewMethod] = useState<"نقداً" | "شيك" | "تحويل">("تحويل");
  const [newReceipt, setNewReceipt] = useState("وصل_مرفق.pdf");

  // Subscribe to real-time transactions from Firestore
  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Transaction[];

        setTransactions(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "transactions");
      },
    );

    return () => unsub();
  }, []);

  // Current balance calculation
  const currentBalance = useMemo(() => {
    return transactions.length > 0 ? (transactions[0]?.balanceAfter ?? 12840000) : 12840000;
  }, [transactions]);

  const totalIncome = useMemo(() => {
    return transactions.filter((t) => t.type === "دخل").reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions.filter((t) => t.type === "خرج").reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Handle adding new transaction with automatic balance calculation & Firestore persistence
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmount || !newParty || !newReason) return;

    const newBalance =
      newType === "دخل" ? currentBalance + Number(newAmount) : currentBalance - Number(newAmount);

    const newTxData = {
      type: newType,
      amount: Number(newAmount),
      party: newParty,
      reason: newReason,
      date: new Date().toISOString().split("T")[0] ?? "2026-10-04",
      paymentMethod: newMethod,
      balanceAfter: newBalance,
      receiptName: newReceipt || "وصل_رسمي.pdf",
      createdBy: profile?.uid || "user",
      createdByName: profile?.name || "المستخدم",
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "transactions"), newTxData);
      await recordAuditLog(
        "تسجيل عملية مالية",
        "التسيير المالي",
        `تسجيل ${newType} بقيمة ${Number(newAmount).toLocaleString()} دج لصالح ${newParty}`,
      );
      setIsModalOpen(false);
      setNewAmount(0);
      setNewParty("");
      setNewReason("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "transactions");
    }
  };

  const handleDeleteTransaction = async (id: string, reason: string) => {
    if (!hasPermission("canDeleteRecords")) {
      alert("عذراً، ليس لديك صلاحية حذف السجلات المالية.");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف العملية: ${reason}؟`)) return;

    try {
      await deleteDoc(doc(db, "transactions", id));
      await recordAuditLog("حذف عملية مالية", "التسيير المالي", `حذف العملية ${id}: ${reason}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch =
        t.party.toLowerCase().includes(search.toLowerCase()) ||
        t.reason.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "الكل" || t.type === filterType;
      const matchMethod = filterMethod === "الكل" || t.paymentMethod === filterMethod;
      return matchSearch && matchType && matchMethod;
    });
  }, [transactions, search, filterType, filterMethod]);

  return (
    <div className="space-y-6">
      {/* Header & Main Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#07152f]">التسيير المالي وحركة الصندوق 💰</h2>
          <p className="text-xs text-muted-foreground mt-1">
            جدول ديناميكي يدعم الحساب الآلي لرصيد الصندوق بعد كل عملية والتصفية الفورية.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#083c7a] hover:bg-[#05326f] text-white font-bold gap-2"
        >
          <Plus className="h-4 w-4" /> إضافة عملية مالية جديدة
        </Button>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">
            الرصيد المتبقي في الصندوق (الآن)
          </span>
          <div className="mt-2 text-2xl font-black text-[#083c7a]">
            {currentBalance.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-emerald-600 font-semibold">تحديث تلقائي بعد كل عملية</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">إجمالي المداخيل المسجلة</span>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            +{totalIncome.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-muted-foreground">مستخلصات الأشغال والتحويلات</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">
            إجمالي المصاريف والمدفوعات
          </span>
          <div className="mt-2 text-2xl font-black text-amber-600">
            -{totalExpense.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-muted-foreground">أجور، مواد أولية، ووقود الآليات</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالجهة المستفيدة، السبب أو رقم العملية..."
            className="pr-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="inline-flex rounded-lg border border-border bg-slate-100 p-0.5 text-xs font-bold">
            {(["الكل", "دخل", "خرج"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  filterType === type
                    ? "bg-[#083c7a] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Payment Method filter */}
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground outline-none"
          >
            <option value="الكل">كل طرق الدفع</option>
            <option value="نقداً">نقداً</option>
            <option value="شيك">شيك</option>
            <option value="تحويل">تحويل</option>
          </select>
        </div>
      </div>

      {/* Dynamic Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-right text-sm">
            <thead className="bg-[#05326f] text-white">
              <tr>
                <th className="px-4 py-3.5 font-bold">نوع العملية</th>
                <th className="px-4 py-3.5 font-bold">المبلغ</th>
                <th className="px-4 py-3.5 font-bold">المصدر / المستفيد</th>
                <th className="px-4 py-3.5 font-bold">سبب العملية</th>
                <th className="px-4 py-3.5 font-bold">التاريخ</th>
                <th className="px-4 py-3.5 font-bold">طريقة الدفع</th>
                <th className="px-4 py-3.5 font-bold">رصيد الصندوق المتبقي</th>
                <th className="px-4 py-3.5 font-bold text-center">المرفقات</th>
                <th className="px-4 py-3.5 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        t.type === "دخل"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {t.type === "دخل" ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-[#07152f]">
                    {t.type === "دخل" ? "+" : "-"} {t.amount.toLocaleString()} دج
                  </td>
                  <td className="px-4 py-3.5 font-medium">{t.party}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{t.reason}</td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{t.date}</td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {t.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-extrabold text-[#083c7a]">
                    {t.balanceAfter.toLocaleString()} دج
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => setPreviewReceipt(t.receiptName)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0555a8] hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {t.receiptName}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {hasPermission("canDeleteRecords") && (
                      <button
                        onClick={() => handleDeleteTransaction(t.id, t.reason)}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                        title="حذف العملية"
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

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">إضافة عملية مالية جديدة 💰</h3>
            <p className="text-xs text-muted-foreground mt-1">
              سيتم حساب رصيد الصندوق وتحديثه تلقائياً فور حفظ هذه العملية.
            </p>

            <form onSubmit={handleAddTransaction} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewType("دخل")}
                  className={`rounded-xl border p-3 font-bold text-sm ${
                    newType === "دخل"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  دخل (إيراد +)
                </button>
                <button
                  type="button"
                  onClick={() => setNewType("خرج")}
                  className={`rounded-xl border p-3 font-bold text-sm ${
                    newType === "خرج"
                      ? "border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-500"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  خرج (مصروف -)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">المبلغ (دج)</label>
                <Input
                  type="number"
                  required
                  placeholder="مثال: 250000"
                  value={newAmount || ""}
                  onChange={(e) => setNewAmount(Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  المصدر / الجهة المستفيدة
                </label>
                <Input
                  required
                  placeholder="اسم المؤسسة أو المشروع"
                  value={newParty}
                  onChange={(e) => setNewParty(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">سبب العملية</label>
                <Input
                  required
                  placeholder="مثال: شراء إسمنت، تسليم دفعة..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">طريقة الدفع</label>
                  <select
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value as "نقداً" | "شيك" | "تحويل")}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="تحويل">تحويل بنكي</option>
                    <option value="شيك">شيك بنكي</option>
                    <option value="نقداً">نقداً</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    اسم المرفق / الوصل
                  </label>
                  <Input
                    placeholder="وصل_رسمي.pdf"
                    value={newReceipt}
                    onChange={(e) => setNewReceipt(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-[#083c7a]">
                <strong>الرصيد بعد هذه العملية التقديري: </strong>
                {newType === "دخل"
                  ? (currentBalance + Number(newAmount || 0)).toLocaleString()
                  : (currentBalance - Number(newAmount || 0)).toLocaleString()}{" "}
                دج
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-[#083c7a] text-white font-bold">
                  حفظ العملية وتحديث الصندوق
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <FileCheck className="h-16 w-16 mx-auto text-[#083c7a]" />
            <h4 className="mt-3 text-lg font-bold text-[#07152f]">معاينة المستند المرفق</h4>
            <p className="mt-1 text-sm text-muted-foreground">{previewReceipt}</p>
            <div className="mt-4 rounded-xl border border-border p-4 bg-slate-50 text-xs text-right space-y-1">
              <p>• مستند معتمد ومؤرشف في قاعدة بيانات BENNINI ETPI.</p>
              <p>• يتضمن الختم الرسمي وتوقيع المستلم وقيمة المبلغ المدفوع.</p>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setPreviewReceipt(null)} className="w-full">
                إغلاق
              </Button>
              <Button
                onClick={() => setPreviewReceipt(null)}
                className="w-full bg-[#083c7a] text-white"
              >
                تحميل الوصل
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
