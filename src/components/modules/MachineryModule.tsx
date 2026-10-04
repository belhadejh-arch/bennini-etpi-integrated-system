import { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  History,
  Fuel,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface MachineryItem {
  id?: string;
  name: string; // اسم الآلية / المركبة
  model: string;
  plateNumber: string;
  status: "تعمل بكفاءة" | "في الصيانة" | "متوقفة";
  assignedSite: string;
  totalRepairExpenses: number;
  fuelConsumptionRate: string;
  notes: string;
  createdAt: string;
}

export interface SparePartItem {
  id?: string;
  name: string; // اسم القطعة
  quantity: number;
  buyPrice: number;
  supplier: string;
  invoiceNumber: string;
  machineryName: string; // الآلية التي استعملت فيها
  installedDate: string;
  remainingStock: number;
  repairExpenses: number;
  notes: string;
  createdAt: string;
}

export function MachineryModule() {
  const { profile, recordAuditLog, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"machinery" | "parts">("machinery");
  const [machineryList, setMachineryList] = useState<MachineryItem[]>([]);
  const [partsList, setPartsList] = useState<SparePartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddMachineModal, setIsAddMachineModal] = useState(false);
  const [isAddPartModal, setIsAddPartModal] = useState(false);

  // Form states - Machine
  const [mName, setMName] = useState("");
  const [mModel, setMModel] = useState("");
  const [mPlate, setMPlate] = useState("");
  const [mSite, setMSite] = useState("ورشة الطريق الولائي رقم 14");
  const [mFuel, setMFuel] = useState("18 لتر / ساعة");
  const [mNotes, setMNotes] = useState("");

  // Form states - Part
  const [pName, setPName] = useState("");
  const [pQty, setPQty] = useState(1);
  const [pPrice, setPPrice] = useState(0);
  const [pSupplier, setPSupplier] = useState("");
  const [pInvoice, setPInvoice] = useState("");
  const [pMachinery, setPMachinery] = useState("");
  const [pExpenses, setPExpenses] = useState(0);
  const [pNotes, setPNotes] = useState("");

  useEffect(() => {
    // Listen to machinery
    const unsubMachinery = onSnapshot(
      collection(db, "machinery"),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MachineryItem);
        setMachineryList(items);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "machinery");
      },
    );

    // Listen to spare parts
    const unsubParts = onSnapshot(
      collection(db, "spareParts"),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SparePartItem);
        setPartsList(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "spareParts");
      },
    );

    return () => {
      unsubMachinery();
      unsubParts();
    };
  }, []);

  const handleAddMachinery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mName || !mModel) return;

    try {
      const newM: Omit<MachineryItem, "id"> = {
        name: mName,
        model: mModel,
        plateNumber: mPlate || "بدون لوحة",
        status: "تعمل بكفاءة",
        assignedSite: mSite,
        totalRepairExpenses: 0,
        fuelConsumptionRate: mFuel,
        notes: mNotes,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "machinery"), newM);
      await recordAuditLog("إضافة آلية جديدة", "المركبات والآليات", `إضافة ${mName} (${mModel})`);
      setIsAddMachineModal(false);
      setMName("");
      setMModel("");
      setMPlate("");
      setMNotes("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "machinery");
    }
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName || !pPrice) return;

    try {
      const newPart: Omit<SparePartItem, "id"> = {
        name: pName,
        quantity: Number(pQty),
        buyPrice: Number(pPrice),
        supplier: pSupplier || "مؤسسة قطع الغيار",
        invoiceNumber: pInvoice || `FAC-P-${Math.floor(Math.random() * 800 + 100)}`,
        machineryName: pMachinery || "مخزن عام",
        installedDate: new Date().toISOString().split("T")[0] ?? "2026-10-04",
        remainingStock: Number(pQty),
        repairExpenses: Number(pExpenses),
        notes: pNotes,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "spareParts"), newPart);

      // If tied to a specific machinery, also update that machine's total repair expenses
      if (pMachinery && pMachinery !== "مخزن عام") {
        const foundMachine = machineryList.find((m) => m.name === pMachinery);
        if (foundMachine?.id) {
          const updatedExpense =
            (foundMachine.totalRepairExpenses || 0) + Number(pPrice) + Number(pExpenses);
          await updateDoc(doc(db, "machinery", foundMachine.id), {
            totalRepairExpenses: updatedExpense,
          });
        }
      }

      await recordAuditLog(
        "تسجيل قطعة غيار وإصلاح",
        "قطع الغيار",
        `تركيب ${pName} في ${pMachinery} بقيمة ${pPrice} دج`,
      );

      setIsAddPartModal(false);
      setPName("");
      setPPrice(0);
      setPNotes("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "spareParts");
    }
  };

  const filteredMachinery = useMemo(() => {
    return machineryList.filter(
      (m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.model.toLowerCase().includes(search.toLowerCase()) ||
        m.assignedSite.toLowerCase().includes(search.toLowerCase()),
    );
  }, [machineryList, search]);

  const filteredParts = useMemo(() => {
    return partsList.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.machineryName.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier.toLowerCase().includes(search.toLowerCase()),
    );
  }, [partsList, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#07152f]">
            المركبات والآليات وتتبع قطع الغيار 🚜
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            سجل الآليات وحالتها، مع ربط كل قطعة غيار بالآلية التي استُعملت فيها لمعرفة تاريخ مصاريف
            وإصلاحات كل آلية بدقة.
          </p>
        </div>

        <div className="flex gap-2">
          {hasPermission("canEditMachinery") && (
            <>
              <Button
                onClick={() => setIsAddMachineModal(true)}
                className="bg-[#083c7a] hover:bg-[#05326f] text-white font-bold gap-2 text-xs"
              >
                <Plus className="h-4 w-4" /> إضافة آلية جديدة
              </Button>
              <Button
                onClick={() => setIsAddPartModal(true)}
                className="bg-[#f5b41e] hover:bg-[#e4a515] text-[#07152f] font-bold gap-2 text-xs"
              >
                <Wrench className="h-4 w-4" /> تسجيل قطعة غيار
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-white rounded-xl p-1 shadow-xs">
        <button
          onClick={() => setActiveTab("machinery")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === "machinery"
              ? "bg-[#083c7a] text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="h-4 w-4" /> حظيرة الآليات والمركبات ({machineryList.length})
        </button>
        <button
          onClick={() => setActiveTab("parts")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === "parts"
              ? "bg-[#083c7a] text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wrench className="h-4 w-4" /> سجل قطع الغيار ومصاريف الإصلاح ({partsList.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            activeTab === "machinery"
              ? "ابحث باسم الآلية أو الورشة أو الموديل..."
              : "ابحث باسم القطعة أو الآلية المستخدمة فيها..."
          }
          className="pr-10 bg-white"
        />
      </div>

      {/* Tab 1: Machinery Fleet */}
      {activeTab === "machinery" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-right text-sm">
              <thead className="bg-[#05326f] text-white">
                <tr>
                  <th className="px-4 py-3.5 font-bold">الآلية / المركبة</th>
                  <th className="px-4 py-3.5 font-bold">الموديل / السلسلة</th>
                  <th className="px-4 py-3.5 font-bold">رقم اللوحة</th>
                  <th className="px-4 py-3.5 font-bold">الحالة الفنية</th>
                  <th className="px-4 py-3.5 font-bold">الورشة التابعة لها</th>
                  <th className="px-4 py-3.5 font-bold">معدل استهلاك الوقود</th>
                  <th className="px-4 py-3.5 font-bold">إجمالي مصاريف الإصلاح</th>
                  <th className="px-4 py-3.5 font-bold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMachinery.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-[#07152f] flex items-center gap-2">
                      <Truck className="h-4 w-4 text-[#083c7a]" />
                      {m.name}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">
                      {m.model}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs">{m.plateNumber}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          m.status === "تعمل بكفاءة"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.status === "في الصيانة"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {m.status === "تعمل بكفاءة" && <CheckCircle2 className="h-3 w-3" />}
                        {m.status === "في الصيانة" && <AlertTriangle className="h-3 w-3" />}
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-[#083c7a]">
                      {m.assignedSite}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Fuel className="h-3.5 w-3.5 text-amber-600" />
                        {m.fuelConsumptionRate}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-black text-rose-700">
                      {(m.totalRepairExpenses || 0).toLocaleString()} دج
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[180px] truncate">
                      {m.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Spare Parts Log Linked to Machinery */}
      {activeTab === "parts" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-right text-sm">
              <thead className="bg-[#05326f] text-white">
                <tr>
                  <th className="px-4 py-3.5 font-bold">اسم القطعة</th>
                  <th className="px-4 py-3.5 font-bold">الآلية التي استُعملت فيها</th>
                  <th className="px-4 py-3.5 font-bold">سعر الشراء</th>
                  <th className="px-4 py-3.5 font-bold">المورد</th>
                  <th className="px-4 py-3.5 font-bold">رقم الفاتورة</th>
                  <th className="px-4 py-3.5 font-bold">تاريخ التركيب</th>
                  <th className="px-4 py-3.5 font-bold">تكاليف التركيب والإصلاح</th>
                  <th className="px-4 py-3.5 font-bold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredParts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-[#07152f] flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-[#0555a8]" />
                      {p.name}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#083c7a]">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-xs">
                        {p.machineryName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium">{p.buyPrice.toLocaleString()} دج</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{p.supplier}</td>
                    <td className="px-4 py-3.5 text-xs font-mono">{p.invoiceNumber}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{p.installedDate}</td>
                    <td className="px-4 py-3.5 font-bold text-amber-700">
                      {(p.repairExpenses || 0).toLocaleString()} دج
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[180px] truncate">
                      {p.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Machinery Modal */}
      {isAddMachineModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">
              إضافة آلية / مركبة جديدة للحظيرة 🚜
            </h3>
            <form onSubmit={handleAddMachinery} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">اسم الآلية</label>
                <Input
                  required
                  placeholder="مثال: حفارة Caterpillar 320، رافعة 25 طن..."
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    الموديل / السلسلة
                  </label>
                  <Input
                    required
                    placeholder="مثال: CAT 320GC"
                    value={mModel}
                    onChange={(e) => setMModel(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    رقم اللوحة / الترقيم
                  </label>
                  <Input
                    placeholder="مثال: 01245-116-16"
                    value={mPlate}
                    onChange={(e) => setMPlate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">الورشة التابعة لها</label>
                <Input value={mSite} onChange={(e) => setMSite(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">ملاحظات الآلية</label>
                <Input
                  placeholder="سنة الصنع، الفحص الفني..."
                  value={mNotes}
                  onChange={(e) => setMNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddMachineModal(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-[#083c7a] text-white font-bold">
                  حفظ الآلية
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Spare Part Modal */}
      {isAddPartModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">تسجيل قطعة غيار وربطها بالآلية 🔧</h3>
            <p className="text-xs text-muted-foreground mt-1">
              يتم ربط قطعة الغيار بالآلية لتحديث إجمالي مصاريف صيانتها وتتبع أعطالها.
            </p>
            <form onSubmit={handleAddPart} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">اسم قطعة الغيار</label>
                <Input
                  required
                  placeholder="مثال: مضخة هيدروليك، مصفاة زيت، جنزير..."
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    الآلية المستخدمة فيها
                  </label>
                  <select
                    value={pMachinery}
                    onChange={(e) => setPMachinery(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">اختر الآلية...</option>
                    {machineryList.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.model})
                      </option>
                    ))}
                    <option value="مخزن عام">مخزن عام (قطع احتياطية)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">سعر الشراء (دج)</label>
                  <Input
                    type="number"
                    required
                    value={pPrice || ""}
                    onChange={(e) => setPPrice(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">المورد</label>
                  <Input
                    placeholder="مؤسسة قطع الغيار"
                    value={pSupplier}
                    onChange={(e) => setPSupplier(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    مصاريف الصيانة والتركيب (دج)
                  </label>
                  <Input
                    type="number"
                    value={pExpenses || ""}
                    onChange={(e) => setPExpenses(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  ملاحظات العطل والإصلاح
                </label>
                <Input
                  placeholder="سبب الاستبدال وفني التركيب..."
                  value={pNotes}
                  onChange={(e) => setPNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddPartModal(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-[#083c7a] text-white font-bold">
                  حفظ وتسجيل في تاريخ الآلية
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
