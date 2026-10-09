import { useAuth } from "../../lib/auth";
import { Pencil, Save, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { apiRequest } from "../../lib/api";
import { colors } from "../../lib/theme";

export type NoteEntity =
  | "transaction"
  | "inventory"
  | "inventoryMovement"
  | "cheque"
  | "rental"
  | "fieldExpense"
  | "machinery"
  | "machinerySparePart"
  | "member"
  | "auditNote";

export default function RecordNotes({
  entity,
  recordId,
  initialNotes,
  editable,
}: {
  entity: NoteEntity;
  recordId: string | number;
  initialNotes?: string | null;
  editable: boolean;
}) {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotes(initialNotes ?? "");
    if (!editing) setDraft(initialNotes ?? "");
  }, [initialNotes, editing]);

  const save = async () => {
    if (draft.length > 5000) {
      setError("الحد الأقصى للملاحظات 5000 حرف.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/record-notes/${entity}/${encodeURIComponent(String(recordId))}`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ notes: draft.trim() }),
      });
      setNotes(draft.trim());
      setDraft(draft.trim());
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ الملاحظات.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.label}>الملاحظات</Text>
        {editable && !editing ? (
          <Pressable onPress={() => { setDraft(notes); setError(""); setEditing(true); }} style={styles.editButton}>
            <Pencil size={12} color={colors.blue} />
            <Text style={styles.editText}>{notes ? "تعديل" : "إضافة ملاحظة"}</Text>
          </Pressable>
        ) : null}
      </View>
      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={5000}
            placeholder="اكتب ملاحظة مرتبطة بهذا السجل..."
            placeholderTextColor="#98A5B4"
            accessibilityLabel="ملاحظات السجل"
            textAlign="right"
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable onPress={() => void save()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Save size={13} color="#FFFFFF" />}
              <Text style={styles.saveText}>حفظ الملاحظة</Text>
            </Pressable>
            <Pressable onPress={() => { setDraft(notes); setEditing(false); setError(""); }} disabled={saving} style={styles.cancelButton}>
              <X size={13} color={colors.muted} />
              <Text style={styles.cancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text selectable style={styles.noteText}>{notes || "لا توجد ملاحظات مسجلة."}</Text>
      )}
    </View>
  );
}

const styles = {
  container: { gap: 8, backgroundColor: "#F3F6FA", borderRadius: 11, padding: 11, borderWidth: 1, borderColor: "#E8EDF3" },
  heading: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 },
  label: { color: colors.muted, fontSize: 11, fontWeight: "800" as const, textAlign: "right" as const },
  editButton: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingVertical: 2, paddingHorizontal: 4 },
  editText: { color: colors.blue, fontSize: 11, fontWeight: "800" as const },
  noteText: { color: colors.ink, fontSize: 12, textAlign: "right" as const, lineHeight: 20 },
  input: { minHeight: 84, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", color: colors.ink, padding: 11, fontSize: 12, textAlign: "right" as const, textAlignVertical: "top" as const, writingDirection: "rtl" as const },
  actions: { flexDirection: "row" as const, gap: 7, justifyContent: "flex-start" as const },
  saveButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.blue, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 5 },
  saveText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" as const },
  cancelButton: { minHeight: 34, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  cancelText: { color: colors.muted, fontSize: 10, fontWeight: "700" as const },
  error: { color: colors.red, fontSize: 10, textAlign: "right" as const },
  disabled: { opacity: 0.55 },
};
