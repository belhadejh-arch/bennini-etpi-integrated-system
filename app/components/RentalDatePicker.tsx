import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../lib/theme";

function fromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function toIso(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function RentalDatePicker({ label, value, onChange, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initial = fromIso(value || new Date().toISOString().slice(0, 10));
  const [cursor, setCursor] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() });
  useEffect(() => {
    const next = fromIso(value || new Date().toISOString().slice(0, 10));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }, [value]);
  const days = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [cursor]);
  const move = (delta: number) => {
    const date = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  };
  return (
    <View style={{ flexGrow: 1, flexBasis: 220 }}>
      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800", textAlign: "right", marginBottom: 6 }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => setOpen((v) => !v)}
        style={{ minHeight: 46, opacity: disabled ? 0.5 : 1, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <CalendarDays size={17} color={disabled ? colors.muted : colors.blue} />
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{disabled ? "تاريخ الانتهاء غير محدد" : value || "اختر التاريخ"}</Text>
      </Pressable>
      {open && !disabled ? (
        <View style={{ marginTop: 7, padding: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable accessibilityLabel="الشهر السابق" onPress={() => move(-1)} style={{ minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center" }}><ChevronLeft size={18} color={colors.blue} /></Pressable>
            <Text style={{ color: colors.navy, fontWeight: "900" }}>{monthNames[cursor.month]} {cursor.year}</Text>
            <Pressable accessibilityLabel="الشهر التالي" onPress={() => move(1)} style={{ minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center" }}><ChevronRight size={18} color={colors.blue} /></Pressable>
          </View>
          <View style={{ flexDirection: "row" }}>{["ن", "ث", "ر", "خ", "ج", "س", "ح"].map((day, i) => <Text key={i} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 11, fontWeight: "800" }}>{day}</Text>)}</View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {days.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={{ width: "14.28%", height: 38 }} />;
              const date = toIso(new Date(Date.UTC(cursor.year, cursor.month, day)));
              const selected = date === value;
              return <Pressable key={date} accessibilityRole="button" accessibilityLabel={date} onPress={() => { onChange(date); setOpen(false); }}
                style={{ width: "14.28%", minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: selected ? colors.action : "transparent" }}>
                <Text style={{ color: selected ? colors.onAccent : colors.ink, fontSize: 12, fontWeight: selected ? "900" : "600" }}>{day}</Text>
              </Pressable>;
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
