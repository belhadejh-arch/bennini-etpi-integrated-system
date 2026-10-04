import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  LayoutDashboard,
  WalletCards,
  Package,
  FileText,
  Truck,
  HardHat,
  Wrench,
  Users,
  History,
  Menu,
  X,
  Bell,
  Search,
  Building2,
  Smartphone,
  LogOut,
  LogIn,
  CheckCircle2,
  ChevronDown,
  User,
  Shield,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BenniniLogo } from "@/components/BenniniLogo";
import { DashboardModule } from "@/components/dashboard/DashboardModule";
import { FinanceModule } from "@/components/modules/FinanceModule";
import { InventoryModule } from "@/components/modules/InventoryModule";
import { ChequeModule } from "@/components/modules/ChequeModule";
import { RentalModule } from "@/components/modules/RentalModule";
import { MachineryModule } from "@/components/modules/MachineryModule";
import { UsersPermissionsModule } from "@/components/modules/UsersPermissionsModule";
import { AuditLogModule } from "@/components/modules/AuditLogModule";
import { FieldMobilePortal } from "@/components/modules/FieldMobilePortal";
import { IndependentLoginPortal } from "@/components/modules/IndependentLoginPortal";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BENNINI ETPI | النظام المتكامل لإدارة الأشغال العمومية والصناعية" },
      {
        name: "description",
        content:
          "المنصة الشاملة لإدارة العمليات المالية، المشتريات، المخزون، الشيكات، الكراء، الآليات، والبوابة الميدانية لشركة BENNINI ETPI.",
      },
      { property: "og:title", content: "BENNINI ETPI - النظام المتكامل" },
      {
        property: "og:description",
        content: "إدارة موحدة للأشغال والعمليات المالية والميدانية للشركة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

export type Section =
  | "dashboard"
  | "finance"
  | "inventory"
  | "cheques"
  | "rentals"
  | "machinery"
  | "field"
  | "users"
  | "audit"
  | "portal";

function IndexPage() {
  const { currentUser, profile, logout, signInWithGoogle, hasPermission } = useAuth();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // If user wants to view the independent worker portal exclusively
  const [showIndependentLogin, setShowIndependentLogin] = useState(false);

  const isMainAdmin =
    profile?.role.includes("المدير") || profile?.email === "mohamedharoun329@gmail.com";

  // Sidebar items filtered strictly by RBAC permissions
  const visibleNavItems = useMemo(() => {
    const items = [
      { id: "dashboard" as const, label: "الرئيسية", icon: LayoutDashboard, allow: true },
      {
        id: "finance" as const,
        label: "التسيير المالي 💰",
        icon: WalletCards,
        allow: isMainAdmin || hasPermission("canViewFinance"),
      },
      {
        id: "inventory" as const,
        label: "المشتريات والمخزون 📦",
        icon: Package,
        allow: isMainAdmin || hasPermission("canViewInventory"),
      },
      {
        id: "cheques" as const,
        label: "إدارة الشيكات 🧾",
        icon: FileText,
        allow: isMainAdmin || hasPermission("canViewCheques"),
      },
      {
        id: "rentals" as const,
        label: "الكراء والمعدات 🏗️",
        icon: Truck,
        allow: isMainAdmin || hasPermission("canViewRentals"),
      },
      {
        id: "machinery" as const,
        label: "المركبات والآليات وقطع الغيار 🚜",
        icon: Wrench,
        allow: isMainAdmin || hasPermission("canViewMachinery"),
      },
      {
        id: "field" as const,
        label: "تطبيق رئيس الأشغال 📱",
        icon: HardHat,
        allow: isMainAdmin || hasPermission("canViewFieldPortal"),
      },
      {
        id: "users" as const,
        label: "المستخدمون والصلاحيات 👥",
        icon: Users,
        allow: isMainAdmin || hasPermission("canManageUsers"),
      },
      {
        id: "audit" as const,
        label: "سجل العمليات Audit Log 📜",
        icon: History,
        allow: isMainAdmin,
      },
    ];

    return items.filter((item) => item.allow);
  }, [isMainAdmin, hasPermission]);

  const handleNavigate = (newSection: string) => {
    setSection(newSection as Section);
    setSidebarOpen(false);
  };

  const showToast = (message: string) => {
    setNotice(message);
    setTimeout(() => {
      setNotice(null);
    }, 4500);
  };

  if (showIndependentLogin) {
    return (
      <IndependentLoginPortal
        onSuccessLogin={() => {
          setShowIndependentLogin(false);
          setSection("dashboard");
        }}
      />
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8fafc] font-sans text-[#07152f]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <button
          aria-label="إغلاق القائمة"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Dark Navy Core: #07152f with exact specifications) */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-[#07152f] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header Logo */}
        <div className="relative flex h-32 items-center justify-between border-b border-[#13274c] px-6">
          <BenniniLogo size="lg" variant="light" />
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation label */}
        <div className="px-6 pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#7fa9c7] flex justify-between items-center">
          <span>أقسام المنظومة</span>
          <span className="text-[10px] bg-[#13274c] px-2 py-0.5 rounded text-white font-mono">
            {profile?.role || "مستخدم"}
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto max-h-[calc(100vh-250px)]">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-[#0555a8] text-white shadow-lg"
                    : "text-[#7fa9c7] hover:bg-[#0c2044] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-[#f5b41e]" : "text-[#7fa9c7]"}`} />
                <span className="truncate">{item.label}</span>
                {active && <span className="mr-auto h-2 w-2 rounded-full bg-[#f5b41e] shadow-sm" />}
              </button>
            );
          })}
        </nav>

        {/* Independent Portal Link in Sidebar */}
        <div className="p-3 border-t border-[#13274c]">
          <button
            onClick={() => setShowIndependentLogin(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0a1b3a] hover:bg-[#13274c] border border-[#13274c] py-2.5 text-xs text-[#7fa9c7] hover:text-white font-bold transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#f5b41e]" />
            بوابة دخول العمال المستقلة
          </button>
        </div>

        {/* Active Project Highlight in Sidebar Footer */}
        <div className="m-3 rounded-xl border border-[#13274c] bg-[#0a1b3a] p-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-white mb-1.5">
            <Building2 className="h-4 w-4 text-[#f5b41e]" /> ورشة الطريق الولائي رقم 14
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#13274c]">
            <div className="h-full w-[68%] rounded-full bg-[#f5b41e]" />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[#7fa9c7]">
            <span>تقدم الإنجاز الميداني</span>
            <span className="font-extrabold text-white">68%</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-h-screen lg:mr-72 flex flex-col">
        {/* Main Header with Logo & Controls */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <BenniniLogo size="sm" variant="colored" showText={false} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-[#07152f]">
                  BENNINI ETPI • النظام المتكامل
                </h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  مؤسسة عتاد الأشغال العمومية والصناعية • الأحد، 04 أكتوبر 2026
                </p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Quick Mobile Field Toggle */}
            <Button
              variant={section === "field" ? "default" : "outline"}
              size="sm"
              onClick={() => setSection(section === "field" ? "dashboard" : "field")}
              className={`text-xs font-bold gap-1.5 ${
                section === "field"
                  ? "bg-[#f5b41e] text-[#07152f] hover:bg-[#e4a515]"
                  : "border-[#083c7a] text-[#083c7a]"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {section === "field" ? "لوحة الإدارة" : "تطبيق رئيس الأشغال 📱"}
              </span>
            </Button>

            {/* Notification Bell with Popup */}
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="h-9 w-9 relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#f5b41e] text-[9px] font-black text-[#07152f]">
                  3
                </span>
              </Button>

              {notificationsOpen && (
                <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white p-4 shadow-2xl border border-border z-50 text-right">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h4 className="font-bold text-xs text-[#07152f]">تنبيهات المنظومة العاجلة</h4>
                    <span className="text-[10px] text-muted-foreground">3 غير مقروءة</span>
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    <div
                      onClick={() => {
                        setSection("cheques");
                        setNotificationsOpen(false);
                      }}
                      className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100"
                    >
                      <strong className="block text-amber-900 font-bold">
                        استحقاق شيك CH-00979
                      </strong>
                      <span className="text-amber-800 text-[11px]">
                        مبلغ 720,000 دج يستحق الصرف خلال يومين.
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        setSection("inventory");
                        setNotificationsOpen(false);
                      }}
                      className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100"
                    >
                      <strong className="block text-blue-900 font-bold">مخزون الإسمنت منخفض</strong>
                      <span className="text-blue-800 text-[11px]">
                        تبقى 18 كيس فقط في مستودع البليدة.
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        setSection("rentals");
                        setNotificationsOpen(false);
                      }}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100"
                    >
                      <strong className="block text-slate-800 font-bold">
                        عقد كراء رافعة 25 طن
                      </strong>
                      <span className="text-slate-600 text-[11px]">
                        ينتهي العقد بتاريخ 20 أكتوبر 2026.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Card / Switcher */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 border-r border-border pr-2.5 text-right hover:opacity-85 transition-opacity"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#083c7a] font-bold text-white text-xs shadow-sm">
                  {profile?.name ? profile.name.slice(0, 2) : "م ب"}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-extrabold text-[#07152f]">
                    {profile?.name || "محمد بنيني"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {profile?.role || "المدير العام"}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white p-3 shadow-2xl border border-border z-50 text-right space-y-1 text-xs font-bold">
                  <div className="p-2 border-b border-border">
                    <p className="text-[11px] text-muted-foreground">مسجل الدخول كـ:</p>
                    <p className="text-xs text-[#07152f] truncate font-extrabold">
                      {currentUser?.email || "المدير العام"}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSection("field");
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-slate-700"
                  >
                    <Smartphone className="h-4 w-4 text-[#083c7a]" /> تطبيق رئيس الأشغال
                  </button>

                  <button
                    onClick={() => {
                      setShowIndependentLogin(true);
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-slate-700"
                  >
                    <ExternalLink className="h-4 w-4 text-[#f5b41e]" /> بوابة دخول العمال
                  </button>

                  {isMainAdmin && (
                    <button
                      onClick={() => {
                        setSection("users");
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-slate-700"
                    >
                      <Shield className="h-4 w-4 text-[#0555a8]" /> إدارة الصلاحيات
                    </button>
                  )}

                  <button
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-rose-50 text-rose-600 border-t border-border mt-1"
                  >
                    <LogOut className="h-4 w-4" /> تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Global Toast */}
        {notice && (
          <div className="m-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-xs font-bold text-emerald-900 shadow-md">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {notice}
            </span>
            <button
              onClick={() => setNotice(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dynamic Section Rendering */}
        <div className="flex-1 p-4 sm:p-7 max-w-[1600px] w-full mx-auto">
          {section === "dashboard" && (
            <DashboardModule
              onNavigate={handleNavigate}
              onOpenQuickEntry={() => handleNavigate("finance")}
            />
          )}

          {section === "finance" && <FinanceModule />}

          {section === "inventory" && <InventoryModule />}

          {section === "cheques" && <ChequeModule />}

          {section === "rentals" && <RentalModule />}

          {section === "machinery" && <MachineryModule />}

          {section === "field" && (
            <div className="py-2">
              <div className="text-center mb-5">
                <h3 className="text-xl font-bold text-[#07152f]">تطبيق رئيس الأشغال الميداني 📱</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  تسجيل المصاريف، المازوت، قطع الغيار، ورفع الوصولات مع مزامنة فورية في قاعدة
                  البيانات المركزية.
                </p>
              </div>
              <FieldMobilePortal />
            </div>
          )}

          {section === "users" && <UsersPermissionsModule />}

          {section === "audit" && <AuditLogModule />}
        </div>

        {/* Global Footer */}
        <footer className="mt-auto border-t border-border bg-white px-6 py-4 text-center text-xs text-muted-foreground">
          BENNINI ETPI — جميع الحقوق محفوظة © 2026 • مؤسسة عتاد الأشغال العمومية والصناعية
        </footer>
      </main>
    </div>
  );
}
