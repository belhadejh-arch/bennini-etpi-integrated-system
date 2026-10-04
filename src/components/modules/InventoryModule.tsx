import { useState, useMemo, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Calculator,
  CheckCircle,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface InventoryItem {
  id?: string;
  name: string; // اسم السلعة
  quantity: number; // الكمية الإجمالية
  buyPrice: number; // سعر الشراء
  totalCost: number; // إجمالي التكلفة (كمية × سعر الشراء)
  supplier: string; // المورد
  invoiceNumber: string; // رقم الفاتورة
  purchaseDate: string; // تاريخ الشراء
  sellPrice: number; // سعر البيع
  expectedProfit: number; // قيمة الربح المتوقعة ((سعر البيع - سعر الشراء) × الكمية)
  realizedProfit: number; // الربح المحقق
  remainingQuantity: number; // الكمية المتبقية
  minStockAlert: number; // حد التنبيه
}

export function InventoryModule() {
  const { profile, recordAuditLog, hasPermission } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Item State with real-time auto calculation
  const [formName, setFormName] = useState("");
  const [formQty, setFormQty] = useState<number>(100);
  const [formBuyPrice, setFormBuyPrice] = useState<number>(500);
  const [formSellPrice, setFormSellPrice] = useState<number>(700);
  const [formSupplier, setFormSupplier] = useState("");
  const [formInvoice, setFormInvoice] = useState("");
  const [formMinAlert, setFormMinAlert] = useState<number>(20);

  // Real-time calculations for new item
  const calculatedTotalCost = formQty * formBuyPrice;
  const calculatedExpectedProfit = (formSellPrice - formBuyPrice) * formQty;

  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("purchaseDate", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as InventoryItem[];
        setItems(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "inventory");
      },
    );

    return () => unsub();
  }, []);

  const lowStockCount = useMemo(() => {
    return items.filter((i) => i.remainingQuantity <= i.minStockAlert).length;
  }, [items]);

  const totalInventoryValue = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.totalCost, 0);
  }, [items]);

  const totalRealizedProfit = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.realizedProfit, 0);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.supplier.toLowerCase().includes(search.toLowerCase()) ||
        item.invoiceNumber.toLowerCase().includes(search.toLowerCase());
      const matchLowStock = onlyLowStock ? item.remainingQuantity <= item.minStockAlert : true;
      return matchSearch && matchLowStock;
    });
  }, [items, search, onlyLowStock]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formQty || !formBuyPrice) return;

    const newItemData = {
      name: formName,
      quantity: Number(formQty),
      buyPrice: Number(formBuyPrice),
      totalCost: Number(calculatedTotalCost),
      supplier: formSupplier || "مورد معتمد",
      invoiceNumber: formInvoice || `FAC-2026-${Math.floor(Math.random() * 900 + 100)}`,
      purchaseDate: new Date().toISOString().split("T")[0] ?? "2026-10-04",
      sellPrice: Number(formSellPrice),
      expectedProfit: Number(calculatedExpectedProfit),
      realizedProfit: 0,
      remainingQuantity: Number(formQty),
      minStockAlert: Number(formMinAlert),
      createdBy: profile?.uid || "user",
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "inventory"), newItemData);
      await recordAuditLog(
        "شراء سلعة للمخزون",
        "المشتريات والمخزون",
        `إضافة ${formName} بكمية ${formQty} بتكلفة إجمالية ${calculatedTotalCost.toLocaleString()} دج`,
      );
      setIsModalOpen(false);
      setFormName("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "inventory");
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!hasPermission("canDeleteRecords")) {
      alert("عذراً، ليس لديك صلاحية حذف المواد من المخزون.");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف مادة: ${name}؟`)) return;

    try {
      await deleteDoc(doc(db, "inventory", id));
      await recordAuditLog("حذف مادة من المخزون", "المشتريات والمخزون", `حذف المادة ${name}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `inventory/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#07152f]">المشتريات والسلع وإدارة المخزون 📦</h2>
          <p className="text-xs text-muted-foreground mt-1">
            سجل الشراء التفصيلي، الحساب الآلي للتكلفة والربح، ونظام التنبيه المبكر لنفاد السلع.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#f5b41e] hover:bg-[#e4a515] text-[#07152f] font-extrabold gap-2"
        >
          <Plus className="h-4 w-4" /> تسجيل شراء / سلعة جديدة
        </Button>
      </div>

      {/* Prompt Formula Highlight Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#f5b41e]" />
            <div>
              <strong className="block text-sm font-bold">
                نموذج الحساب الآلي المعتمد في المنظومة:
              </strong>
              <span>
                شراء 100 قطعة × 500 دج = <strong>50,000 دج</strong> (التكلفة) • البيع 100 قطعة × 700
                دج = <strong>70,000 دج</strong> • الربح المحقق ={" "}
                <strong className="text-emerald-700">20,000 دج</strong>.
              </span>
            </div>
          </div>
          {lowStockCount > 0 && (
            <button
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                onlyLowStock
                  ? "bg-amber-700 text-white"
                  : "bg-amber-200 text-amber-900 hover:bg-amber-300"
              }`}
            >
              ⚠️ {lowStockCount} مواد على وشك النفاد (عرض المنخفض)
            </button>
          )}
        </div>
      </div>

      {/* Inventory Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">إجمالي تكلفة المشتريات</span>
          <div className="mt-2 text-2xl font-black text-[#083c7a]">
            {totalInventoryValue.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-muted-foreground">إجمالي ما تم شراؤه للمستودعات</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">
            الأرباح المحققة من المبيعات
          </span>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            +{totalRealizedProfit.toLocaleString()} دج
          </div>
          <p className="mt-1 text-xs text-muted-foreground">محسوبة من السلع المصروفة فعلياً</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground">تنبيهات المخزون الحرجة</span>
          <div className="mt-2 text-2xl font-black text-amber-600">{lowStockCount} مواد</div>
          <p className="mt-1 text-xs text-amber-600 font-semibold">كميات أقل من حد الأمان</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم السلعة، المورد، أو رقم الفاتورة..."
            className="pr-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={onlyLowStock ? "default" : "outline"}
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className="text-xs font-bold"
          >
            {onlyLowStock ? "عرض كل المواد" : "تصفية: المواد المنخفضة فقط"}
          </Button>
        </div>
      </div>

      {/* Inventory Table with all requested fields */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-right text-sm">
            <thead className="bg-[#05326f] text-white">
              <tr>
                <th className="px-3.5 py-3 font-bold">اسم السلعة</th>
                <th className="px-3 py-3 font-bold">الكمية</th>
                <th className="px-3 py-3 font-bold">سعر الشراء</th>
                <th className="px-3 py-3 font-bold">إجمالي التكلفة</th>
                <th className="px-3.5 py-3 font-bold">المورد</th>
                <th className="px-3 py-3 font-bold">رقم الفاتورة</th>
                <th className="px-3 py-3 font-bold">تاريخ الشراء</th>
                <th className="px-3 py-3 font-bold">سعر البيع</th>
                <th className="px-3 py-3 font-bold">الربح المتوقع</th>
                <th className="px-3 py-3 font-bold">الربح المحقق</th>
                <th className="px-3 py-3 font-bold">الكمية المتبقية</th>
                <th className="px-3 py-3 font-bold text-center">حالة المخزون</th>
                <th className="px-3 py-3 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => {
                const isLow = item.remainingQuantity <= item.minStockAlert;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-3.5 font-bold text-[#07152f]">{item.name}</td>
                    <td className="px-3 py-3.5 font-medium">{item.quantity}</td>
                    <td className="px-3 py-3.5 text-muted-foreground">
                      {item.buyPrice.toLocaleString()} دج
                    </td>
                    <td className="px-3 py-3.5 font-bold text-[#083c7a]">
                      {item.totalCost.toLocaleString()} دج
                    </td>
                    <td className="px-3.5 py-3.5 text-xs text-muted-foreground font-medium">
                      {item.supplier}
                    </td>
                    <td className="px-3 py-3.5 text-xs font-mono">{item.invoiceNumber}</td>
                    <td className="px-3 py-3.5 text-xs text-muted-foreground">
                      {item.purchaseDate}
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground">
                      {item.sellPrice.toLocaleString()} دج
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-blue-700">
                      {item.expectedProfit.toLocaleString()} دج
                    </td>
                    <td className="px-3 py-3.5 font-bold text-emerald-700">
                      {item.realizedProfit.toLocaleString()} دج
                    </td>
                    <td className="px-3 py-3.5 font-black text-slate-900">
                      {item.remainingQuantity}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          <AlertTriangle className="h-3 w-3" /> منخفض ({item.remainingQuantity})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          <CheckCircle className="h-3 w-3" /> متوفر
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      {hasPermission("canDeleteRecords") && item.id && (
                        <button
                          onClick={() => handleDeleteItem(item.id!, item.name)}
                          className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                          title="حذف المادة"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Inventory Item Modal with Live Real-Time Calculator */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">
              تسجيل عملية شراء جديدة للسلع والمخزون 📦
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              يتم حساب إجمالي التكلفة وقيمة الربح المتوقعة آلياً ومباشرة.
            </p>

            <form onSubmit={handleAddItem} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">اسم السلعة</label>
                <Input
                  required
                  placeholder="مثال: رمل مقالع، حصى 15/25، أنابيب..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">الكمية</label>
                  <Input
                    type="number"
                    required
                    value={formQty || ""}
                    onChange={(e) => setFormQty(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    سعر الشراء للوحدة (دج)
                  </label>
                  <Input
                    type="number"
                    required
                    value={formBuyPrice || ""}
                    onChange={(e) => setFormBuyPrice(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    سعر البيع المقترح (دج)
                  </label>
                  <Input
                    type="number"
                    required
                    value={formSellPrice || ""}
                    onChange={(e) => setFormSellPrice(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Automatic Live Calculation Box */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-[#083c7a]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">إجمالي التكلفة الآلي:</span>
                    <strong className="block text-base font-bold text-[#083c7a]">
                      {calculatedTotalCost.toLocaleString()} دج
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الربح المتوقع المحسوب:</span>
                    <strong className="block text-base font-bold text-emerald-700">
                      {calculatedExpectedProfit.toLocaleString()} دج
                    </strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">المورد</label>
                  <Input
                    placeholder="مؤسسة التوريد"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">رقم الفاتورة</label>
                  <Input
                    placeholder="FAC-2026-..."
                    value={formInvoice}
                    onChange={(e) => setFormInvoice(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  حد التنبيه عند اقتراب النفاد (كمية دنيا)
                </label>
                <Input
                  type="number"
                  value={formMinAlert || ""}
                  onChange={(e) => setFormMinAlert(Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-[#f5b41e] text-[#07152f] font-bold">
                  حفظ السلعة وإدراجها بالمخزون
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
