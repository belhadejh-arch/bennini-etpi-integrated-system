import { useAuth } from "@clerk/expo";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowRight, FilePlus2, HardHat, Plus, RefreshCw, Search, Truck, Wrench, X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import RecordNotes from "../components/RecordNotes";
import { apiRequest, type Member } from "../../lib/api";
import { colors, formatDzd } from "../../lib/theme";
import { canUploadFiles, hasPermission } from "../../shared/access";

type Machinery = {
  id: number;
  code: string;
  name: string;
  category: string;
  status: string;
  hours_worked: number;
  repair_count: number;
  total_expenses: number | string;
  notes: string;
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
type DocumentAsset = DocumentPicker.DocumentPickerAsset;
type ApiError = Error & { status?: number; body?: { pending?: boolean } };

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const numberValue = (value: string | number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const dateLabel = (value: string | null) => value ? value.slice(0, 10) : "—";

export default function MachinerySection() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ focusId?: string | string[] }>();
  const focusId = Array.isArray(routeParams.focusId) ? routeParams.focusId[0] : routeParams.focusId;
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [machineFormOpen, setMachineFormOpen] = useState(false);
  const [partFormOpen, setPartFormOpen] = useState(false);
  const [machineDraft, setMachineDraft] = useState({ code: "", name: "", category: "", notes: "" });
  const [partDraft, setPartDraft] = useState({
    machineryId: "", name: "", quantity: "", buyPrice: "", supplier: "",
    invoiceNumber: "", installationDate: localDate(), stockQuantity: "", repairExpense: "0", notes: "",
  });
  const [pickedDocuments, setPickedDocuments] = useState<DocumentAsset[]>([]);

  const isAdmin = member?.role === "admin";
  const canAccess = hasPermission(member, "machinery", "view");
  const canCreate = hasPermission(member, "machinery", "create");
  const canEdit = hasPermission(member, "machinery", "edit");
  const canManage = canCreate || canEdit;
  const canAddAttachments = canManage && canUploadFiles(member);
  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredMachinery = useMemo(
    () => machinery.filter((machine) => !searchTerm || `${machine.name} ${machine.code} ${machine.category}`.toLocaleLowerCase().includes(searchTerm)),
    [machinery, searchTerm],
  );
  const filteredParts = useMemo(
    () => parts.filter((part) =>
      (!focusId || String(part.id) === focusId) &&
      (selectedMachineId === null || part.machinery_id === selectedMachineId) &&
      (!searchTerm || `${part.name} ${part.machinery_name} ${part.machinery_code} ${part.supplier} ${part.invoice_number}`.toLocaleLowerCase().includes(searchTerm))),
    [focusId, parts, selectedMachineId, searchTerm],
  );
  const totalExpenses = parts.reduce(
    (total, part) => total + numberValue(part.buy_price) * part.quantity + numberValue(part.repair_expense), 0,
  );

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const [me, machineResult, partResult] = await Promise.all([
        apiRequest<{ member: Member }>("/me", token),
        apiRequest<{ items: Machinery[] }>("/machinery", token),
        apiRequest<{ items: SparePart[] }>(`/machinery/spare-parts${focusId ? `?focusId=${encodeURIComponent(focusId)}` : ""}`, token),
      ]);
      setMember(me.member);
      setMachinery(machineResult.items);
      setParts(partResult.items);
    } catch (caught) {
      const issue = caught as ApiError;
      setError(issue.message || "تعذر تحميل بيانات المركبات وقطع الغيار.");
      if (issue.status === 403 && issue.body?.pending) setMember(null);
    } finally {
      setLoading(false);
    }
  }, [focusId, getToken, isSignedIn]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (isSignedIn) void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  const changePartField = (key: keyof typeof partDraft, value: string) =>
    setPartDraft((current) => ({ ...current, [key]: value }));

  const saveMachinery = async () => {
    if (!machineDraft.code.trim() || !machineDraft.name.trim()) {
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
        }),
      });
      setMachineDraft({ code: "", name: "", category: "", notes: "" });
      setMachineFormOpen(false);
      setNotice("تم تسجيل المركبة أو الآلية.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تسجيل المركبة أو الآلية.");
    } finally {
      setSaving(false);
    }
  };

  const chooseDocuments = async () => {
    const remaining = 5 - pickedDocuments.length;
    if (remaining <= 0) {
      setError("يمكن إرفاق خمسة ملفات كحد أقصى لكل سجل.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ["application/pdf", "image/*", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      });
      if (!result.canceled && result.assets.length) {
        setPickedDocuments((current) => [...current, ...result.assets].slice(0, remaining));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر اختيار الملفات.");
    }
  };

  const uploadDocuments = async (partId: number, documents: DocumentAsset[]) => {
    const formData = new FormData();
    documents.forEach((asset) => {
      if (Platform.OS === "web" && asset.file) formData.append("files", asset.file, asset.name);
      else formData.append("files", {
        uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream",
      } as unknown as Blob);
    });
    await apiRequest(`/machinery/spare-parts/${partId}/attachments`, () => getToken(), {
      method: "POST", body: formData,
    });
  };

  const saveSparePart = async () => {
    const quantity = Number(partDraft.quantity);
    const stockQuantity = Number(partDraft.stockQuantity);
    const buyPrice = Number(partDraft.buyPrice);
    const repairExpense = Number(partDraft.repairExpense || 0);
    if (!partDraft.machineryId || !partDraft.name.trim() ||
        !Number.isSafeInteger(quantity) || quantity <= 0 ||
        !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > quantity ||
        !Number.isFinite(buyPrice) || buyPrice < 0 ||
        !Number.isFinite(repairExpense) || repairExpense < 0 ||
        (partDraft.installationDate && !/^\d{4}-\d{2}-\d{2}$/.test(partDraft.installationDate))) {
      setError("تحقق من الآلية والقطعة والكميات والأسعار وتاريخ التركيب.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    let savedId: number | null = null;
    try {
      const result = await apiRequest<{ id: number }>("/machinery/spare-parts", () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          ...partDraft,
          machineryId: Number(partDraft.machineryId),
          name: partDraft.name.trim(),
          supplier: partDraft.supplier.trim(),
          invoiceNumber: partDraft.invoiceNumber.trim(),
          quantity,
          buyPrice,
          stockQuantity,
          repairExpense,
          notes: partDraft.notes.trim(),
        }),
      });
      savedId = result.id;
      if (pickedDocuments.length) await uploadDocuments(savedId, pickedDocuments);
      setPartDraft({
        machineryId: partDraft.machineryId, name: "", quantity: "", buyPrice: "", supplier: "",
        invoiceNumber: "", installationDate: localDate(), stockQuantity: "", repairExpense: "0", notes: "",
      });
      setPickedDocuments([]);
      setPartFormOpen(false);
      setNotice("تم حفظ سجل قطعة الغيار والإصلاح.");
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "تعذر حفظ سجل الصيانة.";
      if (savedId) {
        setNotice("");
        setError(`تم حفظ السجل، لكن تعذر رفع المرفقات. ${message}`);
        setPickedDocuments([]);
        setPartFormOpen(false);
        await refresh();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const url = `/api/machinery/spare-part-attachments/${attachment.id}`;
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
        title="المركبات والآليات وقطع الغيار"
        leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>}
        rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>}
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <View style={styles.intro}>
            <Text style={styles.title}>المركبات والآليات وقطع الغيار</Text>
            <Text style={styles.subtitle}>سجّل الأصول وتابع قطع الغيار والمخزون ومصاريف الإصلاح لكل آلية.</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.summaryRow}>
          <Summary label="المركبات والآليات" value={String(machinery.length)} icon={<Truck size={17} color={colors.blue} />} />
          <Summary label="سجلات القطع والإصلاح" value={String(parts.length)} icon={<Wrench size={17} color={colors.blue} />} />
          <Summary label="إجمالي المصاريف" value={formatDzd(totalExpenses)} icon={<HardHat size={17} color={colors.blue} />} />
        </View>

        <View style={styles.searchBox}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="ابحث باسم الآلية أو القطعة أو المورد"
            placeholderTextColor="#98A5B4"
            accessibilityLabel="البحث في الآليات وقطع الغيار"
          />
          {search ? <Pressable onPress={() => setSearch("")} accessibilityLabel="مسح البحث"><X size={16} color={colors.muted} /></Pressable> : null}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>المركبات والآليات</Text>
            <Text style={styles.sectionHint}>اختر آلية لعرض سجل مصاريفها وإصلاحاتها.</Text>
          </View>
          {canCreate ? (
            <Pressable onPress={() => { setMachineFormOpen((open) => !open); setError(""); }} style={styles.smallButton}>
              {machineFormOpen ? <X size={15} color={colors.navy} /> : <Plus size={15} color={colors.navy} />}
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

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>قطع الغيار والإصلاحات</Text>
            <Text style={styles.sectionHint}>
              {selectedMachineId === null ? "السجل الكامل للمصاريف والإصلاحات." : `السجل المرتبط بـ ${machinery.find((item) => item.id === selectedMachineId)?.name ?? "الآلية المحددة"}.`}
            </Text>
          </View>
          {canCreate ? (
            <Pressable
              onPress={() => {
                setPartFormOpen((open) => !open);
                setError("");
                setPartDraft((draft) => ({
                  ...draft,
                  machineryId: selectedMachineId ? String(selectedMachineId) : draft.machineryId,
                }));
              }}
              disabled={!machinery.length}
              style={[styles.smallButton, !machinery.length && styles.disabled]}
            >
              {partFormOpen ? <X size={15} color={colors.navy} /> : <Plus size={15} color={colors.navy} />}
              <Text style={styles.smallButtonText}>{partFormOpen ? "إغلاق" : "تسجيل قطعة أو إصلاح"}</Text>
            </Pressable>
          ) : null}
        </View>

        {partFormOpen && canCreate ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>بيانات قطعة الغيار والإصلاح</Text>
            <Text style={styles.fieldLabel}>المركبة أو الآلية *</Text>
            <View style={styles.machinePicker}>
              {machinery.map((machine) => {
                const selected = partDraft.machineryId === String(machine.id);
                return (
                  <Pressable key={machine.id} onPress={() => changePartField("machineryId", String(machine.id))} style={[styles.machineOption, selected && styles.machineOptionSelected]}>
                    <Text style={[styles.machineOptionText, selected && styles.machineOptionTextSelected]}>{machine.name} · {machine.code}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="اسم قطعة الغيار *" value={partDraft.name} onChange={(value) => changePartField("name", value)} placeholder="مثال: فلتر زيت" />
            <Field label="الكمية المشتراة *" value={partDraft.quantity} onChange={(value) => changePartField("quantity", value)} placeholder="0" numeric />
            <Field label="سعر الشراء للوحدة (دج) *" value={partDraft.buyPrice} onChange={(value) => changePartField("buyPrice", value)} placeholder="0" numeric />
            <Field label="المورد" value={partDraft.supplier} onChange={(value) => changePartField("supplier", value)} placeholder="اسم المورد" />
            <Field label="رقم الفاتورة" value={partDraft.invoiceNumber} onChange={(value) => changePartField("invoiceNumber", value)} placeholder="اختياري" />
            <Field label="تاريخ التركيب" value={partDraft.installationDate} onChange={(value) => changePartField("installationDate", value)} placeholder="YYYY-MM-DD" />
            <Field label="الكمية الموجودة في المخزون *" value={partDraft.stockQuantity} onChange={(value) => changePartField("stockQuantity", value)} placeholder="أدخل الكمية المتبقية" numeric />
            <Field label="مصاريف الإصلاح (دج)" value={partDraft.repairExpense} onChange={(value) => changePartField("repairExpense", value)} placeholder="0" numeric />
            <Field label="ملاحظات" value={partDraft.notes} onChange={(value) => changePartField("notes", value)} placeholder="تفاصيل عن التركيب أو العطل" multiline />
            {canAddAttachments ? (
              <>
                <Text style={styles.helper}>يُحفظ السجل ضمن تاريخ الآلية المختارة. أرفق صورة أو فاتورة أو وثيقة عند الحاجة (حتى 5 ملفات).</Text>
                <Pressable onPress={() => void chooseDocuments()} style={styles.attachButton}>
                  <FilePlus2 size={16} color={colors.blue} />
                  <Text style={styles.attachText}>{pickedDocuments.length ? `إضافة مرفقات (${pickedDocuments.length})` : "اختيار صور أو مستندات"}</Text>
                </Pressable>
                {pickedDocuments.map((asset) => (
                  <Text key={`${asset.name}-${asset.size}`} style={styles.fileName}>{asset.name}</Text>
                ))}
              </>
            ) : null}
            <SaveButton label="حفظ سجل قطعة الغيار" saving={saving} onPress={() => void saveSparePart()} />
          </View>
        ) : null}

        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.blue} /></View> : null}
        {!loading && filteredParts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{search ? "لا توجد نتائج مطابقة للبحث." : `لا توجد قطع غيار أو إصلاحات مسجلة${selectedMachineId ? " لهذه الآلية" : ""}.`}</Text>
            {canManage && !search ? <Text style={styles.emptyHint}>استخدم زر التسجيل لإضافة أول سجل.</Text> : null}
          </View>
        ) : null}
        {filteredParts.map((part) => (
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
            <RecordNotes entity="machinerySparePart" recordId={part.id} initialNotes={part.notes} editable={canEdit} />
            <Text style={styles.recordedBy}>سجلها: {part.recorded_by_name}</Text>
            {part.attachments?.length ? (
              <View style={styles.attachmentBlock}>
                <Text style={styles.fieldLabel}>الصور والوثائق</Text>
                <View style={styles.attachmentList}>
                  {part.attachments.map((attachment) => (
                    <Pressable key={attachment.id} onPress={() => void openAttachment(attachment)} style={styles.attachmentChip}>
                      <FilePlus2 size={14} color={colors.blue} />
                      <Text numberOfLines={1} style={styles.attachmentName}>{attachment.file_name}</Text>
                    </Pressable>
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
  smallButtonText: { color: colors.navy, fontSize: 10, fontWeight: "800" as const },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 17, gap: 12 },
  cardTitle: { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const },
  field: { gap: 5 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, textAlign: "right" as const },
  input: { minHeight: 46, borderRadius: 10, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: "right" as const, writingDirection: "rtl" as const, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  multiline: { minHeight: 78, textAlignVertical: "top" as const },
  machineList: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  machineChip: { paddingHorizontal: 13, minHeight: 39, borderRadius: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, alignItems: "center" as const, justifyContent: "center" as const },
  machineChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  machineChipTitle: { color: colors.muted, fontSize: 11, fontWeight: "800" as const },
  machineChipTitleActive: { color: "#FFFFFF" },
  machineCard: { flexDirection: "column" as const, gap: 8, padding: 10, minWidth: 205, flexGrow: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  machineCardActive: { borderColor: colors.blue, backgroundColor: "#F2F7FD" },
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
  saveButton: { minHeight: 44, borderRadius: 11, backgroundColor: colors.blue, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 2 },
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
