import { useReconnectRefresh } from "../../lib/use-reconnect-refresh";
import { useAuth } from "../../lib/auth";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowRight, HardHat, Plus, RefreshCw, Search, Truck, Wrench, X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import AttachmentActions from "../components/AttachmentActions";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, apiUrl, type Member } from "../../lib/api";
import { colors, formatDzd, formatDate, makeStylesReactive } from "../../lib/theme";
import { translate } from "../../lib/localization";
import { hasPermission } from "../../shared/access";

type Machinery = {
  id: number;
  code: string;
  name: string;
  category: string;
  status: string;
  hours_worked: number;
  repair_count: number;
  legacy_repair_count?: number;
  total_expenses: number | string;
  notes: string;
  driver_assignment_id: number | null;
  driver_name: string | null;
  monthly_salary: number | string | null;
  driver_start_date: string | null;
  driver_total_cost: number | string;
};
type MachineDetails = {
  machine: { id: number; code: string; name: string; category: string; status: string; notes: string };
  rentals: Array<{
    id: number; equipment: string; client_or_owner: string; start_date: string; end_date: string;
    total_amount: number | string; paid_amount: number | string; created_by_name: string | null;
    created_at: string; attachments: Attachment[];
  }>;
  fieldExpenses: Array<{
    id: number; category: string; amount: number | string; site_name: string; details: string;
    fuel_liters: number | string | null; created_by_name: string; created_at: string; attachments: Attachment[];
  }>;
  driverHistory: Array<{
    id: number; driver_name: string; monthly_salary: number | string; start_date: string;
    end_date: string | null; created_by_name: string; created_at: string; accrued_cost: number;
  }>;
  driverTotalCost: number;
};
type Attachment = { id: number; file_name: string; mime_type: string; file_size: number };
type SparePart = {
  id: number;
  machinery_id: number;
  machinery_code: string;
  machinery_name: string;
  name: string;
  quantity: number;
  buy_price: number | string;
  supplier: string;
  invoice_number: string;
  installation_date: string | null;
  stock_quantity: number;
  repair_expense: number | string;
  notes: string;
  recorded_by_name: string;
  attachments: Attachment[];
};
type ApiError = Error & { status?: number; body?: { pending?: boolean } };

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const numberValue = (value: string | number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const dateLabel = (value: string | null) => formatDate(value);

export default function MachinerySection() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ focusId?: string | string[]; machineId?: string | string[] }>();
  const focusId = Array.isArray(routeParams.focusId) ? routeParams.focusId[0] : routeParams.focusId;
  const routeMachineId = Array.isArray(routeParams.machineId) ? routeParams.machineId[0] : routeParams.machineId;
  const { isLoaded, isSignedIn, getToken, getMember, language } = useAuth();
  const t = (text: string) => translate(text, language);
  const [member, setMember] = useState<Member | null>(null);
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [machineDetails, setMachineDetails] = useState<MachineDetails | null>(null);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [search, setSearch] = useState("");
  const [partDateFrom, setPartDateFrom] = useState("");
  const [partDateTo, setPartDateTo] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [machineFormOpen, setMachineFormOpen] = useState(false);
  const [machineDraft, setMachineDraft] = useState({
    code: "", name: "", category: "", notes: "", driverName: "",
    driverMonthlySalary: "", driverStartDate: localDate(),
  });
  const [driverChangeOpen, setDriverChangeOpen] = useState(false);
  const [driverDraft, setDriverDraft] = useState({ driverName: "", monthlySalary: "", startDate: localDate() });

  const isAdmin = member?.role === "admin";
  const canAccess = hasPermission(member, "machinery", "view");
  const canCreate = hasPermission(member, "machinery", "create");
  const canEdit = hasPermission(member, "machinery", "edit");
  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredMachinery = useMemo(
    () => machinery.filter((machine) => !searchTerm || `${machine.id} ${machine.name} ${machine.code} ${machine.category} ${machine.status} ${machine.notes}`.toLocaleLowerCase().includes(searchTerm)),
    [machinery, searchTerm],
  );
  const filteredParts = useMemo(
    () => parts.filter((part) =>
      (!focusId || String(part.id) === focusId) &&
      (selectedMachineId === null || part.machinery_id === selectedMachineId) &&
      (!partDateFrom || (part.installation_date ?? "").slice(0, 10) >= partDateFrom) &&
      (!partDateTo || (part.installation_date ?? "").slice(0, 10) <= partDateTo) &&
      (!searchTerm || `${part.id} ${part.name} ${part.machinery_name} ${part.machinery_code} ${part.supplier} ${part.invoice_number} ${part.recorded_by_name} ${part.notes} ${part.installation_date ?? ""}`.toLocaleLowerCase().includes(searchTerm))),
    [focusId, partDateFrom, partDateTo, parts, selectedMachineId, searchTerm],
  );
  const totalExpenses = machinery.reduce((total, machine) => total + numberValue(machine.total_expenses), 0);
  const totalRepairRecords = machinery.reduce((total, machine) => total + Number(machine.repair_count || 0), 0);
  const totalLegacyRepairRecords = machinery.reduce((total, machine) => total + Number(machine.legacy_repair_count || 0), 0);

  const refresh = useCallback(async (background = false) => {
    if (!isSignedIn) return;
    if (!background) setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const [me, machineResult, partResult, detailResult] = await Promise.all([
        getMember(),
        apiRequest<{ items: Machinery[] }>("/machinery", token),
        apiRequest<{ items: SparePart[] }>(`/machinery/spare-parts${focusId ? `?focusId=${encodeURIComponent(focusId)}` : ""}`, token),
        selectedMachineId
          ? apiRequest<MachineDetails>(`/machinery/${selectedMachineId}/details`, token)
          : Promise.resolve(null),
      ]);
      setMember(me.member);
      setMachinery(machineResult.items);
      setParts(partResult.items);
      setMachineDetails(detailResult);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل بيانات المركبات وقطع الغيار.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [focusId, getToken, getMember, isSignedIn, selectedMachineId]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (isSignedIn) void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);
  useReconnectRefresh(refresh, isSignedIn);

  useEffect(() => {
    const id = routeMachineId ? Number(routeMachineId) : null;
    if (id && Number.isSafeInteger(id) && id > 0) setSelectedMachineId(id);
  }, [routeMachineId]);

  useEffect(() => {
    if (!routeMachineId && focusId && parts.length) {
      const historical = parts.find((part) => String(part.id) === focusId);
      if (historical) setSelectedMachineId(historical.machinery_id);
    }
  }, [focusId, parts, routeMachineId]);

  const saveMachinery = async () => {
    if (!machineDraft.code.trim() || !machineDraft.name.trim() ||
        (machineDraft.driverName.trim() && (!machineDraft.driverMonthlySalary.trim() ||
          !Number.isFinite(Number(machineDraft.driverMonthlySalary)) || Number(machineDraft.driverMonthlySalary) < 0 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(machineDraft.driverStartDate)))) {
      setError("أدخل الرقم التعريفي واسم المركبة أو الآلية.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest("/machinery", () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          code: machineDraft.code.trim(),
          name: machineDraft.name.trim(),
          category: machineDraft.category.trim(),
          notes: machineDraft.notes.trim(),
          driverName: machineDraft.driverName.trim(),
          driverMonthlySalary: machineDraft.driverMonthlySalary,
          driverStartDate: machineDraft.driverName.trim() ? machineDraft.driverStartDate : "",
        }),
      });
      setMachineDraft({ code: "", name: "", category: "", notes: "", driverName: "", driverMonthlySalary: "", driverStartDate: localDate() });
      setMachineFormOpen(false);
      setNotice("تم تسجيل المركبة أو الآلية.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تسجيل المركبة أو الآلية.");
    } finally {
      setSaving(false);
    }
  };

  const saveDriverChange = async () => {
    const machineId = selectedMachineId;
    if (!machineId || !driverDraft.driverName.trim() || !driverDraft.monthlySalary.trim() ||
        !Number.isFinite(Number(driverDraft.monthlySalary)) || Number(driverDraft.monthlySalary) < 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(driverDraft.startDate)) {
      setError("أكمل اسم السائق وراتبه وتاريخ بداية العمل.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/machinery/${machineId}/driver`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({
          driverName: driverDraft.driverName.trim(),
          monthlySalary: Number(driverDraft.monthlySalary),
          startDate: driverDraft.startDate,
        }),
      });
      setDriverDraft({ driverName: "", monthlySalary: "", startDate: localDate() });
      setDriverChangeOpen(false);
      setNotice("تم حفظ السائق الجديد مع الاحتفاظ بسجل السائق السابق.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ تعيين السائق.");
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const url = apiUrl(`/api/machinery/spare-part-attachments/${attachment.id}`);
      if (Platform.OS === "web") {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("تعذر تحميل المرفق.");
        const objectUrl = URL.createObjectURL(await response.blob());
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        const base = FileSystem.documentDirectory;
        if (!base) throw new Error("مساحة حفظ الملفات غير متاحة.");
        const target = `${base}${Date.now()}-${attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const downloaded = await FileSystem.downloadAsync(url, target, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await Sharing.shareAsync(downloaded.uri, {
          mimeType: attachment.mime_type, dialogTitle: attachment.file_name,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر فتح المرفق.");
    }
  };

  if ((!member?.active || !canAccess) && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>{error || "الحساب غير مفعل أو لا يملك صلاحية الوصول إلى قسم المركبات والآليات."}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t("المركبات والآليات")}
        leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <View style={styles.intro}>
            <Text style={styles.title}>{t("المركبات والآليات")}</Text>
            <Text style={styles.subtitle}>{t("سجّل الأصول وتابع قطع الغيار والمخزون ومصاريف الإصلاح لكل آلية.")}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.summaryRow}>
          <Summary label="المركبات والآليات" value={String(machinery.length)} icon={<Truck size={17} color={colors.blue} />} />
          <Summary label="سجلات القطع والإصلاح" value={String(totalRepairRecords)} icon={<Wrench size={17} color={colors.blue} />} />
          <Summary label="سجلات قطع الغيار القديمة" value={String(totalLegacyRepairRecords)} icon={<Wrench size={17} color={colors.muted} />} />
          <Summary label="إجمالي المصاريف" value={formatDzd(totalExpenses)} icon={<HardHat size={17} color={colors.blue} />} />
        </View>

        <View style={styles.searchBox}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="ابحث بالآلية أو القطعة أو المورد أو المستخدم"
            placeholderTextColor="#98A5B4"
            accessibilityLabel={t("البحث في الآليات")}
          />
          {search ? <Pressable onPress={() => setSearch("")} accessibilityLabel="مسح البحث"><X size={16} color={colors.muted} /></Pressable> : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <TextInput value={partDateFrom} onChangeText={setPartDateFrom}
            style={{ minWidth: 135, flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, color: colors.ink, textAlign: "right", fontSize: 11 }}
            placeholder="تاريخ التركيب من" placeholderTextColor="#98A5B4" accessibilityLabel="تصفية القطع من تاريخ" />
          <TextInput value={partDateTo} onChangeText={setPartDateTo}
            style={{ minWidth: 135, flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, color: colors.ink, textAlign: "right", fontSize: 11 }}
            placeholder="تاريخ التركيب إلى" placeholderTextColor="#98A5B4" accessibilityLabel="تصفية القطع إلى تاريخ" />
          {partDateFrom || partDateTo ? <Pressable onPress={() => { setPartDateFrom(""); setPartDateTo(""); }} style={{ minHeight: 38, justifyContent: "center", paddingHorizontal: 8 }}><Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>مسح التاريخ</Text></Pressable> : null}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>المركبات والآليات</Text>
            <Text style={styles.sectionHint}>اختر آلية لعرض سجل مصاريفها وإصلاحاتها.</Text>
          </View>
          {canCreate ? (
            <Pressable onPress={() => { setMachineFormOpen((open) => !open); setError(""); }} style={styles.smallButton}>
              {machineFormOpen ? <X size={15} color={colors.onAccent} /> : <Plus size={15} color={colors.onAccent} />}
              <Text style={styles.smallButtonText}>{machineFormOpen ? "إغلاق" : "إضافة آلية"}</Text>
            </Pressable>
          ) : null}
        </View>

        {machineFormOpen && canCreate ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>تسجيل مركبة أو آلية</Text>
            <Field label="الرقم التعريفي *" value={machineDraft.code} onChange={(value) => setMachineDraft((draft) => ({ ...draft, code: value }))} placeholder="مثال: TR-001" />
            <Field label="اسم المركبة أو الآلية *" value={machineDraft.name} onChange={(value) => setMachineDraft((draft) => ({ ...draft, name: value }))} placeholder="مثال: شاحنة نقل" />
            <Field label="الفئة أو النوع" value={machineDraft.category} onChange={(value) => setMachineDraft((draft) => ({ ...draft, category: value }))} placeholder="شاحنة، حفارة، سيارة..." />
            <Text style={styles.cardTitle}>بيانات السائق الحالي (اختياري)</Text>
            <Field label="اسم سائق الآلة" value={machineDraft.driverName} onChange={(value) => setMachineDraft((draft) => ({ ...draft, driverName: value }))} placeholder="اسم السائق" />
            <Field label="راتب السائق الشهري (دج)" value={machineDraft.driverMonthlySalary} onChange={(value) => setMachineDraft((draft) => ({ ...draft, driverMonthlySalary: value }))} placeholder="0" numeric />
            <Field label="تاريخ بداية العمل" value={machineDraft.driverStartDate} onChange={(value) => setMachineDraft((draft) => ({ ...draft, driverStartDate: value }))} placeholder="YYYY-MM-DD" />
            <Field label="ملاحظات حول الآلية" value={machineDraft.notes} onChange={(value) => setMachineDraft((draft) => ({ ...draft, notes: value }))} placeholder="معلومات إضافية عن الآلية" multiline />
            <SaveButton label="حفظ المركبة أو الآلية" saving={saving} onPress={() => void saveMachinery()} />
          </View>
        ) : null}

        <View style={styles.machineList}>
          <Pressable onPress={() => setSelectedMachineId(null)} style={[styles.machineChip, selectedMachineId === null && styles.machineChipActive]}>
            <Text style={[styles.machineChipTitle, selectedMachineId === null && styles.machineChipTitleActive]}>كل الآليات</Text>
          </Pressable>
          {filteredMachinery.map((machine) => {
            const active = selectedMachineId === machine.id;
            return (
              <View key={machine.id} style={[styles.machineCard, active && styles.machineCardActive]}>
                <Pressable onPress={() => setSelectedMachineId(active ? null : machine.id)} style={styles.machinePress}>
                  <View style={styles.machineIcon}><Truck size={18} color={active ? colors.blue : colors.muted} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.machineName}>{machine.name}</Text>
                    <Text style={styles.machineMeta}>{machine.code}{machine.category ? ` · ${machine.category}` : ""}</Text>
                    <Text style={styles.machineMeta}>{machine.repair_count} سجل · {formatDzd(numberValue(machine.total_expenses))}</Text>
                    {machine.driver_name ? <Text style={styles.machineMeta}>السائق: {machine.driver_name}</Text> : null}
                  </View>
                </Pressable>
                <RecordNotes entity="machinery" recordId={machine.id} initialNotes={machine.notes} editable={canEdit} />
              </View>
            );
          })}
          {!loading && machinery.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>لم تُسجل أي مركبة أو آلية بعد.</Text></View>
          ) : null}
        </View>

        {selectedMachineId && machineDetails ? (
          <View style={styles.card}>
            <View style={styles.detailsHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>تفاصيل الآلة: {machineDetails.machine.name}</Text>
                <Text style={styles.machineMeta}>{machineDetails.machine.code}{machineDetails.machine.category ? ` · ${machineDetails.machine.category}` : ""}</Text>
              </View>
              {canEdit ? (
                <Pressable onPress={() => setDriverChangeOpen((open) => !open)} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>{driverChangeOpen ? "إغلاق" : "تغيير السائق"}</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.detailGrid}>
              <Detail label="إجمالي مصاريف الآلة" value={formatDzd(numberValue(machinery.find((item) => item.id === selectedMachineId)?.total_expenses))} />
              <Detail label="تكلفة السائقين المسجلة" value={formatDzd(machineDetails.driverTotalCost)} />
              <Detail label="السائق الحالي" value={machineDetails.driverHistory.find((driver) => !driver.end_date)?.driver_name ?? "غير مسجل"} />
              <Detail label="راتب السائق الحالي" value={(() => {
                const driver = machineDetails.driverHistory.find((item) => !item.end_date);
                return driver ? formatDzd(numberValue(driver.monthly_salary)) : "—";
              })()} />
              <Detail label="بداية عمل السائق الحالي" value={dateLabel(machineDetails.driverHistory.find((item) => !item.end_date)?.start_date ?? null)} />
            </View>

            {driverChangeOpen && canEdit ? (
              <View style={styles.driverForm}>
                <Text style={styles.cardTitle}>تعيين سائق جديد</Text>
                <Field label="اسم السائق *" value={driverDraft.driverName} onChange={(value) => setDriverDraft((draft) => ({ ...draft, driverName: value }))} placeholder="اسم السائق الجديد" />
                <Field label="الراتب الشهري (دج) *" value={driverDraft.monthlySalary} onChange={(value) => setDriverDraft((draft) => ({ ...draft, monthlySalary: value }))} placeholder="0" numeric />
                <Field label="تاريخ بداية العمل *" value={driverDraft.startDate} onChange={(value) => setDriverDraft((draft) => ({ ...draft, startDate: value }))} placeholder="YYYY-MM-DD" />
                <SaveButton label="حفظ السائق الجديد" saving={saving} onPress={() => void saveDriverChange()} />
              </View>
            ) : null}

            <View style={styles.historyBlock}>
              <Text style={styles.cardTitle}>سجل السائقين</Text>
              {machineDetails.driverHistory.length ? machineDetails.driverHistory.map((driver) => (
                <View key={driver.id} style={styles.historyRow}>
                  <Text style={styles.partName}>{driver.driver_name} · {formatDzd(numberValue(driver.monthly_salary))} شهرياً</Text>
                  <Text style={styles.machineMeta}>من {dateLabel(driver.start_date)} إلى {dateLabel(driver.end_date)} · سجله {driver.created_by_name}</Text>
                  <Text style={styles.machineMeta}>التكلفة المحتسبة: {formatDzd(driver.accrued_cost)}</Text>
                </View>
              )) : <Text style={styles.emptyText}>لا يوجد سائق مسجل لهذه الآلة.</Text>}
            </View>

            <View style={styles.historyBlock}>
              <Text style={styles.cardTitle}>عقود الكراء المرتبطة</Text>
              {machineDetails.rentals.length ? machineDetails.rentals.map((rental) => (
                <View key={rental.id} style={styles.historyRow}>
                  <Text style={styles.partName}>{rental.client_or_owner} · {formatDzd(numberValue(rental.total_amount))}</Text>
                  <Text style={styles.machineMeta}>{dateLabel(rental.start_date)} إلى {dateLabel(rental.end_date)} · مدفوع {formatDzd(numberValue(rental.paid_amount))}</Text>
                  <Text style={styles.machineMeta}>سجله {rental.created_by_name || "سجل قديم"} · {dateLabel(rental.created_at)}</Text>
                  {rental.attachments?.length ? <View style={styles.attachmentList}>{rental.attachments.map((attachment) => (
                    <AttachmentActions key={attachment.id} attachment={attachment} section="machinery"
                      url={`/api/machinery/related-attachments/rental/${attachment.id}?machineryId=${selectedMachineId}`}
                      canDelete={false} onDeleted={() => undefined} />
                  ))}</View> : null}
                </View>
              )) : <Text style={styles.emptyText}>لا توجد عقود كراء مرتبطة بهذه الآلة.</Text>}
            </View>

            <View style={styles.historyBlock}>
              <Text style={styles.cardTitle}>المازوت وعمليات الميدان</Text>
              {machineDetails.fieldExpenses.length ? machineDetails.fieldExpenses.map((expense) => (
                <View key={expense.id} style={styles.historyRow}>
                  <Text style={styles.partName}>{t(expense.category)} · {formatDzd(numberValue(expense.amount))}</Text>
                  <Text style={styles.machineMeta}>{expense.fuel_liters != null ? `${expense.fuel_liters} لتر · ` : ""}{expense.site_name}{expense.details ? ` · ${expense.details}` : ""}</Text>
                  <Text style={styles.machineMeta}>سجله {expense.created_by_name} · {dateLabel(expense.created_at)}</Text>
                  {expense.attachments?.length ? <View style={styles.attachmentList}>{expense.attachments.map((attachment) => (
                    <AttachmentActions key={attachment.id} attachment={attachment} section="machinery"
                      url={`/api/machinery/related-attachments/field/${attachment.id}?machineryId=${selectedMachineId}`}
                      canDelete={false} onDeleted={() => undefined} />
                  ))}</View> : null}
                </View>
              )) : <Text style={styles.emptyText}>لا توجد مصاريف ميدانية مرتبطة بهذه الآلة.</Text>}
            </View>
          </View>
        ) : selectedMachineId && loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.blue} /><Text style={styles.emptyText}>جارٍ تحميل تفاصيل الآلة...</Text></View>
        ) : null}

        {selectedMachineId !== null ? <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>سجلات قطع الغيار القديمة</Text>
            <Text style={styles.sectionHint}>
              السجلات التاريخية محفوظة للقراءة فقط. تُسجل القطع والإصلاحات الجديدة ضمن عمليات الميدان.
            </Text>
          </View>
        </View> : null}

        {selectedMachineId !== null && loading && filteredParts.length === 0 ? <View style={styles.loading}><ActivityIndicator color={colors.blue} /></View> : null}
        {selectedMachineId !== null && !loading && filteredParts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{search ? "لا توجد نتائج مطابقة للبحث." : `لا توجد قطع غيار أو إصلاحات مسجلة${selectedMachineId ? " لهذه الآلية" : ""}.`}</Text>
            {!search ? <Text style={styles.emptyHint}>تُسجل القطع والإصلاحات الجديدة من عمليات الميدان.</Text> : null}
          </View>
        ) : null}
        {selectedMachineId !== null && filteredParts.map((part) => (
          <View key={part.id} style={styles.partCard}>
            <View style={styles.partTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.partName}>{part.name}</Text>
                <Text style={styles.partMachine}>{part.machinery_name} · {part.machinery_code}</Text>
              </View>
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>المخزون {part.stock_quantity}</Text>
              </View>
            </View>
            <View style={styles.detailGrid}>
              <Detail label="الكمية" value={`${part.quantity}`} />
              <Detail label="سعر الوحدة" value={formatDzd(numberValue(part.buy_price))} />
              <Detail label="المورد" value={part.supplier || "—"} />
              <Detail label="رقم الفاتورة" value={part.invoice_number || "—"} />
              <Detail label="تاريخ التركيب" value={dateLabel(part.installation_date)} />
              <Detail label="مصاريف الإصلاح" value={formatDzd(numberValue(part.repair_expense))} />
            </View>
            <View style={styles.costLine}>
              <Text style={styles.costLabel}>تكلفة الشراء والإصلاح</Text>
              <Text style={styles.costValue}>{formatDzd(part.quantity * numberValue(part.buy_price) + numberValue(part.repair_expense))}</Text>
            </View>
            <RecordNotes entity="machinerySparePart" recordId={part.id} initialNotes={part.notes} editable={false} />
            <Text style={styles.recordedBy}>سجلها: {part.recorded_by_name}</Text>
            {part.attachments?.length ? (
              <View style={styles.attachmentBlock}>
                <Text style={styles.fieldLabel}>الصور والوثائق</Text>
                <View style={styles.attachmentList}>
                  {part.attachments.map((attachment) => (
                    <AttachmentActions key={attachment.id} attachment={attachment} section="machinery"
                      url={`/api/machinery/spare-part-attachments/${attachment.id}`}
                      canDelete={false}
                      onDeleted={() => undefined} />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, numeric = false, multiline = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
  numeric?: boolean; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#98A5B4"
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
        textAlign="right"
      />
    </View>
  );
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIcon}>{icon}</View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SaveButton({ label, saving, onPress }: { label: string; saving: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
      {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{label}</Text>}
    </Pressable>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1020, alignSelf: "center" as const, padding: 20, paddingBottom: 44, gap: 16 },
  headingRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  intro: { flex: 1 },
  title: { color: colors.navy, fontWeight: "900" as const, fontSize: 21, textAlign: "right" as const },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, textAlign: "right" as const, lineHeight: 19 },
  summaryRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 9 },
  summaryCard: { flexGrow: 1, flexBasis: 145, minWidth: 105, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 15, gap: 6 },
  summaryIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#EDF4FC", marginBottom: 2 },
  summaryLabel: { color: colors.muted, fontSize: 11, textAlign: "right" as const },
  summaryValue: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  searchBox: { minHeight: 46, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 13, textAlign: "right" as const, writingDirection: "rtl" as const },
  sectionHead: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, marginTop: 3 },
  sectionTitle: { color: colors.navy, fontSize: 16, fontWeight: "900" as const, textAlign: "right" as const },
  sectionHint: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: "right" as const, lineHeight: 15 },
  smallButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 10, backgroundColor: colors.yellow, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 5 },
  smallButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: "600" as const },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 17, gap: 12 },
  cardTitle: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  field: { gap: 5 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, textAlign: "right" as const },
  input: { minHeight: 46, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  multiline: { minHeight: 78, textAlignVertical: "top" as const },
  machineList: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  machineChip: { paddingHorizontal: 13, minHeight: 39, borderRadius: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, alignItems: "center" as const, justifyContent: "center" as const },
  machineChipActive: { backgroundColor: colors.action, borderColor: colors.action },
  machineChipTitle: { color: colors.muted, fontSize: 11, fontWeight: "800" as const },
  machineChipTitleActive: { color: "#FFFFFF" },
  machineCard: { flexDirection: "column" as const, gap: 8, padding: 10, minWidth: 205, flexGrow: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  machineCardActive: { borderColor: colors.blue, backgroundColor: "#F2F7FD" },
  detailsHeading: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: 10 },
  driverForm: { backgroundColor: "#F7FAFD", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13, gap: 9 },
  historyBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 9 },
  historyRow: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#FBFCFE", borderRadius: 10, padding: 10, gap: 4 },
  machinePress: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  machineIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#EDF4FC", alignItems: "center" as const, justifyContent: "center" as const },
  machineName: { color: colors.ink, fontSize: 12, fontWeight: "900" as const, textAlign: "right" as const },
  machineMeta: { color: colors.muted, fontSize: 10, textAlign: "right" as const, marginTop: 3 },
  machinePicker: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  machineOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: "#FBFCFE" },
  machineOptionSelected: { borderColor: colors.blue, backgroundColor: "#EDF4FC" },
  machineOptionText: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
  machineOptionTextSelected: { color: colors.blue, fontWeight: "800" as const },
  helper: { color: colors.muted, fontSize: 10, textAlign: "right" as const, lineHeight: 16 },
  attachButton: { minHeight: 40, borderWidth: 1, borderColor: "#B7CCE2", borderRadius: 10, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 7, backgroundColor: "#F7FAFD" },
  attachText: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  fileName: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
  saveButton: { minHeight: 44, borderRadius: 11, backgroundColor: colors.action, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 2 },
  saveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" as const },
  disabled: { opacity: 0.5 },
  loading: { padding: 20, alignItems: "center" as const },
  emptyCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 18, alignItems: "center" as const },
  emptyText: { color: colors.muted, textAlign: "center" as const, fontSize: 12, lineHeight: 19 },
  emptyHint: { color: colors.blue, textAlign: "center" as const, fontSize: 10, marginTop: 6 },
  partCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 16, gap: 12 },
  partTop: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8 },
  partName: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  partMachine: { color: colors.muted, fontSize: 10, textAlign: "right" as const, marginTop: 4 },
  stockBadge: { borderRadius: 8, backgroundColor: "#EAF7F0", paddingHorizontal: 9, paddingVertical: 6 },
  stockBadgeText: { color: colors.green, fontSize: 10, fontWeight: "800" as const },
  detailGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 9 },
  detail: { flexBasis: "30%" as const, flexGrow: 1, gap: 3 },
  detailLabel: { color: colors.muted, fontSize: 9, textAlign: "right" as const },
  detailValue: { color: colors.ink, fontSize: 10, fontWeight: "700" as const, textAlign: "right" as const },
  costLine: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  costLabel: { color: colors.ink, fontSize: 10, fontWeight: "800" as const },
  costValue: { color: colors.blue, fontSize: 12, fontWeight: "900" as const },
  notes: { color: colors.muted, fontSize: 10, textAlign: "right" as const, lineHeight: 16 },
  recordedBy: { color: colors.muted, fontSize: 9, textAlign: "right" as const },
  attachmentBlock: { gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  attachmentList: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  attachmentChip: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, borderRadius: 8, backgroundColor: "#EDF4FC", paddingHorizontal: 8, paddingVertical: 6, maxWidth: "100%" as const },
  attachmentName: { color: colors.blue, fontSize: 10, maxWidth: 210 },
  error: { backgroundColor: colors.redSoft, color: colors.red, padding: 11, borderRadius: 10, textAlign: "right" as const, fontSize: 11 },
  notice: { backgroundColor: colors.greenSoft, color: colors.green, padding: 11, borderRadius: 10, textAlign: "right" as const, fontSize: 11 },
  center: { flex: 1, padding: 22, justifyContent: "center" as const, gap: 16, backgroundColor: colors.background },
  denied: { color: colors.muted, textAlign: "center" as const, lineHeight: 21 },
  secondaryButton: { alignSelf: "center" as const, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: colors.navy, fontWeight: "800" as const },
};
makeStylesReactive(styles);
