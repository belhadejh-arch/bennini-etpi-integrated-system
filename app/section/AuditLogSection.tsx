import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, RefreshCw, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, type Member } from "../../lib/api";
import { colors, formatDzd } from "../../lib/theme";
import { sections, type SectionId } from "../../shared/sections";
import { hasPermission } from "../../shared/access";

type AuditType = "create" | "update" | "delete" | "review" | "attachment" | "permissions" | "note" | "setup" | "other";
type AuditItem = {
  id: number;
  action: string;
  details: string;
  performed_by_id: string;
  performed_by_name: string;
  section: SectionId | "system";
  event_type: AuditType;
  entity_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
  notes: string;
};
type AuditResponse = { items: AuditItem[]; total: number; page: number; pageSize: number };
type FilterState = { search: string; section: string; type: string; from: string; to: string };

const emptyFilters: FilterState = { search: "", section: "", type: "", from: "", to: "" };
const eventTypes: Array<{ value: AuditType | ""; label: string }> = [
  { value: "", label: "كل الأنواع" },
  { value: "create", label: "إضافة" },
  { value: "update", label: "تعديل" },
  { value: "delete", label: "حذف" },
  { value: "review", label: "مراجعة" },
  { value: "attachment", label: "مرفقات" },
  { value: "permissions", label: "صلاحيات" },
];
const dataLabels: Record<string, string> = {
  amount: "المبلغ",
  party: "الجهة",
  category: "النوع",
  siteName: "موقع العمل",
  fuelLiters: "لتر مازوت",
  quantity: "الكمية",
  supplier: "المورد",
  totalCost: "التكلفة",
  chequeNumber: "رقم الشيك",
  beneficiary: "المستفيد",
  status: "الحالة",
  equipment: "الآلية",
  clientOrOwner: "الجهة",
  machineName: "الآلية",
  itemName: "الصنف",
  fileCount: "عدد المرفقات",
  email: "الحساب",
};

function eventLabel(type: AuditType) {
  return eventTypes.find((item) => item.value === type)?.label ??
    ({ setup: "تهيئة", note: "ملاحظة", other: "أخرى" } as Record<string, string>)[type] ?? "أخرى";
}

function sectionLabel(section: string) {
  return sections.find((item) => item.id === section)?.label ?? (section === "system" ? "النظام" : section);
}

function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("ar-DZ", { dateStyle: "medium", timeStyle: "short" });
}

function dataValue(key: string, value: unknown) {
  if (value == null || value === "") return null;
  if (key.toLowerCase().includes("amount") || key === "totalCost") return formatDzd(Number(value));
  if (typeof value === "object") return null;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

export default function AuditLogSection() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditResponse>({ items: [], total: 0, page: 1, pageSize: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) query.set(key === "search" ? "q" : key, value);
      });
      const [me, data] = await Promise.all([
        apiRequest<{ member: Member }>("/me", () => getToken()),
        apiRequest<AuditResponse>(`/audit?${query.toString()}`, () => getToken()),
      ]);
      setMember(me.member);
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل سجل التدقيق.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, getToken, isSignedIn, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (filters.search === appliedFilters.search) return;
    const timer = setTimeout(() => {
      setPage(1);
      setAppliedFilters((current) => ({ ...current, search: filters.search }));
    }, 350);
    return () => clearTimeout(timer);
  }, [appliedFilters.search, filters.search]);
  useEffect(() => {
    const isDate = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().startsWith(value));
    if (!isDate(filters.from) || !isDate(filters.to) || (filters.from && filters.to && filters.from > filters.to)) return;
    if (filters.from === appliedFilters.from && filters.to === appliedFilters.to) return;
    const timer = setTimeout(() => {
      setPage(1);
      setAppliedFilters((current) => ({ ...current, from: filters.from, to: filters.to }));
    }, 350);
    return () => clearTimeout(timer);
  }, [appliedFilters.from, appliedFilters.to, filters.from, filters.to]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key !== "search" && key !== "from" && key !== "to") {
      setPage(1);
      setAppliedFilters((current) => ({ ...current, [key]: value }));
    }
  };
  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const sectionFilters = useMemo(
    () => [{ id: "", label: "كل الأقسام" }, ...sections.filter((item) => item.id !== "dashboard").map((item) => ({ id: item.id, label: item.shortLabel })), { id: "system", label: "النظام" }],
    [],
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        title="سجل التدقيق"
        leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تحديث" onPress={() => void load()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.introIcon}><Clock3 size={20} color={colors.blue} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>سجل مركزي للعمليات المهمة</Text>
            <Text style={styles.subtitle}>يشمل المستخدم، نوع الإجراء، القسم، السجل المرتبط، وتاريخ ووقت التنفيذ.</Text>
          </View>
        </View>

        <View style={styles.filterPanel}>
          <View style={styles.searchBox}>
            <Search size={17} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={filters.search}
              onChangeText={(value) => updateFilter("search", value)}
              placeholder="ابحث باسم المستخدم أو تفاصيل العملية..."
              placeholderTextColor="#98A5B4"
              returnKeyType="search"
              accessibilityLabel="البحث في سجل التدقيق"
            />
            {filters.search ? <Pressable onPress={() => updateFilter("search", "")} accessibilityLabel="مسح البحث"><X size={16} color={colors.muted} /></Pressable> : null}
          </View>
          <Text style={styles.filterLabel}>القسم</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {sectionFilters.map((item) => (
              <FilterChip key={item.id || "all-sections"} label={item.label} selected={appliedFilters.section === item.id}
                onPress={() => updateFilter("section", item.id)} />
            ))}
          </ScrollView>
          <Text style={styles.filterLabel}>نوع العملية</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {eventTypes.map((item) => (
              <FilterChip key={item.value || "all-types"} label={item.label} selected={appliedFilters.type === item.value}
                onPress={() => updateFilter("type", item.value)} />
            ))}
          </ScrollView>
          <View style={styles.dateRow}>
            <DateFilter label="من تاريخ" value={filters.from} onChange={(value) => updateFilter("from", value)} />
            <DateFilter label="إلى تاريخ" value={filters.to} onChange={(value) => updateFilter("to", value)} />
          </View>
          <View style={styles.filterFooter}>
            <Text style={styles.resultCount}>{result.total} نتيجة</Text>
            {Object.values(filters).some(Boolean) ? (
              <Pressable onPress={clearFilters} style={styles.clearButton}>
                <X size={13} color={colors.blue} /><Text style={styles.clearText}>مسح التصفية</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()}><Text style={styles.retry}>إعادة المحاولة</Text></Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.muted}>جارٍ تحميل سجل العمليات...</Text></View>
        ) : result.items.length ? result.items.map((item) => (
          <View key={item.id} style={styles.entry}>
            <View style={styles.entryHeader}>
              <View style={styles.badgeRow}>
                <Text style={styles.sectionBadge}>{sectionLabel(item.section)}</Text>
                <Text style={styles.typeBadge}>{eventLabel(item.event_type)}</Text>
              </View>
              <Text style={styles.entryTitle}>{item.action}</Text>
            </View>
            <Text style={styles.details}>{item.details}</Text>
            {item.entity_id ? <Text style={styles.linkedRecord}>السجل المرتبط: #{item.entity_id}</Text> : null}
            {Object.entries(item.data ?? {}).filter(([key, value]) => dataLabels[key] && dataValue(key, value) != null).length ? (
              <View style={styles.dataRow}>
                {Object.entries(item.data ?? {}).filter(([key, value]) => dataLabels[key] && dataValue(key, value) != null).map(([key, value]) => (
                  <Text key={key} style={styles.dataPill}>{dataLabels[key]}: {dataValue(key, value)}</Text>
                ))}
              </View>
            ) : null}
            <View style={styles.entryFooter}>
              <Text style={styles.actor}>{item.performed_by_name || item.performed_by_id}</Text>
              <Text style={styles.date}>{timestamp(item.created_at)}</Text>
            </View>
            <RecordNotes entity="auditNote" recordId={String(item.id)} initialNotes={item.notes}
              editable={hasPermission(member, "audit", "edit")} />
          </View>
        )) : (
          <View style={styles.empty}>
            <Clock3 size={23} color={colors.muted} />
            <Text style={styles.emptyTitle}>لا توجد عمليات مطابقة</Text>
            <Text style={styles.muted}>غيّر كلمات البحث أو خيارات التصفية.</Text>
          </View>
        )}

        {!loading && result.total > result.pageSize ? (
          <View style={styles.pagination}>
            <Pressable
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
              accessibilityLabel="الصفحة السابقة"
            ><ChevronRight size={18} color={page <= 1 ? "#AAB4C1" : colors.blue} /><Text style={styles.pageButtonText}>السابق</Text></Pressable>
            <Text style={styles.pageCount}>صفحة {page} من {totalPages}</Text>
            <Pressable
              onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              style={[styles.pageButton, page >= totalPages && styles.pageButtonDisabled]}
              accessibilityLabel="الصفحة التالية"
            ><Text style={styles.pageButtonText}>التالي</Text><ChevronLeft size={18} color={page >= totalPages ? "#AAB4C1" : colors.blue} /></Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TextInput
        style={styles.dateInput}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#98A5B4"
        maxLength={10}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1040, alignSelf: "center" as const, padding: 19, paddingBottom: 38, gap: 14 },
  intro: { backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row" as const, alignItems: "center" as const, gap: 11 },
  introIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EAF1FA", alignItems: "center" as const, justifyContent: "center" as const },
  title: { color: colors.navy, fontSize: 16, fontWeight: "900" as const, textAlign: "right" as const },
  subtitle: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: "right" as const, marginTop: 4 },
  filterPanel: { backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 15, gap: 10 },
  searchBox: { minHeight: 43, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 12, textAlign: "right" as const, writingDirection: "rtl" as const },
  filterLabel: { color: colors.ink, fontSize: 10, fontWeight: "800" as const, textAlign: "right" as const, marginBottom: 3 },
  chips: { gap: 7, paddingVertical: 2 },
  chip: { minHeight: 33, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: "#F8FAFC", paddingHorizontal: 10, alignItems: "center" as const, justifyContent: "center" as const },
  chipSelected: { backgroundColor: "#EAF1FB", borderColor: colors.blue },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: "700" as const },
  chipTextSelected: { color: colors.blue },
  dateRow: { flexDirection: "row" as const, gap: 9, marginTop: 2 },
  dateInput: { height: 39, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, color: colors.ink, fontSize: 11, textAlign: "right" as const, writingDirection: "ltr" as const },
  filterFooter: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  resultCount: { color: colors.muted, fontSize: 10, fontWeight: "700" as const },
  clearButton: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3, padding: 4 },
  clearText: { color: colors.blue, fontSize: 10, fontWeight: "700" as const },
  entry: { backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  entryHeader: { gap: 8 },
  badgeRow: { flexDirection: "row" as const, gap: 6 },
  sectionBadge: { overflow: "hidden" as const, borderRadius: 8, backgroundColor: "#EAF1FB", color: colors.blue, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: "800" as const },
  typeBadge: { overflow: "hidden" as const, borderRadius: 8, backgroundColor: colors.amberSoft, color: colors.navy, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: "800" as const },
  entryTitle: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  details: { color: colors.ink, fontSize: 12, lineHeight: 19, textAlign: "right" as const },
  linkedRecord: { color: colors.muted, fontSize: 9, textAlign: "right" as const },
  dataRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 5 },
  dataPill: { backgroundColor: "#F4F6F9", borderRadius: 7, color: colors.muted, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9 },
  entryFooter: { borderTopWidth: 1, borderTopColor: "#EEF1F5", paddingTop: 8, flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 8 },
  actor: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: "800" as const, textAlign: "right" as const },
  date: { color: colors.muted, fontSize: 9, textAlign: "left" as const },
  errorBox: { backgroundColor: colors.redSoft, borderRadius: 11, padding: 12, flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 8 },
  errorText: { flex: 1, color: colors.red, fontSize: 11, textAlign: "right" as const },
  retry: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  center: { minHeight: 160, alignItems: "center" as const, justifyContent: "center" as const, gap: 10 },
  muted: { color: colors.muted, fontSize: 11, textAlign: "center" as const },
  empty: { minHeight: 180, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, padding: 18 },
  emptyTitle: { color: colors.navy, fontSize: 13, fontWeight: "800" as const },
  pagination: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingVertical: 6 },
  pageButton: { minHeight: 39, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
  pageButtonDisabled: { backgroundColor: "#F5F6F8" },
  pageButtonText: { color: colors.blue, fontSize: 10, fontWeight: "800" as const },
  pageCount: { color: colors.muted, fontSize: 10 },
};
