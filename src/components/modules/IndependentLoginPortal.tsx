import { useState } from "react";
import { Lock, LogIn, ShieldAlert, CheckCircle2, UserCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BenniniLogo } from "@/components/BenniniLogo";
import { useAuth } from "@/context/AuthContext";

interface PortalProps {
  onSuccessLogin: () => void;
}

export function IndependentLoginPortal({ onSuccessLogin }: PortalProps) {
  const { currentUser, profile, signInWithGoogle, logout } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);

  const handleSignIn = async () => {
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

  return (
    <div
      className="min-h-screen bg-[#07152f] flex flex-col justify-center items-center p-4"
      dir="rtl"
    >
      {/* Background radial accent */}
      <div className="absolute h-96 w-96 rounded-full bg-[#083c7a]/40 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center border border-border">
        {/* Header Logo */}
        <div className="flex justify-center mb-6">
          <BenniniLogo size="lg" variant="colored" />
        </div>

        <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#083c7a] mb-2">
          بوابة دخول الموظفين ورؤساء الأشغال والعمال
        </span>

        <h2 className="text-2xl font-black text-[#07152f]">تسجيل الدخول للمنظومة</h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          الدخول محمي بنظام الصلاحيات الدقيقة (RBAC). ستظهر لك فقط الأقسام والوظائف التي حددها لك
          المدير العام.
        </p>

        {currentUser ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-5 border border-border text-right space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#083c7a] text-white font-bold text-base">
                {profile?.name?.slice(0, 2) || "م"}
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#07152f]">{profile?.name}</h4>
                <p className="text-xs text-muted-foreground font-mono">{currentUser.email}</p>
                <span className="inline-block mt-1 text-[11px] font-bold text-[#083c7a] bg-blue-100/60 rounded px-2 py-0.5">
                  الدور: {profile?.role}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex flex-col gap-2">
              <Button
                onClick={onSuccessLogin}
                className="w-full bg-[#083c7a] hover:bg-[#05326f] text-white font-bold h-11"
              >
                الدخول إلى مساحة العمل الخاصة بك
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
          <div className="mt-8 space-y-4">
            <Button
              onClick={handleSignIn}
              disabled={loggingIn}
              className="w-full h-12 bg-[#083c7a] hover:bg-[#05326f] text-white font-bold gap-3 shadow-lg transition-transform active:scale-98"
            >
              <LogIn className="h-5 w-5 text-[#f5b41e]" />
              {loggingIn ? "جاري التحقق والمصادقة..." : "تسجيل الدخول الآمن بحساب Google"}
            </Button>

            <div className="rounded-xl border border-dashed border-slate-200 p-3.5 text-xs text-muted-foreground flex items-center gap-2 text-right">
              <ShieldAlert className="h-5 w-5 shrink-0 text-[#f5b41e]" />
              <span>
                يتم تسجيل وقت وتاريخ الدخول في سجل الأمان المركزي (Audit Log) فور التحقق من الهوية.
              </span>
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-border pt-4 text-[11px] text-muted-foreground">
          BENNINI ETPI — جميع الحقوق محفوظة © 2026
        </div>
      </div>
    </div>
  );
}
