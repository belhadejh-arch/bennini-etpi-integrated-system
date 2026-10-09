import { useAuth, useUser } from "@clerk/expo";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import {
  AlertTriangle, ArrowRight, Check, ChevronLeft, ChevronRight, FilePlus2,
  Pencil, Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, type Member } from "../../lib/api";
import { colors, formatDzd } from "../../lib/theme";

type Status = "pending" | "paid" | "cancelled";
type Attachment = { id: number; file_name: string; mime_type: string; file_size: number };
type Cheque = {
  id: number;
  cheque_number: string;
  invoice_number: string;
  amount: number | string;
  beneficiary: string;
  bank: string;
  issue_date: string;
  due_date: string;
  status: Status;
  notes: string;
  attachments: Attachment[];
};
type DueAlert = {
  id: number;
  cheque_number: string;
  beneficiary: string;
  amount: number | string;
  due_date: string;
  days_until_due: number;
};
type ChequeResult = {
  items: Cheque[];
  total: number;
  page: number;
  pageSize: number;
  dueAlertCount: number;
  dueAlerts: DueAlert[];
};
type Draft = {
  chequeNumber: string;
  invoiceNumber: string;
  amount: string;
  beneficiary: string;
  bank: string;
  issueDate: string;
  dueDate: string;
  status: Status;
  notes: string;
};
type PickedDocument = DocumentPicker.DocumentPickerAsset;
type ApiError = Error & { status?: number; body?: { pending?: boolean } };

const statusOptions: Array<{ value: Status | ""; label: string }> = [
  { value: "", label: "الكل" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "paid", label: "مدفوع" },
  { value: "cancelled", label: "ملغى" },
];
const statusLabels: Record<Status, string> = {
  pending: "قيد الانتظار",
  paid: "مدفوع",
  cancelled: "ملغى",
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function emptyDraft(): Draft {
  const today = localDate();
  return {
    chequeNumber: "", invoiceNumber: "", amount: "", beneficiary: "", bank: "",
    issueDate: today, dueDate: today, status: "pending", notes: "",
  };
}

function dateLabel(value: string) {
  return value ? value.slice(0, 10) : "—";
}

function attachmentLabel(attachment: Attachment) {
  return attachment.mime_type.startsWith("image/") ? "صورة الشيك / وثيقة" : "الفاتورة أو الوثيقة";
}

export default function ChequesSection() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [items, setItems] = useState<Cheque[]>([]);
  const [dueAlerts, setDueAlerts] = useState<DueAlert[]>([]);
  const [dueAlertCount, setDueAlertCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pickedDocs, setPickedDocs] = useState<PickedDocument[]>([]);

  const isAdmin = member?.role === "admin";
  const canAccess = isAdmin || !!member?.allowed_sections.includes("cheques");
  const canManage = canAccess && (isAdmin || member?.role === "finance");
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [page, search, statusFilter]);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const me = await apiRequest<{ member: Member }>("/me", token);
      setMember(me.member);
      const result = await apiRequest<ChequeResult>(`/cheques?${queryString}`, token);
      setItems(result.items);
      setTotal(result.total);
      setDueAlerts(result.dueAlerts);
      setDueAlertCount(result.dueAlertCount);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل سجل الشيكات.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, queryString]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (isSignedIn) void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingCheque(null);
    setPickedDocs([]);
    setDraft(emptyDraft());
  };

  const beginCreate = () => {
    setError("");
    setEditingCheque(null);
    setPickedDocs([]);
    setDraft(emptyDraft());
    setFormOpen(true);
  };

  const beginEdit = (item: Cheque) => {
    setError("");
    setEditingCheque(item);
    setPickedDocs([]);
    setDraft({
      chequeNumber: item.cheque_number,
      invoiceNumber: item.invoice_number || "",
      amount: String(item.amount),
      beneficiary: item.beneficiary,
      bank: item.bank || "",
      issueDate: dateLabel(item.issue_date),
      dueDate: dateLabel(item.due_date),
      status: item.status,
      notes: item.notes || "",
    });
    setFormOpen(true);
  };

  const uploadDocuments = async (chequeId: number, documents: PickedDocument[]) => {
    if (!documents.length) return;
    const formData = new FormData();
    documents.forEach((asset) => {
      if (Platform.OS === "web" && asset.file) {
        formData.append("files", asset.file, asset.name);
      } else {
        formData.append("files", {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
        } as unknown as Blob);
      }
    });
    await apiRequest(`/cheques/${chequeId}/attachments`, () => getToken(), {
      method: "POST",
      body: formData,
    });
  };

  const chooseDocuments = async () => {
    const remaining = 5 - (editingCheque?.attachments.length ?? 0) - pickedDocs.length;
    if (remaining <= 0) {
      setError("الحد الأقصى هو خمسة مرفقات لكل شيك.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: [
          "application/pdf", "image/*", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });
      if (!result.canceled && result.assets.length) {
        setPickedDocs((current) => [...current, ...result.assets].slice(0, remaining));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اختيار المستند.");
    }
  };

  const addAttachments = async (item: Cheque) => {
    const remaining = 5 - item.attachments.length;
    if (remaining <= 0) {
      setError("تم الوصول إلى الحد الأقصى وهو خمسة مرفقات لكل شيك.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: [
          "application/pdf", "image/*", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });
      if (result.canceled || !result.assets.length) return;
      setSaving(true);
      setError("");
      await uploadDocuments(item.id, result.assets.slice(0, remaining));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إرفاق المستند بالشيك.");
    } finally {
      setSaving(false);
    }
  };

  const saveCheque = async () => {
    if (!draft.chequeNumber.trim() || !draft.beneficiary.trim() ||
        !Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.issueDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) || draft.dueDate < draft.issueDate) {
      setError("أكمل رقم الشيك والمبلغ والمستفيد، وتحقق من أن تاريخ الاستحقاق لا يسبق الإصدار.");
      return;
    }
    setSaving(true);
    setError("");
    let savedId: number | null = null;
    try {
      const payload = JSON.stringify({
        ...draft,
        chequeNumber: draft.chequeNumber.trim(),
        invoiceNumber: draft.invoiceNumber.trim(),
        amount: Number(draft.amount),
        beneficiary: draft.beneficiary.trim(),
        bank: draft.bank.trim(),
        notes: draft.notes.trim(),
      });
      const result = editingCheque
        ? await apiRequest<{ item: Cheque }>(`/cheques/${editingCheque.id}`, () => getToken(), { method: "PATCH", body: payload })
        : await apiRequest<{ item: Cheque }>("/cheques", () => getToken(), { method: "POST", body: payload });
      savedId = result.item.id;
      if (pickedDocs.length) await uploadDocuments(savedId, pickedDocs);
      closeForm();
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "تعذر حفظ الشيك.";
      if (savedId) {
        closeForm();
        setError(`تم حفظ بيانات الشيك، لكن تعذر رفع المرفق. ${message}`);
        await refresh();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (item: Cheque, status: Status) => {
    const run = async () => {
      setSaving(true);
      setError("");
      try {
        await apiRequest(`/cheques/${item.id}`, () => getToken(), {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "تعذر تحديث حالة الشيك.");
      } finally {
        setSaving(false);
      }
    };
    const message = status === "paid" ? "هل تريد تعليم هذا الشيك على أنه مدفوع؟" : "هل تريد إلغاء هذا الشيك؟";
    if (Platform.OS === "web") {
      if (window.confirm(message)) void run();
    } else {
      Alert.alert("تأكيد تغيير الحالة", message, [
        { text: "رجوع", style: "cancel" },
        { text: status === "paid" ? "مدفوع" : "إلغاء الشيك", style: status === "paid" ? "default" : "destructive", onPress: () => void run() },
      ]);
    }
  };

  const deleteCheque = (item: Cheque) => {
    const remove = async () => {
      setSaving(true);
      setError("");
      try {
        await apiRequest(`/cheques/${item.id}`, () => getToken(), { method: "DELETE" });
        await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "تعذر حذف الشيك.");
      } finally {
        setSaving(false);
      }
    };
    const message = `سيتم حذف الشيك رقم ${item.cheque_number} وجميع مرفقاته. هل تريد المتابعة؟`;
    if (Platform.OS === "web") {
      if (window.confirm(message)) void remove();
    } else {
      Alert.alert("حذف الشيك", message, [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => void remove() },
      ]);
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const url = `/api/cheque-attachments/${attachment.id}`;
      if (Platform.OS === "web") {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("تعذر تحميل المرفق.");
        const objectUrl = URL.createObjectURL(await response.blob());
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        const base = FileSystem.documentDirectory;
        if (!base) throw new Error("مساحة حفظ الملفات غير متاحة.");
        const name = attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const target = `${base}${Date.now()}-${name}`;
        const downloaded = await FileSystem.downloadAsync(url, target, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await Sharing.shareAsync(downloaded.uri, {
          mimeType: attachment.mime_type,
          dialogTitle: attachment.file_name,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر فتح المرفق.");
    }
  };

  const pages = Math.max(1, Math.ceil(total / 25));
  if ((!member?.active || !canAccess) && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>{error || "الحساب غير مفعل أو لا يملك صلاحية الوصول إلى إدارة الشيكات."}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryButtonText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title="إدارة الشيكات"
        leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.headingRow}>
            <View style={styles.headingIcon}><FilePlus2 size={20} color={colors.blue} /></View>
            <Text style={styles.title}>دفتر الشيكات</Text>
          </View>
          <Text style={styles.subtitle}>سجل مستقل للبحث عن الشيكات ومتابعة مستنداتها ومواعيد استحقاقها.</Text>
        </View>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setError("")} accessibilityLabel="إغلاق التنبيه"><X size={17} color={colors.red} /></Pressable>
          </View>
        ) : null}

        {dueAlertCount > 0 ? (
          <View style={styles.alertPanel}>
            <View style={styles.alertHeading}>
              <AlertTriangle size={19} color={colors.red} />
              <Text style={styles.alertTitle}>تنبيه استحقاق — {dueAlertCount} شيك</Text>
            </View>
            <Text style={styles.alertDescription}>
              شيكات قيد الانتظار متأخرة أو يحين استحقاقها خلال الأيام السبعة القادمة.
            </Text>
            {dueAlerts.map((item) => (
              <View key={item.id} style={styles.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertCheque}>شيك {item.cheque_number} · {item.beneficiary}</Text>
                  <Text style={styles.alertMeta}>
                    {item.days_until_due < 0
                      ? `متأخر ${Math.abs(item.days_until_due)} يوم`
                      : item.days_until_due === 0
                        ? "مستحق اليوم"
                        : `يستحق بعد ${item.days_until_due} ${item.days_until_due === 1 ? "يوم" : "أيام"}`}
                  </Text>
                </View>
                <Text style={styles.alertAmount}>{formatDzd(Number(item.amount))}</Text>
              </View>
            ))}
            {dueAlertCount > dueAlerts.length ? (
              <Text style={styles.alertMore}>وتوجد {dueAlertCount - dueAlerts.length} شيكات أخرى.</Text>
            ) : null}
          </View>
        ) : null}

        {canManage ? (
          <Pressable onPress={formOpen ? closeForm : beginCreate} style={styles.addButton} disabled={saving}>
            {formOpen ? <X size={17} color={colors.navy} /> : <Plus size={18} color={colors.navy} />}
            <Text style={styles.addButtonText}>{formOpen ? "إغلاق النموذج" : "تسجيل شيك جديد"}</Text>
          </Pressable>
        ) : null}

        {formOpen && canManage ? (
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <Text style={styles.cardHeading}>{editingCheque ? `تعديل الشيك ${editingCheque.cheque_number}` : "بيانات الشيك"}</Text>
              <Text style={styles.requiredHint}>الحقول ذات * مطلوبة</Text>
            </View>
            <View style={styles.formGrid}>
              <Field label="رقم الشيك *" value={draft.chequeNumber} onChange={(value) => setField("chequeNumber", value)} placeholder="رقم الشيك" />
              <Field label="رقم الفاتورة المرتبطة" value={draft.invoiceNumber} onChange={(value) => setField("invoiceNumber", value)} placeholder="رقم الفاتورة (اختياري)" />
              <Field label="المبلغ (دج) *" value={draft.amount} onChange={(value) => setField("amount", value)} placeholder="0" numeric />
              <Field label="المستفيد *" value={draft.beneficiary} onChange={(value) => setField("beneficiary", value)} placeholder="اسم المستفيد" />
              <Field label="البنك" value={draft.bank} onChange={(value) => setField("bank", value)} placeholder="اسم البنك" />
              <Field label="تاريخ الإصدار *" value={draft.issueDate} onChange={(value) => setField("issueDate", value)} placeholder="YYYY-MM-DD" />
              <Field label="تاريخ الاستحقاق *" value={draft.dueDate} onChange={(value) => setField("dueDate", value)} placeholder="YYYY-MM-DD" />
            </View>
            <Text style={styles.fieldLabel}>حالة الشيك</Text>
            <View style={styles.choiceRow}>
              {statusOptions.filter((option) => option.value).map((option) => (
                <Choice
                  key={option.value}
                  label={option.label}
                  selected={draft.status === option.value}
                  onPress={() => setField("status", option.value as Status)}
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>ملاحظات</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={draft.notes}
              onChangeText={(value) => setField("notes", value)}
              placeholder="أضف ملاحظة عند الحاجة"
              placeholderTextColor="#98A5B4"
              multiline
            />
            {editingCheque?.attachments.length ? (
              <View style={styles.formAttachments}>
                <Text style={styles.fieldLabel}>المرفقات المحفوظة</Text>
                <View style={styles.chipRow}>
                  {editingCheque.attachments.map((attachment) => (
                    <Pressable key={attachment.id} onPress={() => void openAttachment(attachment)} style={styles.attachmentChip}>
                      <FilePlus2 size={14} color={colors.blue} />
                      <Text numberOfLines={1} style={styles.attachmentName}>{attachment.file_name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <Pressable onPress={() => void chooseDocuments()} disabled={saving} style={styles.outlineButton}>
              <FilePlus2 size={16} color={colors.blue} />
              <Text style={styles.outlineButtonText}>إرفاق صورة الشيك أو الفاتورة / الوثيقة</Text>
            </Pressable>
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
            <Pressable onPress={() => void saveCheque()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editingCheque ? "حفظ التعديلات" : "حفظ الشيك"}</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.searchCard}>
          <View style={styles.searchBox}>
            <Search size={18} color={colors.muted} />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              style={styles.searchInput}
              placeholder="ابحث برقم الشيك أو الفاتورة أو المستفيد أو البنك أو الحالة"
              placeholderTextColor="#98A5B4"
              returnKeyType="search"
              accessibilityLabel="بحث في الشيكات"
            />
            {searchInput ? <Pressable onPress={() => setSearchInput("")}><X size={17} color={colors.muted} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            {statusOptions.map((option) => (
              <Choice
                key={option.value || "all"}
                label={option.label}
                selected={statusFilter === option.value}
                onPress={() => { setPage(1); setStatusFilter(option.value as Status | ""); }}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>سجل الشيكات</Text>
          <Text style={styles.listCount}>{total} شيك</Text>
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.muted}>جارٍ تحميل الشيكات...</Text></View>
        ) : items.length ? (
          items.map((item) => {
            const daysUntilDue = Math.round((new Date(`${dateLabel(item.due_date)}T00:00:00Z`).getTime() - new Date(`${localDate()}T00:00:00Z`).getTime()) / 86400000);
            const isDueSoon = item.status === "pending" && daysUntilDue <= 7;
            return (
              <View key={item.id} style={[styles.chequeCard, isDueSoon && styles.chequeCardDue]}>
                <View style={styles.chequeHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chequeNumber}>شيك رقم {item.cheque_number}</Text>
                    <Text style={styles.chequeSubheading}>{item.beneficiary}{item.bank ? ` · ${item.bank}` : ""}</Text>
                  </View>
                  <View style={styles.amountStatus}>
                    <Text style={styles.amount}>{formatDzd(Number(item.amount))}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                </View>
                <View style={styles.detailsGrid}>
                  <Detail label="رقم الفاتورة" value={item.invoice_number || "—"} />
                  <Detail label="تاريخ الإصدار" value={dateLabel(item.issue_date)} />
                  <Detail label="تاريخ الاستحقاق" value={dateLabel(item.due_date)} highlight={isDueSoon} />
                  {isDueSoon ? (
                    <View style={styles.detailCell}>
                      <Text style={styles.detailLabel}>التنبيه</Text>
                      <Text style={styles.detailDue}>
                        {daysUntilDue < 0 ? `متأخر ${Math.abs(daysUntilDue)} يوم` : daysUntilDue === 0 ? "مستحق اليوم" : `خلال ${daysUntilDue} يوم`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <RecordNotes entity="cheque" recordId={item.id} initialNotes={item.notes} editable={canManage} />
                {item.attachments.length ? (
                  <View style={styles.attachmentBlock}>
                    <Text style={styles.fieldLabel}>صورة الشيك والفاتورة / الوثائق</Text>
                    <View style={styles.chipRow}>
                      {item.attachments.map((attachment) => (
                        <Pressable key={attachment.id} onPress={() => void openAttachment(attachment)} style={styles.attachmentChip}>
                          <FilePlus2 size={14} color={colors.blue} />
                          <Text numberOfLines={1} style={styles.attachmentName}>{attachment.file_name || attachmentLabel(attachment)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noAttachment}>لا توجد صورة أو وثيقة مرفقة.</Text>
                )}
                {canManage ? (
                  <View style={styles.actionsRow}>
                    <ActionButton label="تعديل البيانات" onPress={() => beginEdit(item)} icon={<Pencil size={14} color={colors.blue} />} />
                    {item.status === "pending" ? (
                      <>
                        <ActionButton label="تعليم كمدفوع" onPress={() => void updateStatus(item, "paid")} icon={<Check size={14} color={colors.green} />} />
                        <ActionButton label="إلغاء الشيك" onPress={() => void updateStatus(item, "cancelled")} icon={<X size={14} color={colors.red} />} />
                      </>
                    ) : null}
                    {item.attachments.length < 5 ? (
                      <ActionButton label="إضافة مرفق" onPress={() => void addAttachments(item)} icon={<FilePlus2 size={14} color={colors.blue} />} />
                    ) : null}
                    {isAdmin ? <ActionButton label="حذف" onPress={() => deleteCheque(item)} icon={<Trash2 size={14} color={colors.red} />} danger /> : null}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><FilePlus2 size={22} color={colors.blue} /></View>
            <Text style={styles.emptyTitle}>{search || statusFilter ? "لا توجد نتائج مطابقة" : "لا توجد شيكات مسجلة"}</Text>
            <Text style={styles.emptyText}>{search || statusFilter ? "جرّب تعديل عبارة البحث أو الحالة." : "ستظهر الشيكات المسجلة هنا مع مواعيد استحقاقها ومرفقاتها."}</Text>
            {canManage && !search && !statusFilter ? (
              <Pressable onPress={beginCreate} style={styles.emptyAddButton}><Plus size={16} color="#FFFFFF" /><Text style={styles.emptyAddText}>تسجيل أول شيك</Text></Pressable>
            ) : null}
          </View>
        )}

        {!loading && total > 25 ? (
          <View style={styles.pagination}>
            <Pressable onPress={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} style={[styles.pageButton, page <= 1 && styles.disabled]}>
              <ChevronRight size={17} color={colors.blue} />
              <Text style={styles.pageButtonText}>السابق</Text>
            </Pressable>
            <Text style={styles.pageText}>صفحة {page} من {pages}</Text>
            <Pressable onPress={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages} style={[styles.pageButton, page >= pages && styles.disabled]}>
              <Text style={styles.pageButtonText}>التالي</Text>
              <ChevronLeft size={17} color={colors.blue} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>الحساب: {member?.name || user?.firstName || ""}</Text>
        <Text style={styles.footerText}>{canManage ? "صلاحية إدارة الشيكات" : "عرض فقط"}</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, numeric }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#98A5B4"
        keyboardType={numeric ? "decimal-pad" : "default"}
      />
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

function StatusBadge({ status }: { status: Status }) {
  const tone = status === "paid" ? styles.statusPaid : status === "cancelled" ? styles.statusCancelled : styles.statusPending;
  return <View style={[styles.statusBadge, tone]}><Text style={styles.statusText}>{statusLabels[status]}</Text></View>;
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailDue]}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, icon, danger }: {
  label: string;
  onPress: () => void;
  icon: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, danger && styles.actionButtonDanger]}>
      {icon}
      <Text style={[styles.actionText, danger && { color: colors.red }]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1000, alignSelf: "center" as const, padding: 18, paddingBottom: 28, gap: 14 },
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
  alertCheque: { color: colors.ink, fontSize: 12, fontWeight: "800" as const, textAlign: "right" as const },
  alertMeta: { color: colors.red, fontSize: 10, marginTop: 3, textAlign: "right" as const },
  alertAmount: { color: colors.navy, fontWeight: "900" as const, fontSize: 12 },
  alertMore: { color: "#81393B", fontSize: 10, textAlign: "right" as const, paddingTop: 3 },
  addButton: { minHeight: 46, borderRadius: 13, backgroundColor: colors.yellow, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  addButtonText: { color: colors.navy, fontWeight: "900" as const, fontSize: 12 },
  formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 },
  formHeading: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10, marginBottom: 12 },
  cardHeading: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  requiredHint: { color: colors.muted, fontSize: 10 },
  formGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  field: { flexGrow: 1, flexBasis: 220 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: "800" as const, textAlign: "right" as const, marginBottom: 5 },
  input: { minHeight: 43, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, paddingHorizontal: 11, fontSize: 12 },
  multiline: { minHeight: 75, textAlignVertical: "top" as const, paddingTop: 10, marginBottom: 10 },
  choiceRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, marginBottom: 12 },
  filterChip: { minHeight: 34, borderRadius: 10, paddingHorizontal: 12, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#F3F6FA", borderWidth: 1, borderColor: colors.border },
  filterChipSelected: { backgroundColor: "#E7F0FB", borderColor: "#A9C5E6" },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: "800" as const },
  filterTextSelected: { color: colors.blue },
  formAttachments: { marginBottom: 12 },
  chipRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, marginTop: 7 },
  attachmentChip: { maxWidth: 240, minHeight: 32, borderRadius: 9, borderWidth: 1, borderColor: "#D6E3F2", backgroundColor: "#F3F7FC", paddingHorizontal: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  attachmentName: { flexShrink: 1, color: colors.blue, fontSize: 10, fontWeight: "700" as const },
  outlineButton: { minHeight: 41, borderRadius: 10, borderWidth: 1, borderColor: "#C9D9EA", backgroundColor: "#F7FAFD", alignItems: "center" as const, justifyContent: "center" as const, flexDirection: "row" as const, gap: 7, marginBottom: 8 },
  outlineButtonText: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  pickedList: { borderRadius: 10, backgroundColor: "#F6F8FB", paddingHorizontal: 10, marginBottom: 8 },
  pickedRow: { minHeight: 33, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickedName: { flex: 1, color: colors.muted, fontSize: 10, textAlign: "right" as const },
  saveButton: { height: 45, borderRadius: 11, backgroundColor: colors.blue, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 8 },
  saveText: { color: "#FFFFFF", fontWeight: "900" as const, fontSize: 12 },
  searchCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 11, gap: 9 },
  searchBox: { minHeight: 44, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 11, textAlign: "right" as const, writingDirection: "rtl" as const, paddingVertical: 8 },
  filtersRow: { flexDirection: "row" as const, gap: 7, paddingVertical: 1 },
  listHeading: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 2 },
  listTitle: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  listCount: { color: colors.muted, fontSize: 10, fontWeight: "700" as const },
  chequeCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 11 },
  chequeCardDue: { borderColor: "#E9AAAA" },
  chequeHeader: { flexDirection: "row" as const, alignItems: "flex-start" as const, justifyContent: "space-between" as const, gap: 10 },
  chequeNumber: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  chequeSubheading: { color: colors.muted, fontSize: 11, marginTop: 4, textAlign: "right" as const },
  amountStatus: { alignItems: "flex-start" as const, gap: 6 },
  amount: { color: colors.blue, fontSize: 13, fontWeight: "900" as const, textAlign: "left" as const },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusPending: { backgroundColor: colors.amberSoft },
  statusPaid: { backgroundColor: colors.greenSoft },
  statusCancelled: { backgroundColor: colors.redSoft },
  statusText: { color: colors.ink, fontSize: 9, fontWeight: "800" as const },
  detailsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  detailCell: { flexGrow: 1, flexBasis: 130, minHeight: 48, borderRadius: 9, backgroundColor: "#F7F9FC", paddingHorizontal: 9, paddingVertical: 7 },
  detailLabel: { color: colors.muted, fontSize: 9, textAlign: "right" as const },
  detailValue: { color: colors.ink, fontSize: 10, fontWeight: "800" as const, marginTop: 4, textAlign: "right" as const },
  detailDue: { color: colors.red, fontSize: 10, fontWeight: "900" as const, marginTop: 4, textAlign: "right" as const },
  notes: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: "right" as const },
  attachmentBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  noAttachment: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
  actionsRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  actionButton: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FAFBFD", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 5, paddingHorizontal: 9 },
  actionButtonDanger: { borderColor: "#F2D1D1", backgroundColor: "#FFF8F8" },
  actionText: { color: colors.blue, fontSize: 9, fontWeight: "800" as const },
  emptyCard: { alignItems: "center" as const, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 24, gap: 9 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#EAF1FA" },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" as const },
  emptyText: { maxWidth: 360, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: "center" as const },
  emptyAddButton: { minHeight: 39, borderRadius: 10, backgroundColor: colors.blue, paddingHorizontal: 13, flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: 3 },
  emptyAddText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" as const },
  loading: { paddingVertical: 32, alignItems: "center" as const, gap: 10 },
  muted: { color: colors.muted, fontSize: 11 },
  pagination: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 14, paddingVertical: 5 },
  pageButton: { minHeight: 37, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row" as const, alignItems: "center" as const, gap: 3, paddingHorizontal: 9 },
  pageButtonText: { color: colors.blue, fontSize: 10, fontWeight: "800" as const },
  pageText: { color: colors.muted, fontSize: 10 },
  disabled: { opacity: 0.5 },
  error: { backgroundColor: colors.redSoft, borderRadius: 11, padding: 12, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 9 },
  errorText: { flex: 1, color: colors.red, fontSize: 11, lineHeight: 17, textAlign: "right" as const },
  center: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: 14, backgroundColor: colors.background, padding: 24 },
  denied: { color: colors.red, textAlign: "center" as const, lineHeight: 21, fontSize: 12 },
  secondaryButton: { minHeight: 42, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "center" as const, paddingHorizontal: 14 },
  secondaryButtonText: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  footer: { minHeight: 47, backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { color: colors.muted, fontSize: 9 },
};
