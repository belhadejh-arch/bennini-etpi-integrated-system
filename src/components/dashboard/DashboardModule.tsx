import { useState, useEffect, useMemo } from "react";
import {
  CircleDollarSign,
  TrendingUp,
  FileText,
  Truck,
  HardHat,
  Package,
  ChevronLeft,
  Sun,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Fuel,
  Wrench,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/utils";

interface DashboardProps {
  onNavigate: (section: string) => void;
  onOpenQuickEntry: () => void;
}

interface TransactionSummary {
  id: string;
  type: string;
  amount: number;
  party?: string;
  reason?: string;
  date?: string;
  paymentMethod?: string;
  balanceAfter?: number;
}

interface InventorySummary {
  id: string;
  name?: string;
  quantity?: number;
  buyPrice?: number;
  totalCost?: number;
  remainingQuantity?: number;
}

interface ChequeSummary {
  id: string;
  chequeNumber?: string;
  amount?: number;
  beneficiary?: string;
  dueDate?: string;
  status: string;
}

interface RentalSummary {
  id: string;
  equipment?: string;
  clientOrOwner?: string;
  remainingAmount?: number;
  status: string;
}

interface FieldExpenseSummary {
  id: string;
  category?: string;
  amount?: number;
  siteName?: string;
  createdByName?: string;
  createdAt?: string;
  details?: string;
}

export function DashboardModule({ onNavigate, onOpenQuickEntry }: DashboardProps) {
  const { profile } = useAuth();

  // Real-time Firestore state
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [inventory, setInventory] = useState<InventorySummary[]>([]);
  const [cheques, setCheques] = useState<ChequeSummary[]>([]);
  const [rentals, setRentals] = useState<RentalSummary[]>([]);
  const [fieldExpenses, setFieldExpenses] = useState<FieldExpenseSummary[]>([]);

  useEffect(() => {
    // 1. Transactions
    const unsubTx = onSnapshot(
      query(collection(db, "transactions"), orderBy("date", "desc"), limit(10)),
      (s) =>
        setTransactions(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TransactionSummary, "id">) })),
        ),
      (err) => handleFirestoreError(err, OperationType.GET, "transactions"),
    );

    // 2. Inventory
    const unsubInv = onSnapshot(
      collection(db, "inventory"),
      (s) =>
        setInventory(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventorySummary, "id">) })),
        ),
      (err) => handleFirestoreError(err, OperationType.GET, "inventory"),
    );

    // 3. Cheques
    const unsubChq = onSnapshot(
      collection(db, "cheques"),
      (s) =>
        setCheques(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChequeSummary, "id">) }))),
      (err) => handleFirestoreError(err, OperationType.GET, "cheques"),
    );

    // 4. Rentals
    const unsubRnt = onSnapshot(
      collection(db, "rentals"),
      (s) =>
        setRentals(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RentalSummary, "id">) }))),
      (err) => handleFirestoreError(err, OperationType.GET, "rentals"),
    );

    // 5. Field Expenses
    const unsubField = onSnapshot(
      query(collection(db, "fieldExpenses"), orderBy("createdAt", "desc"), limit(10)),
      (s) =>
        setFieldExpenses(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FieldExpenseSummary, "id">) })),
        ),
      (err) => handleFirestoreError(err, OperationType.GET, "fieldExpenses"),
    );

    return () => {
      unsubTx();
      unsubInv();
      unsubChq();
      unsubRnt();
      unsubField();
    };
  }, []);

  // Computed Real-time Metrics
  const currentBalance = useMemo(() => {
    return transactions.length > 0 ? (transactions[0]?.balanceAfter ?? 12840000) : 12840000;
  }, [transactions]);

  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "دخل")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === "مصروف" || t.type === "خرج")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const totalPurchases = useMemo(() => {
    return inventory.reduce((sum, i) => sum + (Number(i.totalCost) || 0), 0);
  }, [inventory]);

  const totalInventoryStockValue = useMemo(() => {
    return inventory.reduce(
      (sum, i) => sum + Number(i.remainingQuantity || 0) * Number(i.buyPrice || 0),
      0,
    );
  }, [inventory]);

  const pendingChequesTotal = useMemo(() => {
    return cheques
      .filter((c) => c.status === "قيد الانتظار")
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [cheques]);

  const remainingRentalTotal = useMemo(() => {
    return rentals.reduce((sum, r) => sum + (Number(r.remainingAmount) || 0), 0);
  }, [rentals]);

  const dueSoonChequesCount = useMemo(() => {
    return cheques.filter((c) => c.status === "قيد الانتظار").length;
  }, [cheques]);

  const cashflowChartData = [
    { month: "ماي", income: 2400, expense: 1450 },
    { month: "جوان", income: 2950, expense: 1700 },
    { month: "جويلية", income: 2600, expense: 1920 },
    { month: "أوت", income: 3800, expense: 2200 },
    { month: "سبتمبر", income: 4250, expense: 2380 },
    {
      month: "أكتوبر",
      income: Math.round(totalIncome / 1000) || 4750,
      expense: Math.round(totalExpense / 1000) || 2600,
    },
  ];

  const weeklyData = [
    { day: "السبت", netIncome: 75, expense: 22 },
    { day: "الأحد", netIncome: 92, expense: 35 },
    { day: "الإثنين", netIncome: 65, expense: 18 },
    { day: "الثلاثاء", netIncome: 110, expense: 42 },
    { day: "الأربعاء", netIncome: 88, expense: 28 },
    { day: "الخميس", netIncome: 95, expense: 31 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#07152f] via-[#083c7a] to-[#0555a8] p-6 text-white shadow-lg">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f5b41e] px-3 py-1 text-xs font-bold text-[#07152f]">
              <Calendar className="h-3.5 w-3.5" />
              مؤشرات الأداء الميداني والمالي المركزي
            </div>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              مرحباً بك، {profile?.name || "محمد بنيني"}
            </h2>
            <p className="mt-2 text-sm text-blue-100 sm:text-base leading-relaxed max-w-xl">
              جميع أقسام الشركة متزامنة في الوقت الحقيقي. الصندوق المركزي مستقر، ورئيس الأشغال يوثق
              العمليات الميدانية مباشرة من هاتفه.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => onNavigate("finance")}
                className="bg-[#f5b41e] text-[#07152f] font-bold hover:bg-[#e4a515] transition-transform active:scale-95"
              >
                التسيير المالي والصندوق
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigate("field")}
                className="border-white/30 text-white bg-white/10 hover:bg-white/20"
              >
                بوابة تطبيق رئيس الأشغال 📱
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 rounded-xl border border-white/20 bg-black/20 p-4 backdrop-blur">
            <div className="border-l border-white/10 pl-3">
              <span className="text-xs text-blue-200">العمليات المنجزة</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold">
                  {transactions.length + fieldExpenses.length + 15}
                </span>
                <span className="text-xs font-bold text-[#f5b41e]">+22%</span>
              </div>
              <p className="text-[11px] text-blue-200 mt-1">مزامنة سحابية حية</p>
            </div>

            <div>
              <span className="text-xs text-blue-200">حالة الطقس الميداني</span>
              <div className="mt-1 flex items-center gap-1.5">
                <Sun className="h-6 w-6 text-[#f5b41e]" />
                <span className="text-2xl font-bold">24°C</span>
              </div>
              <p className="text-[11px] text-blue-200 mt-1">مشمس • البليدة / رويبة</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main KPI Statistics Grid (Clickable to jump directly to each section) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Current Balance */}
        <div
          onClick={() => onNavigate("finance")}
          className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-[#083c7a] cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-[#0555a8]">
              <CircleDollarSign className="h-6 w-6" />
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              مباشر
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">الرصيد الحالي بالصندوق</p>
          <h3 className="mt-1 text-2xl font-extrabold text-[#07152f]">
            {formatCurrency(currentBalance)} دج
          </h3>
          <p className="mt-1 text-xs text-emerald-600 font-medium">انقر لعرض حركة الصندوق</p>
        </div>

        {/* 2. Total Incomes & Expenses */}
        <div
          onClick={() => onNavigate("finance")}
          className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-[#083c7a] cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#083c7a]">
              المالية
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            إجمالي الأموال الداخلة / الخارجة
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-black text-emerald-700">
              +{formatCurrency(totalIncome)}
            </span>
            <span className="text-sm font-bold text-amber-700">
              -{formatCurrency(totalExpense)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#66839e]">صافي التدفقات المسجلة</p>
        </div>

        {/* 3. Procurement & Stock Value */}
        <div
          onClick={() => onNavigate("inventory")}
          className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-[#083c7a] cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-[#f5b41e]">
              <Package className="h-6 w-6" />
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              المخزون
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            إجمالي المشتريات وقيمة المخزون
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-[#07152f]">
            {formatCurrency(totalPurchases)} دج
          </h3>
          <p className="mt-1 text-xs text-[#66839e]">
            قيمة المواد بالمخزن: {formatCurrency(totalInventoryStockValue)} دج
          </p>
        </div>

        {/* 4. Cheques & Rentals Remaining */}
        <div
          onClick={() => onNavigate("cheques")}
          className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-[#083c7a] cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-700">
              <FileText className="h-6 w-6" />
            </div>
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
              {dueSoonChequesCount} شيكات معلقة
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            الشيكات قيد الانتظار والكراء
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-[#07152f]">
            {formatCurrency(pendingChequesTotal)} دج
          </h3>
          <p className="mt-1 text-xs text-amber-700 font-medium">
            متبقي في الكراء: {formatCurrency(remainingRentalTotal)} دج
          </p>
        </div>
      </section>

      {/* Interactive Charts: Cashflow Area Chart & Weekly Chart */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#07152f]">
                تحليل التدفقات المالية (Sales & Cashflow)
              </h3>
              <p className="text-xs text-muted-foreground">
                مقارنة المداخيل والمصاريف الشهرية (بالآلاف دج)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-[#0555a8]">
                <span className="h-3 w-3 rounded-full bg-[#0555a8]" /> المداخيل
              </span>
              <span className="flex items-center gap-1.5 text-[#f5b41e]">
                <span className="h-3 w-3 rounded-full bg-[#f5b41e]" /> المصاريف
              </span>
            </div>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={cashflowChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0555a8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0555a8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f5b41e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f5b41e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#66839e" fontSize={11} tickLine={false} />
                <YAxis stroke="#66839e" fontSize={11} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="المداخيل"
                  stroke="#0555a8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="المصاريف"
                  stroke="#f5b41e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Cashflow Bar Chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#07152f]">النشاط الأسبوعي</h3>
              <p className="text-xs text-muted-foreground">صافي العمليات اليومية (ألف دج)</p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
              +14.2%
            </span>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#66839e" fontSize={10} tickLine={false} />
                <YAxis stroke="#66839e" fontSize={10} tickLine={false} />
                <Tooltip />
                <Bar dataKey="netIncome" name="الدخل" fill="#083c7a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="المصاريف" fill="#f5b41e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Latest Operations & Latest Field Expenses Section */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Latest Central Operations */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#07152f]">آخر العمليات المالية المسجلة</h3>
              <p className="text-xs text-muted-foreground">تحديث فوري من قاعدة البيانات</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("finance")}
              className="text-xs font-bold text-[#083c7a]"
            >
              عرض الكل <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2.5">
            {transactions.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold ${
                      t.type === "دخل"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {t.type === "دخل" ? "+" : "-"}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#07152f]">{t.party}</h5>
                    <p className="text-[11px] text-muted-foreground">{t.reason}</p>
                  </div>
                </div>
                <div className="text-left">
                  <strong className="block text-xs font-black text-[#07152f]">
                    {formatCurrency(t.amount)} دج
                  </strong>
                  <span className="text-[10px] text-muted-foreground">{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Expenses from Site Foreman App (Synced automatically!) */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#07152f]">آخر مصاريف تطبيق رئيس الأشغال 📱</h3>
              <p className="text-xs text-muted-foreground">متزامنة تلقائياً من الميدان</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("field")}
              className="text-xs font-bold text-[#083c7a]"
            >
              فتح البوابة <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2.5">
            {fieldExpenses.slice(0, 5).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-lg bg-amber-50/60 border border-amber-200/50"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-[#07152f] text-xs font-bold">
                    {f.category === "مازوت وقود" ? (
                      <Fuel className="h-4 w-4 text-[#f5b41e]" />
                    ) : (
                      <Wrench className="h-4 w-4 text-[#083c7a]" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#07152f]">
                      {f.category} {f.fuelLiters ? `(${f.fuelLiters} لتر)` : ""}
                    </h5>
                    <p className="text-[11px] text-slate-600">
                      {f.details} • {f.siteName}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <strong className="block text-xs font-black text-[#07152f]">
                    {formatCurrency(f.amount)} دج
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-bold">✓ متزامن</span>
                </div>
              </div>
            ))}
            {fieldExpenses.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                لم يتم تسجيل مصاريف ميدانية بعد من تطبيق رئيس الأشغال.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
