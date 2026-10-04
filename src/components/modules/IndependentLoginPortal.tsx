import { useState } from "react";
import {
  Lock,
  LogIn,
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  Smartphone,
  Shield,
  Briefcase,
  HardHat,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BenniniLogo } from "@/components/BenniniLogo";
import {
  useAuth,
  type PortalType,
  type AccountCategory,
  PRESET_ACCOUNTS,
} from "@/context/AuthContext";
import { DedicatedPortalsHubModal } from "@/components/modules/DedicatedPortalsHubModal";

interface PortalProps {
  onSuccessLogin: () => void;
  initialPortal?: PortalType;
}

export function IndependentLoginPortal({ onSuccessLogin, initialPortal }: PortalProps) {
  const {
    currentUser,
    profile,
    signInWithGoogle,
    logout,
    currentPortal,
    switchPortal,
    getPortalUrl,
    loginAsRole,
  } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLinksModalOpen, setIsLinksModalOpen] = useState(false);

  const activePortal = initialPortal || currentPortal || "manager";

  const handleSignInGoogle = async () => {
    setLoggingIn(true);
    try {
      await signInWithGoogle();
      onSuccessLogin();
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleDirectRoleLogin = async (category: AccountCategory) => {
    setLoggingIn(true);
    try {
      await loginAsRole(category);
      onSuccessLogin();
    } finally {
      setLoggingIn(false);
    }
  };

  const portalDetails = {
    manager: {
      badge: "بوابة دخول الإدارة والمدير العام 👑",
      title: "دخول المدير العام",
      desc: "تحكم شامل في جميع العمليات المالية، الخزينة، الأرباح، الشيكات، إدارة الصلاحيات، وسجل العمليات الرقابي.",
      icon: Shield,
      accentColor: "border-[#f5b41e] bg-amber-500/10 text-[#f5b41e]",
      presetAccount: PRESET_ACCOUNTS.manager,
      category: "manager" as const,
    },
    staff: {
      badge: "بوابة دخول الموظفين والمستخدمين 💼",
      title: "دخول الموظفين والإداريين",
      desc: "خاص بالمحاسبين وأمناء المخازن ومسؤولي العتاد لإدارة المشتريات والمخزون وحركات السلع وفق الصلاحيات الممنوحة.",
      icon: Briefcase,
      accentColor: "border-[#7fa9c7] bg-blue-500/10 text-[#0555a8]",
      presetAccount: PRESET_ACCOUNTS.staff,
      category: "staff" as const,
    },
    field: {
      badge: "بوابة دخول رؤساء الأشغال والعمال 📱",
      title: "دخول رئيس الأشغال والورشات",
      desc: "واجهة سريعة للهاتف لتسجيل مصاريف المازوت والوقود، قطع الغيار، ومشتريات الورشة مع تصوير الفواتير ومتابعة المهام.",
      icon: HardHat,
      accentColor: "border-[#f5b41e] bg-[#f5b41e]/15 text-[#f5b41e]",
      presetAccount: PRESET_ACCOUNTS.worker,
      category: "worker" as const,
    },
  }[activePortal];

  const currentPortalUrl = getPortalUrl ? getPortalUrl(activePortal) : `/?portal=${activePortal}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentPortalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const Icon = portalDetails.icon;

  return (
    <div
      className="min-h-screen bg-[#07152f] flex flex-col justify-center items-center p-4 relative"
      dir="rtl"
    >
      {/* Background radial accent */}
      <div className="absolute h-96 w-96 rounded-full bg-[#083c7a]/40 blur-3xl pointer-events-none" />

      {/* Top Navigation Switcher for Portals */}
      <div className="relative z-10 w-full max-w-lg mb-4 flex items-center justify-between bg-[#0a1f44] border border-[#132d5c] p-2 rounded-2xl text-xs font-bold">
        <span className="text-slate-300 pr-2">اختر البوابة:</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => switchPortal("manager")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activePortal === "manager"
                ? "bg-[#f5b41e] text-[#07152f] shadow-sm font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            👑 المدير
          </button>
          <button
            onClick={() => switchPortal("staff")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activePortal === "staff"
                ? "bg-[#0555a8] text-white shadow-sm font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            💼 الموظفون
          </button>
          <button
            onClick={() => switchPortal("field")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activePortal === "field"
                ? "bg-[#f5b41e] text-[#07152f] shadow-sm font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📱 العمال
          </button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsLinksModalOpen(true)}
          className="text-xs text-[#f5b41e] hover:bg-[#132d5c] h-8 px-2"
        >
          كل الروابط 🔗
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl text-center border border-slate-200">
        {/* Header Logo */}
        <div className="flex justify-center mb-5">
          <BenniniLogo size="lg" variant="colored" />
        </div>

        {/* Portal Badge */}
        <div className="flex justify-center mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3.5 py-1 text-xs font-black text-[#083c7a]">
            <Icon className="h-3.5 w-3.5 text-[#f5b41e]" />
            {portalDetails.badge}
          </span>
        </div>

        <h2 className="text-2xl font-black text-[#07152f]">{portalDetails.title}</h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed px-2">
          {portalDetails.desc}
        </p>

        {/* Dedicated URL box */}
        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-right">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
            <span>الرابط المخصص لهذه البوابة:</span>
            <button
              onClick={handleCopyLink}
              className="text-[#083c7a] hover:underline flex items-center gap-1 font-bold text-[10px]"
            >
              {copied ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> تم النسخ
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy className="h-3 w-3" /> نسخ الرابط
                </span>
              )}
            </button>
          </div>
          <div
            suppressHydrationWarning
            className="text-[10px] font-mono text-slate-600 truncate dir-ltr select-all bg-white px-2 py-1 rounded border border-slate-200"
          >
            {currentPortalUrl}
          </div>
        </div>

        {/* If user is already authenticated */}
        {profile ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-right space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#083c7a] text-white font-bold text-base shadow-sm">
                {profile.name?.slice(0, 2) || "م"}
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#07152f]">{profile.name}</h4>
                <p className="text-xs text-muted-foreground font-mono">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block text-[10px] font-bold text-[#083c7a] bg-blue-100 rounded px-2 py-0.5">
                    الدور: {profile.role}
                  </span>
                  <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-100 rounded px-2 py-0.5">
                    ✓ متصل
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
              <Button
                onClick={onSuccessLogin}
                className="w-full bg-[#083c7a] hover:bg-[#05326f] text-white font-bold h-11 shadow-sm gap-2"
              >
                الدخول إلى مساحة العمل الخاصة بك <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={logout}
                className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-bold"
              >
                تسجيل الخروج والتبديل لحساب آخر
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {/* Quick entry for the role */}
            <Button
              onClick={() => handleDirectRoleLogin(portalDetails.category)}
              disabled={loggingIn}
              className="w-full h-12 bg-[#083c7a] hover:bg-[#05326f] text-white font-black text-sm shadow-md gap-2"
            >
              <LogIn className="h-4 w-4 text-[#f5b41e]" />
              {loggingIn
                ? "جاري الدخول..."
                : `الدخول الفوري كـ ${portalDetails.presetAccount.name}`}
            </Button>

            {/* Google Login Option */}
            <Button
              variant="outline"
              onClick={handleSignInGoogle}
              disabled={loggingIn}
              className="w-full h-11 border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs gap-2"
            >
              <UserCheck className="h-4 w-4 text-[#083c7a]" />
              تسجيل الدخول بحساب Google معتمد
            </Button>

            <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-muted-foreground flex items-center gap-2 text-right bg-slate-50/50">
              <ShieldAlert className="h-4 w-4 shrink-0 text-[#f5b41e]" />
              <span className="text-[11px]">
                كل عملية دخول يتم توثيقها بالوقت واسم المستخدم في قاعدة بيانات Firebase المركزية.
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>BENNINI ETPI — منظومة الأشغال المتكاملة</span>
          <button
            onClick={() => setIsLinksModalOpen(true)}
            className="text-[#083c7a] font-bold hover:underline"
          >
            عرض الروابط المستقلة
          </button>
        </div>
      </div>

      <DedicatedPortalsHubModal
        isOpen={isLinksModalOpen}
        onClose={() => setIsLinksModalOpen(false)}
      />
    </div>
  );
}
