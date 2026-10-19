import { useAuth, useUser } from "../../lib/auth";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle, ArrowRight, Check, ClipboardCheck, FilePlus2, Fuel,
  HardHat, ImagePlus, RefreshCw, Search, Send, X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import AttachmentActions from "../components/AttachmentActions";
import MachineryPicker, { type MachineryOption } from "../components/MachineryPicker";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, apiUrl, type Member } from "../../lib/api";
import { attachmentPickerTypes } from "../../lib/attachments";
import { colors, formatDzd, formatDateTime, makeStylesReactive } from "../../lib/theme";
import { displayValue, translate } from "../../lib/localization";
import { canUploadFiles, hasPermission } from "../../shared/access";

type ReviewStatus = "pending" | "reviewed";
type Attachment = { id: number; file_name: string; mime_type: string; file_size: number };
type FieldExpense = {
  id: number;
  machinery_id: number | null;
  machinery_name: string | null;
  machinery_code: string | null;
  category: string;
  amount: number | string;
  site_name: string;
  details: string;
  notes: string;
  fuel_liters: number | string | null;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  review_status: ReviewStatus;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string;
  attachments: Attachment[];
};
type Result = { items: FieldExpense[]; pendingCount: number };
type Draft = {
  machineryId: string;
  category: string;
  amount: string;
  siteName: string;
  details: string;
  fuelLiters: string;
  notes: string;
};
type PickedDocument = DocumentPicker.DocumentPickerAsset;
type ApiError = Error & { status?: number; body?: { pending?: boolean } };

const quickCategories = ["مازوت", "قطع غيار", "مشتريات", "إصلاح آلية", "مصاريف أخرى"];
const emptyDraft = (): Draft => ({
  machineryId: "",
  category: "مازوت",
  amount: "",
  siteName: "",
  details: "",
  fuelLiters: "",
  notes: "",
});

function localAmount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDateTime(date);
}

export default function FieldExpensesSection() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ focusId?: string | string[] }>();
  const focusId = Array.isArray(routeParams.focusId) ? routeParams.focusId[0] : routeParams.focusId;
  const { isLoaded, isSignedIn, getToken, getMember, language } = useAuth();
  const t = (text: string) => translate(text, language);
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [items, setItems] = useState<FieldExpense[]>([]);
  const [machineryOptions, setMachineryOptions] = useState<MachineryOption[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pickedDocs, setPickedDocs] = useState<PickedDocument[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAdmin = member?.role === "admin";
  const canAccess = hasPermission(member, "field", "view");
  const canRecord = hasPermission(member, "field", "create");
  const canEdit = hasPermission(member, "field", "edit");
  const canAddAttachments = canUploadFiles(member) && (canRecord || canEdit);
  const visibleItems = useMemo(
    () => items.filter((item) =>
      (statusFilter === "all" || item.review_status === statusFilter) &&
      (categoryFilter === "all" || item.category === categoryFilter) &&
      (!dateFrom || item.created_at.slice(0, 10) >= dateFrom) &&
      (!dateTo || item.created_at.slice(0, 10) <= dateTo) &&
       (!search.trim() || `${item.id} ${item.category} ${item.site_name} ${item.machinery_name ?? ""} ${item.machinery_code ?? ""} ${item.created_by_name} ${item.details} ${item.notes} ${item.review_status}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))),
    [categoryFilter, dateFrom, dateTo, items, search, statusFilter],
  );

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const [me, result, machines] = await Promise.all([
        getMember(),
        apiRequest<Result>(`/field-expenses${focusId ? `?focusId=${encodeURIComponent(focusId)}` : ""}`, token),
        apiRequest<{ items: MachineryOption[] }>("/machinery/options", token),
      ]);
      setMember(me.member);
      setItems(result.items);
      setMachineryOptions(machines.items);
      setPendingCount(result.pendingCount);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل مصاريف الميدان.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [focusId, getToken, getMember, isSignedIn]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (isSignedIn) void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const closeForm = () => {
    setFormOpen(false);
    setDraft(emptyDraft());
    setPickedDocs([]);
  };

  const uploadDocuments = async (expenseId: number, documents: PickedDocument[]) => {
    if (!documents.length) return;
    const data = new FormData();
    documents.forEach((asset) => {
      if (Platform.OS === "web" && asset.file) data.append("files", asset.file, asset.name);
      else data.append("files", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/octet-stream",
      } as unknown as Blob);
    });
    await apiRequest(`/field-expenses/${expenseId}/attachments`, () => getToken(), {
      method: "POST",
      body: data,
    });
  };

  const chooseDocuments = async () => {
    const available = 5 - pickedDocs.length;
    if (available <= 0) {
      setError("الحد الأقصى هو خمسة صور أو وثائق للعملية الواحدة.");
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
      setError(caught instanceof Error ? caught.message : "تعذر اختيار الصور أو الوثائق.");
    }
  };

  const submitExpense = async () => {
    const amount = Number(draft.amount);
    const liters = draft.fuelLiters.trim() ? Number(draft.fuelLiters) : undefined;
    const requiresMachinery = ["مازوت", "قطع غيار", "إصلاح آلية"].includes(draft.category);
    if (requiresMachinery && !draft.machineryId) {
      setError("اختر الآلة المرتبطة بالمازوت أو قطع الغيار أو الإصلاح.");
      return;
    }
    if (!draft.category.trim() || !draft.siteName.trim() || !Number.isFinite(amount) || amount <= 0 ||
        (draft.category === "مازوت" && (!liters || !Number.isFinite(liters) || liters <= 0)) ||
        (liters !== undefined && (!Number.isFinite(liters) || liters <= 0))) {
      setError("أدخل موقع العمل والمبلغ، وحدد كمية المازوت باللتر عند تسجيله.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    let savedId: number | null = null;
    try {
      const result = await apiRequest<{ item: FieldExpense }>("/field-expenses", () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          category: draft.category,
          machineryId: draft.machineryId ? Number(draft.machineryId) : null,
          amount,
          siteName: draft.siteName.trim(),
          details: draft.details.trim(),
          fuelLiters: liters,
          notes: draft.notes.trim(),
        }),
      });
      savedId = result.item.id;
      if (pickedDocs.length) await uploadDocuments(savedId, pickedDocs);
      closeForm();
      setSuccess("تم إرسال العملية إلى المنصة الرئيسية للمراجعة.");
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "تعذر إرسال العملية.";
      if (savedId) {
        closeForm();
        setError(`تم تسجيل العملية ومزامنتها، لكن تعذر رفع بعض المرفقات. ${message}`);
        await refresh();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const changeReview = async (expense: FieldExpense, status: ReviewStatus) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/field-expenses/${expense.id}/review`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSuccess(status === "reviewed" ? "تم تسجيل مراجعة العملية." : "أعيدت العملية إلى قائمة المراجعة.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحديث حالة المراجعة.");
    } finally {
      setSaving(false);
    }
  };

  const linkMachinery = async (expense: FieldExpense, machineryId: string) => {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/field-expenses/${expense.id}/machinery`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ machineryId: Number(machineryId) }),
      });
      await refresh();
      setSuccess("تم ربط العملية بالآلة مع الاحتفاظ ببيانات مسجلها ومرفقاتها.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر ربط العملية بالآلة.");
    } finally {
      setSaving(false);
    }
  };

  const addAttachments = async (expense: FieldExpense) => {
    const available = 5 - expense.attachments.length;
    if (available <= 0) {
      setError("وصلت العملية إلى الحد الأقصى للمرفقات.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true, copyToCacheDirectory: true,
        type: [...attachmentPickerTypes],
      });
      if (result.canceled || !result.assets.length) return;
      setSaving(true);
      setError("");
      await uploadDocuments(expense.id, result.assets.slice(0, available));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إرفاق المستند.");
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const url = apiUrl(`/api/field-expense-attachments/${attachment.id}`);
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
        const result = await FileSystem.downloadAsync(url, `${base}${Date.now()}-${safeName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await Sharing.shareAsync(result.uri, { mimeType: attachment.mime_type, dialogTitle: attachment.file_name });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر فتح المرفق.");
    }
  };

  if ((!member?.active || !canAccess) && !loading && isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>{error || "لا تملك صلاحية الوصول إلى مصاريف الميدان."}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryButtonText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t(isAdmin ? "مراجعة مصاريف الميدان" : "صفحة رئيس الأشغال")}
        leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.headingRow}>
            <View style={styles.headingIcon}><HardHat size={20} color={colors.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t(isAdmin ? "عمليات الميدان الواردة" : "تسجيل مصروف ميداني")}</Text>
              <Text style={styles.subtitle}>
                {t(isAdmin ? "تصل العمليات هنا مباشرة من رئيس الأشغال لمراجعتها دون إعادة إدخالها." : "أرسل المصاريف والمازوت والوثائق مباشرة إلى الإدارة.")}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{t(error)}</Text>
            <Pressable onPress={() => setError("")} accessibilityLabel="إغلاق التنبيه"><X size={17} color={colors.red} /></Pressable>
          </View>
        ) : null}
        {success ? (
          <View style={styles.success}>
            <Check size={16} color={colors.green} />
            <Text style={styles.successText}>{t(success)}</Text>
            <Pressable onPress={() => setSuccess("")} accessibilityLabel="إغلاق رسالة النجاح"><X size={15} color={colors.green} /></Pressable>
          </View>
        ) : null}

        {isAdmin ? (
          <View style={styles.reviewSummary}>
            <View style={styles.reviewIcon}><ClipboardCheck size={20} color={colors.amber} /></View>
            <View style={{ flex: 1 }}>
            <Text style={styles.reviewTitle}>{pendingCount ? `${pendingCount} ${language === "ar" ? "عملية بانتظار مراجعتك" : "opérations à valider"}` : t("لا توجد عمليات بانتظار المراجعة")}</Text>
              <Text style={styles.reviewHint}>{t("تظهر كل عملية مع بيانات مسجلها ووقت الإرسال ومرفقاتها.")}</Text>
            </View>
          </View>
        ) : null}

        {canRecord ? (
          <Pressable onPress={() => { setFormOpen((open) => !open); setError(""); setSuccess(""); }}
            disabled={saving} style={styles.addButton}>
            {formOpen ? <X size={18} color={colors.onAccent} /> : <PlusIcon />}
            <Text style={styles.addButtonText}>{t(formOpen ? "إغلاق النموذج" : "تسجيل عملية جديدة")}</Text>
          </Pressable>
        ) : null}

        {formOpen && canRecord ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t("ما نوع العملية؟")}</Text>
            <View style={styles.categoryGrid}>
              {quickCategories.map((category) => (
                <Pressable key={category} onPress={() => setDraft((current) => ({
                  ...current,
                  category,
                  machineryId: ["مازوت", "قطع غيار", "إصلاح آلية"].includes(category) ? current.machineryId : "",
                  fuelLiters: category === "مازوت" ? current.fuelLiters : "",
                }))}
                  style={[styles.categoryChip, draft.category === category && styles.categoryChipSelected]}>
                  {category === "مازوت" ? <Fuel size={15} color={draft.category === category ? colors.onAccent : colors.blue} /> : null}
                  <Text style={[styles.categoryText, draft.category === category && styles.categoryTextSelected]}>{displayValue(category, language)}</Text>
                </Pressable>
              ))}
            </View>

            {["مازوت", "قطع غيار", "إصلاح آلية"].includes(draft.category) ? (
              <MachineryPicker
                items={machineryOptions}
                value={draft.machineryId}
                label={t("الآلة المرتبطة بالعملية *")}
                emptyLabel={t("ابحث عن الآلة بالاسم أو الرقم")}
                onChange={(id) => setField("machineryId", id)}
              />
            ) : null}
            <View style={styles.formGrid}>
              <Field label="المبلغ (دج) *" value={draft.amount} onChange={(value) => setField("amount", value)} placeholder="مثال: 50000" numeric />
              {draft.category === "مازوت" ? (
                <Field label="الكمية باللتر *" value={draft.fuelLiters} onChange={(value) => setField("fuelLiters", value)} placeholder="مثال: 200" numeric />
              ) : null}
              <Field label="الورشة / موقع العمل *" value={draft.siteName} onChange={(value) => setField("siteName", value)} placeholder="اسم الموقع أو الورشة" />
            </View>
            <Text style={styles.fieldLabel}>{t(draft.category === "مازوت" ? "تفاصيل المازوت" : "تفاصيل العملية")}</Text>
            <TextInput style={[styles.input, styles.textArea]} value={draft.details} onChangeText={(value) => setField("details", value)}
              placeholder={draft.category === "مازوت" ? "مثال: تزويد آلية الورشة بالوقود" : "مثال: قطعة الغيار أو نوع الإصلاح"} placeholderTextColor={colors.placeholder} multiline />
            <Text style={styles.fieldLabel}>{t("ملاحظات")}</Text>
            <TextInput style={[styles.input, styles.textArea]} value={draft.notes} onChangeText={(value) => setField("notes", value)}
              placeholder="أضف أي معلومة للإدارة" placeholderTextColor={colors.placeholder} multiline />

            {canUploadFiles(member) ? (
              <Pressable onPress={() => void chooseDocuments()} disabled={saving} style={styles.attachmentButton}>
                <ImagePlus size={17} color={colors.blue} />
                <Text style={styles.attachmentButtonText}>{t("إضافة صور الفاتورة أو الوصل")}</Text>
                <Text style={styles.attachmentCount}>{pickedDocs.length}/5</Text>
              </Pressable>
            ) : null}
            {pickedDocs.length ? (
              <View style={styles.pickedList}>
                {pickedDocs.map((doc, index) => (
                  <View key={`${doc.name}-${index}`} style={styles.pickedRow}>
                    <Text numberOfLines={1} style={styles.pickedName}>{doc.name}</Text>
                    <Pressable onPress={() => setPickedDocs((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      <X size={16} color={colors.red} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.syncNote}>{t("تُحفظ العملية باسم حسابك وتظهر فورًا في سجل الإدارة.")}</Text>
            <Pressable onPress={() => void submitExpense()} disabled={saving} style={[styles.submitButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <><Send size={17} color="#FFFFFF" /><Text style={styles.submitText}>{t("إرسال إلى الإدارة")}</Text></>}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>{t(isAdmin ? "سجل العمليات الواردة" : "عملياتي الميدانية")}</Text>
            <Text style={styles.listSubtitle}>{visibleItems.length} {language === "ar" ? "عملية مطابقة" : "résultats"} · {pendingCount} {t("بانتظار المراجعة")}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <FilterChip label={t("الكل")} selected={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
            <FilterChip label={t("بانتظار المراجعة")} selected={statusFilter === "pending"} onPress={() => setStatusFilter("pending")} />
            <FilterChip label={t("تمت المراجعة")} selected={statusFilter === "reviewed"} onPress={() => setStatusFilter("reviewed")} />
          </ScrollView>
          <View style={{ gap: 5 }}>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700", lineHeight: 22, textAlign: "right" }}>{t("نوع العملية")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <FilterChip label="كل الأنواع" selected={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />
              {quickCategories.map((category) => (
                <FilterChip key={category} label={displayValue(category, language)} selected={categoryFilter === category} onPress={() => setCategoryFilter(category)} />
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.searchBox}>
          <Search size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="ابحث بالموقع أو النوع أو المسجل"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="البحث في مصاريف الميدان"
          />
          {search ? <Pressable onPress={() => setSearch("")} accessibilityLabel="مسح البحث"><X size={16} color={colors.muted} /></Pressable> : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <TextInput value={dateFrom} onChangeText={setDateFrom}
            style={{ minWidth: 135, flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, color: colors.ink, textAlign: "right", fontSize: 14 }}
            placeholder="تاريخ التسجيل من" placeholderTextColor={colors.placeholder} accessibilityLabel="تصفية المصاريف من تاريخ" />
          <TextInput value={dateTo} onChangeText={setDateTo}
            style={{ minWidth: 135, flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, color: colors.ink, textAlign: "right", fontSize: 14 }}
            placeholder="تاريخ التسجيل إلى" placeholderTextColor={colors.placeholder} accessibilityLabel="تصفية المصاريف إلى تاريخ" />
          {dateFrom || dateTo ? <Pressable onPress={() => { setDateFrom(""); setDateTo(""); }} style={{ minHeight: 42, justifyContent: "center", paddingHorizontal: 8 }}><Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>مسح التاريخ</Text></Pressable> : null}
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.loadingText}>جارٍ تحديث العمليات...</Text></View>
        ) : visibleItems.length ? (
          visibleItems.map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} isAdmin={isAdmin} canRecord={canRecord}
              canReview={canEdit} canEditNotes={canEdit && (isAdmin || expense.created_by_id === member?.clerk_user_id)}
              saving={saving} onReview={() => void changeReview(expense, expense.review_status === "pending" ? "reviewed" : "pending")}
              canAddAttachment={canAddAttachments} onAddAttachment={() => void addAttachments(expense)}
              canDeleteAttachment={hasPermission(member, "field", "delete")}
              machineryOptions={machineryOptions}
              canLinkMachinery={canEdit && ["admin", "finance"].includes(member?.role ?? "")}
              onLinkMachinery={(id) => void linkMachinery(expense, id)}
              onDeletedAttachment={() => void refresh()} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><HardHat size={22} color={colors.blue} /></View>
            <Text style={styles.emptyTitle}>{items.length ? "لا توجد عمليات بهذه الحالة" : "لا توجد عمليات مسجلة بعد"}</Text>
            <Text style={styles.emptyText}>
              {items.length ? "غيّر البحث أو خيارات الحالة لمشاهدة عمليات أخرى." : isAdmin ? "ستظهر هنا المصاريف التي يرسلها رئيس الأشغال." : "سجّل أول عملية لتصل مباشرة إلى الإدارة."}
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>الحساب: {member?.name || user?.firstName || ""}</Text>
        <Text style={styles.footerText}>{isAdmin ? "مراجعة إدارية" : "مزامنة مباشرة مع الإدارة"}</Text>
      </View>
    </View>
  );
}

function PlusIcon() {
  return <FilePlus2 size={18} color={colors.onAccent} />;
}

function Field({ label, value, onChange, placeholder, numeric }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; numeric?: boolean;
}) {
  const { language } = useAuth();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{translate(label, language)}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={translate(placeholder, language)}
        placeholderTextColor={colors.placeholder} keyboardType={numeric ? "decimal-pad" : "default"} />
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, selected && styles.filterSelected]}>
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ExpenseCard({ expense, isAdmin, canRecord, canReview, canEditNotes, canAddAttachment, canDeleteAttachment, saving, onReview, onAddAttachment, onDeletedAttachment, machineryOptions, canLinkMachinery, onLinkMachinery }: {
  expense: FieldExpense;
  isAdmin: boolean;
  canRecord: boolean;
  canReview: boolean;
  canEditNotes: boolean;
  canAddAttachment: boolean;
  canDeleteAttachment: boolean;
  saving: boolean;
  onReview: () => void;
  onAddAttachment: () => void;
  onDeletedAttachment: (attachmentId: number) => void;
  machineryOptions: MachineryOption[];
  canLinkMachinery: boolean;
  onLinkMachinery: (id: string) => void;
}) {
  const { language } = useAuth();
  const t = (text: string) => translate(text, language);
  const isFuel = expense.category === "مازوت" && expense.fuel_liters != null;
  const [linkOpen, setLinkOpen] = useState(false);
  const [machineId, setMachineId] = useState(expense.machinery_id ? String(expense.machinery_id) : "");
  return (
    <View style={[styles.expenseCard, expense.review_status === "pending" && styles.pendingCard]}>
      <View style={styles.expenseTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.expenseHeading}>
            <Text style={styles.expenseCategory}>{displayValue(expense.category, language)}</Text>
            {isFuel ? <View style={styles.litersBadge}><Fuel size={12} color={colors.amber} /><Text style={styles.litersText}>{expense.fuel_liters} {language === "ar" ? "لتر" : "L"}</Text></View> : null}
          </View>
          <Text style={styles.expenseSite}>{expense.site_name}</Text>
          {expense.machinery_name ? (
            <Text style={styles.expenseMachine}>{t("الآلة:")} {expense.machinery_name}{expense.machinery_code ? ` · ${expense.machinery_code}` : ""}</Text>
          ) : null}
        </View>
        <View style={styles.amountColumn}>
          <Text style={styles.expenseAmount}>{formatDzd(localAmount(expense.amount))}</Text>
          <View style={[styles.reviewBadge, expense.review_status === "reviewed" ? styles.reviewedBadge : styles.pendingBadge]}>
            <Text style={[styles.reviewBadgeText, expense.review_status === "reviewed" ? styles.reviewedText : styles.pendingText]}>
              {t(expense.review_status === "reviewed" ? "تمت المراجعة" : "بانتظار المراجعة")}
            </Text>
          </View>
        </View>
      </View>

      {canLinkMachinery ? (
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setLinkOpen((open) => !open)}>
            <Text style={styles.expenseMachine}>{t(linkOpen ? "إغلاق اختيار الآلة" : expense.machinery_id ? "تعديل الآلة المرتبطة" : "ربط العملية القديمة بآلة")}</Text>
          </Pressable>
          {linkOpen ? <>
            <MachineryPicker items={machineryOptions} value={machineId} onChange={setMachineId} label={t("الآلة المرتبطة بالعملية")} />
            <Pressable disabled={saving || !machineId} onPress={() => onLinkMachinery(machineId)} style={styles.reviewAction}>
              <Text style={styles.reviewActionText}>{t("حفظ ربط الآلة")}</Text>
            </Pressable>
          </> : null}
        </View>
      ) : null}
      <View style={styles.recordedLine}>
        <Text style={styles.recordedText}>{t("سجلها:")} {expense.created_by_name}</Text>
        <Text style={styles.recordedText}>{recordedAt(expense.created_at)}</Text>
      </View>
      {expense.details ? <Text style={styles.detailsText}>{expense.details}</Text> : null}
      <RecordNotes entity="fieldExpense" recordId={expense.id} initialNotes={expense.notes} editable={canEditNotes} />
      {expense.review_status === "reviewed" && expense.reviewed_by_name ? (
        <Text style={styles.reviewedBy}>{t("راجعها")} {expense.reviewed_by_name}{expense.reviewed_at ? ` · ${recordedAt(expense.reviewed_at)}` : ""}</Text>
      ) : null}

      {expense.attachments.length ? (
        <View style={styles.attachmentList}>
          <Text style={styles.attachmentsLabel}>{t("الفواتير والوصولات")} ({expense.attachments.length})</Text>
          <View style={styles.attachmentChips}>
            {expense.attachments.map((attachment) => (
              <AttachmentActions key={attachment.id} attachment={attachment} section="field"
                url={`/api/field-expense-attachments/${attachment.id}`}
                canDelete={canDeleteAttachment}
                onDeleted={onDeletedAttachment} />
            ))}
          </View>
        </View>
      ) : <Text style={styles.noAttachments}>{t("لا توجد فاتورة أو وصل مرفق.")}</Text>}

      {(canReview || canRecord) ? (
        <View style={styles.actions}>
          {canReview ? (
            <Pressable onPress={onReview} disabled={saving} style={[styles.reviewAction, expense.review_status === "reviewed" && styles.returnAction]}>
              {expense.review_status === "pending" ? <Check size={15} color={colors.green} /> : <AlertTriangle size={15} color={colors.amber} />}
              <Text style={[styles.reviewActionText, expense.review_status === "reviewed" && { color: colors.amber }]}>
                {t(expense.review_status === "pending" ? "تمت المراجعة" : "إعادة للمراجعة")}
              </Text>
            </Pressable>
          ) : null}
          {canAddAttachment && expense.review_status === "pending" && expense.attachments.length < 5 ? (
            <Pressable onPress={onAddAttachment} disabled={saving} style={styles.addAttachmentAction}>
              <ImagePlus size={14} color={colors.blue} />
              <Text style={styles.addAttachmentText}>إضافة صورة أو وصل</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1020, alignSelf: "center" as const, padding: 18, paddingBottom: 36, gap: 15 },
  intro: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 },
  headingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  headingIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EAF1FA", alignItems: "center" as const, justifyContent: "center" as const },
  title: { color: colors.navy, fontSize: 19, fontWeight: "900" as const, textAlign: "right" as const },
  subtitle: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, lineHeight: 23, marginTop: 5 },
  error: { backgroundColor: colors.redSoft, borderRadius: 11, padding: 11, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 },
  errorText: { flex: 1, color: colors.red, fontSize: 14, fontWeight: "600" as const, lineHeight: 23, textAlign: "right" as const },
  success: { backgroundColor: colors.greenSoft, borderRadius: 11, padding: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  successText: { flex: 1, color: colors.green, fontSize: 14, fontWeight: "700" as const, lineHeight: 23, textAlign: "right" as const },
  reviewSummary: { backgroundColor: colors.amberSoft, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  reviewIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center" as const, justifyContent: "center" as const },
  reviewTitle: { color: colors.navy, fontSize: 15, fontWeight: "700" as const, lineHeight: 24, textAlign: "right" as const },
  reviewHint: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, lineHeight: 23, textAlign: "right" as const, marginTop: 3 },
  addButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.yellow, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  addButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: "600" as const, lineHeight: 24 },
  formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 17, gap: 12 },
  formTitle: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  categoryGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  categoryChip: { minHeight: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: "#F8FAFC", paddingHorizontal: 11, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6 },
  categoryChipSelected: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  categoryText: { color: colors.ink, fontSize: 14, fontWeight: "700" as const, lineHeight: 22 },
  categoryTextSelected: { color: colors.onAccent },
  formGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  field: { flexGrow: 1, flexBasis: 190 },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" as const, lineHeight: 23, textAlign: "right" as const, marginBottom: 5 },
  input: { minHeight: 48, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, paddingHorizontal: 12, fontSize: 15 },
  textArea: { minHeight: 64, textAlignVertical: "top" as const, paddingTop: 10 },
  attachmentButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: "#C9D9EA", backgroundColor: "#F5F9FE", paddingHorizontal: 11, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  attachmentButtonText: { flex: 1, color: colors.blue, fontSize: 14, fontWeight: "600" as const, lineHeight: 22, textAlign: "right" as const },
  attachmentCount: { color: colors.muted, fontSize: 14, fontWeight: "600" as const },
  pickedList: { backgroundColor: "#F6F8FB", borderRadius: 10, paddingHorizontal: 9 },
  pickedRow: { minHeight: 32, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickedName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, lineHeight: 22 },
  syncNote: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, lineHeight: 23 },
  submitButton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.action, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" as const, lineHeight: 24 },
  disabled: { opacity: 0.55 },
  listHeader: { gap: 8, marginTop: 3 },
  listTitle: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  listSubtitle: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, lineHeight: 22, textAlign: "right" as const, marginTop: 2 },
  searchBox: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 11, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, fontWeight: "500" as const, lineHeight: 22, textAlign: "right" as const, writingDirection: "rtl" as const },
  filters: { flexDirection: "row" as const, gap: 6 },
  filterChip: { minHeight: 31, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 10, alignItems: "center" as const, justifyContent: "center" as const },
  filterSelected: { backgroundColor: "#E7F0FB", borderColor: "#A9C5E6" },
  filterText: { color: colors.muted, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 },
  filterTextSelected: { color: colors.blue },
  loading: { minHeight: 120, alignItems: "center" as const, justifyContent: "center" as const, gap: 9, backgroundColor: colors.surface, borderRadius: 14 },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, lineHeight: 23 },
  expenseCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 16, gap: 11 },
  pendingCard: { borderColor: "#EDCF8E" },
  expenseTop: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 10 },
  expenseHeading: { flexDirection: "row" as const, alignItems: "center" as const, flexWrap: "wrap" as const, gap: 7 },
  expenseCategory: { color: colors.navy, fontSize: 15, fontWeight: "700" as const, textAlign: "right" as const, lineHeight: 24 },
  litersBadge: { minHeight: 24, borderRadius: 8, backgroundColor: colors.amberSoft, paddingHorizontal: 7, flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  litersText: { color: colors.amber, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 },
  expenseSite: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, marginTop: 4, lineHeight: 22 },
  expenseMachine: { color: colors.blue, fontSize: 14, fontWeight: "600" as const, textAlign: "right" as const, marginTop: 4, lineHeight: 22 },
  amountColumn: { alignItems: "flex-start" as const, gap: 5 },
  expenseAmount: { color: colors.blue, fontSize: 16, fontWeight: "700" as const, lineHeight: 25 },
  reviewBadge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  pendingBadge: { backgroundColor: colors.amberSoft },
  reviewedBadge: { backgroundColor: colors.greenSoft },
  reviewBadgeText: { fontSize: 14, fontWeight: "700" as const, lineHeight: 22 },
  pendingText: { color: colors.amber },
  reviewedText: { color: colors.green },
  recordedLine: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7, flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 5 },
  recordedText: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, lineHeight: 23 },
  detailsText: { color: colors.ink, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, lineHeight: 23 },
  notesText: { color: colors.muted, backgroundColor: colors.background, borderRadius: 8, padding: 8, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, lineHeight: 23 },
  reviewedBy: { color: colors.green, fontSize: 14, fontWeight: "600" as const, textAlign: "right" as const, lineHeight: 23 },
  attachmentList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 6 },
  attachmentsLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" as const, textAlign: "right" as const, lineHeight: 22 },
  attachmentChips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  attachmentChip: { maxWidth: 240, minHeight: 30, borderRadius: 8, borderWidth: 1, borderColor: "#D6E3F2", backgroundColor: "#F3F7FC", paddingHorizontal: 8, flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
  attachmentName: { flexShrink: 1, color: colors.blue, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 },
  noAttachments: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, textAlign: "right" as const, lineHeight: 23 },
  actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  reviewAction: { minHeight: 32, borderRadius: 8, borderWidth: 1, borderColor: "#B8E1CC", backgroundColor: colors.greenSoft, paddingHorizontal: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
  returnAction: { borderColor: colors.border, backgroundColor: colors.amberSoft },
  reviewActionText: { color: colors.green, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 },
  addAttachmentAction: { minHeight: 32, borderRadius: 8, borderWidth: 1, borderColor: "#C9D9EA", backgroundColor: "#F5F9FE", paddingHorizontal: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
  addAttachmentText: { color: colors.blue, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 },
  emptyCard: { minHeight: 160, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  emptyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EAF1FA", alignItems: "center" as const, justifyContent: "center" as const },
  emptyTitle: { color: colors.navy, fontSize: 15, fontWeight: "700" as const, lineHeight: 24 },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, textAlign: "center" as const, lineHeight: 23 },
  center: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: 13, backgroundColor: colors.background, padding: 24 },
  denied: { color: colors.red, textAlign: "center" as const, lineHeight: 23, fontSize: 14, fontWeight: "600" as const },
  secondaryButton: { minHeight: 41, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "center" as const, paddingHorizontal: 13 },
  secondaryButtonText: { color: colors.blue, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 },
  footer: { minHeight: 43, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { color: colors.muted, fontSize: 14, fontWeight: "500" as const, lineHeight: 22 },
};
makeStylesReactive(styles);
