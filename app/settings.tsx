import { useAuth, useUser } from "../lib/auth";
import { useRouter } from "expo-router";
import { ArrowRight, LogOut, ShieldCheck, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { AppHeader, HeaderAction } from "./components/AppHeader";
import { apiRequest, type Member } from "../lib/api";
import { colors } from "../lib/theme";
import { hasPermission } from "../shared/access";
import { sections } from "../shared/sections";

export default function SettingsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/(auth)/sign-in");
      return;
    }
    let alive = true;
    void apiRequest<{ member: Member }>("/me", () => getToken())
      .then(({ member: currentMember }) => {
        if (!alive) return;
        setMember(currentMember);
        if (currentMember.role !== "admin") router.replace("/");
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "تعذر تحميل إعدادات الحساب.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [getToken, isLoaded, isSignedIn, router]);

  return (
    <View style={styles.screen}>
      <AppHeader
        title="الإعدادات"
        leftAction={<HeaderAction label="العودة إلى الرئيسية" onPress={() => router.replace("/")}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تسجيل الخروج" onPress={() => void signOut()}><LogOut size={18} color="#D8E2EF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.intro}>
          <View style={styles.introIcon}><ShieldCheck size={22} color={colors.blue} /></View>
          <Text style={styles.title}>إعدادات الحساب والوصول</Text>
          <Text style={styles.subtitle}>معلومات حساب المدير والأقسام المتاحة له في المنصة.</Text>
        </View>
        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.blue} /><Text style={styles.body}>جارٍ تحميل بيانات الحساب...</Text></View>
        ) : error ? (
          <View style={styles.card}><Text style={styles.error}>{error}</Text></View>
        ) : member?.role === "admin" ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <UserRound size={19} color={colors.blue} />
                <Text style={styles.cardTitle}>الحساب</Text>
              </View>
              <InfoRow label="الاسم" value={member.name || user?.fullName || "—"} />
               <InfoRow label="طريقة الدخول" value="رقم تسلسلي من 6 أرقام" />
              <InfoRow label="الصلاحية" value={member.role_name || "مدير النظام"} last />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>الأقسام المتاحة</Text>
              <View style={styles.sectionList}>
                {sections.filter((section) => hasPermission(member, section.id, "view")).map((section) => (
                  <View key={section.id} style={styles.sectionChip}>
                    <Text style={styles.sectionText}>{section.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Pressable onPress={() => router.push("/members")} style={({ pressed }) => [styles.manageButton, pressed && { opacity: 0.8 }]}>
              <Text style={styles.manageButtonText}>إدارة المستخدمين والصلاحيات</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.note}>لتعديل صلاحيات أعضاء الفريق، استخدم إدارة المستخدمين والصلاحيات.</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const styles = {
  screen: { flex: 1 as const, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 920, alignSelf: "center" as const, padding: 20, paddingBottom: 40, gap: 14 },
  intro: { backgroundColor: "#EAF1FB", borderRadius: 16, padding: 17, gap: 6 },
  introIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#FFFFFF" },
  title: { color: colors.navy, fontSize: 18, fontWeight: "900" as const, textAlign: "right" as const, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "right" as const },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 17, gap: 11 },
  cardHeading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 3 },
  cardTitle: { color: colors.navy, fontSize: 14, fontWeight: "800" as const, textAlign: "right" as const },
  infoRow: { minHeight: 39, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  infoLabel: { color: colors.muted, fontSize: 12, textAlign: "right" as const },
  infoValue: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, flexShrink: 1, textAlign: "left" as const },
  sectionList: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "flex-start" as const, gap: 8 },
  sectionChip: { backgroundColor: "#F0F4F9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  sectionText: { color: colors.blue, fontSize: 11, fontWeight: "700" as const },
  manageButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.blue, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 9 },
  manageButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" as const },
  note: { color: colors.muted, fontSize: 11, textAlign: "center" as const, marginTop: 2 },
  loading: { minHeight: 120, alignItems: "center" as const, justifyContent: "center" as const, gap: 10 },
  body: { color: colors.muted, fontSize: 12 },
  error: { color: colors.red, fontSize: 12, textAlign: "right" as const },
};
