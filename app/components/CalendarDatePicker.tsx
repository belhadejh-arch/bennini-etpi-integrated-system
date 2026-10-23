import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../lib/theme";

const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const weekdayNames = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];

function localTodayIso() {
  const today = new Date();
  return toIso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
}

function fromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return fromIso(localTodayIso());
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatIso(value: string) {
  return new Intl.DateTimeFormat("ar-DZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(fromIso(value));
}

export default function CalendarDatePicker({
  label,
  value,
  onChange,
  disabled = false,
  minDate,
  maxDate,
  placeholder = "اختر التاريخ",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const initial = fromIso(value || localTodayIso());
  const [cursor, setCursor] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() });

  useEffect(() => {
    const next = fromIso(value || localTodayIso());
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }, [value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const days = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [cursor]);

  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  const today = localTodayIso();
  const todayOutOfRange = (!!minDate && today < minDate) || (!!maxDate && today > maxDate);

  return (
    <View style={{ flexGrow: 1, flexBasis: 220, zIndex: open ? 20 : 1 }}>
      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800", textAlign: "right", marginBottom: 6 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `: ${formatIso(value)}` : ""}`}
        accessibilityHint="افتح التقويم لاختيار التاريخ"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={{
          minHeight: 48,
          opacity: disabled ? 0.55 : 1,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: open ? colors.blue : colors.border,
          paddingHorizontal: 13,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          ...(open ? { shadowColor: colors.navy, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 } : {}),
        }}
      >
        <CalendarDays size={18} color={disabled ? colors.muted : colors.blue} />
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: value ? colors.ink : colors.placeholder, fontSize: 13, fontWeight: value ? "800" : "600", textAlign: "right" }}
        >
          {disabled ? "تاريخ الانتهاء غير محدد" : value ? formatIso(value) : placeholder}
        </Text>
        <ChevronLeft size={16} color={colors.muted} />
      </Pressable>

      {open && !disabled ? (
        <View
          accessibilityRole="none"
          style={{
            marginTop: 8,
            padding: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            gap: 11,
            shadowColor: colors.navy,
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الشهر السابق"
              onPress={() => moveMonth(-1)}
              style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.blueSoft }}
            >
              <ChevronRight size={19} color={colors.blue} />
            </Pressable>
            <View style={{ alignItems: "center", gap: 1 }}>
              <Text style={{ color: colors.navy, fontSize: 15, fontWeight: "900" }}>{monthNames[cursor.month]} {cursor.year}</Text>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>اختر اليوم المناسب</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الشهر التالي"
              onPress={() => moveMonth(1)}
              style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.blueSoft }}
            >
              <ChevronLeft size={19} color={colors.blue} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {weekdayNames.map((day) => (
              <Text key={day} numberOfLines={1} style={{ width: "14.28%", textAlign: "center", color: colors.muted, fontSize: 9, fontWeight: "800" }}>
                {day}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 3 }}>
            {days.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={{ width: "14.28%", height: 40 }} />;
              const date = toIso(new Date(Date.UTC(cursor.year, cursor.month, day)));
              const selected = date === value;
              const isToday = date === today;
              const outOfRange = (!!minDate && date < minDate) || (!!maxDate && date > maxDate);
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={formatIso(date)}
                  accessibilityState={{ selected, disabled: outOfRange }}
                  disabled={outOfRange}
                  onPress={() => { onChange(date); setOpen(false); }}
                  style={{
                    width: "14.28%",
                    minHeight: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    backgroundColor: selected ? colors.action : isToday ? colors.blueSoft : "transparent",
                    borderWidth: isToday && !selected ? 1 : 0,
                    borderColor: colors.blue,
                    opacity: outOfRange ? 0.3 : 1,
                  }}
                >
                  <Text style={{ color: selected ? colors.onAccent : colors.ink, fontSize: 12, fontWeight: selected || isToday ? "900" : "600" }}>{day}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: todayOutOfRange }}
              disabled={todayOutOfRange}
              onPress={() => { onChange(today); setCursor(fromIso(today).getUTCFullYear() === cursor.year && fromIso(today).getUTCMonth() === cursor.month ? cursor : { year: fromIso(today).getUTCFullYear(), month: fromIso(today).getUTCMonth() }); setOpen(false); }}
              style={{ minHeight: 34, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.blueSoft, flexDirection: "row", alignItems: "center", gap: 6, opacity: todayOutOfRange ? 0.45 : 1 }}
            >
              <RotateCcw size={13} color={colors.blue} />
              <Text style={{ color: colors.blue, fontSize: 11, fontWeight: "800" }}>اليوم</Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>{value ? formatIso(value) : "لم يتم اختيار تاريخ"}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
