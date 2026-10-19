import { Search, Truck, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
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
      {selected ? (
        <View style={{
          alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: "#EAF1FA", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
        }}>
          <Truck size={13} color={colors.blue} />
          <Text style={{ color: colors.blue, fontSize: 10, fontWeight: "800" }}>{selected.name} · {selected.code}</Text>
          <Pressable onPress={() => onChange("")} accessibilityLabel="إزالة اختيار الآلية"><X size={13} color={colors.blue} /></Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {filtered.map((machine) => {
          const active = String(machine.id) === value;
          return (
            <Pressable key={machine.id} onPress={() => onChange(String(machine.id))} style={{
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
      </View>
      {onAdd ? (
        <Pressable onPress={onAdd} style={{ alignSelf: "flex-start", paddingVertical: 5 }}>
          <Text style={{ color: colors.blue, fontSize: 11, fontWeight: "800" }}>+ إضافة آلة جديدة</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
