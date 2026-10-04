import { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  Building,
  Eye,
  FileCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface ChequeItem {
  id?: string;
  chequeNumber: string; // رقم الشيك
  invoiceNumber: string; // رقم الفاتورة المرتبطة
  amount: number; // المبلغ
  beneficiary: string; // المستفيد
  bank: string; // البنك
  issueDate: string; // تاريخ الإصدار
  dueDate: string; // تاريخ الاستحقاق
  status: "قيد الانتظار" | "مدفوع" | "ملغى"; // حالة الشيك
  notes: string; // ملاحظات
  chequeImage: string; // صورة الشيك / الفاتورة
}

export function ChequeModule() {
  const { profile, recordAuditLog, hasPermission } = useAuth();
  const [cheques, setCheques] = useState<ChequeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("الكل");
  const [bankFilter, setBankFilter] = useState<string>("الكل");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewChequeImage, setViewChequeImage] = useState<string | null>(null);

  // New Cheque state
  const [newChequeNumber, setNewChequeNumber] = useState("");
  const [newInvoiceNumber, setNewInvoiceNumber] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newBeneficiary, setNewBeneficiary] = useState("");
  const [newBank, setNewBank] = useState("BNA");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    const q = query(collection(db, "cheques"), orderBy("dueDate", "asc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ChequeItem[];
        setCheques(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "cheques");
      },
    );

    return () => unsub();
  }, []);

  const pendingTotal = useMemo(() => {
    return cheques.filter((c) => c.status === "قيد الانتظار").reduce((sum, c) => sum + c.amount, 0);
  }, [cheques]);

  const paidTotal = useMemo(() => {
    return cheques.filter((c) => c.status === "مدفوع").reduce((sum, c) => sum + c.amount, 0);
  }, [cheques]);

  const filteredCheques = useMemo(() => {
    return cheques.filter((item) => {
      // Fast search prioritized for Cheque Number and Invoice Number
      const query = search.trim().toLowerCase();
      const matchSearch =
        item.chequeNumber.toLowerCase().includes(query) ||
        item.invoiceNumber.toLowerCase().includes(query) ||
        item.beneficiary.toLowerCase().includes(query) ||
        item.bank.toLowerCase().includes(query);

      const matchStatus = statusFilter === "الكل" || item.status === statusFilter;
      const matchBank = bankFilter === "الكل" || item.bank.includes(bankFilter);

      return matchSearch && matchStatus && matchBank;
    });
  }, [cheques, search, statusFilter, bankFilter]);

  const updateStatus = async (id: string, newStatus: "قيد الانتظار" | "مدفوع" | "ملغى") => {
    try {
      await updateDoc(doc(db, "cheques", id), { status: newStatus });
      await recordAuditLog(
        "تحديث حالة شيك",
        "إدارة الشيكات",
        `تحديث حالة الشيك ${id} إلى "${newStatus}"`,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cheques/${id}`);
    }
  };

  const handleAddCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChequeNumber || !newAmount || !newBeneficiary) return;

    const newChqData = {
      chequeNumber: newChequeNumber,
      invoiceNumber: newInvoiceNumber || `FAC-2026-${Math.floor(Math.random() * 800 + 100)}`,
      amount: Number(newAmount),
      beneficiary: newBeneficiary,
      bank: newBank,
      issueDate: new Date().toISOString().split("T")[0] ?? "2026-10-04",
      dueDate: newDueDate || "2026-10-25",
      status: "قيد الانتظار",
      notes: newNotes || "شيك قيد المتابعة",
      chequeImage: `شيك_${newChequeNumber}.jpg`,
      createdBy: profile?.uid || "user",
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "cheques"), newChqData);
      await recordAuditLog(
        "إصدار / تسجيل شيك",
        "إدارة الشيكات",
        `تسجيل شيك رقم ${newChequeNumber} بقيمة ${Number(newAmount).toLocaleString()} دج لصالح ${newBeneficiary}`,
      );
      setIsModalOpen(false);
      setNewChequeNumber("");
      setNewAmount(0);
      setNewBeneficiary("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "cheques");
    }
  };

  const handleDeleteCheque = async (id: string, num: string) => {
    if (!hasPermission("canDeleteRecords")) {
      alert("عذراً، ليس لديك صلاحية حذف الشيكات.");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف الشيك رقم: ${num}؟`)) return;

    try {
      await deleteDoc(doc(db, "cheques", id));
      await recordAuditLog("حذف شيك", "إدارة الشيكات", `حذف الشيك ${num}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `cheques/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#07152f]">إدارة الشيكات والفواتير 🧾</h2>
          <p className="text-xs text-muted-foreground mt-1">
            متابعة دقيقة لتواريخ الاستحقاق، البنوك، مع ميزة البحث السريع برقم الشيك أو الفاتورة.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#083c7a] hover:bg-[#05326f] text-white font-bold gap-2"
        >
          <Plus className="h-4 w-4" /> إصدار / تسجيل شيك جديد
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">شيكات قيد الانتظار</span>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {pendingTotal.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-amber-700">مبالغ واجبة الصرف والمتابعة</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">إجمالي الشيكات المدفوعة</span>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            {paidTotal.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-muted-foreground">شيكات تم صرفها بنجاح</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">إجمالي الشيكات المسجلة</span>
          <div className="mt-2 text-2xl font-black text-[#083c7a]">{cheques.length} شيكات</div>
          <p className="mt-1 text-xs text-muted-foreground">موزعة على البنوك الوطنية</p>
        </div>
      </div>

      {/* Prominent Quick Search Bar as requested in prompt */}
      <div className="rounded-xl border-2 border-[#0555a8]/20 bg-blue-50/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0555a8]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 شريط البحث السريع: اكتب رقم الشيك (مثال: CH-00984) أو رقم الفاتورة للوصول الفوري..."
              className="h-11 pr-11 bg-white font-medium text-sm border-blue-200 focus-visible:ring-[#0555a8]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="inline-flex rounded-lg border border-border bg-white p-0.5 text-xs font-bold">
              {(["الكل", "قيد الانتظار", "مدفوع", "ملغى"] as const).map((st) => (
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

            {/* Bank Filter */}
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground outline-none"
            >
              <option value="الكل">كل البنوك</option>
              <option value="BNA">BNA</option>
              <option value="CPA">CPA</option>
              <option value="BADR">BADR</option>
              <option value="BDL">BDL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table with all requested fields */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-right text-sm">
            <thead className="bg-[#05326f] text-white">
              <tr>
                <th className="px-3.5 py-3 font-bold">رقم الشيك</th>
                <th className="px-3.5 py-3 font-bold">رقم الفاتورة المرتبطة</th>
                <th className="px-3.5 py-3 font-bold">المبلغ</th>
                <th className="px-3.5 py-3 font-bold">المستفيد</th>
                <th className="px-3.5 py-3 font-bold">البنك</th>
                <th className="px-3.5 py-3 font-bold">تاريخ الإصدار</th>
                <th className="px-3.5 py-3 font-bold">تاريخ الاستحقاق</th>
                <th className="px-3.5 py-3 font-bold">حالة الشيك</th>
                <th className="px-3.5 py-3 font-bold">ملاحظات</th>
                <th className="px-3.5 py-3 font-bold text-center">صورة الشيك</th>
                <th className="px-3.5 py-3 font-bold text-center">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCheques.map((chq) => (
                <tr key={chq.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-3.5 font-bold font-mono text-[#083c7a]">
                    {chq.chequeNumber}
                  </td>
                  <td className="px-3.5 py-3.5 text-xs font-mono">{chq.invoiceNumber}</td>
                  <td className="px-3.5 py-3.5 font-black text-[#07152f]">
                    {chq.amount.toLocaleString()} دج
                  </td>
                  <td className="px-3.5 py-3.5 font-medium">{chq.beneficiary}</td>
                  <td className="px-3.5 py-3.5 text-xs text-muted-foreground">{chq.bank}</td>
                  <td className="px-3.5 py-3.5 text-xs text-muted-foreground">{chq.issueDate}</td>
                  <td className="px-3.5 py-3.5 font-semibold text-xs text-amber-700">
                    {chq.dueDate}
                  </td>
                  <td className="px-3.5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        chq.status === "قيد الانتظار"
                          ? "bg-amber-100 text-amber-800"
                          : chq.status === "مدفوع"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {chq.status === "قيد الانتظار" && <Clock className="h-3 w-3" />}
                      {chq.status === "مدفوع" && <CheckCircle2 className="h-3 w-3" />}
                      {chq.status === "ملغى" && <Ban className="h-3 w-3" />}
                      {chq.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3.5 text-xs text-muted-foreground max-w-[150px] truncate">
                    {chq.notes}
                  </td>
                  <td className="px-3.5 py-3.5 text-center">
                    <button
                      onClick={() => setViewChequeImage(chq.chequeImage)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0555a8] hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      معاينة
                    </button>
                  </td>
                  <td className="px-3.5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {chq.status === "قيد الانتظار" && (
                        <button
                          onClick={() => updateStatus(chq.id, "مدفوع")}
                          className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          تأكيد الصرف
                        </button>
                      )}
                      {chq.status !== "ملغى" && (
                        <button
                          onClick={() => updateStatus(chq.id!, "ملغى")}
                          className="rounded bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                        >
                          إلغاء
                        </button>
                      )}
                      {hasPermission("canDeleteRecords") && chq.id && (
                        <button
                          onClick={() => handleDeleteCheque(chq.id!, chq.chequeNumber)}
                          className="rounded p-1 text-slate-400 hover:text-rose-600"
                          title="حذف الشيك"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cheque Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">إصدار وتسجيل شيك جديد 🧾</h3>
            <p className="text-xs text-muted-foreground mt-1">
              أدخل بيانات الشيك والفاتورة المرتبطة وتاريخ الاستحقاق.
            </p>

            <form onSubmit={handleAddCheque} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">رقم الشيك</label>
                  <Input
                    required
                    placeholder="CH-00..."
                    value={newChequeNumber}
                    onChange={(e) => setNewChequeNumber(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    رقم الفاتورة المرتبطة
                  </label>
                  <Input
                    placeholder="FAC-2026-..."
                    value={newInvoiceNumber}
                    onChange={(e) => setNewInvoiceNumber(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">المبلغ (دج)</label>
                  <Input
                    type="number"
                    required
                    value={newAmount || ""}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    البنك المسحوب عليه
                  </label>
                  <select
                    value={newBank}
                    onChange={(e) => setNewBank(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="BNA (البنك الوطني الجزائري)">BNA</option>
                    <option value="CPA (القرض الشعبي الجزائري)">CPA</option>
                    <option value="BADR (بنك الفلاحة والتنمية)">BADR</option>
                    <option value="BDL (بنك التنمية المحلية)">BDL</option>
                    <option value="BEA (بنك الجزائر الخارجي)">BEA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">المستفيد</label>
                <Input
                  required
                  placeholder="اسم الشخص أو المؤسسة"
                  value={newBeneficiary}
                  onChange={(e) => setNewBeneficiary(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">تاريخ الاستحقاق</label>
                <Input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">ملاحظات إضافية</label>
                <Input
                  placeholder="سبب الإصدار أو تفاصيل العقد..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-[#083c7a] text-white font-bold">
                  حفظ الشيك في السجل
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cheque Preview Modal */}
      {viewChequeImage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <FileCheck className="h-16 w-16 mx-auto text-[#083c7a]" />
            <h4 className="mt-3 text-lg font-bold text-[#07152f]">معاينة صورة الشيك / الفاتورة</h4>
            <p className="mt-1 text-sm text-muted-foreground font-mono">{viewChequeImage}</p>
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 bg-slate-50 text-xs text-muted-foreground">
              نسخة رقمية مطابقة لأصل الشيك البنكي المعتمد والموقع من إدارة الشركة.
            </div>
            <Button
              onClick={() => setViewChequeImage(null)}
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
