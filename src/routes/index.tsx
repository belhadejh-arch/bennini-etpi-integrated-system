import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ComponentType } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import {
  Bell, Box, Building2, CalendarDays, Camera, ChevronLeft, CircleDollarSign,
  ClipboardCheck, FileText, HardHat, LayoutDashboard, Menu, Package, Plus,
  Search, Send, Settings, TrendingUp, Truck, WalletCards, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logoAsset from "@/assets/bennini-etpi-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "لوحة الإدارة | BENNINI ETPI" },
    { name: "description", content: "النظام المتكامل لإدارة الأشغال والمالية والمخزون والكراء في BENNINI ETPI." },
    { property: "og:title", content: "لوحة إدارة BENNINI ETPI" },
    { property: "og:description", content: "منصة موحدة لإدارة العمليات المالية والميدانية للشركة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

type Section = "dashboard" | "finance" | "inventory" | "cheques" | "rentals" | "field";
type IconType = ComponentType<{ className?: string }>;

const navigation: Array<{ id: Section; label: string; icon: IconType }> = [
  { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { id: "finance", label: "التسيير المالي", icon: WalletCards },
  { id: "inventory", label: "المشتريات والمخزون", icon: Package },
  { id: "cheques", label: "إدارة الشيكات", icon: FileText },
  { id: "rentals", label: "الكراء والآليات", icon: Truck },
  { id: "field", label: "البوابة الميدانية", icon: HardHat },
];

const cashflow = [
  { month: "ماي", income: 2100, expense: 1450 }, { month: "جوان", income: 2900, expense: 1700 },
  { month: "جويلية", income: 2550, expense: 1900 }, { month: "أوت", income: 3600, expense: 2250 },
  { month: "سبتمبر", income: 4100, expense: 2380 }, { month: "أكتوبر", income: 4750, expense: 2600 },
];

const financeRows = [
  ["دخل", "2,400,000 دج", "مشروع تهيئة الطريق الولائي", "دفعة الأشغال رقم 03", "03 أكتوبر 2026", "تحويل", "12,840,000 دج"],
  ["خرج", "385,000 دج", "SARL Atlas Matériaux", "اقتناء إسمنت وحديد", "02 أكتوبر 2026", "شيك", "10,440,000 دج"],
  ["خرج", "128,500 دج", "طاقم ورشة البليدة", "أجور أسبوعية", "30 سبتمبر 2026", "نقداً", "10,825,000 دج"],
];
const inventoryRows = [
  ["إسمنت CPJ 42.5", "100 كيس", "500 دج", "50,000 دج", "مؤسسة الأطلس", "70,000 دج", "20,000 دج", "18", "منخفض"],
  ["حديد 12 مم", "240 قضيب", "1,850 دج", "444,000 دج", "حديد الجزائر", "540,000 دج", "96,000 دج", "164", "متوفر"],
  ["أنبوب PVC 110", "75 وحدة", "1,200 دج", "90,000 دج", "بلاست الأنابيب", "120,000 دج", "30,000 دج", "11", "منخفض"],
];
const chequeRows = [
  ["CH-00984", "FAC-2026-184", "385,000 دج", "SARL Atlas Matériaux", "BNA", "12 أكتوبر 2026", "قيد الانتظار"],
  ["CH-00979", "FAC-2026-179", "720,000 دج", "EURL Béton Plus", "CPA", "06 أكتوبر 2026", "قيد الانتظار"],
  ["CH-00961", "FAC-2026-161", "215,000 دج", "Location BTP", "BADR", "28 سبتمبر 2026", "مدفوع"],
];
const rentalRows = [
  ["حفارة Caterpillar 320", "SARL Travaux Centre", "01 أكتوبر", "31 أكتوبر", "30 يوماً", "42,000 دج / يوم", "1,260,000 دج", "نشط"],
  ["رافعة 25 طن", "ورشة مشروع البليدة", "20 سبتمبر", "20 أكتوبر", "شهر", "650,000 دج / شهر", "650,000 دج", "ينتهي قريباً"],
  ["شاحنة نقل 12 طن", "مؤسسة بن صالح", "15 سبتمبر", "15 نوفمبر", "شهران", "380,000 دج / شهر", "760,000 دج", "نشط"],
];

function Index() {
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebar, setSidebar] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState("");
  const title = navigation.find((item) => item.id === section)?.label ?? "لوحة التحكم";

  const navigate = (id: Section) => { setSection(id); setSidebar(false); setSearch(""); };

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      {sidebar && <button aria-label="إغلاق القائمة" className="fixed inset-0 z-40 bg-overlay lg:hidden" onClick={() => setSidebar(false)} />}
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-sidebar transition-transform duration-300 lg:translate-x-0 ${sidebar ? "translate-x-0" : "translate-x-full"}`}>
        <div className="relative flex h-36 items-center justify-center border-b border-sidebar-border px-6">
          <img src={logoAsset.url} alt="شعار BENNINI ETPI" className="h-24 w-auto object-contain" />
          <Button variant="ghost" size="icon" className="absolute left-3 top-3 text-sidebar-muted lg:hidden" onClick={() => setSidebar(false)} aria-label="إغلاق"><X /></Button>
        </div>
        <div className="px-5 pb-3 pt-7 text-xs font-semibold text-sidebar-muted">مساحة الإدارة</div>
        <nav className="flex-1 space-y-2 px-4">
          {navigation.map((item) => {
            const Icon = item.icon; const active = section === item.id;
            return <Button key={item.id} variant="ghost" onClick={() => navigate(item.id)} className={`h-12 w-full justify-start rounded-xl px-4 text-base ${active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-active hover:bg-sidebar-accent" : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"}`}>
              <Icon className="h-5 w-5" /><span>{item.label}</span>{active && <span className="mr-auto h-2 w-2 rounded-full bg-brand-yellow" />}
            </Button>;
          })}
        </nav>
        <div className="m-4 rounded-xl border border-sidebar-border bg-sidebar-panel p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Building2 className="text-brand-yellow" /> مشروع الطريق الولائي</div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sidebar-border"><div className="h-full w-[68%] bg-brand-yellow" /></div>
          <div className="mt-2 flex justify-between text-xs text-sidebar-muted"><span>التقدم الإجمالي</span><b className="text-sidebar-foreground">68%</b></div>
        </div>
      </aside>

      <main className="min-h-screen lg:mr-72">
        <header className="sticky top-0 z-30 grid h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-7">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebar(true)} aria-label="فتح القائمة"><Menu /></Button>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">الأحد، 04 أكتوبر 2026</p><h1 className="truncate text-xl font-bold sm:text-2xl">{title}</h1></div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" className="relative" aria-label="الإشعارات"><Bell /><span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-yellow text-[10px] font-bold text-brand-yellow-foreground">3</span></Button>
            <div className="hidden h-10 items-center gap-3 border-r border-border pr-3 sm:flex"><div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">م ب</div><div><b className="block text-sm">محمد بنيني</b><span className="text-xs text-muted-foreground">المدير العام</span></div></div>
          </div>
        </header>
        <div className="mx-auto max-w-[1600px] p-4 sm:p-7">
          {notice && <div className="mb-4 flex items-center justify-between rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-success"><span>{notice}</span><Button variant="ghost" size="icon" onClick={() => setNotice("")}><X /></Button></div>}
          {section === "dashboard" && <Dashboard onNavigate={navigate} />}
          {section !== "dashboard" && section !== "field" && <ModulePage section={section} search={search} setSearch={setSearch} onAdd={() => setModal(true)} />}
          {section === "field" && <FieldPortal onSubmit={() => setNotice("تم إرسال التقرير الميداني بنجاح إلى الإدارة.")} />}
        </div>
      </main>
      {modal && <QuickEntry title={title} onClose={() => setModal(false)} onSave={() => { setModal(false); setNotice(`تمت إضافة سجل جديد إلى ${title}.`); }} />}
    </div>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (id: Section) => void }) {
  const kpis = [
    { title: "الرصيد الصافي", value: "12.84 م دج", change: "+8.4%", icon: CircleDollarSign, tone: "bg-kpi-blue text-kpi-blue-foreground" },
    { title: "الربح المحقق", value: "3.26 م دج", change: "+12.1%", icon: TrendingUp, tone: "bg-kpi-green text-kpi-green-foreground" },
    { title: "شيكات معلّقة", value: "1.10 م دج", change: "شيكان قريبان", icon: FileText, tone: "bg-kpi-yellow text-kpi-yellow-foreground" },
    { title: "عقود كراء نشطة", value: "08", change: "عقد ينتهي قريباً", icon: Truck, tone: "bg-kpi-slate text-kpi-slate-foreground" },
  ];
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl bg-hero px-5 py-6 text-primary-foreground shadow-card sm:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0"><span className="inline-flex rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-yellow-foreground">ملخص اليوم</span><h2 className="mt-3 text-2xl font-bold sm:text-3xl">مرحباً، محمد</h2><p className="mt-2 max-w-2xl text-sm text-hero-muted sm:text-base">كل المؤشرات مستقرة. لديك شيكان قريبَا الاستحقاق وتنبيه مخزون واحد يحتاج المتابعة.</p></div>
        <div className="hidden h-28 w-44 items-center justify-center rounded-2xl border border-hero-border bg-hero-panel md:flex"><HardHat className="h-14 w-14 text-brand-yellow" /></div>
      </div>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(({ title, value, change, icon: Icon, tone }) => <article key={title} className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="flex items-start justify-between"><div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon /></div><span className="text-xs font-semibold text-muted-foreground">{change}</span></div><p className="mt-5 text-sm text-muted-foreground">{title}</p><strong className="mt-1 block text-2xl font-bold">{value}</strong></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
      <article className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="mb-6 flex items-center justify-between"><div><h3 className="font-bold">تحليل التدفقات المالية</h3><p className="text-xs text-muted-foreground">بالآلاف دج — آخر 6 أشهر</p></div><span className="rounded-lg bg-success-soft px-3 py-1 text-xs font-semibold text-success">+18.6%</span></div><div className="h-72" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cashflow}><defs><linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--chart-income)" stopOpacity={0.32}/><stop offset="95%" stopColor="var(--chart-income)" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}/><Tooltip/><Area type="monotone" dataKey="income" name="المداخيل" stroke="var(--chart-income)" strokeWidth={3} fill="url(#income)"/><Area type="monotone" dataKey="expense" name="المصاريف" stroke="var(--chart-expense)" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer></div></article>
      <article className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="mb-5 flex items-center justify-between"><h3 className="font-bold">تنبيهات اليوم</h3><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-yellow text-xs font-bold text-brand-yellow-foreground">3</span></div><div className="space-y-3"><Alert icon={Package} title="مخزون الإسمنت منخفض" text="تبقى 18 كيساً في مخزن البليدة"/><Alert icon={FileText} title="شيك يستحق خلال يومين" text="CH-00979 — بقيمة 720,000 دج"/><Alert icon={Truck} title="عقد كراء ينتهي قريباً" text="رافعة 25 طن — 20 أكتوبر"/></div><Button variant="outline" className="mt-5 w-full" onClick={() => onNavigate("cheques")}>عرض كل التنبيهات <ChevronLeft /></Button></article>
    </section>
    <section className="grid gap-5 lg:grid-cols-3"><Project name="تهيئة الطريق الولائي رقم 14" place="البليدة" progress={68}/><Project name="إنجاز شبكة الصرف الصحي" place="البويرة" progress={42}/><Project name="تهيئة المنطقة الصناعية" place="رويبة" progress={81}/></section>
  </div>;
}

function Alert({ icon: Icon, title, text }: { icon: IconType; title: string; text: string }) { return <div className="flex gap-3 rounded-xl bg-muted p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning-soft"><Icon className="h-5 w-5 text-warning"/></div><div className="min-w-0"><b className="block truncate text-sm">{title}</b><span className="text-xs text-muted-foreground">{text}</span></div></div>; }
function Project({ name, place, progress }: { name: string; place: string; progress: number }) { return <article className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft"><Building2 className="text-primary"/></div><span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">قيد الإنجاز</span></div><h3 className="mt-4 font-bold">{name}</h3><p className="text-sm text-muted-foreground">{place}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }}/></div><div className="mt-2 flex justify-between text-xs"><span className="text-muted-foreground">نسبة التقدم</span><b>{progress}%</b></div></article>; }

function ModulePage({ section, search, setSearch, onAdd }: { section: Exclude<Section,"dashboard"|"field">; search: string; setSearch: (v:string)=>void; onAdd:()=>void }) {
  const config = {
    finance: { description: "متابعة كل المداخيل والمصاريف وحركة الصندوق", headers: ["النوع","المبلغ","المصدر / المستفيد","السبب","التاريخ","الدفع","الرصيد"], rows: financeRows },
    inventory: { description: "متابعة المشتريات والكميات والأرباح المتوقعة", headers: ["السلعة","الكمية","سعر الشراء","التكلفة","المورد","قيمة البيع","الربح","المتبقي","الحالة"], rows: inventoryRows },
    cheques: { description: "تتبع الشيكات وتواريخ الاستحقاق والفواتير المرتبطة", headers: ["رقم الشيك","رقم الفاتورة","المبلغ","المستفيد","البنك","الاستحقاق","الحالة"], rows: chequeRows },
    rentals: { description: "إدارة عقود كراء الآليات والمدفوعات والمواعيد", headers: ["الآلية","المستأجر / المؤجر","البداية","النهاية","المدة","السعر","الإجمالي","الحالة"], rows: rentalRows },
  }[section];
  const filtered = useMemo(() => config.rows.filter(row => row.join(" ").toLowerCase().includes(search.toLowerCase())), [config.rows, search]);
  return <div className="space-y-5"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><div className="min-w-0"><h2 className="text-xl font-bold">{navigation.find(n=>n.id===section)?.label}</h2><p className="text-sm text-muted-foreground">{config.description}</p></div><Button className="h-11 bg-brand-yellow text-brand-yellow-foreground hover:bg-brand-yellow/90" onClick={onAdd}><Plus/> إضافة سجل</Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Summary label="إجمالي هذا الشهر" value={section === "finance" ? "4.75 م دج" : section === "inventory" ? "584,000 دج" : section === "cheques" ? "1.10 م دج" : "2.67 م دج"}/><Summary label="السجلات النشطة" value={section === "inventory" ? "24 مادة" : section === "cheques" ? "06 شيكات" : section === "rentals" ? "08 عقود" : "32 عملية"}/><Summary label="يتطلب المتابعة" value={section === "inventory" ? "مادتان" : section === "cheques" ? "شيكان" : section === "rentals" ? "عقد واحد" : "3 عمليات"}/></div>
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"><div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,380px)_auto] sm:justify-between"><div className="relative min-w-0"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder={section === "cheques" ? "ابحث برقم الشيك أو الفاتورة..." : "ابحث في السجلات..."} className="h-11 pr-10"/></div><Button variant="outline"><CalendarDays/> هذا الشهر</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-table-head text-table-head-foreground"><tr>{config.headers.map(h=><th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{filtered.map((row,i)=><tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50">{row.map((cell,j)=><td key={j} className="whitespace-nowrap px-4 py-4"><span className={j === row.length-1 ? statusClass(cell) : ""}>{cell}</span></td>)}</tr>)}</tbody></table></div>{filtered.length===0&&<div className="py-16 text-center text-muted-foreground">لا توجد نتائج مطابقة</div>}</article>
  </div>;
}
function statusClass(value:string) { return ["منخفض","قيد الانتظار","ينتهي قريباً"].includes(value) ? "rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning" : ["متوفر","مدفوع","نشط"].includes(value) ? "rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success" : "font-semibold"; }
function Summary({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-border bg-card p-5 shadow-card"><span className="text-sm text-muted-foreground">{label}</span><strong className="mt-2 block text-2xl">{value}</strong></div>; }

function FieldPortal({onSubmit}:{onSubmit:()=>void}) { const [photo,setPhoto]=useState(false); return <div className="mx-auto max-w-4xl"><div className="mb-6 rounded-2xl bg-hero p-6 text-primary-foreground shadow-card"><div className="flex items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-yellow text-brand-yellow-foreground"><HardHat/></div><div className="min-w-0"><p className="text-sm text-hero-muted">مساحة الفريق الميداني</p><h2 className="truncate text-2xl font-bold">ورشة الطريق الولائي رقم 14</h2><p className="text-sm text-hero-muted">البليدة • فريق أحمد قادري</p></div></div></div><div className="grid gap-5 md:grid-cols-[1fr_0.8fr]"><article className="rounded-2xl border border-border bg-card p-5 shadow-card"><h3 className="mb-5 text-lg font-bold">إرسال تقرير اليوم</h3><label className="mb-2 block text-sm font-semibold">نسبة تقدم الأشغال</label><div className="mb-5 grid grid-cols-4 gap-2">{[25,50,75,100].map(v=><Button key={v} variant={v===75?"default":"outline"}>{v}%</Button>)}</div><label className="mb-2 block text-sm font-semibold">الملاحظات الميدانية</label><textarea className="min-h-28 w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="اكتب تفاصيل الأشغال، الاحتياجات أو العراقيل..."/><button onClick={()=>setPhoto(!photo)} className={`mt-4 flex h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${photo?"border-success bg-success-soft text-success":"border-border bg-muted text-muted-foreground hover:border-primary"}`}><Camera className="mb-2"/><span className="text-sm font-semibold">{photo?"تم إرفاق صورة الموقع":"إرفاق صور الموقع"}</span></button><Button onClick={onSubmit} className="mt-5 h-12 w-full bg-brand-yellow text-brand-yellow-foreground hover:bg-brand-yellow/90"><Send/> إرسال التقرير</Button></article><div className="space-y-5"><article className="rounded-2xl border border-border bg-card p-5 shadow-card"><h3 className="mb-4 font-bold">مهام اليوم</h3><Task done text="فحص طبقة الأساس"/><Task done text="تسوية الجهة الشرقية"/><Task text="توثيق الكميات المنجزة"/><Task text="إرسال طلب المواد"/></article><article className="rounded-2xl border border-border bg-card p-5 shadow-card"><h3 className="mb-3 font-bold">ظروف الموقع</h3><div className="flex items-end justify-between"><div><strong className="text-3xl">24°</strong><p className="text-sm text-muted-foreground">مشمس، رياح خفيفة</p></div><span className="text-4xl">☀️</span></div></article></div></div></div>; }
function Task({text,done=false}:{text:string;done?:boolean}) { return <div className="flex items-center gap-3 border-b border-border py-3 last:border-0"><span className={`grid h-6 w-6 place-items-center rounded-md border ${done?"border-success bg-success text-success-foreground":"border-border"}`}>{done&&<ClipboardCheck className="h-4 w-4"/>}</span><span className={`text-sm ${done?"text-muted-foreground line-through":"font-medium"}`}>{text}</span></div>; }

function QuickEntry({title,onClose,onSave}:{title:string;onClose:()=>void;onSave:()=>void}) { return <div className="fixed inset-0 z-[60] grid place-items-center bg-overlay p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label={`إضافة سجل إلى ${title}`} className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-modal" onMouseDown={e=>e.stopPropagation()}><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div><h2 className="text-xl font-bold">إضافة سجل جديد</h2><p className="text-sm text-muted-foreground">{title}</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق"><X/></Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="البيان الرئيسي" placeholder="أدخل الاسم أو الرقم"/><Field label="المبلغ / القيمة" placeholder="0.00 دج"/><Field label="الجهة أو المورد" placeholder="اسم الجهة"/><Field label="التاريخ" type="date"/><div className="sm:col-span-2"><Field label="ملاحظات" placeholder="تفاصيل إضافية..."/></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={onSave} className="bg-brand-yellow text-brand-yellow-foreground hover:bg-brand-yellow/90">حفظ السجل</Button></div></div></div>; }
function Field({label,placeholder="",type="text"}:{label:string;placeholder?:string;type?:string}) { return <label className="block text-sm font-semibold">{label}<Input type={type} placeholder={placeholder} className="mt-2 h-11 font-normal"/></label>; }