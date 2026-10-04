import { useState } from "react";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Briefcase,
  HardHat,
  X,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

interface DedicatedPortalsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DedicatedPortalsHubModal({ isOpen, onClose }: DedicatedPortalsHubModalProps) {
  const { currentPortal, switchPortal, getPortalUrl, loginAsRole } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const managerUrl = getPortalUrl ? getPortalUrl("manager") : "/?portal=manager";
  const staffUrl = getPortalUrl ? getPortalUrl("staff") : "/?portal=staff";
  const fieldUrl = getPortalUrl ? getPortalUrl("field") : "/?portal=field";

  const handleCopy = (key: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const portals = [
    {
      id: "manager" as const,
      title: "رابط المدير العام والإدارة العليا 👑",
      roleLabel: "حساب المدير العام",
      url: managerUrl,
      targetPortal: "manager" as const,
      color: "from-[#083c7a] to-[#052654]",
      borderColor: "border-[#f5b41e]/50",
      badgeColor: "bg-[#f5b41e] text-[#07152f]",
      icon: Shield,
      features: [
        "لوحة قيادة مركزية وشاملة لجميع العمليات",
        "التسيير المالي والأرباح ورصيد الصندوق والخزينة",
        "إدارة الشيكات الصادرة والواردة وتوقيعاتها",
        "إدارة المستخدمين ومنح أو إلغاء الصلاحيات",
        "سجل العمليات الرقابي غير القابل للتعديل (Audit Log)",
      ],
      notice: "يُعطى حصرياً للمدير العام ومجلس الإدارة.",
    },
    {
      id: "staff" as const,
      title: "رابط الموظفين والمستخدمين 💼",
      roleLabel: "حساب موظف (محاسب / أمين مخزن)",
      url: staffUrl,
      targetPortal: "staff" as const,
      color: "from-[#0555a8] to-[#0a3568]",
      borderColor: "border-[#7fa9c7]/40",
      badgeColor: "bg-blue-100 text-[#083c7a]",
      icon: Briefcase,
      features: [
        "إدارة المشتريات والمخزون وحركات السلع",
        "تسجيل فواتير المشتريات وتتبع الموردين",
        "متابعة سجلات الكراء وتأجير المعدات",
        "تحديث حالات الشيكات وصيانة الآليات",
        "محجوب عنه أسرار الأرباح والإعدادات الإدارية",
      ],
      notice: "يُرسل للموظفين الإداريين والمحاسبين وأمناء المخازن.",
    },
    {
      id: "field" as const,
      title: "رابط العمال ورؤساء الأشغال الميدانيين 📱",
      roleLabel: "حساب رئيس أشغال / عامل ورشة",
      url: fieldUrl,
      targetPortal: "field" as const,
      color: "from-[#07152f] to-[#0c234b]",
      borderColor: "border-[#f5b41e]/70",
      badgeColor: "bg-amber-100 text-amber-900",
      icon: HardHat,
      features: [
        "واجهة هاتف خفيفة ومناسبة للعمل في الميدان",
        "تسجيل مصاريف المازوت والوقود فورياً مع العداد",
        "تسجيل قطع الغيار والإصلاحات العاجلة مع تصوير الوصل",
        "تسجيل المشتريات الميدانية والأجور السريعة",
        "متابعة قائمة مهام الورشة ونسب التقدم اليومية",
      ],
      notice: "يُرسل لرؤساء الورشات وعمال الميدان لاستعماله من الهاتف الذكي.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#083c7a] text-white">
              <Link2 className="h-6 w-6 text-[#f5b41e]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#07152f]">
                الروابط المستقلة المخصصة للمنظومة
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                تم فصل حسابات العمال والمستخدمين والمدير، وكل طرف يدخل من الرابط المخصص له.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Portals Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {portals.map((p) => {
            const Icon = p.icon;
            const isCurrent = currentPortal === p.targetPortal;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-4 transition-all ${
                  isCurrent
                    ? "border-[#f5b41e] bg-amber-50/30 shadow-md"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full ${p.badgeColor}`}
                    >
                      {p.roleLabel}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> البوابة الحالية
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-xl bg-[#083c7a]/10 text-[#083c7a]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h4 className="font-black text-sm text-[#07152f] leading-snug">{p.title}</h4>
                  </div>

                  {/* URL display & copy */}
                  <div className="my-3 rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                    <div className="text-[10px] font-bold text-muted-foreground mb-1">
                      الرابط المخصص:
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span
                        suppressHydrationWarning
                        className="text-[11px] font-mono text-slate-700 truncate dir-ltr select-all"
                      >
                        {p.url}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(p.id, p.url)}
                        className="h-7 px-2 text-xs font-bold text-[#083c7a] hover:bg-blue-50"
                      >
                        {copiedKey === p.id ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Check className="h-3 w-3" /> تم النسخ
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Copy className="h-3 w-3" /> نسخ
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="space-y-1.5 text-[11px] text-slate-600 mb-4">
                    <div className="font-bold text-slate-900 text-xs mb-1">الصلاحيات المتاحة:</div>
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span className="leading-tight">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-[10px] text-muted-foreground bg-slate-50 p-2 rounded-lg">
                    {p.notice}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        switchPortal(p.targetPortal);
                        onClose();
                      }}
                      className="w-full bg-[#083c7a] hover:bg-[#05326f] text-white text-xs font-bold"
                    >
                      <ExternalLink className="h-3 w-3 ml-1" /> فتح البوابة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await loginAsRole(
                          p.targetPortal === "manager"
                            ? "manager"
                            : p.targetPortal === "staff"
                              ? "staff"
                              : "worker",
                        );
                        onClose();
                      }}
                      className="w-full border-[#083c7a] text-[#083c7a] hover:bg-blue-50 text-xs font-bold"
                    >
                      تجربة الدخول
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[#083c7a]" />
            <span>
              <strong>ملاحظة للميدان:</strong> رابط العمال ورئيس الأشغال مصمم تلقائياً ليلائم شاشات
              الهواتف الذكية مع سرعة إدخال ومزامنة فورية دون الحاجة لتطبيق متجر.
            </span>
          </div>
          <Button
            variant="default"
            onClick={onClose}
            className="bg-[#07152f] hover:bg-[#0c234b] text-white font-bold text-xs px-6"
          >
            إغلاق النافذة
          </Button>
        </div>
      </div>
    </div>
  );
}
