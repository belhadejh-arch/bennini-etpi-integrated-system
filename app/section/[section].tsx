import { useAuth, useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, Plus, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import RecordNotes from "../components/RecordNotes";
import InventorySection from "./InventorySection";
import ChequesSection from "./ChequesSection";
import RentalsSection from "./RentalsSection";
import FieldExpensesSection from "./FieldExpensesSection";
import MachinerySection from "./MachinerySection";
import AuditLogSection from "./AuditLogSection";
import { apiRequest, type Member } from "../../lib/api";
import { colors, formatDzd } from "../../lib/theme";
import { sections, type SectionId } from "../../shared/sections";
import { hasPermission } from "../../shared/access";

type SectionResult = { items: Array<Record<string, unknown>> };
type ApiError = Error & { status?: number; body?: { pending?: boolean } };

export default function SectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section: string }>();
  const section = params.section as SectionId;
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [party, setParty] = useState("");
  const [reason, setReason] = useState("");

  const sectionMeta = sections.find((entry) => entry.id === section);
  const refresh = useCallback(async () => {
    if (!isSignedIn || !sectionMeta) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const me = await apiRequest<{ member: Member }>("/me", token);
      setMember(me.member);
      const data = await apiRequest<SectionResult>(`/sections/${section}`, token);
      setItems(data.items);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل القسم.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, section, sectionMeta]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (section === "dashboard") router.replace("/");
    else if (section !== "inventory" && section !== "cheques" && section !== "rentals" && section !== "field" && section !== "audit") void refresh();
  }, [isLoaded, isSignedIn, refresh, router, section]);

  const canSee = hasPermission(member, section, "view");
  const canAdd = useMemo(
    () => canSee && section === "finance" && hasPermission(member, "finance", "create"),
    [canSee, member, section],
  );

  if (section === "audit") return <AuditLogSection />;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const token = () => getToken();
      await apiRequest("/transactions", token, {
        method: "POST",
        body: JSON.stringify({ type: kind, amount: Number(amount), party, reason, paymentMethod: "نقداً" }),
      });
      setAmount(""); setParty(""); setReason("");
      setFormOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ البيانات.");
    } finally {
      setSaving(false);
    }
  };

  const title = sectionMeta?.label ?? "القسم";

  if (section === "inventory") return <InventorySection />;
  if (section === "cheques") return <ChequesSection />;
  if (section === "rentals") return <RentalsSection />;
  if (section === "field") return <FieldExpensesSection />;
  if (section === "machinery") return <MachinerySection />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: "rtl" }}>
      <AppHeader
        title={title}
        leftAction={
          <HeaderAction label="رجوع" onPress={() => router.back()}>
            <ArrowRight size={19} color="#FFFFFF" />
          </HeaderAction>
        }
        rightAction={
          <HeaderAction label="تحديث" onPress={() => void refresh()}>
            <RefreshCw size={17} color="#FFFFFF" />
          </HeaderAction>
        }
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>البيانات المسجلة في المنصة الموحدة.</Text>
        </View>

        {error ? <View style={styles.error}><Text style={{ color: colors.red, textAlign: "right" }}>{error}</Text></View> : null}

        {canAdd ? (
          <Pressable onPress={() => setFormOpen((open) => !open)} style={styles.addButton}>
            <Plus size={17} color={colors.navy} />
            <Text style={styles.addButtonText}>{formOpen ? "إغلاق النموذج" : section === "finance" ? "تسجيل عملية مالية" : "تسجيل مصروف ميداني"}</Text>
          </Pressable>
        ) : null}

        {formOpen && canAdd ? (
          <View style={styles.card}>
            {section === "finance" ? (
              <View style={styles.segment}>
                {(["income", "expense"] as const).map((value) => (
                  <Pressable key={value} onPress={() => setKind(value)} style={[styles.segmentButton, kind === value && styles.segmentSelected]}>
                    <Text style={[styles.segmentText, kind === value && styles.segmentTextSelected]}>{value === "income" ? "دخل" : "مصروف"}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text style={styles.label}>الجهة</Text>
            <TextInput style={styles.input} value={party} onChangeText={setParty} placeholder="المصدر أو الجهة المستفيدة" placeholderTextColor="#98A5B4" />
            <Text style={styles.label}>طريقة الدفع</Text>
            <Text style={styles.readonly}>نقداً</Text>
            <Text style={styles.label}>المبلغ (دج)</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A5B4" />
            <Text style={styles.label}>السبب</Text>
            <TextInput style={[styles.input, { minHeight: 76, textAlignVertical: "top" }]} value={reason} onChangeText={setReason} multiline placeholder="ملاحظات إضافية" placeholderTextColor="#98A5B4" />
            <Pressable onPress={save} disabled={saving || !amount || Number(amount) <= 0 || !party.trim()} style={[styles.saveButton, (saving || !amount) && { opacity: 0.55 }]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>حفظ العملية</Text>}
            </Pressable>
          </View>
        ) : null}

        {!canSee ? (
          <View style={styles.card}><Text style={styles.empty}>ليس لديك صلاحية الوصول إلى هذا القسم. تواصل مع المدير.</Text></View>
        ) : loading ? (
          <View style={styles.card}><ActivityIndicator color={colors.blue} /></View>
        ) : items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>لا توجد بيانات مسجلة في هذا القسم بعد.</Text>
            {canAdd ? <Text style={styles.emptyHint}>استخدم زر الإضافة لتسجيل أول عملية.</Text> : null}
          </View>
        ) : items.map((item) => (
          <DataCard
            key={String(item.id)}
            item={item}
            section={section}
            editable={hasPermission(member, section, "edit")}
          />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>الحساب: {member?.name || user?.firstName || ""}</Text>
        <Switch value={!!member?.active} disabled />
      </View>
    </View>
  );
}

function DataCard({ item, section, editable }: { item: Record<string, unknown>; section: SectionId; editable: boolean }) {
  let title = "";
  let subtitle = "";
  let amount: string | null = null;
  if (section === "finance") {
    title = String(item.party ?? "");
    subtitle = `${String(item.reason || "عملية مالية")} · ${String(item.date ?? "")}`;
    amount = formatDzd(Number(item.amount));
  } else if (section === "inventory") {
    title = String(item.name ?? "");
    subtitle = `${item.remaining_quantity} متبقي من ${item.quantity} · ${String(item.supplier || "دون مورد")}`;
    amount = formatDzd(Number(item.total_cost));
  } else if (section === "cheques") {
    title = `شيك ${String(item.cheque_number ?? "")}`;
    subtitle = `${String(item.beneficiary ?? "")} · الاستحقاق ${String(item.due_date ?? "")}`;
    amount = formatDzd(Number(item.amount));
  } else if (section === "rentals") {
    title = String(item.equipment ?? "");
    subtitle = `${String(item.client_or_owner ?? "")} · متبقي ${formatDzd(Number(item.remaining))}`;
    amount = formatDzd(Number(item.total_amount));
  } else if (section === "field") {
    title = String(item.category ?? "");
    subtitle = `${String(item.site_name ?? "")} · ${String(item.created_by_name ?? "")}`;
    amount = formatDzd(Number(item.amount));
  } else if (section === "machinery") {
    title = String(item.name ?? "");
    subtitle = `${String(item.code ?? "")} · ${String(item.category ?? "")}`;
    amount = String(item.status ?? "");
  } else if (section === "audit") {
    title = String(item.action ?? "");
    subtitle = `${String(item.performed_by_name ?? "")} · ${String(item.created_at ?? "")}`;
    amount = "";
  }
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
        {section === "audit" ? (
          <View style={{ marginTop: 8 }}>
            <RecordNotes entity="auditNote" recordId={String(item.id)} initialNotes={String(item.notes ?? "")} editable={editable} />
          </View>
        ) : null}
      </View>
      {amount ? <Text style={styles.cardAmount}>{amount}</Text> : null}
    </View>
  );
}

const styles = {
  page: { width: "100%" as const, maxWidth: 840, alignSelf: "center" as const, padding: 18, paddingBottom: 34, gap: 13 },
  intro: { marginBottom: 3 },
  title: { color: colors.navy, fontWeight: "900" as const, fontSize: 21, textAlign: "right" as const },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, textAlign: "right" as const },
  addButton: { minHeight: 46, borderRadius: 13, backgroundColor: colors.yellow, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  addButtonText: { color: colors.navy, fontWeight: "800" as const },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" as const, textAlign: "right" as const },
  cardSubtitle: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: "right" as const, lineHeight: 16 },
  cardAmount: { color: colors.blue, fontSize: 12, fontWeight: "900" as const, maxWidth: 120, textAlign: "left" as const },
  empty: { color: colors.muted, textAlign: "center" as const, fontSize: 12, lineHeight: 20 },
  emptyHint: { color: colors.blue, textAlign: "center" as const, fontSize: 11, marginTop: 6 },
  error: { backgroundColor: colors.redSoft, padding: 12, borderRadius: 12 },
  segment: { flexDirection: "row" as const, borderRadius: 12, backgroundColor: colors.background, padding: 4, marginBottom: 14 },
  segmentButton: { flex: 1, alignItems: "center" as const, paddingVertical: 10, borderRadius: 9 },
  segmentSelected: { backgroundColor: "#FFFFFF", elevation: 1 },
  segmentText: { color: colors.muted, fontWeight: "700" as const },
  segmentTextSelected: { color: colors.blue },
  label: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, textAlign: "right" as const, marginTop: 10 },
  input: { minHeight: 45, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, paddingHorizontal: 12, marginTop: 6 },
  readonly: { borderRadius: 10, backgroundColor: colors.background, color: colors.muted, padding: 12, textAlign: "right" as const, marginTop: 6 },
  saveButton: { height: 48, borderRadius: 12, backgroundColor: colors.blue, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 16 },
  saveText: { color: "#FFFFFF", fontWeight: "800" as const },
  footer: { minHeight: 52, backgroundColor: "#FFFFFF", paddingHorizontal: 16, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { color: colors.muted, fontSize: 10 },
};
