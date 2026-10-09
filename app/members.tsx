import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { ArrowRight, Check, ShieldCheck, Users } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "./components/AppHeader";
import RecordNotes from "./components/RecordNotes";
import { apiRequest, type Member } from "../lib/api";
import { colors } from "../lib/theme";
import { sections, type SectionId } from "../shared/sections";
import { permissionActions, type MemberPermissions, type PermissionAction } from "../shared/access";

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
  const [roleNameDrafts, setRoleNameDrafts] = useState<Record<string, string>>({});

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

  const patchMember = async (target: TeamMember, patch: {
    active?: boolean;
    permissions?: MemberPermissions;
    role_name?: string;
  }) => {
    setSavingId(target.clerk_user_id);
    setError("");
    try {
      const token = () => getToken();
      await apiRequest(`/members/${encodeURIComponent(target.clerk_user_id)}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          active: patch.active ?? target.active,
          permissions: patch.permissions ?? target.permissions ?? {},
          roleName: (patch.role_name ?? roleNameDrafts[target.clerk_user_id] ?? target.role_name ?? roleLabel(target.role)).trim()
            || roleLabel(target.role),
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
              <Text style={styles.summaryTitle}>إدارة المستخدمين والصلاحيات</Text>
              <Text style={styles.summarySub}>فعّل الحساب، اكتب المسمى الوظيفي بحرية، وحدد ما يستطيع المستخدم فعله في كل قسم.</Text>
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
                    <Text style={styles.role}>{item.role_name || roleLabel(item.role)}{item.role === "pending" ? " · بانتظار التفعيل" : ""}</Text>
                    <RecordNotes entity="member" recordId={item.clerk_user_id} initialNotes={item.notes} editable={admin} />
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
                <Text style={styles.sectionLabel}>المسمى الوظيفي (غير مقيّد بقائمة ثابتة)</Text>
                <TextInput
                  value={roleNameDrafts[item.clerk_user_id] ?? item.role_name ?? roleLabel(item.role)}
                  onChangeText={(value) => setRoleNameDrafts((current) => ({ ...current, [item.clerk_user_id]: value }))}
                  onBlur={() => {
                    const roleName = roleNameDrafts[item.clerk_user_id]?.trim();
                    if (roleName && roleName !== (item.role_name || roleLabel(item.role))) {
                      void patchMember(item, { role_name: roleName });
                    }
                  }}
                  editable={!isSelf && savingId !== item.clerk_user_id}
                  placeholder="مثال: مسؤول المشتريات"
                  placeholderTextColor={colors.muted}
                  style={styles.roleInput}
                  textAlign="right"
                  maxLength={80}
                />
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>صلاحيات كل قسم</Text>
                <Text style={styles.permissionLegend}>فعّل العرض أو الإضافة أو التعديل أو الحذف لكل قسم بشكل مستقل.</Text>
                {sections.filter((section) => !["dashboard", "users", "audit"].includes(section.id)).map((section) => (
                  <View key={section.id} style={styles.permissionRow}>
                    <Text style={styles.permissionSection}>{section.shortLabel}</Text>
                    <View style={styles.permissionActions}>
                      {permissionActions.map((action) => {
                        const checked = item.permissions?.[section.id]?.[action] === true;
                        return (
                          <Pressable
                            key={action}
                            disabled={isSelf || savingId === item.clerk_user_id}
                            onPress={() => {
                              const updated: MemberPermissions = {
                                ...item.permissions,
                                [section.id]: {
                                  ...item.permissions?.[section.id],
                                  [action]: !checked,
                                },
                              };
                              if (action !== "view" && !checked) {
                                updated[section.id] = { ...updated[section.id], view: true };
                              }
                              if (action === "view" && checked) {
                                updated[section.id] = { view: false, create: false, edit: false, delete: false };
                              }
                              void patchMember(item, { permissions: updated });
                            }}
                            style={[styles.permissionChip, checked && styles.chipActive, isSelf && { opacity: 0.65 }]}
                          >
                            {checked ? <Check size={12} color={colors.blue} /> : null}
                            <Text style={[styles.chipText, checked && styles.chipTextActive]}>{actionLabel(action)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
                {isSelf ? <Text style={styles.selfNote}>لا يمكن تعديل صلاحيات حساب المدير الحالي من هذه الشاشة.</Text> : null}
                {savingId === item.clerk_user_id ? <Text style={styles.saving}>جارٍ حفظ التغييرات...</Text> : null}
              </View>
            );
          })}
          <Text style={styles.footerText}>الحسابات الجديدة تنشأ عبر صفحة «إنشاء حساب»، ثم تظهر هنا بانتظار تفعيل المدير. وتُفرض الصلاحيات أيضاً على طلبات الخادم.</Text>
          <Pressable onPress={() => void signOut()} style={styles.logout}><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function roleLabel(role: string) {
  return ({ admin: "مدير النظام", finance: "الإدارة المالية", field: "رئيس أشغال", supervisor: "مشرف", viewer: "عضو", pending: "عضو جديد" } as Record<string, string>)[role] ?? "عضو";
}

function actionLabel(action: PermissionAction) {
  return ({ view: "عرض", create: "إضافة", edit: "تعديل", delete: "حذف" } as Record<PermissionAction, string>)[action];
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
  roleInput: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.ink, paddingHorizontal: 12, fontSize: 12 },
  switchLabel: { color: colors.muted, fontSize: 9 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  sectionLabel: { color: colors.ink, textAlign: "right" as const, fontSize: 11, fontWeight: "700" as const, marginBottom: 9 },
  chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, justifyContent: "flex-start" as const },
  permissionLegend: { color: colors.muted, textAlign: "right" as const, fontSize: 10, marginBottom: 8 },
  permissionRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  permissionSection: { color: colors.ink, fontWeight: "700" as const, textAlign: "right" as const, fontSize: 11, flex: 1 },
  permissionActions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 5, justifyContent: "flex-end" as const },
  permissionChip: { minHeight: 30, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
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
