import { useAuth, useUser } from "../../lib/auth";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { ArrowRight, ChevronLeft, ChevronRight, Eye, FilePlus2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import AttachmentActions from "../components/AttachmentActions";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, apiUrl, type Member } from "../../lib/api";
import { attachmentPickerTypes } from "../../lib/attachments";
import { colors, formatDzd } from "../../lib/theme";
import { canUploadFiles, hasPermission } from "../../shared/access";

type Attachment = { id: number; file_name: string; mime_type: string; file_size: number };
type Transaction = {
  id: number;
  type: "income" | "expense";
  amount: number | string;
  party: string;
  reason: string;
  payment_method: string;
  date: string;
  cash_balance_after: number | string;
  notes: string;
  recorded_by_id: string;
  recorded_by_name: string;
  attachments: Attachment[];
};
type TransactionResult = { items: Transaction[]; total: number; page: number; pageSize: number; cashBalance: number };
type ApiError = Error & { status?: number; body?: { pending?: boolean } };
type PickedDocument = DocumentPicker.DocumentPickerAsset;

const paymentMethods = ["نقداً", "شيك", "تحويل بنكي"] as const;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function FinanceSection() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cashBalance, setCashBalance] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pickedDocs, setPickedDocs] = useState<PickedDocument[]>([]);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [party, setParty] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("نقداً");
  const [date, setDate] = useState(localDate());
  const [notes, setNotes] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filterParty, setFilterParty] = useState("");
  const [filterRecorder, setFilterRecorder] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    from: "", to: "", type: "", method: "", minAmount: "", maxAmount: "", party: "", recorder: "",
  });

  const isAdmin = member?.role === "admin";
  const canAccess = hasPermission(member, "finance", "view");
  const canCreate = hasPermission(member, "finance", "create");
  const canEdit = hasPermission(member, "finance", "edit");
  const canManage = canCreate || canEdit;
  const canAddAttachments = canManage && canUploadFiles(member);
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (appliedFilters.from) params.set("from", appliedFilters.from);
    if (appliedFilters.to) params.set("to", appliedFilters.to);
    if (appliedFilters.type) params.set("type", appliedFilters.type);
    if (appliedFilters.method) params.set("paymentMethod", appliedFilters.method);
    if (appliedFilters.minAmount) params.set("minAmount", appliedFilters.minAmount);
    if (appliedFilters.maxAmount) params.set("maxAmount", appliedFilters.maxAmount);
    if (appliedFilters.party) params.set("party", appliedFilters.party);
    if (appliedFilters.recorder) params.set("recorder", appliedFilters.recorder);
    if (search) params.set("q", search);
    return params.toString();
  }, [appliedFilters, page, search]);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const memberRequest = apiRequest<{ member: Member }>("/me", token);
      const transactionsRequest = apiRequest<TransactionResult>(`/transactions?${queryString}`, token);
      const me = await memberRequest;
      setMember(me.member);
      const result = await transactionsRequest;
      setTransactions(result.items);
      setTotal(result.total);
      setCashBalance(result.cashBalance);
      if (expandedId && !result.items.some((item) => item.id === expandedId)) setExpandedId(null);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل العمليات المالية.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [expandedId, getToken, isSignedIn, queryString]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clearForm = () => {
    setEditingId(null);
    setPickedDocs([]);
    setType("expense");
    setAmount("");
    setParty("");
    setReason("");
    setPaymentMethod("نقداً");
    setDate(localDate());
    setNotes("");
  };

  const beginEdit = (item: Transaction) => {
    setEditingId(item.id);
    setPickedDocs([]);
    setType(item.type);
    setAmount(String(item.amount));
    setParty(item.party);
    setReason(item.reason);
    setPaymentMethod(item.payment_method as (typeof paymentMethods)[number]);
    setDate(item.date.slice(0, 10));
    setNotes(item.notes || "");
    setFormOpen(true);
    setExpandedId(item.id);
  };

  const save = async () => {
    if (!amount || Number(amount) <= 0 || !party.trim() || !reason.trim() || !date.trim()) {
      setError("أكمل نوع العملية والمبلغ والجهة والسبب والتاريخ.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = () => getToken();
      const payload = JSON.stringify({
        type, amount: Number(amount), party: party.trim(), reason: reason.trim(),
        paymentMethod, transactionDate: date, notes: notes.trim(),
      });
      const result = editingId
        ? await apiRequest<{ item: Transaction }>(`/transactions/${editingId}`, token, { method: "PATCH", body: payload })
        : await apiRequest<{ item: Transaction }>("/transactions", token, { method: "POST", body: payload });
      if (pickedDocs.length) await uploadDocuments(result.item.id, pickedDocs, token);
      clearForm();
      setFormOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ العملية.");
    } finally {
      setSaving(false);
    }
  };

  const uploadDocuments = async (transactionId: number, documents: PickedDocument[], token: () => Promise<string | null>) => {
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
    await apiRequest(`/transactions/${transactionId}/attachments`, token, { method: "POST", body: formData });
  };

  const chooseDocuments = async (transactionId?: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: [...attachmentPickerTypes],
      });
      if (result.canceled || !result.assets.length) return;
      if (transactionId) {
        setSaving(true);
        const token = () => getToken();
        await uploadDocuments(transactionId, result.assets, token);
        await refresh();
      } else {
        setPickedDocs((current) => [...current, ...result.assets].slice(0, 5));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إرفاق المستند.");
    } finally {
      if (transactionId) setSaving(false);
    }
  };

  const deleteTransaction = (id: number) => {
    const remove = async () => {
      try {
        setSaving(true);
        await apiRequest(`/transactions/${id}`, () => getToken(), { method: "DELETE" });
        setExpandedId(null);
        await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "تعذر حذف العملية.");
      } finally {
        setSaving(false);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("هل تريد حذف العملية المالية؟ سيتم حذف المستندات المرفقة بها أيضاً.")) void remove();
    } else {
      Alert.alert("حذف العملية", "سيتم حذف العملية والمستندات المرفقة بها.", [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => void remove() },
      ]);
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const url = apiUrl(`/api/transaction-attachments/${attachment.id}`);
      if (Platform.OS === "web") {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("تعذر تحميل المستند.");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        const base = FileSystem.documentDirectory;
        if (!base) throw new Error("مساحة حفظ الملفات غير متاحة.");
        const target = `${base}${Date.now()}-${attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const downloaded = await FileSystem.downloadAsync(url, target, { headers: { Authorization: `Bearer ${token}` } });
        await Sharing.shareAsync(downloaded.uri, { mimeType: attachment.mime_type, dialogTitle: attachment.file_name });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر فتح المستند.");
    }
  };

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({
      from: from.trim(), to: to.trim(), type: filterType, method: filterMethod,
      minAmount: minAmount.trim(), maxAmount: maxAmount.trim(),
      party: filterParty.trim(), recorder: filterRecorder.trim(),
    });
  };
  const resetFilters = () => {
    setFrom(""); setTo(""); setFilterType(""); setFilterMethod(""); setMinAmount(""); setMaxAmount(""); setFilterParty(""); setFilterRecorder("");
    setSearchInput(""); setSearch("");
    setAppliedFilters({ from: "", to: "", type: "", method: "", minAmount: "", maxAmount: "", party: "", recorder: "" });
    setPage(1);
  };

  if ((!member?.active || !canAccess) && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>{error || "الحساب غير مفعل أو لا يملك صلاحية الوصول إلى التسيير المالي."}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title="التسيير المالي والصندوق"
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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>التسيير المالي</Text>
            <Text style={styles.subtitle}>تسجيل ومتابعة الأموال الداخلة والخارجة من الشركة.</Text>
          </View>
          {canCreate ? (
            <Pressable
              onPress={() => {
                if (formOpen) { setFormOpen(false); clearForm(); }
                else { clearForm(); setFormOpen(true); }
              }}
              style={styles.addButton}
            >
              {formOpen ? <X size={16} color={colors.navy} /> : <Plus size={17} color={colors.navy} />}
              <Text style={styles.addButtonText}>{formOpen ? "إغلاق" : "عملية جديدة"}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable>
          </View>
        ) : null}

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>الرصيد النقدي الحالي في الصندوق</Text>
          <Text style={styles.summaryAmount}>{formatDzd(cashBalance)}</Text>
          <Text style={styles.summaryHint}>يُحتسب من العمليات النقدية فقط؛ الشيكات والتحويلات لا تغيّر رصيد الصندوق.</Text>
        </View>

        {formOpen && (editingId ? canEdit : canCreate) ? (
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <Text style={styles.formTitle}>{editingId ? `تعديل العملية رقم ${editingId}` : "تسجيل عملية مالية جديدة"}</Text>
              {editingId ? <Pressable onPress={() => { clearForm(); setFormOpen(false); }}><X size={18} color={colors.muted} /></Pressable> : null}
            </View>
            <Text style={styles.label}>نوع العملية</Text>
            <View style={styles.segment}>
              {(["income", "expense"] as const).map((value) => (
                <Pressable key={value} onPress={() => setType(value)} style={[styles.segmentButton, type === value && (value === "income" ? styles.incomeSelected : styles.expenseSelected)]}>
                  <Text style={[styles.segmentText, type === value && styles.segmentTextSelected]}>{value === "income" ? "دخل" : "مصروف"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.formGrid}>
              <Field label="المبلغ (دج)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
              <Field label="التاريخ" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
              <Field label="المصدر / الجهة المستفيدة" value={party} onChangeText={setParty} placeholder="اسم المصدر أو المستفيد" />
              <Field label="السبب" value={reason} onChangeText={setReason} placeholder="سبب الدخل أو المصروف" />
            </View>
            <Text style={styles.label}>طريقة الدفع</Text>
            <View style={styles.chips}>
              {paymentMethods.map((method) => (
                <Pressable key={method} onPress={() => setPaymentMethod(method)} style={[styles.chip, paymentMethod === method && styles.chipSelected]}>
                  <Text style={[styles.chipText, paymentMethod === method && styles.chipTextSelected]}>{method}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>ملاحظات</Text>
            <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholder="ملاحظات إضافية (اختياري)" placeholderTextColor="#98A5B4" />
            {canAddAttachments ? (
              <View style={styles.docsRow}>
                <Pressable onPress={() => void chooseDocuments()} style={styles.attachButton}>
                  <FilePlus2 size={16} color={colors.blue} />
                  <Text style={styles.attachText}>إرفاق فاتورة أو وصل</Text>
                </Pressable>
                <Text style={styles.helperText}>PDF أو صورة أو ملف Office، حتى 8 م.ب للملف</Text>
              </View>
            ) : null}
            {pickedDocs.length ? (
              <View style={styles.pickedList}>
                {pickedDocs.map((doc, index) => (
                  <View key={`${doc.name}-${index}`} style={styles.pickedItem}>
                    <Text style={styles.pickedName} numberOfLines={1}>{doc.name}</Text>
                    <Pressable onPress={() => setPickedDocs((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X size={15} color={colors.red} /></Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.cashHint}>
              <Text style={styles.helperText}>يحسب النظام رصيد الصندوق بعد العملية تلقائياً حسب التاريخ وطريقة الدفع.</Text>
            </View>
            <Pressable onPress={() => void save()} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editingId ? "حفظ التعديلات" : "حفظ العملية"}</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <View>
            <Text style={styles.sectionTitle}>سجل العمليات</Text>
            <Text style={styles.subtitle}>{total} عملية مسجلة</Text>
          </View>
          <Pressable style={styles.filterToggle} onPress={() => setFiltersOpen((open) => !open)}>
            <Search size={16} color={colors.blue} />
            <Text style={styles.filterToggleText}>{filtersOpen ? "إخفاء البحث" : "بحث وتصفية"}</Text>
          </Pressable>
        </View>

        <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF" }}>
          <Search size={16} color={colors.muted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            style={{ flex: 1, color: colors.ink, textAlign: "right", writingDirection: "rtl", fontSize: 12 }}
            placeholder="ابحث برقم العملية أو الجهة أو السبب أو المستخدم"
            placeholderTextColor="#98A5B4"
            returnKeyType="search"
            accessibilityLabel="البحث في العمليات المالية"
          />
          {searchInput ? <Pressable onPress={() => setSearchInput("")} accessibilityLabel="مسح البحث"><X size={16} color={colors.muted} /></Pressable> : null}
        </View>

        {filtersOpen ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterTitle}>تصفية العمليات</Text>
            <View style={styles.formGrid}>
              <Field label="من تاريخ" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
              <Field label="إلى تاريخ" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
              <Field label="المصدر / المستفيد" value={filterParty} onChangeText={setFilterParty} placeholder="بحث باسم الجهة" />
              <Field label="المستخدم المسجل" value={filterRecorder} onChangeText={setFilterRecorder} placeholder="بحث باسم المستخدم" />
              <Field label="المبلغ من" value={minAmount} onChangeText={setMinAmount} placeholder="0" keyboardType="decimal-pad" />
              <Field label="المبلغ إلى" value={maxAmount} onChangeText={setMaxAmount} placeholder="0" keyboardType="decimal-pad" />
            </View>
            <Text style={styles.label}>نوع العملية</Text>
            <View style={styles.chips}>
              {[["", "الكل"], ["income", "دخل"], ["expense", "مصروف"]].map(([value, label]) => (
                <Pressable key={value} onPress={() => setFilterType(value)} style={[styles.chip, filterType === value && styles.chipSelected]}>
                  <Text style={[styles.chipText, filterType === value && styles.chipTextSelected]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>طريقة الدفع</Text>
            <View style={styles.chips}>
              {["", ...paymentMethods].map((value) => (
                <Pressable key={value || "all"} onPress={() => setFilterMethod(value)} style={[styles.chip, filterMethod === value && styles.chipSelected]}>
                  <Text style={[styles.chipText, filterMethod === value && styles.chipTextSelected]}>{value || "الكل"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.filterActions}>
              <Pressable onPress={applyFilters} style={styles.saveButtonSmall}><Text style={styles.saveText}>تطبيق التصفية</Text></Pressable>
              <Pressable onPress={resetFilters} style={styles.resetButton}><Text style={styles.resetText}>مسح الحقول</Text></Pressable>
            </View>
          </View>
        ) : null}

        {loading && transactions.length === 0 ? (
          <View style={styles.loadingCard}><ActivityIndicator color={colors.blue} /></View>
        ) : transactions.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHead]}>
                  <TableCell text="التاريخ" width={100} header />
                  <TableCell text="النوع" width={90} header />
                  <TableCell text="المبلغ" width={135} header />
                  <TableCell text="المصدر / المستفيد" width={180} header />
                  <TableCell text="طريقة الدفع" width={110} header />
                  <TableCell text="السبب" width={180} header />
                  <TableCell text="سجلها" width={125} header />
                  <TableCell text="المتبقي في الصندوق" width={155} header />
                  <TableCell text="الإجراءات" width={250} header />
                </View>
                {transactions.map((item) => (
                  <View key={item.id}>
                    <View style={styles.tableRow}>
                      <TableCell text={String(item.date).slice(0, 10)} width={100} />
                      <View style={[styles.tableCell, { width: 90 }]}>
                        <Text style={[styles.typeBadge, item.type === "income" ? styles.incomeBadge : styles.expenseBadge]}>{item.type === "income" ? "دخل" : "مصروف"}</Text>
                      </View>
                      <TableCell text={formatDzd(Number(item.amount))} width={135} strong />
                      <TableCell text={item.party} width={180} />
                      <TableCell text={item.payment_method} width={110} />
                      <TableCell text={item.reason || "—"} width={180} />
                      <TableCell text={item.recorded_by_name} width={125} />
                      <TableCell text={formatDzd(Number(item.cash_balance_after))} width={155} strong />
                      <View style={[styles.tableCell, styles.actionsCell, { width: 250 }]}>
                        <ActionButton label="عرض" onPress={() => setExpandedId(expandedId === item.id ? null : item.id)} icon={<Eye size={14} color={colors.blue} />} />
                        {canEdit ? <ActionButton label="تعديل" onPress={() => beginEdit(item)} icon={<Pencil size={14} color={colors.blue} />} /> : null}
                        {canAddAttachments ? <ActionButton label="مرفق" onPress={() => void chooseDocuments(item.id)} icon={<FilePlus2 size={14} color={colors.blue} />} /> : null}
                        {hasPermission(member, "finance", "delete") ? <ActionButton label="حذف" danger onPress={() => deleteTransaction(item.id)} icon={<Trash2 size={14} color={colors.red} />} /> : null}
                      </View>
                    </View>
                    {expandedId === item.id ? (
                      <View style={styles.detailPanel}>
                        <Text style={styles.detailTitle}>تفاصيل العملية</Text>
                        <RecordNotes entity="transaction" recordId={item.id} initialNotes={item.notes} editable={canEdit} />
                        <Text style={styles.detailText}>المعرف: {item.id} · سجلها: {item.recorded_by_name}</Text>
                        <View style={styles.attachmentList}>
                          {item.attachments?.length ? item.attachments.map((attachment) => (
                            <AttachmentActions key={attachment.id} attachment={attachment} section="finance"
                              url={`/api/transaction-attachments/${attachment.id}`}
                              canDelete={hasPermission(member, "finance", "delete")}
                              onDeleted={() => void refresh()} />
                          )) : <Text style={styles.helperText}>لا توجد مستندات مرفقة.</Text>}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </ScrollView>
            <View style={styles.pagination}>
              <Pressable disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} style={[styles.pageButton, page <= 1 && styles.disabledButton]}>
                <ChevronRight size={16} color={colors.blue} /><Text style={styles.pageButtonText}>السابق</Text>
              </Pressable>
              <Text style={styles.pageText}>صفحة {page} من {Math.max(1, Math.ceil(total / 25))}</Text>
              <Pressable disabled={page * 25 >= total} onPress={() => setPage((current) => current + 1)} style={[styles.pageButton, page * 25 >= total && styles.disabledButton]}>
                <Text style={styles.pageButtonText}>التالي</Text><ChevronLeft size={16} color={colors.blue} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>لا توجد عمليات مطابقة</Text>
            <Text style={styles.emptyHint}>{total === 0 ? "سجّل أول عملية مالية أو غيّر معايير البحث." : "جرّب الانتقال إلى صفحة أخرى."}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>الحساب: {member?.name || user?.firstName || ""}</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98A5B4"
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
        textAlign="right"
      />
    </View>
  );
}

function TableCell({ text, width, header, strong }: { text: string; width: number; header?: boolean; strong?: boolean }) {
  return (
    <View style={[styles.tableCell, { width }]}>
      <Text numberOfLines={2} style={[styles.cellText, header && styles.headText, strong && styles.strongText]}>{text}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, icon, danger }: { label: string; onPress: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, danger && styles.actionDanger]}>
      {icon}<Text style={[styles.actionText, danger && { color: colors.red }]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1320, alignSelf: "center" as const, padding: 20, paddingBottom: 40, gap: 16 },
  intro: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12 },
  title: { color: colors.navy, fontWeight: "900" as const, fontSize: 23, textAlign: "right" as const },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, textAlign: "right" as const },
  addButton: { minHeight: 46, borderRadius: 12, paddingHorizontal: 16, backgroundColor: colors.yellow, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  addButtonText: { color: colors.navy, fontWeight: "800" as const, fontSize: 13 },
  summary: { padding: 21, borderRadius: 17, backgroundColor: colors.navy, gap: 8, borderWidth: 1, borderColor: "#17365D" },
  summaryLabel: { color: "#FFFFFFB8", fontSize: 13, textAlign: "right" as const },
  summaryAmount: { color: colors.yellow, fontSize: 29, fontWeight: "900" as const, textAlign: "right" as const },
  summaryHint: { color: "#FFFFFFA8", fontSize: 11, textAlign: "right" as const, lineHeight: 17 },
  formCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 9 },
  formHeading: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 2 },
  formTitle: { color: colors.navy, fontSize: 16, fontWeight: "900" as const, textAlign: "right" as const },
  formGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  field: { flexGrow: 1, flexBasis: 240, minWidth: 200 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, textAlign: "right" as const, marginTop: 8, marginBottom: 5 },
  input: { minHeight: 46, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, paddingHorizontal: 12, fontSize: 13 },
  multiline: { minHeight: 70, textAlignVertical: "top" as const, paddingTop: 10 },
  segment: { flexDirection: "row" as const, borderRadius: 11, backgroundColor: colors.background, padding: 4, marginTop: 3 },
  segmentButton: { flex: 1, alignItems: "center" as const, paddingVertical: 10, borderRadius: 8 },
  incomeSelected: { backgroundColor: "#DCF5E9" },
  expenseSelected: { backgroundColor: "#FCE8E7" },
  segmentText: { color: colors.muted, fontWeight: "700" as const, fontSize: 12 },
  segmentTextSelected: { color: colors.navy },
  chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 4 },
  chip: { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: "#EAF1FF", borderColor: colors.blue },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: "700" as const },
  chipTextSelected: { color: colors.blue },
  docsRow: { marginTop: 8, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: 8, flexWrap: "wrap" as const },
  attachButton: { flexDirection: "row" as const, gap: 7, alignItems: "center" as const, paddingVertical: 7 },
  attachText: { color: colors.blue, fontWeight: "800" as const, fontSize: 11 },
  helperText: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
  pickedList: { gap: 6 },
  pickedItem: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, backgroundColor: colors.background, borderRadius: 9, padding: 8 },
  pickedName: { flex: 1, textAlign: "right" as const, color: colors.ink, fontSize: 11 },
  cashHint: { padding: 9, borderRadius: 9, backgroundColor: "#F2F6FC", marginTop: 3 },
  saveButton: { height: 45, borderRadius: 11, backgroundColor: colors.blue, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 8 },
  saveText: { color: "#FFFFFF", fontWeight: "800" as const, fontSize: 12 },
  toolbar: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10 },
  sectionTitle: { color: colors.navy, fontWeight: "900" as const, fontSize: 18, textAlign: "right" as const },
  filterToggle: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border },
  filterToggleText: { color: colors.blue, fontWeight: "800" as const, fontSize: 11 },
  filterCard: { backgroundColor: "#FFFFFF", borderRadius: 15, padding: 15, borderWidth: 1, borderColor: colors.border, gap: 5 },
  filterTitle: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  filterActions: { flexDirection: "row" as const, gap: 9, marginTop: 12 },
  saveButtonSmall: { flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.blue, alignItems: "center" as const, justifyContent: "center" as const },
  resetButton: { minWidth: 100, height: 40, borderRadius: 10, backgroundColor: colors.background, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 12 },
  resetText: { color: colors.muted, fontSize: 11, fontWeight: "700" as const },
  table: { minWidth: 1325, backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden" as const, borderWidth: 1, borderColor: colors.border },
  tableRow: { flexDirection: "row" as const, minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: "stretch" as const },
  tableHead: { backgroundColor: "#EDF2F8", minHeight: 46 },
  tableCell: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: "center" as const, borderLeftWidth: 1, borderLeftColor: "#EDF0F4" },
  cellText: { color: colors.ink, fontSize: 11, textAlign: "right" as const, lineHeight: 17 },
  headText: { color: colors.muted, fontSize: 11, fontWeight: "900" as const },
  strongText: { color: colors.navy, fontWeight: "800" as const },
  typeBadge: { fontSize: 10, fontWeight: "800" as const, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" as const },
  incomeBadge: { color: "#178653", backgroundColor: "#E4F6EC" },
  expenseBadge: { color: "#BA4C44", backgroundColor: "#FCEBE9" },
  actionsCell: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 4 },
  actionButton: { minHeight: 34, flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#F1F5FC" },
  actionDanger: { backgroundColor: "#FEF0EF" },
  actionText: { color: colors.blue, fontSize: 10, fontWeight: "800" as const },
  detailPanel: { padding: 14, gap: 7, backgroundColor: "#F8FAFD", borderBottomWidth: 1, borderBottomColor: colors.border },
  detailTitle: { color: colors.navy, fontWeight: "900" as const, fontSize: 12, textAlign: "right" as const },
  detailText: { color: colors.muted, fontSize: 11, textAlign: "right" as const },
  attachmentList: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  attachmentPill: { maxWidth: 240, flexDirection: "row" as const, alignItems: "center" as const, gap: 6, padding: 8, borderRadius: 8, backgroundColor: "#EAF1FF" },
  attachmentText: { flexShrink: 1, color: colors.blue, fontSize: 10, fontWeight: "700" as const },
  pagination: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingVertical: 8 },
  pageButton: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border },
  pageButtonText: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  pageText: { color: colors.muted, fontSize: 11 },
  disabledButton: { opacity: 0.4 },
  loadingCard: { minHeight: 110, justifyContent: "center" as const, backgroundColor: "#FFFFFF", borderRadius: 14 },
  emptyCard: { padding: 24, alignItems: "center" as const, gap: 6, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.navy, fontWeight: "800" as const, fontSize: 14 },
  emptyHint: { color: colors.muted, textAlign: "center" as const, fontSize: 11 },
  error: { backgroundColor: colors.redSoft, padding: 12, borderRadius: 11, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10 },
  errorText: { color: colors.red, textAlign: "right" as const, fontSize: 11 },
  retryText: { color: colors.blue, fontWeight: "800" as const, fontSize: 11 },
  center: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const, padding: 25, gap: 14, backgroundColor: colors.background },
  denied: { color: colors.muted, textAlign: "center" as const, lineHeight: 22 },
  secondaryButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, backgroundColor: "#FFFFFF" },
  secondaryText: { color: colors.blue, fontWeight: "800" as const },
  footer: { minHeight: 45, backgroundColor: "#FFFFFF", paddingHorizontal: 16, justifyContent: "center" as const, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
};
