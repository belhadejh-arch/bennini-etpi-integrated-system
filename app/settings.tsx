import { useAuth, useUser } from "../lib/auth";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Check, LogOut, Moon, ShieldCheck, Sun, UserRound } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { AppHeader, HeaderAction } from "./components/AppHeader";
import { colors } from "../lib/theme";
import { hasPermission } from "../shared/access";
import { sections, type SectionId } from "../shared/sections";
import { sectionName, translate } from "../lib/localization";
import type { Appearance, Language } from "../lib/api";

export default function SettingsScreen() {
  const router = useRouter();
  const { isLoaded, member, signOut, language, appearance, isDark, updatePreferences } = useAuth();
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = (text: string) => translate(text, language);
  const styles = useMemo(() => makeStyles(), [language, appearance, isDark]);

  const choose = async (next: { language?: Language; appearance?: Appearance }) => {
    setError("");
    setSaving(true);
    try { await updatePreferences(next); }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("تعذر حفظ التفضيلات.")); }
    finally { setSaving(false); }
  };
  const admin = member?.role === "admin";
  const Arrow = language === "ar" ? ArrowRight : ArrowLeft;

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t("الإعدادات")}
        leftAction={<HeaderAction label={t("العودة إلى الرئيسية")} onPress={() => router.replace("/")}><Arrow size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label={t("تسجيل الخروج")} onPress={() => void signOut()}><LogOut size={18} color="#F3D98D" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.intro}>
          <View style={styles.icon}><ShieldCheck size={22} color={colors.blue} /></View>
          <Text style={styles.title}>{t("إعدادات الحساب والوصول")}</Text>
          <Text style={styles.subtitle}>{t("اختر اللغة والمظهر اللذين يناسبانك. تحفظ التفضيلات على حسابك.")}</Text>
        </View>
        {!isLoaded ? <View style={styles.card}><ActivityIndicator color={colors.blue} /></View> : (
          <>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.card}>
              <View style={styles.heading}><UserRound size={20} color={colors.blue} /><Text style={styles.cardTitle}>{t("الحساب")}</Text></View>
              <Info label={t("الاسم")} value={member?.name || user?.fullName || "—"} />
              <Info label={t("طريقة الدخول")} value={t("رقم تسلسلي من 6 أرقام")} />
              <Info label={t("الصلاحية")} value={member?.role_name || (language === "fr" ? roleFr(member?.role) : roleAr(member?.role))} />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("اللغة")}</Text>
              <View style={styles.options}>
                <Option title="العربية" selected={language === "ar"} onPress={() => void choose({ language: "ar" })} styles={styles} />
                <Option title="Français" selected={language === "fr"} onPress={() => void choose({ language: "fr" })} styles={styles} />
              </View>
              <Text style={styles.hint}>{language === "ar" ? "تتغير الواجهة واتجاه القراءة فوراً." : "La langue et le sens de lecture changent immédiatement."}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("المظهر")}</Text>
              <View style={styles.options}>
                <Option title={t("فاتح")} icon={<Sun size={18} color={colors.amber} />} selected={appearance === "light"} onPress={() => void choose({ appearance: "light" })} styles={styles} />
                <Option title={t("داكن")} icon={<Moon size={18} color={colors.blue} />} selected={appearance === "dark"} onPress={() => void choose({ appearance: "dark" })} styles={styles} />
                <Option title={t("حسب نظام الهاتف")} selected={appearance === "system"} onPress={() => void choose({ appearance: "system" })} styles={styles} />
              </View>
              <Text style={styles.hint}>{language === "ar" ? "يتبدل المظهر دون إعادة تحميل التطبيق." : "Le thème change sans recharger l’application."}</Text>
            </View>
            {admin ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t("الأقسام المتاحة")}</Text>
                  <View style={styles.chips}>
                    {sections.filter((section) => hasPermission(member, section.id, "view")).map((section) => (
                      <View key={section.id} style={styles.chip}><Text style={styles.chipText}>{sectionLabel(section.id, language)}</Text></View>
                    ))}
                  </View>
                </View>
                <Pressable accessibilityRole="button" onPress={() => router.push("/members")} style={styles.manage}>
                  <Text style={styles.manageText}>{t("إدارة المستخدمين والصلاحيات")}</Text><Arrow size={18} color={colors.surface} />
                </Pressable>
                <Text style={styles.hint}>{t("لتعديل صلاحيات أعضاء الفريق، استخدم إدارة المستخدمين والصلاحيات.")}</Text>
              </>
            ) : null}
            {saving ? <Text style={styles.saving}>{language === "ar" ? "جارٍ حفظ التفضيلات…" : "Enregistrement des préférences…"}</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Option({ title, selected, onPress, icon, styles }: { title: string; selected: boolean; onPress: () => void; icon?: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
    {icon}{selected ? <Check size={17} color={colors.green} /> : null}<Text style={[styles.optionText, selected && styles.optionTextSelected]}>{title}</Text>
  </Pressable>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <View style={makeStyles().info}><Text style={makeStyles().value}>{value}</Text><Text style={makeStyles().muted}>{label}</Text></View>;
}
function roleFr(role?: string) {
  return ({ admin: "Administrateur", finance: "Finance", field: "Chef de chantier", supervisor: "Superviseur", partner: "Partenaire", viewer: "Membre" } as Record<string, string>)[role ?? ""] ?? "Membre";
}
function roleAr(role?: string) {
  return ({ admin: "مدير النظام", finance: "الإدارة المالية", field: "رئيس أشغال", supervisor: "مشرف", partner: "شريك", viewer: "عضو" } as Record<string, string>)[role ?? ""] ?? "عضو";
}
function sectionLabel(id: SectionId, lang: Language) {
  return sectionName(id, lang);
}
function makeStyles() {
  return {
    screen: { flex: 1 as const, backgroundColor: colors.background },
    page: { width: "100%" as const, maxWidth: 900, alignSelf: "center" as const, padding: 20, paddingBottom: 48, gap: 14 },
    intro: { backgroundColor: colors.greenSoft, borderRadius: 18, padding: 20, gap: 8 },
    icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surface },
    title: { color: colors.ink, fontSize: 21, fontWeight: "800" as const, lineHeight: 32, textAlign: "right" as const },
    subtitle: { color: colors.muted, fontSize: 15, fontWeight: "500" as const, lineHeight: 24, textAlign: "right" as const },
    card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 13 },
    heading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
    cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" as const, lineHeight: 26 },
    info: { minHeight: 46, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
    muted: { color: colors.muted, fontSize: 15, fontWeight: "500" as const, lineHeight: 24 },
    value: { color: colors.ink, fontSize: 15, fontWeight: "600" as const, flexShrink: 1, textAlign: "left" as const, lineHeight: 24 },
    options: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 9 },
    option: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 8, backgroundColor: colors.background },
    optionSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
    optionText: { color: colors.ink, fontSize: 15, fontWeight: "600" as const, lineHeight: 24 },
    optionTextSelected: { color: colors.green, fontWeight: "700" as const },
    hint: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, lineHeight: 23 },
    chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: colors.greenSoft },
    chipText: { color: colors.green, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 },
    manage: { minHeight: 52, backgroundColor: colors.action, borderRadius: 13, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10 },
    manageText: { color: colors.surface, fontSize: 15, fontWeight: "700" as const, lineHeight: 24 },
    error: { color: colors.red, fontSize: 15, fontWeight: "600" as const, lineHeight: 24 },
    saving: { color: colors.muted, fontSize: 14, fontWeight: "600" as const, lineHeight: 23 },
  };
}
