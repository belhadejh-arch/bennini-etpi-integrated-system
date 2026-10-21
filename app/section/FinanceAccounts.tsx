import { useAuth } from "../../lib/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { ArrowRight, FilePlus2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import AttachmentActions from "../components/AttachmentActions";
import { PrintRecordButton } from "../components/PrintingProvider";
import { apiRequest, type Member } from "../../lib/api";
import { attachmentPickerTypes } from "../../lib/attachments";
import { colors, formatDate, formatDzd, makeStylesReactive } from "../../lib/theme";
import { translate } from "../../lib/localization";
import { canUploadFiles, hasPermission } from "../../shared/access";

type Account = {
  id: number; kind: "customer" | "partner"; name: string; phone: string | null; address: string | null; notes: string | null;
  member_id: string | null; invoice_total: number | string; paid_total: number | string; unpaid_total: number | string;
  deposits: number | string; withdrawals: number | string; interest_total: number | string; balance: number | string;
};
type Transaction = {
  id: number; type: "income" | "expense"; amount: number | string; interest_rate?: number | string;
  interest_amount?: number | string; party: string; reason: string; payment_method: string; date: string;
  recorded_by_name: string; notes: string; attachments?: Array<{ id: number; file_name: string; mime_type: string; file_size: number }>;
};
type Invoice = { id: number; invoice_number: string; invoice_date: string; amount: number | string; paid: boolean; cheque_id: number | null; cheque_number: string | null; cheque_status: string | null; cheque_date: string | null };
type Detail = { account: Account; transactions: Transaction[]; invoices: Invoice[] };
type MemberOption = { clerk_user_id: string; name: string };
type Draft = { name: string; phone: string; address: string; notes: string; memberId: string };
type OperationDraft = { type: "income" | "expense"; amount: string; interestRate: string; reason: string; paymentMethod: string; date: string; notes: string };
const today = () => new Date().toISOString().slice(0, 10);
const blankDraft = (): Draft => ({ name: "", phone: "", address: "", notes: "", memberId: "" });
const blankOperation = (): OperationDraft => ({ type: "income", amount: "", interestRate: "0", reason: "", paymentMethod: "نقداً", date: today(), notes: "" });

export default function FinanceAccounts({ kind, member, onNavigate }: { kind: "customer" | "partner"; member: Member | null; onNavigate: (area: string) => void }) {
  const { getToken, language } = useAuth();
  const t = (text: string) => translate(text, language);
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ customerId?: string | string[] }>();
  const requestedCustomerId = Array.isArray(routeParams.customerId) ? routeParams.customerId[0] : routeParams.customerId;
  const partnerViewer = member?.role === "partner";
  const canCreate = !partnerViewer && hasPermission(member, "finance", "create");
  const canEdit = !partnerViewer && hasPermission(member, "finance", "edit");
  const mayLinkMember = canEdit && (member?.role === "admin" || member?.role === "finance");
  const canManageFiles = canEdit && canUploadFiles(member);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [operation, setOperation] = useState<OperationDraft>(blankOperation());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [operationOpen, setOperationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await apiRequest<{ items: Account[] }>(`/finance/accounts?kind=${kind}`, getToken);
      const visibleItems = partnerViewer
        ? result.items.filter((account) => account.member_id === member?.clerk_user_id)
        : result.items;
      setAccounts(visibleItems);
      if (partnerViewer && visibleItems[0]) setSelected(visibleItems[0].id);
      else if (kind === "customer" && requestedCustomerId && visibleItems.some((item) => Number(item.id) === Number(requestedCustomerId))) {
        setSelected((current) => current ?? Number(requestedCustomerId));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل الحسابات."); }
    finally { setLoading(false); }
  }, [getToken, kind, member?.clerk_user_id, partnerViewer, requestedCustomerId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (selected == null) { setDetail(null); return; }
    let active = true;
    setDetail(null);
    setLoading(true); setError("");
    apiRequest<Detail>(`/finance/accounts/${selected}`, getToken)
      .then((result) => { if (active) setDetail(result); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "تعذر تحميل الحساب."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [getToken, selected]);
  useEffect(() => {
    if (!mayLinkMember || kind !== "partner") return;
    let active = true;
    apiRequest<{ items: MemberOption[] }>("/finance/partner-members", getToken)
      .then((result) => { if (active) setMembers(result.items); })
      .catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [getToken, kind, mayLinkMember]);

  const beginEdit = (account?: Account) => {
    setCreatingAccount(!account);
    if (!account) setSelected(null);
    setDraft(account ? { name: account.name, phone: account.phone ?? "", address: account.address ?? "", notes: account.notes ?? "", memberId: account.member_id ?? "" } : blankDraft());
    setEditing(true); setError("");
  };
  const saveAccount = async () => {
    if (!draft.name.trim()) { setError("اسم الحساب مطلوب."); return; }
    setSaving(true); setError("");
    try {
      const payload = JSON.stringify({ kind, name: draft.name.trim(), phone: draft.phone.trim(), address: draft.address.trim(), notes: draft.notes.trim(), ...(kind === "partner" && mayLinkMember ? { memberId: draft.memberId || null } : {}) });
      const result = !creatingAccount && selected && detail
        ? await apiRequest<{ account: Account }>(`/finance/accounts/${selected}`, getToken, { method: "PATCH", body: payload })
        : await apiRequest<{ account: Account }>("/finance/accounts", getToken, { method: "POST", body: payload });
       setEditing(false); setCreatingAccount(false); setSelected(result.account.id);
       if (!creatingAccount) setDetail((current) => current ? { ...current, account: result.account } : current);
       await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الحساب."); }
    finally { setSaving(false); }
  };
  const saveOperation = async () => {
    if (!detail || !operation.amount || Number(operation.amount) <= 0 || !operation.reason.trim() || !operation.date) { setError("أكمل المبلغ والسبب والتاريخ."); return; }
    setSaving(true); setError("");
    try {
      await apiRequest("/transactions", getToken, { method: "POST", body: JSON.stringify({
        type: operation.type, amount: Number(operation.amount), party: detail.account.name, reason: operation.reason.trim(),
        paymentMethod: operation.paymentMethod, transactionDate: operation.date, notes: operation.notes.trim(),
        accountId: detail.account.id, interestRate: Number(operation.interestRate) || 0,
      }) });
      setOperation(blankOperation()); setOperationOpen(false);
      const result = await apiRequest<Detail>(`/finance/accounts/${detail.account.id}`, getToken);
      setDetail(result); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ العملية."); }
    finally { setSaving(false); }
  };
  const updateInterest = async (transaction: Transaction, rate: string) => {
    const parsed = Number(rate);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    try {
      await apiRequest(`/transactions/${transaction.id}`, getToken, { method: "PATCH", body: JSON.stringify({
        type: transaction.type, amount: Number(transaction.amount), party: detail?.account.name ?? transaction.party,
        reason: transaction.reason, paymentMethod: transaction.payment_method, transactionDate: transaction.date.slice(0, 10),
        notes: transaction.notes ?? "", accountId: detail?.account.id, interestRate: parsed,
      }) });
      if (detail) {
        const result = await apiRequest<Detail>(`/finance/accounts/${detail.account.id}`, getToken);
        setDetail(result); await refresh();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث نسبة الفائدة."); }
  };
  const addAttachments = async (transaction: Transaction) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: [...attachmentPickerTypes] });
      if (result.canceled || !result.assets.length) return;
      const formData = new FormData();
      const documents = result.assets.slice(0, Math.max(0, 5 - (transaction.attachments?.length ?? 0)));
      if (!documents.length) { setError("تم الوصول إلى الحد الأقصى للمرفقات."); return; }
      documents.forEach((asset) => {
        if (Platform.OS === "web" && asset.file) formData.append("files", asset.file, asset.name);
        else formData.append("files", { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream" } as unknown as Blob);
      });
      setSaving(true);
      await apiRequest(`/transactions/${transaction.id}/attachments`, getToken, { method: "POST", body: formData });
      if (detail) setDetail(await apiRequest<Detail>(`/finance/accounts/${detail.account.id}`, getToken));
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إرفاق المستند."); }
    finally { setSaving(false); }
  };
  const deleteTransaction = (transaction: Transaction) => {
    const remove = async () => {
      try {
        setSaving(true); setError("");
        await apiRequest(`/transactions/${transaction.id}`, getToken, { method: "DELETE" });
        if (detail) setDetail(await apiRequest<Detail>(`/finance/accounts/${detail.account.id}`, getToken));
        await refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف الحركة."); }
      finally { setSaving(false); }
    };
    const message = "سيتم حذف الحركة المالية ومرفقاتها. هل تريد المتابعة؟";
    if (Platform.OS === "web") {
      if (window.confirm(message)) void remove();
    } else {
      Alert.alert("حذف الحركة", message, [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => void remove() },
      ]);
    }
  };
  const filtered = accounts.filter((account) => account.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const total = (key: keyof Account) => accounts.reduce((sum, account) => sum + (Number(account[key]) || 0), 0);
  const title = t(kind === "customer" ? "حسابات الزبائن" : "حسابات الشركاء");
  if (partnerViewer && kind !== "partner") return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: language === "ar" ? "rtl" : "ltr" }}>
      <AppHeader title={title} leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>} rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>} />
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 1180, alignSelf: "center", padding: 18, paddingBottom: 36, gap: 14 }} keyboardShouldPersistTaps="handled">
        {!partnerViewer ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          <Pick label="العمليات الأخرى" active={false} onPress={() => onNavigate("transactions")} />
          <Pick label="الزبائن" active={kind === "customer"} onPress={() => onNavigate("customers")} />
          <Pick label="الشركاء" active={kind === "partner"} onPress={() => onNavigate("partners")} />
          <Pick label="الآليات" active={false} onPress={() => onNavigate("machinery")} />
        </View> : null}
        <View style={{ backgroundColor: colors.deepBlue, borderRadius: 16, padding: 19, gap: 7 }}>
          <Text style={{ color: colors.yellow, fontSize: 14, fontWeight: "700", lineHeight: 22, textAlign: language === "ar" ? "right" : "left" }}>BENNINI ETPI · سجل مستقل</Text>
          <Text style={{ color: colors.white, fontSize: 21, fontWeight: "900", textAlign: language === "ar" ? "right" : "left" }}>{title}</Text>
          <Text style={{ color: colors.lightBlue, fontSize: 14, fontWeight: "500", textAlign: language === "ar" ? "right" : "left", lineHeight: 23 }}>كل حساب يحتفظ بحركته ومستنداته ومستحقاته بصورة مستقلة.</Text>
        </View>
        {error ? <View style={{ padding: 12, borderRadius: 10, backgroundColor: colors.redSoft }}><Text style={{ color: colors.red, textAlign: "right" }}>{error}</Text></View> : null}
        {kind === "customer" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Summary label="قيمة الفواتير" value={formatDzd(total("invoice_total"))} />
            <Summary label="فواتير مسددة بشيك" value={formatDzd(total("paid_total"))} />
            <Summary label="المتبقي" value={formatDzd(total("unpaid_total"))} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Summary label="الإيداعات" value={formatDzd(total("deposits"))} />
            <Summary label="السحوبات" value={formatDzd(total("withdrawals"))} />
            <Summary label="صافي رأس المال" value={formatDzd(total("balance"))} />
            <Summary label="إجمالي الفائدة" value={formatDzd(total("interest_total"))} green />
          </View>
        )}
        {!partnerViewer && canCreate ? <Pressable onPress={() => beginEdit()} style={button}><Plus size={16} color={colors.onAccent} /><Text style={buttonText}>إضافة {kind === "customer" ? "زبون" : "شريك"}</Text></Pressable> : null}
        <TextInput value={search} onChangeText={setSearch} placeholder={`بحث في ${title}`} placeholderTextColor="#98A5B4" style={input} />
        {editing ? (
          <View style={card}>
            <View style={rowBetween}><Text style={heading}>{creatingAccount ? "حساب جديد" : "تعديل بيانات الحساب"}</Text><Pressable onPress={() => { setEditing(false); setCreatingAccount(false); }}><X size={18} color={colors.muted} /></Pressable></View>
            <TextInput style={input} value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} placeholder="الاسم *" placeholderTextColor="#98A5B4" />
            <TextInput style={input} value={draft.phone} onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))} placeholder="رقم الهاتف" placeholderTextColor="#98A5B4" />
            <TextInput style={input} value={draft.address} onChangeText={(address) => setDraft((d) => ({ ...d, address }))} placeholder="العنوان" placeholderTextColor="#98A5B4" />
            {kind === "partner" && mayLinkMember ? (
              <View style={{ gap: 7 }}>
                <Text style={label}>حساب دخول الشريك (اختياري)</Text>
                <Text style={hint}>ربط الحساب هنا يجعل دخول العضو من نوع «شريك» يعرض هذا الحساب فقط.</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                  <Pick label="بدون ربط" active={!draft.memberId} onPress={() => setDraft((d) => ({ ...d, memberId: "" }))} />
                  {members.map((item) => <Pick key={item.clerk_user_id} label={item.name} active={draft.memberId === item.clerk_user_id} onPress={() => setDraft((d) => ({ ...d, memberId: item.clerk_user_id }))} />)}
                </View>
              </View>
            ) : null}
            <TextInput style={[input, { minHeight: 70 }]} value={draft.notes} onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))} placeholder="ملاحظات" placeholderTextColor="#98A5B4" multiline />
            <Pressable disabled={saving} onPress={() => void saveAccount()} style={[primary, saving && { opacity: 0.6 }]}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={primaryText}>حفظ الحساب</Text>}</Pressable>
          </View>
        ) : null}
        {loading && accounts.length === 0 ? <View style={card}><ActivityIndicator color={colors.blue} /></View> : filtered.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flexGrow: 1, flexBasis: 260, gap: 8 }}>
              {filtered.map((account) => (
                <Pressable key={account.id} onPress={() => { setSelected(account.id); setEditing(false); }} style={[card, { borderColor: selected === account.id ? colors.blue : colors.border, borderWidth: selected === account.id ? 2 : 1 }]}>
                  <Text style={heading}>{account.name}</Text>
                  <Text style={hint}>{account.phone || "دون رقم هاتف"}</Text>
                  {kind === "customer" ? <Text style={value}>متبقٍ: {formatDzd(Number(account.unpaid_total))}</Text> : <Text style={value}>الرصيد الصافي: {formatDzd(Number(account.balance))}</Text>}
                </Pressable>
              ))}
            </View>
            <View style={{ flexGrow: 2, flexBasis: 460, gap: 10 }}>
              {selected && detail ? (
                <>
                  <View style={card}>
                    <View style={rowBetween}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {!partnerViewer && canEdit ? <Pressable onPress={() => beginEdit(detail.account)} style={smallButton}><Pencil size={13} color={colors.blue} /><Text style={smallText}>تعديل البيانات</Text></Pressable> : null}
                        {!partnerViewer && kind === "partner" && canCreate ? <Pressable onPress={() => setOperationOpen((v) => !v)} style={smallButton}><Plus size={13} color={colors.blue} /><Text style={smallText}>عملية مالية</Text></Pressable> : null}
                      </View>
                      <Text style={heading}>{detail.account.name}</Text>
                    </View>
                    <PrintRecordButton report={kind === "customer" ? "customers" : "partners"} id={detail.account.id} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                      <Summary label="الهاتف" value={detail.account.phone || "—"} />
                      <Summary label="العنوان" value={detail.account.address || "—"} />
                      {kind === "customer" ? <>
                        <Summary label="الفواتير" value={formatDzd(Number(detail.account.invoice_total))} />
                        <Summary label="المدفوع" value={formatDzd(Number(detail.account.paid_total))} />
                        <Summary label="المتبقي" value={formatDzd(Number(detail.account.unpaid_total))} />
                      </> : <>
                        <Summary label="الإيداعات" value={formatDzd(Number(detail.account.deposits))} />
                        <Summary label="السحوبات" value={formatDzd(Number(detail.account.withdrawals))} />
                        <Summary label="رأس المال الصافي" value={formatDzd(Number(detail.account.balance))} />
                        <Summary label="الفائدة" value={formatDzd(Number(detail.account.interest_total))} green />
                      </>}
                    </View>
                  </View>
                  {operationOpen ? (
                    <View style={card}>
                      <Text style={heading}>تسجيل حركة الشريك</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pick label="إيداع" active={operation.type === "income"} onPress={() => setOperation((o) => ({ ...o, type: "income" }))} />
                        <Pick label="سحب" active={operation.type === "expense"} onPress={() => setOperation((o) => ({ ...o, type: "expense" }))} />
                      </View>
                      <TextInput style={input} value={operation.amount} onChangeText={(amount) => setOperation((o) => ({ ...o, amount }))} placeholder="المبلغ" keyboardType="decimal-pad" />
                      <TextInput style={input} value={operation.interestRate} onChangeText={(interestRate) => setOperation((o) => ({ ...o, interestRate }))} placeholder="نسبة الفائدة %" keyboardType="decimal-pad" />
                      <TextInput style={input} value={operation.reason} onChangeText={(reason) => setOperation((o) => ({ ...o, reason }))} placeholder="سبب الحركة" />
                      <TextInput style={input} value={operation.paymentMethod} onChangeText={(paymentMethod) => setOperation((o) => ({ ...o, paymentMethod }))} placeholder="طريقة الدفع" />
                      <TextInput style={input} value={operation.date} onChangeText={(date) => setOperation((o) => ({ ...o, date }))} placeholder="YYYY-MM-DD" />
                      <TextInput style={input} value={operation.notes} onChangeText={(notes) => setOperation((o) => ({ ...o, notes }))} placeholder="ملاحظات" />
                      <Pressable onPress={() => void saveOperation()} disabled={saving} style={primary}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={primaryText}>حفظ الحركة</Text>}</Pressable>
                    </View>
                  ) : null}
                  {kind === "customer" ? (
                    <View style={card}>
                      <Text style={heading}>فواتير الزبون والشيكات المرتبطة</Text>
                      {detail.invoices.length ? detail.invoices.map((invoice) => (
                        <View key={invoice.id} style={line}>
                          <PrintRecordButton report="customerInvoices" id={invoice.id} />
                          <View style={{ flex: 1 }}>
                            <Text style={value}>فاتورة {invoice.invoice_number} · {formatDzd(Number(invoice.amount))}</Text>
                            <Text style={hint}>{formatDate(invoice.invoice_date)} · {invoice.paid ? "مدفوعة" : "غير مدفوعة"}</Text>
                            {invoice.cheque_id ? <Text style={hint}>شيك {invoice.cheque_number || invoice.cheque_id} · {formatDate(invoice.cheque_date)}</Text> : null}
                          </View>
                          {invoice.cheque_id ? <Pressable onPress={() => router.push(`/section/cheques?focusId=${invoice.cheque_id}`)} style={smallButton}><Text style={smallText}>عرض الشيك</Text></Pressable> : null}
                        </View>
                      )) : <Text style={hint}>لا توجد فواتير مرتبطة بهذا الحساب.</Text>}
                    </View>
                  ) : null}
                  <View style={card}>
                    <Text style={heading}>{kind === "partner" ? "الإيداعات والسحوبات والفوائد" : "الحركة المالية"}</Text>
                    {detail.transactions.length ? detail.transactions.map((transaction) => (
                      <View key={transaction.id} style={line}>
                        <PrintRecordButton report="finance" id={transaction.id} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={value}>{transaction.type === "income" ? "إيداع / دخل" : "سحب / مصروف"} · {formatDzd(Number(transaction.amount))}</Text>
                          <Text style={hint}>{formatDate(transaction.date)} · {transaction.reason} · {transaction.recorded_by_name || "—"} · {translate(transaction.payment_method, language)}</Text>
                          {transaction.notes ? <Text style={hint}>{transaction.notes}</Text> : null}
                          {transaction.attachments?.length ? <View style={{ gap: 5 }}>
                            {transaction.attachments.map((attachment) => (
                              <AttachmentActions key={attachment.id} attachment={attachment} section="finance"
                                url={`/api/transaction-attachments/${attachment.id}`}
                                canDelete={hasPermission(member, "finance", "delete")}
                                onDeleted={() => {
                                  if (detail) void apiRequest<Detail>(`/finance/accounts/${detail.account.id}`, getToken).then(setDetail);
                                }} />
                            ))}
                          </View> : null}
                          {!partnerViewer && canManageFiles && (transaction.attachments?.length ?? 0) < 5 ? <Pressable onPress={() => void addAttachments(transaction)} style={smallButton}><FilePlus2 size={13} color={colors.blue} /><Text style={smallText}>إضافة مرفق</Text></Pressable> : null}
                          {!partnerViewer && hasPermission(member, "finance", "delete") ? <Pressable onPress={() => deleteTransaction(transaction)} style={smallButton}><Trash2 size={13} color={colors.red} /><Text style={[smallText, { color: colors.red }]}>حذف الحركة</Text></Pressable> : null}
                          {kind === "partner" ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={{ color: colors.green, fontSize: 14, fontWeight: "600", lineHeight: 23 }}>فائدة: {formatDzd(Number(transaction.interest_amount))}</Text>
                            {!partnerViewer && canEdit ? <RateField value={String(transaction.interest_rate ?? 0)} onSave={(rate) => void updateInterest(transaction, rate)} /> : <Text style={hint}>النسبة {Number(transaction.interest_rate ?? 0)}%</Text>}
                            <Text style={value}>رأس المال: {formatDzd(Number(transaction.amount))}</Text>
                          </View> : null}
                        </View>
                      </View>
                    )) : <Text style={hint}>لا توجد حركات مسجلة.</Text>}
                  </View>
                </>
              ) : selected ? <View style={card}><ActivityIndicator color={colors.blue} /></View> : <View style={card}><Text style={hint}>اختر حسابًا لعرض كشفه المستقل.</Text></View>}
            </View>
          </View>
        ) : loading ? <View style={card}><ActivityIndicator color={colors.blue} /></View> : <View style={card}><Text style={heading}>لا توجد حسابات مطابقة</Text><Text style={hint}>أضف حسابًا أو غيّر البحث لعرض السجلات.</Text></View>}
      </ScrollView>
    </View>
  );
}

function Summary({ label, value: content, green = false }: { label: string; value: string; green?: boolean }) {
  return <View style={{ flexGrow: 1, flexBasis: 135, padding: 11, borderRadius: 10, backgroundColor: green ? colors.greenSoft : colors.background }}><Text style={hint}>{label}</Text><Text style={[value, green && { color: colors.green }]}>{content}</Text></View>;
}
function RateField({ value: initial, onSave }: { value: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => { setValue(initial); }, [initial]);
  return <TextInput value={value} onChangeText={setValue} onSubmitEditing={() => onSave(value)} onBlur={() => { if (value !== initial) onSave(value); }} keyboardType="decimal-pad" style={[input, { width: 95, minHeight: 34 }]} placeholder="النسبة %" />;
}
function Pick({ label: content, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={{ borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: active ? colors.greenSoft : colors.background, borderWidth: 1, borderColor: active ? colors.green : colors.border }}><Text style={{ color: active ? colors.green : colors.ink, fontSize: 14, fontWeight: "600", lineHeight: 22 }}>{content}</Text></Pressable>;
}
const card = { backgroundColor: "#FFFFFF", borderRadius: 13, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 } as const;
const input = { minHeight: 42, borderRadius: 9, backgroundColor: "#FBFCFE", borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, color: colors.ink, textAlign: "right" as const, fontSize: 12 };
const label = { color: colors.ink, fontSize: 11, fontWeight: "800" as const, textAlign: "right" as const };
const hint = { color: colors.muted, fontSize: 10, textAlign: "right" as const, lineHeight: 16 };
const heading = { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const };
const value = { color: colors.navy, fontSize: 12, fontWeight: "800" as const, textAlign: "right" as const };
const rowBetween = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10 };
const line = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#EDF0F4" };
const button = { alignSelf: "flex-start" as const, minHeight: 42, borderRadius: 10, paddingHorizontal: 14, backgroundColor: colors.yellow, flexDirection: "row" as const, alignItems: "center" as const, gap: 7 };
const buttonText = { color: colors.onAccent, fontSize: 14, fontWeight: "600" as const, lineHeight: 22 };
const primary = { minHeight: 42, borderRadius: 10, paddingHorizontal: 14, backgroundColor: colors.action, alignItems: "center" as const, justifyContent: "center" as const };
const primaryText = { color: "#FFFFFF", fontSize: 11, fontWeight: "900" as const };
const smallButton = { minHeight: 30, borderRadius: 8, paddingHorizontal: 8, backgroundColor: "#EEF3FB", flexDirection: "row" as const, alignItems: "center" as const, gap: 5 };
const smallText = { color: colors.blue, fontSize: 10, fontWeight: "800" as const };
makeStylesReactive({ card, input, label, hint, heading, value, rowBetween, line, button, buttonText, primary, primaryText, smallButton, smallText });
