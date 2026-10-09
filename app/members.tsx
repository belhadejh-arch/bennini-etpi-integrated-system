import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { ArrowRight, Check, ShieldCheck, Users } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { AppHeader, HeaderAction } from "./components/AppHeader";
import { apiRequest, type Member } from "../lib/api";
import { colors } from "../lib/theme";
import { sections, type SectionId } from "../shared/sections";

type TeamMember = Member & { created_at?: string };

export default function MembersScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const me = await apiRequest<{ member: Member }>("/me", token);
      setMember(me.member);
      const result = await apiRequest<{ members: TeamMember[] }>("/members", token);
      setMembers(result.members);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل الأعضاء.");
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  const patchMember = async (target: TeamMember, patch: Partial<Pick<TeamMember, "active" | "allowed_sections" | "role">>) => {
    setSavingId(target.clerk_user_id);
    setError("");
    try {
      const token = () => getToken();
      await apiRequest(`/members/${encodeURIComponent(target.clerk_user_id)}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          active: patch.active ?? target.active,
          allowedSections: patch.allowed_sections ?? target.allowed_sections,
          role: patch.role ?? target.role,
        }),
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ الصلاحيات.");
    } finally {
      setSavingId("");
    }
  };

  const admin = member?.role === "admin";
  const selfId = user?.id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: "rtl" }}>
      <AppHeader
        title="الأعضاء والصلاحيات"
        leftAction={
          <HeaderAction label="رجوع" onPress={() => router.back()}>
            <ArrowRight size={19} color="#FFFFFF" />
          </HeaderAction>
        }
        rightAction={<View style={styles.icon}><ShieldCheck size={19} color={colors.yellow} /></View>}
      />

      {!admin && !loading ? (
        <View style={styles.center}>
          <Text style={styles.notice}>إدارة المستخدمين متاحة للمدير فقط.</Text>
          <Pressable style={styles.action} onPress={() => router.replace("/")}>
            <Text style={styles.actionText}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.summary}>
            <View style={styles.summaryIcon}><Users size={21} color={colors.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>إدارة الوصول إلى المنصة</Text>
              <Text style={styles.summarySub}>فعّل حساب العضو، ثم اختر الأقسام التي تظهر له.</Text>
            </View>
          </View>
          {error ? <View style={styles.error}><Text style={{ color: colors.red, textAlign: "right" }}>{error}</Text></View> : null}
          {loading ? <ActivityIndicator color={colors.blue} style={{ marginTop: 35 }} /> : members.map((item) => {
            const isSelf = item.clerk_user_id === selfId;
            return (
              <View key={item.clerk_user_id} style={styles.card}>
                <View style={styles.memberTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name || "عضو جديد"}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                    <Text style={styles.role}>{roleLabel(item.role)}{item.role === "pending" ? " · بانتظار التفعيل" : ""}</Text>
                  </View>
                  <View style={{ alignItems: "center", gap: 3 }}>
                    <Switch
                      value={item.active}
                      disabled={isSelf || savingId === item.clerk_user_id}
                      onValueChange={(active) => void patchMember(item, { active })}
                      trackColor={{ false: "#DCE3EB", true: "#A4D8BD" }}
                      thumbColor={item.active ? colors.green : "#FFFFFF"}
                    />
                    <Text style={styles.switchLabel}>{item.active ? "مفعّل" : "موقوف"}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>دور العضو</Text>
                <View style={styles.chips}>
                  {([
                    ["finance", "محاسب"],
                    ["field", "رئيس أشغال"],
                    ["supervisor", "مشرف"],
                    ["viewer", "عضو"],
                  ] as const).map(([role, label]) => {
                    const selected = item.role === role;
                    return (
                      <Pressable
                        key={role}
                        disabled={isSelf || savingId === item.clerk_user_id}
                        onPress={() => void patchMember(item, { role })}
                        style={[styles.chip, selected && styles.chipActive, isSelf && { opacity: 0.65 }]}
                      >
                        {selected ? <Check size={13} color={colors.blue} /> : null}
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>الأقسام المسموح بها</Text>
                <View style={styles.chips}>
                  {sections.filter((section) => !["dashboard", "users", "audit"].includes(section.id)).map((section) => {
                    const checked = item.allowed_sections.includes(section.id);
                    return (
                      <Pressable
                        key={section.id}
                        disabled={isSelf || savingId === item.clerk_user_id}
                        onPress={() => {
                          const updated = checked
                            ? item.allowed_sections.filter((value) => value !== section.id)
                            : [...item.allowed_sections, section.id];
                          void patchMember(item, { allowed_sections: updated });
                        }}
                        style={[styles.chip, checked && styles.chipActive, isSelf && { opacity: 0.65 }]}
                      >
                        {checked ? <Check size={13} color={colors.blue} /> : null}
                        <Text style={[styles.chipText, checked && styles.chipTextActive]}>{section.shortLabel}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {isSelf ? <Text style={styles.selfNote}>لا يمكن تعديل صلاحيات حساب المدير الحالي من هذه الشاشة.</Text> : null}
                {savingId === item.clerk_user_id ? <Text style={styles.saving}>جارٍ حفظ التغييرات...</Text> : null}
              </View>
            );
          })}
          <Text style={styles.footerText}>تُفرض الصلاحيات أيضاً على طلبات الخادم، وليس على ظهور القوائم فقط.</Text>
          <Pressable onPress={() => void signOut()} style={styles.logout}><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function roleLabel(role: string) {
  return ({ admin: "مدير النظام", finance: "الإدارة المالية", field: "رئيس أشغال", supervisor: "مشرف", viewer: "عضو", pending: "عضو جديد" } as Record<string, string>)[role] ?? "عضو";
}

const styles = {
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF1A", alignItems: "center" as const, justifyContent: "center" as const },
  page: { width: "100%" as const, maxWidth: 860, alignSelf: "center" as const, padding: 17, paddingBottom: 40, gap: 13 },
  summary: { backgroundColor: "#FFFFFF", padding: 15, borderRadius: 15, borderWidth: 1, borderColor: colors.border, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EAF1FB", alignItems: "center" as const, justifyContent: "center" as const },
  summaryTitle: { color: colors.navy, fontWeight: "800" as const, textAlign: "right" as const, fontSize: 14 },
  summarySub: { color: colors.muted, textAlign: "right" as const, fontSize: 11, marginTop: 4 },
  card: { backgroundColor: "#FFFFFF", padding: 15, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
  memberTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
  name: { color: colors.navy, textAlign: "right" as const, fontSize: 14, fontWeight: "800" as const },
  email: { color: colors.muted, textAlign: "right" as const, fontSize: 11, marginTop: 4 },
  role: { color: colors.blue, textAlign: "right" as const, fontSize: 10, fontWeight: "700" as const, marginTop: 5 },
  switchLabel: { color: colors.muted, fontSize: 9 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  sectionLabel: { color: colors.ink, textAlign: "right" as const, fontSize: 11, fontWeight: "700" as const, marginBottom: 9 },
  chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, justifyContent: "flex-start" as const },
  chip: { minHeight: 34, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  chipActive: { backgroundColor: "#EAF1FB", borderColor: "#BCD0EB" },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: "600" as const },
  chipTextActive: { color: colors.blue, fontWeight: "800" as const },
  selfNote: { color: colors.muted, fontSize: 10, textAlign: "right" as const, marginTop: 11 },
  saving: { color: colors.blue, fontSize: 10, textAlign: "right" as const, marginTop: 8 },
  footerText: { color: colors.muted, textAlign: "center" as const, fontSize: 10, lineHeight: 17 },
  error: { backgroundColor: colors.redSoft, borderRadius: 11, padding: 12 },
  center: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, padding: 24 },
  notice: { color: colors.muted, textAlign: "center" as const },
  action: { backgroundColor: colors.blue, borderRadius: 11, padding: 13, marginTop: 12 },
  actionText: { color: "#FFFFFF", fontWeight: "700" as const },
  logout: { alignSelf: "center" as const, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 18, paddingVertical: 11 },
  logoutText: { color: colors.blue, fontWeight: "700" as const, fontSize: 11 },
};
