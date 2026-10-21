import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { applyDailyShiftBulk, type DailyShift } from "../../shared/rental-calculation";
import { colors, formatDate } from "../../lib/theme";

const presets = [{ value: 1, label: "08–16" }, { value: 1.5, label: "08–20" }, { value: 2, label: "08–00" }, { value: 3, label: "24 ساعة" }, { value: 0, label: "غياب" }];
const pageSize = 14;

export default function RentalShiftDays({ rows, onChange }: { rows: DailyShift[]; onChange: (rows: DailyShift[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [bulk, setBulk] = useState("1");
  const [excludeFriday, setExcludeFriday] = useState(false);
  const [excludeHoliday, setExcludeHoliday] = useState(false);
  const bulkNumber = Number(bulk.replace(",", "."));
  const bulkValid = bulk.trim() !== "" && Number.isFinite(bulkNumber) && bulkNumber >= 0 && bulkNumber <= 3;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { setPage((current) => Math.min(current, pages - 1)); }, [pages]);
  const visible = useMemo(() => rows.slice(page * pageSize, (page + 1) * pageSize), [rows, page]);
  const update = (date: string, patch: Partial<DailyShift>) => onChange(rows.map((row) => row.date === date ? { ...row, ...patch } : row));
  const toggleSelected = (date: string) => setSelected((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date]);
  const applyBulk = (onlySelected: boolean) => {
    if (!bulkValid) return;
    onChange(applyDailyShiftBulk(rows, bulkNumber, onlySelected ? selected : null, excludeFriday, excludeHoliday));
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ padding: 12, borderRadius: 11, backgroundColor: colors.blueSoft, gap: 4 }}>
        <Text style={{ color: colors.navy, textAlign: "right", fontSize: 12, fontWeight: "900" }}>تحديد الوردية اليومية</Text>
        <Text style={{ color: colors.muted, textAlign: "right", fontSize: 11, lineHeight: 18 }}>كل يوم يبدأ بوردية واحدة. عيّن العطل يدوياً؛ لا تُفترض أيام عطلة تلقائياً. التمييز بالعطلة مخصص للاستثناء عند تطبيق قيمة جماعية.</Text>
      </View>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 10, gap: 8, backgroundColor: colors.surface }}>
        <Text style={{ color: colors.ink, textAlign: "right", fontWeight: "800", fontSize: 12 }}>تطبيق جماعي {selected.length ? `(${selected.length} محدد)` : "(كل الأيام)"}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <TextInput value={bulk} onChangeText={setBulk} keyboardType="decimal-pad" accessibilityLabel="قيمة الوردية الجماعية"
            style={{ minWidth: 78, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, color: colors.ink, textAlign: "center" }} />
          <Pressable disabled={!bulkValid} onPress={() => applyBulk(false)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 9, backgroundColor: colors.action, opacity: bulkValid ? 1 : 0.5 }}><Text style={{ color: colors.onAccent, fontWeight: "800", fontSize: 11 }}>تطبيق على كل الأيام</Text></Pressable>
          <Pressable disabled={!bulkValid || !selected.length} onPress={() => applyBulk(true)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: colors.border, opacity: bulkValid && selected.length ? 1 : 0.5 }}><Text style={{ color: colors.blue, fontWeight: "800", fontSize: 11 }}>تطبيق على الأيام المحددة</Text></Pressable>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[{ label: "استثناء أيام الجمعة", value: excludeFriday, toggle: () => setExcludeFriday((v) => !v) },
            { label: "استثناء العطل", value: excludeHoliday, toggle: () => setExcludeHoliday((v) => !v) }].map((option) => (
            <Pressable key={option.label} accessibilityRole="checkbox" accessibilityState={{ checked: option.value }} onPress={option.toggle}
              style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderWidth: 1, borderColor: option.value ? colors.blue : colors.border, borderRadius: 9, backgroundColor: option.value ? colors.blueSoft : colors.surface }}>
              <Text style={{ color: colors.blue, fontSize: 12 }}>{option.value ? "✓ " : ""}{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: colors.muted, textAlign: "right", fontSize: 10 }}>القيمة من 0 إلى 3، وتقبل الكسور مثل 1.5.</Text>
      </View>
      {visible.map((row) => (
        <View key={row.date} style={{ borderWidth: 1, borderColor: row.holiday ? colors.amber : colors.border, borderRadius: 11, backgroundColor: colors.surface, padding: 10, gap: 9 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(row.date) }} onPress={() => toggleSelected(row.date)}
              style={{ minWidth: 42, minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: selected.includes(row.date) ? colors.blue : colors.border, backgroundColor: selected.includes(row.date) ? colors.blueSoft : colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.blue, fontWeight: "900" }}>{selected.includes(row.date) ? "✓" : " "}</Text>
            </Pressable>
            <Text style={{ flex: 1, color: colors.ink, textAlign: "right", fontSize: 12, fontWeight: "800" }}>{formatDate(row.date)}{new Date(`${row.date}T00:00:00Z`).getUTCDay() === 5 ? " · الجمعة" : ""}</Text>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!row.holiday }} onPress={() => update(row.date, { holiday: !row.holiday })}
              style={{ minHeight: 40, paddingHorizontal: 10, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: row.holiday ? colors.amber : colors.border, backgroundColor: row.holiday ? colors.amberSoft : colors.surface }}>
              <Text style={{ color: row.holiday ? colors.amber : colors.muted, fontSize: 10, fontWeight: "800" }}>عطلة</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {presets.map((preset) => <Pressable key={preset.value} accessibilityRole="button" accessibilityState={{ selected: row.shifts === preset.value }}
              onPress={() => update(row.date, { shifts: preset.value })}
              style={{ flexGrow: 1, minWidth: 56, minHeight: 44, paddingHorizontal: 7, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: row.shifts === preset.value ? colors.blueSoft : colors.background, borderWidth: 1, borderColor: row.shifts === preset.value ? colors.blue : colors.border }}>
              <Text style={{ color: row.shifts === preset.value ? colors.blue : colors.ink, fontSize: 13, fontWeight: "800" }}>{preset.value}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{preset.label}</Text>
            </Pressable>)}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>قيمة مخصصة</Text>
            <ShiftValueInput value={row.shifts} onChange={(value) => update(row.date, { shifts: value })} label={`عدد الورديات ${row.date}`} />
          </View>
        </View>
      ))}
      {rows.length > pageSize ? <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable disabled={page === 0} onPress={() => setPage((current) => Math.max(0, current - 1))} style={{ minWidth: 90, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", opacity: page === 0 ? 0.4 : 1 }}><ChevronLeft size={16} color={colors.blue} /><Text style={{ color: colors.blue, fontWeight: "800", fontSize: 11 }}>السابق</Text></Pressable>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{page + 1} / {pages}</Text>
        <Pressable disabled={page >= pages - 1} onPress={() => setPage((current) => Math.min(pages - 1, current + 1))} style={{ minWidth: 90, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", opacity: page >= pages - 1 ? 0.4 : 1 }}><Text style={{ color: colors.blue, fontWeight: "800", fontSize: 11 }}>التالي</Text><ChevronRight size={16} color={colors.blue} /></Pressable>
      </View> : null}
    </View>
  );
}

function ShiftValueInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(String(value)); }, [value, focused]);
  return <TextInput value={text} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onChangeText={(next) => {
      const normalized = next.replace(",", ".");
      if (!/^\d*(\.\d{0,4})?$/.test(normalized)) return;
      const parsed = Number(normalized);
      if (normalized !== "" && normalized !== "." && (!Number.isFinite(parsed) || parsed > 3)) return;
      setText(next);
      if (normalized !== "" && normalized !== ".") onChange(parsed);
    }} keyboardType="decimal-pad" accessibilityLabel={label}
    style={{ width: 80, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, color: colors.ink, textAlign: "center" }} />;
}
