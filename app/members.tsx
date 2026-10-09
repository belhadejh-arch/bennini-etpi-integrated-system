import { useAuth, useUser } from "../lib/auth";
import { useRouter } from "expo-router";
import { ArrowRight, Check, Plus, Search, ShieldCheck, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "./components/AppHeader";
import RecordNotes from "./components/RecordNotes";
import { apiRequest, type Member } from "../lib/api";
import { colors } from "../lib/theme";
import { sections, type SectionId } from "../shared/sections";
import { hasPermission, permissionActions, type MemberCapabilities, type MemberPermissions, type PermissionAction } from "../shared/access";

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
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleNameDrafts, setRoleNameDrafts] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [newRoleName, setNewRoleName] = useState("");
  const [createdSerial, setCreatedSerial] = useState("");
  const [creating, setCreating] = useState(false);

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
    capabilities?: MemberCapabilities;
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
          capabilities: patch.capabilities ?? target.capabilities ?? {
            uploadFiles: true,
            viewFinancialData: true,
            manageOperations: true,
          },
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

  const createMember = async () => {
    setCreating(true);
    setError("");
    setCreatedSerial("");
    try {
      const result = await apiRequest<{ member: TeamMember; serial: string }>("/members", () => getToken(), {
        method: "POST",
        body: JSON.stringify({ name: newName, role: newRole, roleName: newRoleName }),
      });
      setCreatedSerial(result.serial);
      setNewName("");
      setNewRoleName("");
      setNewRole("viewer");
      setCreateOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إنشاء حساب العضو.");
    } finally {
      setCreating(false);
    }
  };

  const admin = member?.role === "admin";
  const canViewUsers = hasPermission(member, "users", "view");
  const selfId = user?.id;
  const visibleMembers = members.filter((item) =>
    (activeFilter === "all" || item.active === (activeFilter === "active")) &&
    `${item.name} ${item.role_name ?? roleLabel(item.role)}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

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

      {!canViewUsers && !loading ? (
        <View style={styles.center}>
          <Text style={styles.notice}>ليس لديك صلاحية عرض المستخدمين.</Text>
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
              <Text style={styles.summarySub}>أنشئ حساب العضو ورقم دخوله، ثم حدّد الأقسام والصلاحيات المسموح بها.</Text>
            </View>
          </View>
          {admin ? (
            <Pressable onPress={() => { setCreatedSerial(""); setCreateOpen((open) => !open); }} style={[styles.action, { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 8 }]}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.actionText}>{createOpen ? "إغلاق النموذج" : "إضافة عضو"}</Text>
            </Pressable>
          ) : null}
          {createdSerial ? (
            <View style={styles.serialNotice}>
              <Text style={styles.serialTitle}>تم إنشاء الحساب. احفظ رقم الدخول الآن؛ لن يظهر مرة أخرى.</Text>
              <Text selectable style={styles.serialCode}>{createdSerial}</Text>
              <Text style={styles.permissionLegend}>أرسله للعضو بطريقة آمنة. يمكنه استخدام الرقم لتسجيل الدخول.</Text>
              <Pressable onPress={() => setCreatedSerial("")} style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
                <Text style={{ color: colors.blue, fontWeight: "700" }}>إخفاء الرقم</Text>
              </Pressable>
            </View>
          ) : null}
          {createOpen && admin ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>إنشاء حساب عضو</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="اسم العضو"
                placeholderTextColor={colors.muted}
                style={styles.roleInput}
                textAlign="right"
                maxLength={100}
              />
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>نوع الحساب</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                {[
                  { value: "viewer", label: "عضو" },
                  { value: "finance", label: "الإدارة المالية" },
                  { value: "field", label: "رئيس أشغال" },
                  { value: "supervisor", label: "مشرف" },
                ].map((option) => (
                  <Pressable key={option.value} onPress={() => setNewRole(option.value)} style={[styles.permissionChip, newRole === option.value && styles.chipActive]}>
                    <Text style={[styles.chipText, newRole === option.value && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>المسمى الوظيفي (اختياري)</Text>
              <TextInput
                value={newRoleName}
                onChangeText={setNewRoleName}
                placeholder="مثال: مسؤول المشتريات"
                placeholderTextColor={colors.muted}
                style={styles.roleInput}
                textAlign="right"
                maxLength={80}
              />
              <Pressable onPress={() => void createMember()} disabled={creating || newName.trim().length < 2} style={[styles.action, { alignSelf: "flex-start", marginTop: 14, opacity: creating || newName.trim().length < 2 ? 0.6 : 1 }]}>
                {creating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionText}>إنشاء رقم الدخول</Text>}
              </Pressable>
            </View>
          ) : null}
          {error ? <View style={styles.error}><Text style={{ color: colors.red, textAlign: "right" }}>{error}</Text></View> : null}
          <View style={styles.searchBox}>
            <Search size={17} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث بالاسم أو المسمى الوظيفي"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              accessibilityLabel="البحث عن عضو"
            />
            {search ? <Pressable onPress={() => setSearch("")} accessibilityLabel="مسح البحث"><X size={16} color={colors.muted} /></Pressable> : null}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {[
              { value: "all" as const, label: "كل الحسابات" },
              { value: "active" as const, label: "مفعّلة" },
              { value: "inactive" as const, label: "موقوفة" },
            ].map((option) => (
              <Pressable key={option.value} onPress={() => setActiveFilter(option.value)}
                style={[styles.permissionChip, activeFilter === option.value && styles.chipActive]}>
                <Text style={[styles.chipText, activeFilter === option.value && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          {loading ? <ActivityIndicator color={colors.blue} style={{ marginTop: 35 }} /> : visibleMembers.length === 0 ? (
            <View style={styles.empty}>
              <Users size={23} color={colors.muted} />
              <Text style={styles.emptyTitle}>{members.length ? "لا يوجد عضو مطابق للبحث" : "لا توجد حسابات أعضاء بعد"}</Text>
              <Text style={styles.emptyText}>{members.length ? "جرّب البحث باسم مختلف أو بالمسمى الوظيفي." : "ستظهر هنا الحسابات بعد إنشائها."}</Text>
            </View>
          ) : visibleMembers.map((item) => {
            const isSelf = item.clerk_user_id === selfId;
            return (
              <View key={item.clerk_user_id} style={styles.card}>
                <View style={styles.memberTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name || "عضو جديد"}</Text>
                    <Text style={styles.email}>{item.has_serial ? "رقم دخول مخصص" : "لا يوجد رقم دخول"}</Text>
                    <Text style={styles.role}>{item.role_name || roleLabel(item.role)}{item.role === "pending" ? " · بانتظار التفعيل" : ""}</Text>
                    {admin ? <RecordNotes entity="member" recordId={item.clerk_user_id} initialNotes={item.notes} editable /> : null}
                  </View>
                  <View style={{ alignItems: "center", gap: 3 }}>
                    <Switch
                      value={item.active}
                      disabled={!admin || isSelf || savingId === item.clerk_user_id}
                      onValueChange={(active) => void patchMember(item, { active })}
                      trackColor={{ false: "#DCE3EB", true: "#A4D8BD" }}
                      thumbColor={item.active ? colors.green : "#FFFFFF"}
                    />
                    <Text style={styles.switchLabel}>{item.active ? "مفعّل" : "موقوف"}</Text>
                  </View>
                </View>
                {admin ? (
                  <>
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
                  </>
                ) : null}
                {admin ? (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.sectionLabel}>صلاحيات كل قسم</Text>
                    <Text style={styles.permissionLegend}>
                      حدّد صلاحيات العرض أو الإضافة أو التعديل أو الحذف لكل قسم. عرض المالية وإدارة العمليات لهما إذن إضافي مستقل أدناه.
                    </Text>
                    {sections.filter((section) => section.id !== "dashboard").map((section) => (
                      <View key={section.id} style={styles.permissionRow}>
                        <Text style={styles.permissionSection}>{section.shortLabel}</Text>
                        <View style={styles.permissionActions}>
                          {actionsForSection(section.id).map((action) => {
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
                    <View style={styles.divider} />
                    <Text style={styles.sectionLabel}>صلاحيات إضافية</Text>
                    <Text style={styles.permissionLegend}>رفع الملفات يتطلب أيضاً صلاحية الإضافة أو التعديل في القسم المعني.</Text>
                    {capabilityRows(item.capabilities).map((capability) => (
                      <View key={capability.key} style={styles.capabilityRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.permissionSection}>{capability.label}</Text>
                          <Text style={styles.permissionLegend}>{capability.description}</Text>
                        </View>
                        <Switch
                          value={capability.value}
                          disabled={isSelf || savingId === item.clerk_user_id}
                          onValueChange={(value) => void patchMember(item, {
                            capabilities: { ...capabilityValues(item.capabilities), [capability.key]: value },
                          })}
                          trackColor={{ false: "#DCE3EB", true: "#A4D8BD" }}
                          thumbColor={capability.value ? colors.green : "#FFFFFF"}
                        />
                      </View>
                    ))}
                  </>
                ) : (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.selfNote}>معلومات المستخدمين ظاهرة للقراءة فقط؛ تفاصيل الصلاحيات وإدارة الحسابات متاحة للمدير.</Text>
                  </>
                )}
                {isSelf ? <Text style={styles.selfNote}>لا يمكن تعديل صلاحيات حساب المدير الحالي من هذه الشاشة.</Text> : null}
                {savingId === item.clerk_user_id ? <Text style={styles.saving}>جارٍ حفظ التغييرات...</Text> : null}
              </View>
            );
          })}
          <Text style={styles.footerText}>تنشأ الأرقام التسلسلية تلقائياً عند إضافة العضو، وتُفرض الصلاحيات أيضاً على طلبات الخادم.</Text>
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

function actionsForSection(section: SectionId): PermissionAction[] {
  if (section === "users") return ["view"];
  if (section === "audit") return ["view", "edit"];
  return [...permissionActions];
}

function capabilityValues(capabilities?: MemberCapabilities): Required<MemberCapabilities> {
  return {
    uploadFiles: capabilities?.uploadFiles !== false,
    viewFinancialData: capabilities?.viewFinancialData !== false,
    manageOperations: capabilities?.manageOperations !== false,
  };
}

function capabilityRows(capabilities?: MemberCapabilities) {
  const values = capabilityValues(capabilities);
  return [
    { key: "uploadFiles" as const, label: "رفع الملفات والصور", description: "إذن عام لرفع المرفقات، مع بقاء صلاحية القسم مطلوبة.", value: values.uploadFiles },
    { key: "viewFinancialData" as const, label: "رؤية البيانات المالية", description: "يسمح بفتح قسم المالية وإظهار المؤشرات المالية في لوحة القيادة.", value: values.viewFinancialData },
    { key: "manageOperations" as const, label: "إدارة العمليات المالية", description: "يسمح بالإضافة والتعديل والحذف في سجل العمليات المالية، وفق صلاحيات القسم.", value: values.manageOperations },
  ];
}

const styles = {
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF1A", alignItems: "center" as const, justifyContent: "center" as const },
  page: { width: "100%" as const, maxWidth: 940, alignSelf: "center" as const, padding: 20, paddingBottom: 44, gap: 15 },
  summary: { backgroundColor: "#FFFFFF", padding: 17, borderRadius: 16, borderWidth: 1, borderColor: colors.border, flexDirection: "row" as const, alignItems: "center" as const, gap: 13 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EAF1FB", alignItems: "center" as const, justifyContent: "center" as const },
  summaryTitle: { color: colors.navy, fontWeight: "800" as const, textAlign: "right" as const, fontSize: 14 },
  summarySub: { color: colors.muted, textAlign: "right" as const, fontSize: 11, marginTop: 4 },
  serialNotice: { backgroundColor: "#FFF9E8", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#F0D78C", gap: 5 },
  serialTitle: { color: colors.navy, fontWeight: "800" as const, textAlign: "right" as const, fontSize: 12 },
  serialCode: { color: colors.navy, fontSize: 29, fontWeight: "900" as const, letterSpacing: 9, textAlign: "center" as const, paddingVertical: 8 },
  searchBox: { minHeight: 46, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  searchInput: { flex: 1, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, fontSize: 12 },
  empty: { minHeight: 150, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, padding: 20, backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.navy, fontSize: 13, fontWeight: "800" as const },
  emptyText: { color: colors.muted, fontSize: 11, textAlign: "center" as const },
  card: { backgroundColor: "#FFFFFF", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 2 },
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
  capabilityRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  permissionSection: { color: colors.ink, fontWeight: "700" as const, textAlign: "right" as const, fontSize: 11, flex: 1 },
  permissionActions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 5, justifyContent: "flex-end" as const },
  permissionChip: { minHeight: 34, borderRadius: 17, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  chip: { minHeight: 34, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  chipActive: { backgroundColor: "#EAF1FB", borderColor: "#BCD0EB" },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: "600" as const },
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
