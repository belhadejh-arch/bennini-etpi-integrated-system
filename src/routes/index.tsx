import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
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
  Briefcase,
  AlertCircle,
  ExternalLink,
  Link2,
  Copy,
  Check,
  Sparkles,
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
import { DedicatedPortalsHubModal } from "@/components/modules/DedicatedPortalsHubModal";
import { useAuth, type PortalType, type AccountCategory } from "@/context/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BENNINI ETPI | النظام المتكامل لإدارة الأشغال العمومية والصناعية" },
      {
        name: "description",
        content:
          "المنصة الشاملة لإدارة العمليات المالية، المشتريات، المخزون، الشيكات، الكراء، الآليات، والبوابة الميدانية لشركة BENNINI ETPI مع روابط مخصصة للمدير والموظفين والعمال.",
      },
      { property: "og:title", content: "BENNINI ETPI - النظام المتكامل" },
      {
        property: "og:description",
        content: "إدارة موحدة للأشغال والعمليات المالية والميدانية للشركة مع روابط وصول مستقلة.",
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
  const {
    currentUser,
    profile,
    logout,
    hasPermission,
    currentPortal,
    switchPortal,
    getPortalUrl,
    loginAsRole,
  } = useAuth();

  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLinksModalOpen, setIsLinksModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // If user wants to view the login portal explicitly
  const [showIndependentLogin, setShowIndependentLogin] = useState(false);

  // Automatically adjust view based on active portal
  useEffect(() => {
    if (currentPortal === "field") {
      setSection("field");
    } else if (currentPortal === "staff") {
      setSection((prev) =>
        prev === "finance" || prev === "users" || prev === "audit" ? "inventory" : prev,
      );
    }
  }, [currentPortal]);

  const isMainAdmin =
    profile?.accountCategory === "manager" ||
    profile?.role.includes("المدير") ||
    profile?.email === "mohamedharoun329@gmail.com";

  const isStaff = profile?.accountCategory === "staff";
  const isWorker = profile?.accountCategory === "worker";

  // Sidebar items filtered strictly by RBAC permissions and portal
  const visibleNavItems = useMemo(() => {
    const items = [
      {
        id: "dashboard" as const,
        label: "الرئيسية",
        icon: LayoutDashboard,
        allow: !isWorker, // workers have field portal as primary
      },
      {
        id: "finance" as const,
        label: "التسيير المالي 💰",
        icon: WalletCards,
        allow: isMainAdmin || (!isWorker && hasPermission("canViewFinance")),
      },
      {
        id: "inventory" as const,
        label: "المشتريات والمخزون 📦",
        icon: Package,
        allow: !isWorker && (isMainAdmin || hasPermission("canViewInventory")),
      },
      {
        id: "cheques" as const,
        label: "إدارة الشيكات 🧾",
        icon: FileText,
        allow: !isWorker && (isMainAdmin || hasPermission("canViewCheques")),
      },
      {
        id: "rentals" as const,
        label: "الكراء والمعدات 🏗️",
        icon: Truck,
        allow: !isWorker && (isMainAdmin || hasPermission("canViewRentals")),
      },
      {
        id: "machinery" as const,
        label: "المركبات والآليات وقطع الغيار 🚜",
        icon: Wrench,
        allow: !isWorker && (isMainAdmin || hasPermission("canViewMachinery")),
      },
      {
        id: "field" as const,
        label: "تطبيق رئيس الأشغال 📱",
        icon: HardHat,
        allow: true,
      },
      {
        id: "users" as const,
        label: "المستخدمون والصلاحيات 👥",
        icon: Users,
        allow: isMainAdmin,
      },
      {
        id: "audit" as const,
        label: "سجل العمليات Audit Log 📜",
        icon: History,
        allow: isMainAdmin,
      },
    ];

    return items.filter((item) => item.allow);
  }, [isMainAdmin, isWorker, hasPermission]);

  const handleNavigate = (newSection: string) => {
    // Guard against worker accessing executive sections
    if (isWorker && newSection !== "field") {
      showToast(
        "عذراً، هذا القسم إداري ومتاح فقط للمدير العام والموظفين. حسابك مخصص للورشة الميدانية.",
      );
      return;
    }
    setSection(newSection as Section);
    setSidebarOpen(false);
  };

  const showToast = (message: string) => {
    setNotice(message);
    setTimeout(() => {
      setNotice(null);
    }, 4500);
  };

  const handleCopyLink = (portalKey: PortalType, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(portalKey);
    showToast(
      `✓ تم نسخ ${portalKey === "manager" ? "رابط المدير" : portalKey === "staff" ? "رابط الموظفين" : "رابط العمال"} بنجاح!`,
    );
    setTimeout(() => setCopiedLink(null), 3000);
  };

  if (showIndependentLogin) {
    return (
      <IndependentLoginPortal
        onSuccessLogin={() => {
          setShowIndependentLogin(false);
          setSection(currentPortal === "field" ? "field" : "dashboard");
        }}
      />
    );
  }

  const managerUrl = getPortalUrl ? getPortalUrl("manager") : "/?portal=manager";
  const staffUrl = getPortalUrl ? getPortalUrl("staff") : "/?portal=staff";
  const fieldUrl = getPortalUrl ? getPortalUrl("field") : "/?portal=field";

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8fafc] font-sans text-[#07152f]">
      {/* Top Banner: Dedicated Portals & Role Links */}
      <div className="bg-[#07152f] text-white border-b border-[#13274c] px-4 py-2.5 sm:px-6 shadow-md">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs">
          {/* Active Portal Indicator */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#7fa9c7] font-bold">بوابة الدخول الحالية:</span>
            <span
              className={`px-3 py-1 rounded-full font-black text-xs flex items-center gap-1.5 shadow-sm ${
                currentPortal === "manager"
                  ? "bg-[#f5b41e] text-[#07152f]"
                  : currentPortal === "staff"
                    ? "bg-[#0555a8] text-white"
                    : "bg-emerald-600 text-white"
              }`}
            >
              {currentPortal === "manager" && <Shield className="h-3.5 w-3.5" />}
              {currentPortal === "staff" && <Briefcase className="h-3.5 w-3.5" />}
              {currentPortal === "field" && <HardHat className="h-3.5 w-3.5" />}
              {currentPortal === "manager"
                ? "👑 بوابة المدير العام (تحكم كامل)"
                : currentPortal === "staff"
                  ? "💼 بوابة الموظفين والمستخدمين"
                  : "📱 بوابة وتطبيق رئيس الأشغال والعمال"}
            </span>

            {/* Quick Portal Switch buttons */}
            <div className="hidden sm:flex items-center gap-1 mr-2 border-r border-[#13274c] pr-2">
              <button
                onClick={() => {
                  switchPortal("manager");
                  setSection("dashboard");
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                  currentPortal === "manager"
                    ? "bg-white/20 text-[#f5b41e]"
                    : "text-[#7fa9c7] hover:text-white"
                }`}
              >
                المدير
              </button>
              <button
                onClick={() => {
                  switchPortal("staff");
                  setSection("inventory");
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                  currentPortal === "staff"
                    ? "bg-white/20 text-white"
                    : "text-[#7fa9c7] hover:text-white"
                }`}
              >
                الموظفون
              </button>
              <button
                onClick={() => {
                  switchPortal("field");
                  setSection("field");
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                  currentPortal === "field"
                    ? "bg-white/20 text-[#f5b41e]"
                    : "text-[#7fa9c7] hover:text-white"
                }`}
              >
                العمال
              </button>
            </div>
          </div>

          {/* Quick Copy Dedicated Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#7fa9c7] text-[11px] hidden lg:inline">نسخ الرابط المخصص:</span>
            <button
              onClick={() => handleCopyLink("manager", managerUrl)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0a1f44] hover:bg-[#132d5c] border border-[#132d5c] text-[11px] font-bold text-amber-300 hover:text-amber-200 transition-colors"
              title="نسخ رابط المدير العام"
            >
              {copiedLink === "manager" ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              رابط المدير
            </button>

            <button
              onClick={() => handleCopyLink("staff", staffUrl)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0a1f44] hover:bg-[#132d5c] border border-[#132d5c] text-[11px] font-bold text-blue-300 hover:text-blue-200 transition-colors"
              title="نسخ رابط الموظفين"
            >
              {copiedLink === "staff" ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              رابط الموظفين
            </button>

            <button
              onClick={() => handleCopyLink("field", fieldUrl)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0a1f44] hover:bg-[#132d5c] border border-[#132d5c] text-[11px] font-bold text-emerald-300 hover:text-emerald-200 transition-colors"
              title="نسخ رابط العمال ورئيس الأشغال"
            >
              {copiedLink === "field" ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              رابط العمال 📱
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsLinksModalOpen(true)}
              className="h-7 px-3 text-[11px] font-bold border-[#f5b41e] text-[#f5b41e] hover:bg-[#f5b41e] hover:text-[#07152f]"
            >
              <Link2 className="h-3.5 w-3.5 ml-1" />
              كل الروابط والصلاحيات
            </Button>
          </div>
        </div>
      </div>

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

        {/* Navigation label with Role Badge */}
        <div className="px-6 pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#7fa9c7] flex justify-between items-center">
          <span>أقسام المنظومة</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
              isMainAdmin
                ? "bg-[#f5b41e] text-[#07152f]"
                : isStaff
                  ? "bg-[#0555a8] text-white"
                  : "bg-emerald-600 text-white"
            }`}
          >
            {profile?.role || "مستخدم"}
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto max-h-[calc(100vh-270px)]">
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

        {/* Portals Hub in Sidebar */}
        <div className="p-3 border-t border-[#13274c] space-y-1.5">
          <button
            onClick={() => setIsLinksModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0a1b3a] hover:bg-[#13274c] border border-[#13274c] py-2 text-xs text-[#f5b41e] font-bold transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" />
            روابط الدخول المستقلة للمنظومة
          </button>

          <button
            onClick={() => setShowIndependentLogin(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#083c7a]/40 hover:bg-[#083c7a] border border-[#13274c] py-2 text-xs text-white font-bold transition-colors"
          >
            <LogIn className="h-3.5 w-3.5 text-[#f5b41e]" />
            بوابة تسجيل الدخول المخصصة
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
                <h1 className="text-base sm:text-lg font-black text-[#07152f] flex items-center gap-2">
                  BENNINI ETPI • النظام المتكامل
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isMainAdmin
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : isStaff
                          ? "bg-blue-100 text-blue-900 border border-blue-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    }`}
                  >
                    {isMainAdmin ? "الإدارة العليا" : isStaff ? "الموظفون" : "الميدان والورشة"}
                  </span>
                </h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  مؤسسة عتاد الأشغال العمومية والصناعية • الأحد، 04 أكتوبر 2026
                </p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Quick Switch to Field Application */}
            <Button
              variant={section === "field" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (section === "field") {
                  setSection(isWorker ? "field" : "dashboard");
                } else {
                  setSection("field");
                }
              }}
              className={`text-xs font-bold gap-1.5 ${
                section === "field"
                  ? "bg-[#f5b41e] text-[#07152f] hover:bg-[#e4a515]"
                  : "border-[#083c7a] text-[#083c7a]"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {section === "field"
                  ? isWorker
                    ? "تطبيق الورشة"
                    : "لوحة الإدارة"
                  : "تطبيق رئيس الأشغال 📱"}
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
                <div
                  className={`grid h-9 w-9 place-items-center rounded-full font-bold text-white text-xs shadow-sm ${
                    isMainAdmin ? "bg-[#083c7a]" : isStaff ? "bg-[#0555a8]" : "bg-emerald-700"
                  }`}
                >
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
                <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white p-3 shadow-2xl border border-border z-50 text-right space-y-1.5 text-xs font-bold">
                  <div className="p-2 border-b border-border bg-slate-50 rounded-xl mb-1">
                    <p className="text-[10px] text-muted-foreground">الحساب المتصل حالياً:</p>
                    <p className="text-xs text-[#07152f] truncate font-extrabold">
                      {profile?.name}
                    </p>
                    <p className="text-[10px] text-[#083c7a] font-mono mt-0.5">{profile?.email}</p>
                  </div>

                  <div className="text-[10px] text-muted-foreground font-bold px-2 pt-1">
                    تبديل الحساب التجريبي:
                  </div>

                  <button
                    onClick={async () => {
                      await loginAsRole("manager");
                      setUserMenuOpen(false);
                      setSection("dashboard");
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs ${
                      isMainAdmin
                        ? "bg-amber-50 text-amber-900 font-black"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-[#f5b41e]" /> حساب المدير العام
                    </span>
                    {isMainAdmin && <span className="text-[10px]">✓ نشط</span>}
                  </button>

                  <button
                    onClick={async () => {
                      await loginAsRole("staff");
                      setUserMenuOpen(false);
                      setSection("inventory");
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs ${
                      isStaff
                        ? "bg-blue-50 text-blue-900 font-black"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-[#0555a8]" /> حساب موظف (محاسب/مخزن)
                    </span>
                    {isStaff && <span className="text-[10px]">✓ نشط</span>}
                  </button>

                  <button
                    onClick={async () => {
                      await loginAsRole("worker");
                      setUserMenuOpen(false);
                      setSection("field");
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs ${
                      isWorker
                        ? "bg-emerald-50 text-emerald-900 font-black"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <HardHat className="h-3.5 w-3.5 text-emerald-600" /> حساب رئيس أشغال (ميداني)
                    </span>
                    {isWorker && <span className="text-[10px]">✓ نشط</span>}
                  </button>

                  <div className="border-t border-border pt-1">
                    <button
                      onClick={() => {
                        setIsLinksModalOpen(true);
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[#083c7a]"
                    >
                      <Link2 className="h-3.5 w-3.5" /> عرض ونسخ الروابط المخصصة
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-rose-50 text-rose-600 mt-1"
                    >
                      <LogOut className="h-3.5 w-3.5" /> تسجيل الخروج
                    </button>
                  </div>
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

        {/* Worker Alert Barrier: If worker is on main page, show dedicated worker view */}
        {isWorker && section !== "field" && (
          <div className="m-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <span>
                أنت مسجل الدخول كـ <strong>{profile?.name} (رئيس أشغال)</strong>. الأقسام المالية
                والإدارية المركزية محجوبة، ويرجى استخدام تطبيق الورشة الميداني المخصص.
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setSection("field")}
              className="bg-[#083c7a] text-white hover:bg-[#05326f] text-xs font-bold"
            >
              فتح تطبيق الورشة 📱
            </Button>
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

          {section === "finance" &&
            (isMainAdmin || hasPermission("canViewFinance") ? (
              <FinanceModule />
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                <h4 className="font-bold text-base text-[#07152f]">
                  هذا القسم مخصص للإدارة والمدير العام
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  ليس لديك صلاحية عرض التسيير المالي والخزينة.
                </p>
              </div>
            ))}

          {section === "inventory" && <InventoryModule />}

          {section === "cheques" && <ChequeModule />}

          {section === "rentals" && <RentalModule />}

          {section === "machinery" && <MachineryModule />}

          {section === "field" && (
            <div className="py-2">
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs mb-2">
                  <HardHat className="h-3.5 w-3.5 text-emerald-700" />
                  رابط مخصص لرؤساء الأشغال والعمال:{" "}
                  <span className="font-mono text-[11px] underline">/?portal=field</span>
                </div>
                <h3 className="text-xl font-bold text-[#07152f]">تطبيق رئيس الأشغال الميداني 📱</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl mx-auto">
                  تسجيل المصاريف، المازوت والوقود، قطع الغيار المستعجلة، ورفع الوصولات مع المزامنة
                  الفورية في قاعدة البيانات المركزية لشركة BENNINI ETPI.
                </p>
              </div>
              <FieldMobilePortal />
            </div>
          )}

          {section === "users" &&
            (isMainAdmin ? (
              <UsersPermissionsModule />
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <Shield className="h-10 w-10 text-rose-500 mx-auto mb-2" />
                <h4 className="font-bold text-base text-[#07152f]">
                  الصلاحيات مخصصة للمدير العام فقط
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  لا يمكن للموظفين أو العمال إدارة الصلاحيات.
                </p>
              </div>
            ))}

          {section === "audit" &&
            (isMainAdmin ? (
              <AuditLogModule />
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <History className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                <h4 className="font-bold text-base text-[#07152f]">
                  سجل التدقيق متاح للمدير العام فقط
                </h4>
              </div>
            ))}
        </div>

        {/* Global Footer */}
        <footer className="mt-auto border-t border-border bg-white px-6 py-4 text-center text-xs text-muted-foreground">
          BENNINI ETPI — جميع الحقوق محفوظة © 2026 • مؤسسة عتاد الأشغال العمومية والصناعية
        </footer>
      </main>

      {/* Modal for viewing all dedicated links and their roles */}
      <DedicatedPortalsHubModal
        isOpen={isLinksModalOpen}
        onClose={() => setIsLinksModalOpen(false)}
      />
    </div>
  );
}
