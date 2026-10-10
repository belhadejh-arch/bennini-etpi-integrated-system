import { useAuth, useUser } from "../../lib/auth";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle, ArrowRight, Building2, CalendarClock, Check, FilePlus2,
  Pencil, Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import AttachmentActions from "../components/AttachmentActions";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, apiUrl, type Member } from "../../lib/api";
import { attachmentPickerTypes } from "../../lib/attachments";
import { colors, formatDzd } from "../../lib/theme";
import { canUploadFiles, hasPermission } from "../../shared/access";

type Status = "active" | "completed" | "cancelled";
type RatePeriod = "daily" | "monthly";
type Attachment = { id: number; file_name: string; mime_type: string; file_size: number };
type Rental = {
  id: number;
  equipment: string;
  client_or_owner: string;
  start_date: string;
  end_date: string;
  total_amount: number | string;
  paid_amount: number | string;
  remaining: number | string;
  status: Status;
  rate_period: RatePeriod;
  rental_rate: number | string;
  duration: number;
  notes: string;
  attachments: Attachment[];
};
type RentalAlert = {
  id: number;
  equipment: string;
  client_or_owner: string;
  end_date: string;
  days_until_end: number;
};
type RentalResult = { items: Rental[]; dueAlertCount: number; dueAlerts: RentalAlert[] };
type Draft = {
  equipment: string;
  clientOrOwner: string;
  startDate: string;
  endDate: string;
  ratePeriod: RatePeriod;
  rentalRate: string;
  paidAmount: string;
  status: Status;
  notes: string;
};
type PickedDocument = DocumentPicker.DocumentPickerAsset;
type ApiError = Error & { status?: number; body?: { pending?: boolean } };

const statusLabels: Record<Status, string> = { active: "جاري", completed: "منتهٍ", cancelled: "ملغى" };
const rateLabels: Record<RatePeriod, string> = { daily: "يومي", monthly: "شهري" };
const statusOptions: Array<{ value: Status | ""; label: string }> = [
  { value: "", label: "كل الحالات" },
  { value: "active", label: "جاري" },
  { value: "completed", label: "منتهٍ" },
  { value: "cancelled", label: "ملغى" },
];

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function emptyDraft(): Draft {
  return {
    equipment: "", clientOrOwner: "", startDate: localDate(), endDate: localDate(),
    ratePeriod: "daily", rentalRate: "", paidAmount: "0", status: "active", notes: "",
  };
}

function dateLabel(value: string) {
  return value ? value.slice(0, 10) : "—";
}

function amount(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function durationFor(start: string, end: string, period: RatePeriod) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return 0;
  const days = Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
  return period === "monthly" ? Math.ceil(days / 30) : days;
}

function daysUntil(value: string) {
  return Math.round((Date.parse(`${dateLabel(value)}T00:00:00Z`) - Date.parse(`${localDate()}T00:00:00Z`)) / 86400000);
}

function rentalStatusTone(status: Status) {
  if (status === "completed") return styles.statusCompleted;
  if (status === "cancelled") return styles.statusCancelled;
  return styles.statusActive;
}

export default function RentalsSection() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ focusId?: string | string[] }>();
  const focusId = Array.isArray(routeParams.focusId) ? routeParams.focusId[0] : routeParams.focusId;
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [items, setItems] = useState<Rental[]>([]);
  const [dueAlerts, setDueAlerts] = useState<RentalAlert[]>([]);
  const [dueAlertCount, setDueAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Rental | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pickedDocs, setPickedDocs] = useState<PickedDocument[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAdmin = member?.role === "admin";
  const canAccess = hasPermission(member, "rentals", "view");
  const canCreate = hasPermission(member, "rentals", "create");
  const canEdit = hasPermission(member, "rentals", "edit");
  const canManage = canCreate || canEdit;
  const canAddAttachments = canManage && canUploadFiles(member);
  const duration = durationFor(draft.startDate, draft.endDate, draft.ratePeriod);
  const totalAmount = Math.round(duration * amount(draft.rentalRate) * 100) / 100;
  const remainingAmount = Math.max(0, totalAmount - amount(draft.paidAmount));
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || `${item.id} ${item.equipment} ${item.client_or_owner} ${item.notes} ${item.status} ${item.start_date} ${item.end_date}`.toLowerCase().includes(term);
    const matchesDateRange = (!dateFrom || item.end_date.slice(0, 10) >= dateFrom) &&
      (!dateTo || item.start_date.slice(0, 10) <= dateTo);
    return matchesStatus && matchesSearch && matchesDateRange;
  }), [dateFrom, dateTo, items, search, statusFilter]);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const [me, result] = await Promise.all([
        apiRequest<{ member: Member }>("/me", token),
        apiRequest<RentalResult>(`/rentals${focusId ? `?focusId=${encodeURIComponent(focusId)}` : ""}`, token),
      ]);
      setMember(me.member);
      setItems(result.items);
      setDueAlerts(result.dueAlerts);
      setDueAlertCount(result.dueAlertCount);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل سجل الكراء.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [focusId, getToken, isSignedIn]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (isSignedIn) void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setPickedDocs([]);
    setDraft(emptyDraft());
  };

  const startCreate = () => {
    setError("");
    setEditing(null);
    setPickedDocs([]);
    setDraft(emptyDraft());
    setFormOpen(true);
  };

  const startEdit = (rental: Rental) => {
    setError("");
    setEditing(rental);
    setPickedDocs([]);
    setDraft({
      equipment: rental.equipment,
      clientOrOwner: rental.client_or_owner,
      startDate: dateLabel(rental.start_date),
      endDate: dateLabel(rental.end_date),
      ratePeriod: rental.rate_period || "daily",
      rentalRate: String(rental.rental_rate ?? 0),
      paidAmount: String(rental.paid_amount),
      status: rental.status,
      notes: rental.notes || "",
    });
    setFormOpen(true);
  };

  const uploadDocuments = async (rentalId: number, documents: PickedDocument[]) => {
    if (!documents.length) return;
    const formData = new FormData();
    documents.forEach((asset) => {
      if (Platform.OS === "web" && asset.file) formData.append("files", asset.file, asset.name);
      else formData.append("files", {
        uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream",
      } as unknown as Blob);
    });
    await apiRequest(`/rentals/${rentalId}/attachments`, () => getToken(), { method: "POST", body: formData });
  };

  const chooseDocuments = async () => {
    const available = 5 - (editing?.attachments.length ?? 0) - pickedDocs.length;
    if (available <= 0) {
      setError("الحد الأقصى هو خمسة مستندات لكل عقد كراء.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: [...attachmentPickerTypes],
      });
      if (!result.canceled && result.assets.length) {
        setPickedDocs((current) => [...current, ...result.assets].slice(0, available));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اختيار المستند.");
    }
  };

  const saveRental = async () => {
    if (!draft.equipment.trim() || !draft.clientOrOwner.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.endDate) ||
        draft.endDate < draft.startDate || amount(draft.rentalRate) < 0 ||
        !Number.isFinite(Number(draft.rentalRate)) || amount(draft.paidAmount) < 0 ||
        !Number.isFinite(Number(draft.paidAmount)) || amount(draft.paidAmount) > totalAmount) {
      setError("أكمل بيانات الكراء وتحقق من صحة التواريخ والمبلغ المدفوع.");
      return;
    }
    setSaving(true);
    setError("");
    let savedId: number | null = null;
    try {
      const payload = JSON.stringify({
        ...draft,
        equipment: draft.equipment.trim(),
        clientOrOwner: draft.clientOrOwner.trim(),
        rentalRate: amount(draft.rentalRate),
        paidAmount: amount(draft.paidAmount),
        notes: draft.notes.trim(),
      });
      if (editing) {
        await apiRequest(`/rentals/${editing.id}`, () => getToken(), { method: "PATCH", body: payload });
        savedId = editing.id;
      } else {
        const result = await apiRequest<{ id: number }>("/rentals", () => getToken(), { method: "POST", body: payload });
        savedId = result.id;
      }
      if (pickedDocs.length && savedId) await uploadDocuments(savedId, pickedDocs);
      closeForm();
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "تعذر حفظ عملية الكراء.";
      if (savedId) {
        closeForm();
        setError(`تم حفظ بيانات الكراء، لكن تعذر رفع المرفق. ${message}`);
        await refresh();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (rental: Rental, status: Status) => {
    const payload = {
      equipment: rental.equipment,
      clientOrOwner: rental.client_or_owner,
      startDate: dateLabel(rental.start_date),
      endDate: dateLabel(rental.end_date),
      ratePeriod: rental.rate_period,
      rentalRate: amount(rental.rental_rate),
      paidAmount: amount(rental.paid_amount),
      status,
      notes: rental.notes,
    };
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/rentals/${rental.id}`, () => getToken(), { method: "PATCH", body: JSON.stringify(payload) });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحديث حالة الكراء.");
    } finally {
      setSaving(false);
    }
  };

  const addAttachments = async (rental: Rental) => {
    const available = 5 - rental.attachments.length;
    if (available <= 0) return setError("وصل العقد إلى الحد الأقصى للمرفقات.");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true, copyToCacheDirectory: true,
        type: [...attachmentPickerTypes],
      });
      if (result.canceled || !result.assets.length) return;
      setSaving(true);
      await uploadDocuments(rental.id, result.assets.slice(0, available));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إرفاق المستند.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRental = (rental: Rental) => {
    const remove = async () => {
      setSaving(true);
      setError("");
      try {
        await apiRequest(`/rentals/${rental.id}`, () => getToken(), { method: "DELETE" });
        await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "تعذر حذف عقد الكراء.");
      } finally {
        setSaving(false);
      }
    };
    const message = `سيتم حذف عقد كراء ${rental.equipment} وجميع مرفقاته. هل تريد المتابعة؟`;
    if (Platform.OS === "web") {
      if (window.confirm(message)) void remove();
    } else {
      Alert.alert("حذف عقد الكراء", message, [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => void remove() },
      ]);
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const url = apiUrl(`/api/rental-attachments/${attachment.id}`);
      if (Platform.OS === "web") {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("تعذر تحميل المرفق.");
        const objectUrl = URL.createObjectURL(await response.blob());
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        const base = FileSystem.documentDirectory;
        if (!base) throw new Error("مساحة حفظ الملفات غير متاحة.");
        const safeName = attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const downloaded = await FileSystem.downloadAsync(url, `${base}${Date.now()}-${safeName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await Sharing.shareAsync(downloaded.uri, { mimeType: attachment.mime_type, dialogTitle: attachment.file_name });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر فتح المرفق.");
    }
  };

  if ((!member?.active || !canAccess) && !loading && isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>{error || "الحساب غير مفعل أو لا يملك صلاحية الوصول إلى قسم الكراء."}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryButtonText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title="إدارة الكراء"
        leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.headingRow}>
            <View style={styles.headingIcon}><Building2 size={20} color={colors.blue} /></View>
            <Text style={styles.title}>سجل الكراء والآليات</Text>
          </View>
          <Text style={styles.subtitle}>متابعة العقود والمبالغ المدفوعة ومواعيد إرجاع المعدات والممتلكات.</Text>
        </View>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void refresh()} accessibilityLabel="إعادة تحميل سجل الكراء"><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable>
            <Pressable onPress={() => setError("")} accessibilityLabel="إغلاق التنبيه"><X size={17} color={colors.red} /></Pressable>
          </View>
        ) : null}

        {dueAlertCount > 0 ? (
          <View style={styles.alertPanel}>
            <View style={styles.alertHeading}>
              <AlertTriangle size={19} color={colors.red} />
              <Text style={styles.alertTitle}>تنبيه نهاية الكراء — {dueAlertCount} عقد</Text>
            </View>
            <Text style={styles.alertDescription}>عقود نشطة تنتهي خلال سبعة أيام أو انتهت مدتها.</Text>
            {dueAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertName}>{alert.equipment} · {alert.client_or_owner}</Text>
                  <Text style={styles.alertMeta}>
                    {alert.days_until_end < 0
                      ? `انتهى منذ ${Math.abs(alert.days_until_end)} يوم`
                      : alert.days_until_end === 0
                        ? "ينتهي اليوم"
                        : `ينتهي خلال ${alert.days_until_end} ${alert.days_until_end === 1 ? "يوم" : "أيام"}`}
                  </Text>
                </View>
                <CalendarClock size={17} color={colors.red} />
              </View>
            ))}
            {dueAlertCount > dueAlerts.length ? <Text style={styles.alertMore}>وعقود أخرى عددها {dueAlertCount - dueAlerts.length}.</Text> : null}
          </View>
        ) : null}

        {canCreate ? (
          <Pressable onPress={formOpen ? closeForm : startCreate} disabled={saving} style={styles.addButton}>
            {formOpen ? <X size={17} color={colors.navy} /> : <Plus size={18} color={colors.navy} />}
            <Text style={styles.addButtonText}>{formOpen ? "إغلاق النموذج" : "تسجيل عملية كراء"}</Text>
          </Pressable>
        ) : null}

        {formOpen && (editing ? canEdit : canCreate) ? (
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <Text style={styles.cardHeading}>{editing ? "تعديل عملية الكراء" : "بيانات عملية الكراء"}</Text>
              <Text style={styles.requiredHint}>الحقول ذات * مطلوبة</Text>
            </View>
            <View style={styles.formGrid}>
              <Field label="الشيء المؤجر *" value={draft.equipment} onChange={(value) => setField("equipment", value)} placeholder="اسم الآلية أو المعدة" />
              <Field label="اسم المستأجر / المؤجر *" value={draft.clientOrOwner} onChange={(value) => setField("clientOrOwner", value)} placeholder="الاسم أو الجهة" />
              <Field label="تاريخ بداية الكراء *" value={draft.startDate} onChange={(value) => setField("startDate", value)} placeholder="YYYY-MM-DD" />
              <Field label="تاريخ نهاية الكراء *" value={draft.endDate} onChange={(value) => setField("endDate", value)} placeholder="YYYY-MM-DD" />
              <Field label={`السعر ${rateLabels[draft.ratePeriod]} (دج) *`} value={draft.rentalRate} onChange={(value) => setField("rentalRate", value)} placeholder="0" numeric />
              <Field label="المبلغ المدفوع (دج)" value={draft.paidAmount} onChange={(value) => setField("paidAmount", value)} placeholder="0" numeric />
            </View>

            <Text style={styles.fieldLabel}>طريقة احتساب السعر</Text>
            <View style={styles.choiceRow}>
              {(["daily", "monthly"] as const).map((period) => (
                <Choice key={period} label={period === "daily" ? "يومي" : "شهري"} selected={draft.ratePeriod === period}
                  onPress={() => setField("ratePeriod", period)} />
              ))}
            </View>
            <Text style={styles.helper}>الشهور تُحسب على أساس 30 يوماً، مع تقريب المدة الجزئية إلى شهر كامل.</Text>

            <View style={styles.calculationBox}>
              <Calc label="مدة الكراء" value={duration ? `${duration} ${draft.ratePeriod === "daily" ? "يوم" : "شهر"}` : "تحقق من التواريخ"} />
              <Calc label="المبلغ الإجمالي" value={formatDzd(totalAmount)} />
              <Calc label="المبلغ المتبقي" value={formatDzd(remainingAmount)} highlight />
            </View>

            <Text style={styles.fieldLabel}>حالة الكراء</Text>
            <View style={styles.choiceRow}>
              {(["active", "completed", "cancelled"] as const).map((status) => (
                <Choice key={status} label={statusLabels[status]} selected={draft.status === status}
                  onPress={() => setField("status", status)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>ملاحظات</Text>
            <TextInput style={[styles.input, styles.multiline]} value={draft.notes} onChangeText={(value) => setField("notes", value)}
              placeholder="ملاحظات إضافية" placeholderTextColor="#98A5B4" multiline />

            {editing?.attachments.length ? (
              <View style={styles.formAttachments}>
                <Text style={styles.fieldLabel}>المستندات المرفقة</Text>
                <View style={styles.chipRow}>
                  {editing.attachments.map((attachment) => (
                    <AttachmentActions key={attachment.id} attachment={attachment} section="rentals"
                      url={`/api/rental-attachments/${attachment.id}`} canDelete={false} onDeleted={() => undefined} />
                  ))}
                </View>
              </View>
            ) : null}
            {canAddAttachments ? (
              <Pressable onPress={() => void chooseDocuments()} disabled={saving} style={styles.outlineButton}>
                <FilePlus2 size={16} color={colors.blue} />
                <Text style={styles.outlineButtonText}>إرفاق العقد أو وثائق الكراء</Text>
              </Pressable>
            ) : null}
            {pickedDocs.length ? (
              <View style={styles.pickedList}>
                {pickedDocs.map((doc, index) => (
                  <View key={`${doc.name}-${index}`} style={styles.pickedRow}>
                    <Text numberOfLines={1} style={styles.pickedName}>{doc.name}</Text>
                    <Pressable onPress={() => setPickedDocs((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      <X size={15} color={colors.red} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable onPress={() => void saveRental()} disabled={saving || !duration || amount(draft.paidAmount) > totalAmount}
              style={[styles.saveButton, (saving || !duration || amount(draft.paidAmount) > totalAmount) && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editing ? "حفظ التعديلات" : "حفظ عملية الكراء"}</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.searchCard}>
          <View style={styles.searchBox}>
            <Search size={18} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} style={styles.searchInput}
              placeholder="ابحث عن المعدة أو المستأجر" placeholderTextColor="#98A5B4" accessibilityLabel="بحث في عقود الكراء" />
            {search ? <Pressable onPress={() => setSearch("")}><X size={17} color={colors.muted} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            {statusOptions.map((option) => (
              <Choice key={option.value || "all"} label={option.label} selected={statusFilter === option.value}
                onPress={() => setStatusFilter(option.value as Status | "")} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <TextInput value={dateFrom} onChangeText={setDateFrom}
              style={{ minWidth: 135, flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, color: colors.ink, textAlign: "right", fontSize: 11 }}
              placeholder="تداخل مع تاريخ من" placeholderTextColor="#98A5B4" accessibilityLabel="تصفية الكراء ابتداءً من تاريخ" />
            <TextInput value={dateTo} onChangeText={setDateTo}
              style={{ minWidth: 135, flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, color: colors.ink, textAlign: "right", fontSize: 11 }}
              placeholder="تداخل مع تاريخ إلى" placeholderTextColor="#98A5B4" accessibilityLabel="تصفية الكراء حتى تاريخ" />
            {dateFrom || dateTo ? <Pressable onPress={() => { setDateFrom(""); setDateTo(""); }} style={{ minHeight: 38, justifyContent: "center", paddingHorizontal: 8 }}><Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>مسح التاريخ</Text></Pressable> : null}
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>سجل عمليات الكراء</Text>
          <Text style={styles.listCount}>{filteredItems.length} عقد</Text>
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.muted}>جارٍ تحميل عقود الكراء...</Text></View>
        ) : filteredItems.length ? (
          filteredItems.map((rental) => {
            const left = daysUntil(rental.end_date);
            const isDueSoon = rental.status === "active" && left <= 7;
            return (
              <View key={rental.id} style={[styles.rentalCard, isDueSoon && styles.rentalCardDue]}>
                <View style={styles.rentalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rentalTitle}>{rental.equipment}</Text>
                    <Text style={styles.rentalSubheading}>{rental.client_or_owner}</Text>
                  </View>
                  <View style={styles.amountStatus}>
                    <Text style={styles.totalAmount}>{formatDzd(amount(rental.total_amount))}</Text>
                    <View style={[styles.statusBadge, rentalStatusTone(rental.status)]}>
                      <Text style={styles.statusText}>{statusLabels[rental.status]}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.detailsGrid}>
                  <Detail label="بداية الكراء" value={dateLabel(rental.start_date)} />
                  <Detail label="نهاية الكراء" value={dateLabel(rental.end_date)} highlight={isDueSoon} />
                  <Detail label="مدة الكراء" value={`${rental.duration} ${rental.rate_period === "monthly" ? "شهر" : "يوم"}`} />
                  <Detail label={`السعر ${rateLabels[rental.rate_period]}`} value={formatDzd(amount(rental.rental_rate))} />
                  <Detail label="المبلغ المدفوع" value={formatDzd(amount(rental.paid_amount))} />
                  <Detail label="المبلغ المتبقي" value={formatDzd(amount(rental.remaining))} highlight={amount(rental.remaining) > 0} />
                  {isDueSoon ? (
                    <Detail label="تنبيه النهاية" value={left < 0 ? `انتهى منذ ${Math.abs(left)} يوم` : left === 0 ? "ينتهي اليوم" : `خلال ${left} يوم`} highlight />
                  ) : null}
                </View>
                <RecordNotes entity="rental" recordId={rental.id} initialNotes={rental.notes} editable={canEdit} />
                {rental.attachments.length ? (
                  <View style={styles.attachmentBlock}>
                    <Text style={styles.fieldLabel}>العقد والوثائق</Text>
                    <View style={styles.chipRow}>
                      {rental.attachments.map((attachment) => (
                        <AttachmentActions key={attachment.id} attachment={attachment} section="rentals"
                          url={`/api/rental-attachments/${attachment.id}`}
                          canDelete={hasPermission(member, "rentals", "delete")}
                          onDeleted={() => void refresh()} />
                      ))}
                    </View>
                  </View>
                ) : <Text style={styles.noAttachment}>لا توجد وثائق مرفقة.</Text>}
                {canManage || hasPermission(member, "rentals", "delete") ? (
                  <View style={styles.actionsRow}>
                    {canEdit ? <ActionButton label="تعديل البيانات" onPress={() => startEdit(rental)} icon={<Pencil size={14} color={colors.blue} />} /> : null}
                    {canEdit && rental.status === "active" ? (
                      <ActionButton label="إنهاء الكراء" onPress={() => void changeStatus(rental, "completed")} icon={<Check size={14} color={colors.green} />} />
                    ) : null}
                    {canAddAttachments && rental.attachments.length < 5 ? (
                      <ActionButton label="إضافة مستند" onPress={() => void addAttachments(rental)} icon={<FilePlus2 size={14} color={colors.blue} />} />
                    ) : null}
                    {hasPermission(member, "rentals", "delete") ? <ActionButton label="حذف العقد" onPress={() => deleteRental(rental)} icon={<Trash2 size={14} color={colors.red} />} danger /> : null}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Building2 size={22} color={colors.blue} /></View>
            <Text style={styles.emptyTitle}>{items.length ? "لا توجد نتائج مطابقة" : "لا توجد عقود كراء مسجلة"}</Text>
            <Text style={styles.emptyText}>{items.length ? "جرّب تعديل البحث أو اختيار حالة أخرى." : "ستظهر هنا المعدات المؤجرة ومواعيدها ومبالغها."}</Text>
            {canManage && !items.length ? (
              <Pressable onPress={startCreate} style={styles.emptyAddButton}><Plus size={16} color="#FFFFFF" /><Text style={styles.emptyAddText}>تسجيل أول عملية كراء</Text></Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>الحساب: {member?.name || user?.firstName || ""}</Text>
        <Text style={styles.footerText}>{canManage ? "صلاحية إدارة الكراء" : "عرض فقط"}</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, numeric }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor="#98A5B4" keyboardType={numeric ? "decimal-pad" : "default"} />
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}>
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Calc({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.calculationCell}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={[styles.calcValue, highlight && { color: colors.blue }]}>{value}</Text>
    </View>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailDue]}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, icon, danger }: { label: string; onPress: () => void; icon: ReactNode; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.actionButton, danger && styles.actionButtonDanger]}>
      {icon}
      <Text style={[styles.actionText, danger && { color: colors.red }]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1100, alignSelf: "center" as const, padding: 20, paddingBottom: 36, gap: 16 },
  intro: { marginBottom: 1 },
  headingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  headingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EAF1FA", alignItems: "center" as const, justifyContent: "center" as const },
  title: { color: colors.navy, fontWeight: "900" as const, fontSize: 21, textAlign: "right" as const },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 7, textAlign: "right" as const, lineHeight: 18 },
  alertPanel: { backgroundColor: "#FFF1F0", borderColor: "#F4B8B5", borderWidth: 1, borderRadius: 15, padding: 14, gap: 8 },
  alertHeading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  alertTitle: { color: "#9E292E", fontWeight: "900" as const, fontSize: 14 },
  alertDescription: { color: "#81393B", fontSize: 11, lineHeight: 17, textAlign: "right" as const },
  alertRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, borderTopWidth: 1, borderTopColor: "#F3D2D0", paddingTop: 9 },
  alertName: { color: colors.ink, fontSize: 12, fontWeight: "800" as const, textAlign: "right" as const },
  alertMeta: { color: colors.red, fontSize: 10, marginTop: 3, textAlign: "right" as const },
  alertMore: { color: "#81393B", fontSize: 10, textAlign: "right" as const, paddingTop: 3 },
  addButton: { minHeight: 48, borderRadius: 13, backgroundColor: colors.yellow, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  addButtonText: { color: colors.navy, fontWeight: "900" as const, fontSize: 13 },
  formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 18 },
  formHeading: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10, marginBottom: 12 },
  cardHeading: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  requiredHint: { color: colors.muted, fontSize: 10 },
  formGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  field: { flexGrow: 1, flexBasis: 220 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "800" as const, textAlign: "right" as const, marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, paddingHorizontal: 12, fontSize: 13 },
  multiline: { minHeight: 75, textAlignVertical: "top" as const, paddingTop: 10, marginBottom: 10 },
  choiceRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, marginBottom: 8 },
  filterChip: { minHeight: 34, borderRadius: 10, paddingHorizontal: 12, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#F3F6FA", borderWidth: 1, borderColor: colors.border },
  filterChipSelected: { backgroundColor: "#E7F0FB", borderColor: "#A9C5E6" },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: "800" as const },
  filterTextSelected: { color: colors.blue },
  helper: { color: colors.muted, fontSize: 10, textAlign: "right" as const, marginTop: -3, marginBottom: 11 },
  calculationBox: { backgroundColor: "#F5F8FC", borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: "row" as const, flexWrap: "wrap" as const, padding: 10, gap: 10, marginBottom: 13 },
  calculationCell: { flexGrow: 1, flexBasis: 120, gap: 4 },
  calcLabel: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
  calcValue: { color: colors.ink, fontSize: 12, fontWeight: "900" as const, textAlign: "right" as const },
  formAttachments: { marginBottom: 12 },
  chipRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, marginTop: 7 },
  attachmentChip: { maxWidth: 240, minHeight: 32, borderRadius: 9, borderWidth: 1, borderColor: "#D6E3F2", backgroundColor: "#F3F7FC", paddingHorizontal: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  attachmentName: { flexShrink: 1, color: colors.blue, fontSize: 10, fontWeight: "700" as const },
  outlineButton: { minHeight: 41, borderRadius: 10, borderWidth: 1, borderColor: "#C9D9EA", backgroundColor: "#F7FAFD", alignItems: "center" as const, justifyContent: "center" as const, flexDirection: "row" as const, gap: 7, marginBottom: 8 },
  outlineButtonText: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  pickedList: { borderRadius: 10, backgroundColor: "#F6F8FB", paddingHorizontal: 10, marginBottom: 8 },
  pickedRow: { minHeight: 34, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickedName: { flex: 1, color: colors.ink, fontSize: 10, textAlign: "right" as const },
  saveButton: { minHeight: 45, borderRadius: 11, backgroundColor: colors.blue, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 6 },
  saveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" as const },
  disabled: { opacity: 0.5 },
  searchCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 10, gap: 10 },
  searchBox: { minHeight: 42, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  searchInput: { flex: 1, color: colors.ink, textAlign: "right" as const, fontSize: 11, paddingVertical: 7 },
  filtersRow: { flexDirection: "row" as const, gap: 7 },
  listHeading: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  listTitle: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  listCount: { color: colors.muted, fontSize: 10 },
  loading: { minHeight: 130, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, backgroundColor: colors.surface, borderRadius: 15 },
  muted: { color: colors.muted, fontSize: 11 },
  rentalCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 17, gap: 13 },
  rentalCardDue: { borderColor: "#F2C1BE" },
  rentalHeader: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 12 },
  rentalTitle: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  rentalSubheading: { color: colors.muted, fontSize: 11, marginTop: 4, textAlign: "right" as const },
  amountStatus: { alignItems: "flex-start" as const, gap: 7 },
  totalAmount: { color: colors.blue, fontSize: 13, fontWeight: "900" as const },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusActive: { backgroundColor: colors.greenSoft },
  statusCompleted: { backgroundColor: "#EEF1F5" },
  statusCancelled: { backgroundColor: colors.redSoft },
  statusText: { color: colors.ink, fontSize: 9, fontWeight: "800" as const },
  detailsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11 },
  detailCell: { flexGrow: 1, flexBasis: 120, gap: 4 },
  detailLabel: { color: colors.muted, fontSize: 9, textAlign: "right" as const },
  detailValue: { color: colors.ink, fontSize: 11, fontWeight: "800" as const, textAlign: "right" as const },
  detailDue: { color: colors.red },
  notes: { color: colors.muted, backgroundColor: "#F8FAFC", borderRadius: 9, padding: 9, fontSize: 10, lineHeight: 16, textAlign: "right" as const },
  attachmentBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  noAttachment: { color: colors.muted, fontSize: 9, textAlign: "right" as const },
  actionsRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  actionButton: { minHeight: 33, borderRadius: 9, borderWidth: 1, borderColor: "#D6E3F2", backgroundColor: "#F6F9FD", paddingHorizontal: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
  actionButtonDanger: { borderColor: "#F1C6C7", backgroundColor: "#FFF7F7" },
  actionText: { color: colors.blue, fontSize: 9, fontWeight: "800" as const },
  emptyCard: { minHeight: 210, alignItems: "center" as const, justifyContent: "center" as const, gap: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 18 },
  emptyIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#EAF1FA", alignItems: "center" as const, justifyContent: "center" as const },
  emptyTitle: { color: colors.navy, fontSize: 14, fontWeight: "900" as const },
  emptyText: { color: colors.muted, fontSize: 10, textAlign: "center" as const, lineHeight: 16 },
  emptyAddButton: { minHeight: 37, borderRadius: 10, backgroundColor: colors.blue, paddingHorizontal: 12, flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: 4 },
  emptyAddText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" as const },
  error: { backgroundColor: colors.redSoft, borderRadius: 11, padding: 12, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 9 },
  errorText: { flex: 1, color: colors.red, fontSize: 11, lineHeight: 17, textAlign: "right" as const },
  retryText: { color: colors.blue, fontSize: 10, fontWeight: "800" as const },
  center: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: 14, backgroundColor: colors.background, padding: 24 },
  denied: { color: colors.red, textAlign: "center" as const, lineHeight: 21, fontSize: 12 },
  secondaryButton: { minHeight: 42, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "center" as const, paddingHorizontal: 14 },
  secondaryButtonText: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  footer: { minHeight: 47, backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { color: colors.muted, fontSize: 9 },
};
