import { useAuth } from "@clerk/expo";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowRight, Boxes, ChevronLeft, ChevronRight, FilePlus2, Pencil, Plus, RefreshCw,
  Search, ShoppingCart, Trash2, X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, type Member } from "../../lib/api";
import { colors, formatDzd } from "../../lib/theme";
import { canUploadFiles, hasPermission } from "../../shared/access";

type Attachment = { id: number; file_name: string; mime_type: string; file_size: number };
type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  remaining_quantity: number;
  buy_price: number | string;
  total_cost: number | string;
  sale_price: number | string | null;
  expected_profit: number | string | null;
  realized_profit: number | string;
  sold_quantity: number;
  used_quantity: number;
  supplier: string;
  invoice_number: string;
  purchase_date: string;
  notes: string;
  attachments: Attachment[];
};
type Movement = {
  id: number;
  movement_type: "sale" | "use";
  quantity: number;
  unit_price: number | string | null;
  counterparty: string;
  movement_date: string;
  notes: string;
  recorded_by_name: string;
};
type Summary = {
  item_count: number;
  purchased_quantity: number;
  remaining_quantity: number;
  sold_quantity: number;
  used_quantity: number;
  total_cost: number | string;
  stock_value: number | string;
  expected_profit: number | string;
  realized_profit: number | string;
};
type InventoryResult = { items: InventoryItem[]; total: number; page: number; pageSize: number; summary: Summary };
type PurchaseDraft = {
  name: string; quantity: string; buyPrice: string; salePrice: string;
  supplier: string; invoiceNumber: string; purchaseDate: string; notes: string;
};
type Filters = {
  name: string; supplier: string; invoice: string; from: string; to: string;
  minPrice: string; maxPrice: string; minSalePrice: string; maxSalePrice: string; stock: string;
};
type ApiError = Error & { status?: number; body?: { pending?: boolean } };
type PickedDocument = DocumentPicker.DocumentPickerAsset;

const emptyPurchase = (): PurchaseDraft => ({
  name: "", quantity: "", buyPrice: "", salePrice: "", supplier: "", invoiceNumber: "", purchaseDate: localDate(), notes: "",
});
const emptyFilters: Filters = {
  name: "", supplier: "", invoice: "", from: "", to: "",
  minPrice: "", maxPrice: "", minSalePrice: "", maxSalePrice: "", stock: "",
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function amount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function profitLabel(value: number | string | null | undefined) {
  const parsed = amount(value);
  return `${parsed > 0 ? "+" : ""}${formatDzd(parsed)}`;
}

function dateLabel(value: string) {
  return value ? value.slice(0, 10) : "—";
}

export default function InventorySection() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ focusId?: string | string[] }>();
  const focusId = Array.isArray(routeParams.focusId) ? routeParams.focusId[0] : routeParams.focusId;
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const [member, setMember] = useState<Member | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseDraft>(emptyPurchase());
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [pickedDocs, setPickedDocs] = useState<PickedDocument[]>([]);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<"sale" | "use">("sale");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementPrice, setMovementPrice] = useState("");
  const [movementParty, setMovementParty] = useState("");
  const [movementDate, setMovementDate] = useState(localDate());
  const [movementNotes, setMovementNotes] = useState("");
  const [historyItemId, setHistoryItemId] = useState<number | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isAdmin = member?.role === "admin";
  const canAccess = hasPermission(member, "inventory", "view");
  const canCreate = hasPermission(member, "inventory", "create");
  const canEdit = hasPermission(member, "inventory", "edit");
  const canManage = canCreate || canEdit;
  const canAddAttachments = canManage && canUploadFiles(member);
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(appliedFilters)) {
      if (value) params.set(key, value);
    }
    if (focusId) params.set("focusId", focusId);
    return params.toString();
  }, [appliedFilters, focusId, page]);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const me = await apiRequest<{ member: Member }>("/me", token);
      setMember(me.member);
      const result = await apiRequest<InventoryResult>(`/inventory?${queryString}`, token);
      setItems(result.items);
      setSummary(result.summary);
      setTotal(result.total);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل المشتريات والمخزون.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, queryString]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (isSignedIn) void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  const setPurchaseField = (key: keyof PurchaseDraft, value: string) =>
    setPurchase((current) => ({ ...current, [key]: value }));
  const setFilterField = (key: keyof Filters, value: string) =>
    setDraftFilters((current) => ({ ...current, [key]: value }));

  const startNewPurchase = () => {
    setEditingItem(null);
    setPurchase(emptyPurchase());
    setPickedDocs([]);
    setPurchaseOpen(true);
    setError("");
  };

  const startEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setPickedDocs([]);
    setPurchase({
      name: item.name, quantity: String(item.quantity), buyPrice: String(item.buy_price),
      salePrice: item.sale_price == null ? "" : String(item.sale_price),
      supplier: item.supplier, invoiceNumber: item.invoice_number,
      purchaseDate: dateLabel(item.purchase_date), notes: item.notes || "",
    });
    setPurchaseOpen(true);
    setError("");
  };

  const uploadDocuments = async (itemId: number, documents: PickedDocument[]) => {
    if (!documents.length) return;
    const formData = new FormData();
    documents.forEach((asset) => {
      if (Platform.OS === "web" && asset.file) formData.append("files", asset.file, asset.name);
      else formData.append("files", {
        uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream",
      } as unknown as Blob);
    });
    await apiRequest(`/inventory/${itemId}/attachments`, () => getToken(), { method: "POST", body: formData });
  };

  const chooseDocuments = async () => {
    try {
      const allowed = Math.max(0, 5 - (editingItem?.attachments.length ?? 0) - pickedDocs.length);
      if (!allowed) {
        setError("تم الوصول إلى الحد الأقصى وهو خمسة مستندات لكل عملية شراء.");
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: [
          "application/pdf", "image/*", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });
      if (!result.canceled && result.assets.length) setPickedDocs((current) => [...current, ...result.assets].slice(0, allowed));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اختيار المستند.");
    }
  };

  const savePurchase = async () => {
    if (!purchase.name.trim() || !purchase.supplier.trim() ||
        !Number.isSafeInteger(Number(purchase.quantity)) || Number(purchase.quantity) < 1 ||
        purchase.buyPrice === "" || !Number.isFinite(Number(purchase.buyPrice)) || Number(purchase.buyPrice) < 0 ||
        purchase.salePrice === "" || !Number.isFinite(Number(purchase.salePrice)) || Number(purchase.salePrice) < 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(purchase.purchaseDate)) {
      setError("أكمل اسم السلعة والكمية والأسعار والمورد وتاريخ الشراء.");
      return;
    }
    setSaving(true);
    setError("");
    let savedItemId: number | null = null;
    let savedDocuments = false;
    try {
      const payload = JSON.stringify({
        name: purchase.name.trim(), quantity: Number(purchase.quantity),
        buyPrice: Number(purchase.buyPrice), salePrice: Number(purchase.salePrice),
        supplier: purchase.supplier.trim(), invoiceNumber: purchase.invoiceNumber.trim(),
        purchaseDate: purchase.purchaseDate, notes: purchase.notes.trim(),
      });
      const result = editingItem
        ? await apiRequest<{ item: InventoryItem }>(`/inventory/${editingItem.id}`, () => getToken(), { method: "PATCH", body: payload })
        : await apiRequest<{ item: InventoryItem }>("/inventory", () => getToken(), { method: "POST", body: payload });
      savedItemId = result.item.id;
      if (pickedDocs.length) {
        await uploadDocuments(result.item.id, pickedDocs);
        savedDocuments = true;
      }
      setPurchaseOpen(false);
      setPurchase(emptyPurchase());
      setEditingItem(null);
      setPickedDocs([]);
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "تعذر حفظ عملية الشراء.";
      if (savedItemId) {
        setPurchaseOpen(false);
        setPurchase(emptyPurchase());
        setEditingItem(null);
        setPickedDocs([]);
        setError(savedDocuments ? message : `تم حفظ الشراء، لكن تعذر رفع المستندات. ${message}`);
        await refresh();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const startMovement = (item: InventoryItem, type: "sale" | "use") => {
    setMovementItem(item);
    setMovementType(type);
    setMovementQuantity("");
    setMovementPrice(type === "sale" && item.sale_price != null ? String(item.sale_price) : "");
    setMovementParty("");
    setMovementDate(localDate());
    setMovementNotes("");
    setError("");
  };

  const saveMovement = async () => {
    if (!movementItem || !Number.isSafeInteger(Number(movementQuantity)) ||
        Number(movementQuantity) < 1 || Number(movementQuantity) > movementItem.remaining_quantity ||
        (movementType === "sale" && (movementPrice === "" || !Number.isFinite(Number(movementPrice)) || Number(movementPrice) < 0)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) {
      setError("تحقق من الكمية والسعر والتاريخ؛ لا يمكن تجاوز المخزون المتبقي.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/inventory/${movementItem.id}/movements`, () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          type: movementType, quantity: Number(movementQuantity),
          unitPrice: movementType === "sale" ? Number(movementPrice) : null,
          counterparty: movementParty.trim(), movementDate, notes: movementNotes.trim(),
        }),
      });
      setMovementItem(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تسجيل حركة المخزون.");
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const url = `/api/inventory-attachments/${attachment.id}`;
      if (Platform.OS === "web") {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("تعذر تحميل المستند.");
        const objectUrl = URL.createObjectURL(await response.blob());
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

  const toggleHistory = async (item: InventoryItem) => {
    if (historyItemId === item.id) {
      setHistoryItemId(null);
      return;
    }
    setHistoryItemId(item.id);
    setHistoryLoading(true);
    try {
      const result = await apiRequest<{ movements: Movement[] }>(`/inventory/${item.id}/movements`, () => getToken());
      setMovements(result.movements);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل سجل الحركة.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...draftFilters });
  };
  const resetFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  if ((!member?.active || !canAccess) && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>{error || "الحساب غير مفعل أو لا يملك صلاحية الوصول إلى المشتريات والمخزون."}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  const purchaseQuantity = Number(purchase.quantity) || 0;
  const buyPrice = Number(purchase.buyPrice) || 0;
  const salePrice = Number(purchase.salePrice) || 0;
  const totalCost = purchaseQuantity * buyPrice;
  const expectedSales = purchaseQuantity * salePrice;
  const expectedProfit = expectedSales - totalCost;
  const pageCount = Math.max(1, Math.ceil(total / 25));

  return (
    <View style={styles.screen}>
      <AppHeader
        title="المشتريات والمخزون"
        leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: width < 420 ? 12 : 20 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.introRow, { flexDirection: wide ? "row" : "column" }]}>
          <View style={styles.intro}>
            <Text style={styles.title}>المشتريات والمخزون</Text>
            <Text style={styles.subtitle}>سجّل الشراء، تابع الكميات، واحسب الربح المتوقع والمحقق من المبيعات.</Text>
          </View>
          {canCreate ? (
            <Pressable onPress={purchaseOpen ? () => { setPurchaseOpen(false); setEditingItem(null); setPickedDocs([]); } : startNewPurchase} style={styles.primaryButton}>
              {purchaseOpen ? <X size={17} color={colors.navy} /> : <Plus size={18} color={colors.navy} />}
              <Text style={styles.primaryButtonText}>{purchaseOpen ? "إغلاق النموذج" : "تسجيل عملية شراء"}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable>
          </View>
        ) : null}

        {summary ? (
          <View style={styles.summaryGrid}>
            <SummaryCard label="إجمالي تكلفة المشتريات" value={formatDzd(amount(summary.total_cost))} accent={colors.blue} />
            <SummaryCard label="قيمة المخزون المتبقي" value={formatDzd(amount(summary.stock_value))} accent="#0F766E" />
            <SummaryCard label="الربح المتوقع" value={profitLabel(summary.expected_profit)} accent="#15803D" />
            <SummaryCard label="الربح المحقق من البيع" value={profitLabel(summary.realized_profit)} accent="#B45309" />
            <SummaryCard label="المخزون المتبقي" value={`${Number(summary.remaining_quantity) || 0} قطعة`} accent={colors.navy} />
            <SummaryCard label="المباع / المستعمل" value={`${Number(summary.sold_quantity) || 0} / ${Number(summary.used_quantity) || 0} قطعة`} accent="#7C3AED" />
          </View>
        ) : null}

        {purchaseOpen && (editingItem ? canEdit : canCreate) ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>{editingItem ? "تعديل بيانات الشراء" : "تسجيل شراء جديد"}</Text>
            <View style={styles.formGrid}>
              <Field label="اسم السلعة *" value={purchase.name} onChange={(value) => setPurchaseField("name", value)} placeholder="مثال: أنبوب فولاذي" />
              <Field label="المورد *" value={purchase.supplier} onChange={(value) => setPurchaseField("supplier", value)} placeholder="اسم المورد" />
              <Field label="الكمية *" value={purchase.quantity} onChange={(value) => setPurchaseField("quantity", value)} placeholder="0" numeric />
              <Field label="رقم الفاتورة" value={purchase.invoiceNumber} onChange={(value) => setPurchaseField("invoiceNumber", value)} placeholder="اختياري" />
              <Field label="سعر الشراء للوحدة (دج) *" value={purchase.buyPrice} onChange={(value) => setPurchaseField("buyPrice", value)} placeholder="0" numeric />
              <Field label="سعر البيع للوحدة (دج) *" value={purchase.salePrice} onChange={(value) => setPurchaseField("salePrice", value)} placeholder="0" numeric />
              <Field label="تاريخ الشراء *" value={purchase.purchaseDate} onChange={(value) => setPurchaseField("purchaseDate", value)} placeholder="YYYY-MM-DD" />
              <Field label="ملاحظات" value={purchase.notes} onChange={(value) => setPurchaseField("notes", value)} placeholder="تفاصيل إضافية" />
            </View>
            <View style={styles.calculationBox}>
              <Calculation label="إجمالي التكلفة" value={formatDzd(totalCost)} />
              <Calculation label="قيمة البيع المتوقعة" value={formatDzd(expectedSales)} />
              <Calculation label="الربح المتوقع" value={formatDzd(expectedProfit)} highlight />
            </View>
            {canAddAttachments ? (
              <View style={styles.actionsRow}>
                <Pressable onPress={() => void chooseDocuments()} style={styles.outlineButton} disabled={saving}>
                  <FilePlus2 size={16} color={colors.blue} />
                  <Text style={styles.outlineButtonText}>إرفاق فاتورة أو وثيقة</Text>
                </Pressable>
                <Text style={styles.mutedText}>حتى 5 مستندات، 8 MB للملف</Text>
              </View>
            ) : null}
            {pickedDocs.length ? (
              <View style={styles.fileList}>
                {pickedDocs.map((doc, index) => (
                  <View key={`${doc.name}-${index}`} style={styles.filePill}>
                    <Text style={styles.fileName}>{doc.name}</Text>
                    <Pressable onPress={() => setPickedDocs((current) => current.filter((_, i) => i !== index))} accessibilityLabel="إزالة الملف">
                      <X size={15} color={colors.red} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable onPress={() => void savePurchase()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{editingItem ? "حفظ التعديلات" : "حفظ عملية الشراء"}</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionTitleRow}>
              <Search size={18} color={colors.blue} />
              <Text style={styles.cardHeading}>البحث والتصفية</Text>
            </View>
            <Pressable onPress={() => setFiltersOpen((open) => !open)} style={styles.smallOutlineButton}>
              <Text style={styles.smallOutlineText}>{filtersOpen ? "إخفاء" : "عرض المرشحات"}</Text>
            </Pressable>
          </View>
          {filtersOpen ? (
            <>
              <View style={styles.formGrid}>
                <Field label="السلعة" value={draftFilters.name} onChange={(value) => setFilterField("name", value)} placeholder="اسم السلعة" />
                <Field label="المورد" value={draftFilters.supplier} onChange={(value) => setFilterField("supplier", value)} placeholder="اسم المورد" />
                <Field label="رقم الفاتورة" value={draftFilters.invoice} onChange={(value) => setFilterField("invoice", value)} placeholder="رقم الفاتورة" />
                <Field label="من تاريخ" value={draftFilters.from} onChange={(value) => setFilterField("from", value)} placeholder="YYYY-MM-DD" />
                <Field label="إلى تاريخ" value={draftFilters.to} onChange={(value) => setFilterField("to", value)} placeholder="YYYY-MM-DD" />
                <Field label="سعر الشراء من (دج)" value={draftFilters.minPrice} onChange={(value) => setFilterField("minPrice", value)} placeholder="0" numeric />
                <Field label="سعر الشراء إلى (دج)" value={draftFilters.maxPrice} onChange={(value) => setFilterField("maxPrice", value)} placeholder="—" numeric />
                <Field label="سعر البيع من (دج)" value={draftFilters.minSalePrice} onChange={(value) => setFilterField("minSalePrice", value)} placeholder="0" numeric />
                <Field label="سعر البيع إلى (دج)" value={draftFilters.maxSalePrice} onChange={(value) => setFilterField("maxSalePrice", value)} placeholder="—" numeric />
              </View>
              <Text style={styles.fieldLabel}>حالة المخزون</Text>
              <View style={styles.chipRow}>
                {[
                  { value: "", label: "الكل" },
                  { value: "available", label: "متوفر" },
                  { value: "empty", label: "نفد" },
                ].map((option) => (
                  <FilterChip key={option.value} label={option.label} selected={draftFilters.stock === option.value} onPress={() => setFilterField("stock", option.value)} />
                ))}
              </View>
              <View style={styles.actionsRow}>
                <Pressable onPress={applyFilters} style={styles.smallPrimaryButton}><Text style={styles.smallPrimaryText}>تطبيق التصفية</Text></Pressable>
                <Pressable onPress={resetFilters} style={styles.smallOutlineButton}><Text style={styles.smallOutlineText}>مسح المرشحات</Text></Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.mutedText}>بحث حسب السلعة أو المورد أو الفاتورة أو التاريخ أو حالة المخزون أو سعر الشراء.</Text>
          )}
        </View>

        <View style={styles.listHeader}>
          <View style={styles.sectionTitleRow}>
            <Boxes size={19} color={colors.blue} />
            <Text style={styles.cardHeading}>سجل المشتريات</Text>
          </View>
          <Text style={styles.mutedText}>{total} عملية شراء</Text>
        </View>

        {loading ? (
          <View style={styles.card}><ActivityIndicator color={colors.blue} /></View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <ShoppingCart size={28} color={colors.muted} />
            <Text style={styles.emptyText}>لا توجد مشتريات تطابق البحث.</Text>
            {canManage ? <Text style={styles.mutedText}>سجّل عملية شراء جديدة أو غيّر المرشحات.</Text> : null}
          </View>
        ) : items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={[styles.itemTop, { flexDirection: wide ? "row" : "column" }]}>
              <View style={styles.itemHeading}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.supplier || "دون مورد"} · فاتورة {item.invoice_number || "—"} · {dateLabel(item.purchase_date)}
                </Text>
              </View>
              <View style={[styles.stockBadge, item.remaining_quantity > 0 ? styles.stockBadgeAvailable : styles.stockBadgeEmpty]}>
                <Text style={[styles.stockBadgeText, item.remaining_quantity > 0 ? styles.stockTextAvailable : styles.stockTextEmpty]}>
                  {item.remaining_quantity > 0 ? `${item.remaining_quantity} متبقي` : "نفد المخزون"}
                </Text>
              </View>
            </View>
            <View style={styles.metricsGrid}>
              <Metric label="الكمية المشراة" value={`${item.quantity} قطعة`} />
              <Metric label="المباع" value={`${item.sold_quantity} قطعة`} />
              <Metric label="المستعمل" value={`${item.used_quantity} قطعة`} />
              <Metric label="سعر الشراء للوحدة" value={formatDzd(amount(item.buy_price))} />
              <Metric label="سعر البيع للوحدة" value={item.sale_price == null ? "غير محدد" : formatDzd(amount(item.sale_price))} />
              <Metric label="إجمالي التكلفة" value={formatDzd(amount(item.total_cost))} />
              <Metric label="الربح المتوقع" value={item.expected_profit == null ? "غير محدد" : profitLabel(item.expected_profit)} accent="#15803D" />
              <Metric label="الربح المحقق" value={profitLabel(item.realized_profit)} accent="#B45309" />
            </View>
            <RecordNotes entity="inventory" recordId={item.id} initialNotes={item.notes} editable={canEdit} />
            <View style={styles.actionsRow}>
              {canCreate && item.remaining_quantity > 0 ? (
                <>
                  <ActionButton label="تسجيل بيع" onPress={() => startMovement(item, "sale")} />
                  <ActionButton label="تسجيل استعمال" onPress={() => startMovement(item, "use")} />
                </>
              ) : null}
              {canEdit ? <ActionButton label="تعديل الشراء" onPress={() => startEdit(item)} icon={<Pencil size={14} color={colors.blue} />} /> : null}
              <ActionButton label={historyItemId === item.id ? "إخفاء الحركات" : "سجل الحركات"} onPress={() => void toggleHistory(item)} />
            </View>
            {item.attachments.length ? (
              <View style={styles.attachmentBlock}>
                <Text style={styles.fieldLabel}>الفواتير والوثائق</Text>
                <View style={styles.chipRow}>
                  {item.attachments.map((attachment) => (
                    <Pressable key={attachment.id} onPress={() => void openAttachment(attachment)} style={styles.attachmentChip}>
                      <FilePlus2 size={14} color={colors.blue} />
                      <Text style={styles.attachmentName}>{attachment.file_name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {movementItem?.id === item.id ? (
              <View style={styles.subCard}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.cardHeading}>{movementType === "sale" ? "تسجيل بيع" : "تسجيل استعمال"}</Text>
                  <Pressable onPress={() => setMovementItem(null)}><X size={18} color={colors.muted} /></Pressable>
                </View>
                <View style={styles.formGrid}>
                  <Field label={`الكمية (المتاح ${item.remaining_quantity}) *`} value={movementQuantity} onChange={setMovementQuantity} placeholder="0" numeric />
                  {movementType === "sale" ? <Field label="سعر البيع الفعلي للوحدة (دج) *" value={movementPrice} onChange={setMovementPrice} placeholder="0" numeric /> : null}
                  <Field label={movementType === "sale" ? "المشتري (اختياري)" : "موقع أو سبب الاستعمال"} value={movementParty} onChange={setMovementParty} placeholder="اسم الجهة أو الموقع" />
                  <Field label="التاريخ *" value={movementDate} onChange={setMovementDate} placeholder="YYYY-MM-DD" />
                  <Field label="ملاحظات" value={movementNotes} onChange={setMovementNotes} placeholder="تفاصيل إضافية" />
                </View>
                <Text style={styles.mutedText}>{movementType === "sale" ? "يُحسب الربح المحقق من سعر البيع الفعلي وتكلفة الشراء للوحدة." : "يُخصم الاستعمال من المخزون ولا يُسجّل كربح بيع."}</Text>
                <Pressable onPress={() => void saveMovement()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>حفظ الحركة</Text>}
                </Pressable>
              </View>
            ) : null}
            {historyItemId === item.id ? (
              <View style={styles.subCard}>
                <Text style={styles.cardHeading}>سجل البيع والاستعمال</Text>
                {historyLoading ? <ActivityIndicator color={colors.blue} /> : movements.length ? movements.map((movement) => (
                  <View key={movement.id} style={styles.movementRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.movementTitle}>
                        {movement.movement_type === "sale" ? "بيع" : "استعمال"} · {movement.quantity} قطعة
                        {movement.movement_type === "sale" ? ` · ${formatDzd(amount(movement.unit_price))} للوحدة` : ""}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {dateLabel(movement.movement_date)} · {movement.counterparty || "—"} · {movement.recorded_by_name}
                      </Text>
                      <RecordNotes entity="inventoryMovement" recordId={movement.id} initialNotes={movement.notes} editable={canEdit} />
                    </View>
                    {movement.movement_type === "sale" ? (
                      <Text style={styles.realizedValue}>{profitLabel((amount(movement.unit_price) - amount(item.buy_price)) * movement.quantity)}</Text>
                    ) : null}
                  </View>
                )) : <Text style={styles.mutedText}>لا توجد حركات مسجلة لهذه السلعة.</Text>}
              </View>
            ) : null}
          </View>
        ))}

        {!loading && total > 25 ? (
          <View style={styles.pagination}>
            <Pressable disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}>
              <ChevronRight size={17} color={colors.navy} /><Text style={styles.pageButtonText}>السابق</Text>
            </Pressable>
            <Text style={styles.pageIndicator}>صفحة {page} من {pageCount}</Text>
            <Pressable disabled={page >= pageCount} onPress={() => setPage((value) => Math.min(pageCount, value + 1))} style={[styles.pageButton, page >= pageCount && styles.disabled]}>
              <Text style={styles.pageButtonText}>التالي</Text><ChevronLeft size={17} color={colors.navy} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, numeric = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; numeric?: boolean;
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
        style={styles.input}
        textAlign="right"
      />
    </View>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryAccent, { backgroundColor: accent }]} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Calculation({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.calculation}>
      <Text style={styles.calculationLabel}>{label}</Text>
      <Text style={[styles.calculationValue, highlight && styles.calculationHighlight]}>{value}</Text>
    </View>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.actionButton}>
      {icon}
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1320, alignSelf: "center" as const, paddingTop: 20, paddingBottom: 42, gap: 16 },
  introRow: { alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12 },
  intro: { flex: 1 },
  title: { color: colors.navy, fontWeight: "900" as const, fontSize: 22, textAlign: "right" as const },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, textAlign: "right" as const, lineHeight: 19 },
  primaryButton: { minHeight: 44, borderRadius: 12, backgroundColor: colors.yellow, paddingHorizontal: 15, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  primaryButtonText: { color: colors.navy, fontWeight: "800" as const, fontSize: 12 },
  summaryGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  summaryCard: { flexGrow: 1, flexBasis: 175, minWidth: 145, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 15, overflow: "hidden" as const },
  summaryAccent: { width: 4, position: "absolute" as const, right: 0, top: 0, bottom: 0 },
  summaryLabel: { color: colors.muted, fontSize: 11, textAlign: "right" as const, lineHeight: 17 },
  summaryValue: { color: colors.navy, fontWeight: "900" as const, fontSize: 16, textAlign: "right" as const, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 17, gap: 13 },
  cardHeading: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  formGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  field: { flexGrow: 1, flexBasis: 205, minWidth: 145 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, textAlign: "right" as const, marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, paddingHorizontal: 12, fontSize: 13 },
  calculationBox: { flexDirection: "row" as const, flexWrap: "wrap" as const, backgroundColor: "#F4F7FB", borderRadius: 12, padding: 12, gap: 12 },
  calculation: { flexGrow: 1, minWidth: 135 },
  calculationLabel: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
  calculationValue: { color: colors.navy, fontSize: 13, fontWeight: "800" as const, textAlign: "right" as const, marginTop: 5 },
  calculationHighlight: { color: "#15803D" },
  actionsRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 8 },
  outlineButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 7 },
  outlineButtonText: { color: colors.blue, fontSize: 11, fontWeight: "700" as const },
  mutedText: { color: colors.muted, fontSize: 10, textAlign: "right" as const, lineHeight: 17 },
  fileList: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  filePill: { maxWidth: "100%" as const, flexDirection: "row" as const, alignItems: "center" as const, gap: 7, padding: 8, borderRadius: 9, backgroundColor: "#F4F7FB" },
  fileName: { color: colors.ink, fontSize: 10, maxWidth: 240 },
  saveButton: { minHeight: 45, borderRadius: 11, backgroundColor: colors.blue, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 14 },
  saveText: { color: "#FFFFFF", fontWeight: "800" as const, fontSize: 12 },
  disabled: { opacity: 0.5 },
  sectionHeadingRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 },
  sectionTitleRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  smallOutlineButton: { minHeight: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, alignItems: "center" as const, justifyContent: "center" as const },
  smallOutlineText: { color: colors.blue, fontSize: 10, fontWeight: "700" as const },
  smallPrimaryButton: { minHeight: 36, backgroundColor: colors.blue, borderRadius: 9, paddingHorizontal: 14, alignItems: "center" as const, justifyContent: "center" as const },
  smallPrimaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" as const },
  chipRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, alignItems: "center" as const },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  filterChipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  filterChipText: { color: colors.ink, fontSize: 10, fontWeight: "700" as const },
  filterChipTextSelected: { color: "#FFFFFF" },
  listHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 4 },
  emptyCard: { minHeight: 120, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14, alignItems: "center" as const, justifyContent: "center" as const, gap: 9, padding: 20 },
  emptyText: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, textAlign: "center" as const },
  itemCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 17, gap: 14 },
  itemTop: { alignItems: "center" as const, justifyContent: "space-between" as const, gap: 9 },
  itemHeading: { flex: 1, width: "100%" as const },
  itemName: { color: colors.navy, fontSize: 15, fontWeight: "900" as const, textAlign: "right" as const },
  itemMeta: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: "right" as const, lineHeight: 16 },
  stockBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  stockBadgeAvailable: { backgroundColor: "#ECFDF3" },
  stockBadgeEmpty: { backgroundColor: "#FEF2F2" },
  stockBadgeText: { fontSize: 10, fontWeight: "800" as const },
  stockTextAvailable: { color: "#15803D" },
  stockTextEmpty: { color: colors.red },
  metricsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  metric: { flexGrow: 1, flexBasis: 145, minWidth: 125, backgroundColor: "#F7F9FC", borderRadius: 10, padding: 10 },
  metricLabel: { color: colors.muted, fontSize: 10, textAlign: "right" as const },
  metricValue: { color: colors.ink, fontSize: 13, fontWeight: "800" as const, textAlign: "right" as const, marginTop: 6 },
  itemNote: { color: colors.muted, fontSize: 11, textAlign: "right" as const, lineHeight: 18 },
  actionButton: { minHeight: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 5 },
  actionButtonText: { color: colors.blue, fontSize: 10, fontWeight: "700" as const },
  attachmentBlock: { gap: 7 },
  attachmentChip: { maxWidth: "100%" as const, minHeight: 32, flexDirection: "row" as const, alignItems: "center" as const, borderRadius: 8, backgroundColor: "#EFF6FF", paddingHorizontal: 9, gap: 6 },
  attachmentName: { color: colors.blue, fontSize: 10, maxWidth: 230 },
  subCard: { backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  movementRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 9, gap: 10 },
  movementTitle: { color: colors.ink, fontSize: 11, fontWeight: "800" as const, textAlign: "right" as const },
  realizedValue: { color: "#15803D", fontSize: 11, fontWeight: "800" as const },
  pagination: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 16, paddingVertical: 5 },
  pageButton: { minHeight: 38, flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: "#FFFFFF" },
  pageButtonText: { color: colors.navy, fontSize: 10, fontWeight: "700" as const },
  pageIndicator: { color: colors.muted, fontSize: 11 },
  errorBox: { padding: 12, borderRadius: 11, backgroundColor: colors.redSoft, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10 },
  errorText: { color: colors.red, fontSize: 11, textAlign: "right" as const, lineHeight: 18 },
  retryText: { color: colors.blue, fontSize: 10, fontWeight: "800" as const },
  center: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.background, padding: 24, gap: 14 },
  denied: { color: colors.muted, fontSize: 13, textAlign: "center" as const, lineHeight: 22 },
  secondaryButton: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FFFFFF", borderRadius: 10 },
  secondaryText: { color: colors.blue, fontWeight: "800" as const, fontSize: 12 },
};
