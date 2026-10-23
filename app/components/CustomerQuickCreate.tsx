import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { apiRequest } from "../../lib/api";
import { colors } from "../../lib/theme";
import type { FinanceEntity } from "./EntityPicker";

export default function CustomerQuickCreate({ onSaved, onCancel }: { onSaved: (customer: FinanceEntity) => void; onCancel: () => void }) {
  const { getToken } = useAuth();
  const [draft, setDraft] = useState({ name: "", phone: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (!draft.name.trim()) { setError("اسم الزبون مطلوب."); return; }
    setSaving(true); setError("");
    try {
      const { account } = await apiRequest<{ account: FinanceEntity }>("/finance/accounts", getToken, {
        method: "POST", body: JSON.stringify({ kind: "customer", ...draft }),
      });
      onSaved(account);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر إضافة الزبون."); }
    finally { setSaving(false); }
  };
  return <View style={{ padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.blueSoft }}>
    <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800", textAlign: "right" }}>تسجيل زبون جديد</Text>
    {(["name", "phone", "address", "notes"] as const).map((key, index) => <View key={key} style={{ gap: 5 }}>
      <Text style={{ color: colors.ink, textAlign: "right" }}>{["اسم الزبون *", "الهاتف", "العنوان", "ملاحظات"][index]}</Text>
      <TextInput accessibilityLabel={["اسم الزبون الجديد", "هاتف الزبون", "عنوان الزبون", "ملاحظات الزبون"][index]}
        value={draft[key]} editable={!saving} onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, textAlign: "right" }} />
    </View>)}
    {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Pressable onPress={() => void save()} disabled={saving} style={{ backgroundColor: colors.action, padding: 12, borderRadius: 9 }}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>حفظ الزبون والعودة للشراء</Text>}
      </Pressable>
      <Pressable onPress={onCancel} disabled={saving} style={{ padding: 12 }}><Text style={{ color: colors.ink }}>إلغاء</Text></Pressable>
    </View>
  </View>;
}
