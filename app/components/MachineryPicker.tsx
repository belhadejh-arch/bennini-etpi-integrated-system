import { ChevronDown, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors } from "../../lib/theme";

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
      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700", textAlign: "right" }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, minHeight: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, color: selected ? colors.ink : colors.muted, fontSize: 12, textAlign: "right" }}>
          {selected ? `${selected.name} · ${selected.code}` : emptyLabel}
        </Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      {open ? <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 8, gap: 8, backgroundColor: "#FFFFFF" }}>
      <View style={{
        minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9,
        paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "#FBFCFE",
      }}>
        <Search size={15} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, minWidth: 0, color: colors.ink, fontSize: 12, textAlign: "right" }}
          placeholder={selected ? `${selected.name} · ${selected.code}` : emptyLabel}
          placeholderTextColor="#98A5B4"
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
              backgroundColor: active ? "#EAF1FA" : "#FFFFFF", borderRadius: 8,
              paddingHorizontal: 9, paddingVertical: 7,
            }}>
              <Text style={{ color: active ? colors.blue : colors.muted, fontSize: 10, fontWeight: active ? "800" : "600" }}>
                {machine.name} · {machine.code}
              </Text>
            </Pressable>
          );
        })}
        {!filtered.length ? <Text style={{ color: colors.muted, fontSize: 10, paddingVertical: 7 }}>لا توجد آلة مطابقة.</Text> : null}
      </ScrollView>
      {onAdd ? (
        <Pressable onPress={() => { setOpen(false); onAdd(); }} style={{ alignSelf: "flex-start", paddingVertical: 5 }}>
          <Text style={{ color: colors.blue, fontSize: 11, fontWeight: "800" }}>+ إضافة آلة جديدة</Text>
        </Pressable>
      ) : null}
      </View> : null}
    </View>
  );
}
