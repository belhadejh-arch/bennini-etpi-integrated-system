import { ChevronDown, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { translateStatic } from "../../lib/localization";

export type MachineryOption = { id: number; name: string; code: string };

export default function MachineryPicker({
  items,
  value,
  onChange,
  label,
  emptyLabel = "اختر الآلية",
  onAdd,
}: {
  items: MachineryOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  emptyLabel?: string;
  onAdd?: () => void;
}) {
  const { language } = useAuth();
  const localizedEmptyLabel = translateStatic(emptyLabel);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter((machine) =>
      !term || `${machine.name} ${machine.code}`.toLocaleLowerCase().includes(term),
    );
  }, [items, search]);
  const selected = items.find((machine) => String(machine.id) === value);

  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600", lineHeight: 23, textAlign: language === "ar" ? "right" : "left" }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, minHeight: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, color: selected ? colors.ink : colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 23, textAlign: language === "ar" ? "right" : "left" }}>
          {selected ? `${selected.name} · ${selected.code}` : localizedEmptyLabel}
        </Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      {open ? <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 8, gap: 8, backgroundColor: colors.surface }}>
      <View style={{
        minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9,
        paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: colors.surface,
      }}>
        <Search size={15} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, lineHeight: 23, textAlign: language === "ar" ? "right" : "left" }}
          placeholder={selected ? `${selected.name} · ${selected.code}` : localizedEmptyLabel}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="البحث عن مركبة أو آلية"
        />
        {search ? <Pressable onPress={() => setSearch("")} accessibilityLabel="مسح البحث"><X size={15} color={colors.muted} /></Pressable> : null}
      </View>
      <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
        {filtered.map((machine) => {
          const active = String(machine.id) === value;
          return (
            <Pressable key={machine.id} onPress={() => { onChange(String(machine.id)); setOpen(false); setSearch(""); }} style={{
              borderWidth: 1, borderColor: active ? colors.blue : colors.border,
              backgroundColor: active ? colors.greenSoft : colors.surface, borderRadius: 8,
              paddingHorizontal: 9, paddingVertical: 7,
            }}>
              <Text style={{ color: active ? colors.blue : colors.muted, fontSize: 14, fontWeight: active ? "700" : "500", lineHeight: 23 }}>
                {machine.name} · {machine.code}
              </Text>
            </Pressable>
          );
        })}
        {!filtered.length ? <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 23, paddingVertical: 7 }}>{language === "ar" ? "لا توجد آلة مطابقة." : "Aucun engin correspondant."}</Text> : null}
      </ScrollView>
      {onAdd ? (
        <Pressable onPress={() => { setOpen(false); onAdd(); }} style={{ alignSelf: "flex-start", paddingVertical: 5 }}>
          <Text style={{ color: colors.blue, fontSize: 14, fontWeight: "600", lineHeight: 23 }}>+ {language === "ar" ? "إضافة آلة جديدة" : "Ajouter un engin"}</Text>
        </Pressable>
      ) : null}
      </View> : null}
    </View>
  );
}
