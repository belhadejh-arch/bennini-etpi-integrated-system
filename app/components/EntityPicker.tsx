import { useAuth } from "../../lib/auth";
import { Plus, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { apiRequest } from "../../lib/api";
import { colors } from "../../lib/theme";

export type FinanceEntity = { id: number; name: string; phone?: string | null; invoice_total?: number | string };

export default function EntityPicker({
  kind, value, onChange, label, disabled = false, onAdd, showInitialResults = false,
}: {
  kind: "customer" | "partner";
  value: FinanceEntity | null;
  onChange: (entity: FinanceEntity | null) => void;
  label: string;
  disabled?: boolean;
  onAdd?: () => void;
  showInitialResults?: boolean;
}) {
  const { getToken, language } = useAuth();
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<FinanceEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setQuery(value?.name ?? ""); }, [value?.id, value?.name]);
  useEffect(() => {
    if (disabled || value || (!showInitialResults && !query.trim())) { setResults([]); return; }
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      apiRequest<{ items: FinanceEntity[] }>(`/finance/accounts?kind=${kind}&q=${encodeURIComponent(query.trim())}`, getToken)
        .then((result) => { if (current) setResults(result.items); })
        .catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : "تعذر تحميل القائمة."); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [disabled, getToken, kind, query, value, showInitialResults]);

  return (
    <View style={{ gap: 6, position: "relative" }}>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600", lineHeight: 23, textAlign: language === "ar" ? "right" : "left" }}>{label}</Text>
      <View style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 }}>
        {loading ? <ActivityIndicator size="small" color={colors.blue} /> : <Search size={15} color={colors.muted} />}
        <TextInput
          value={query} editable={!disabled && !value}
          onChangeText={(text) => { setQuery(text); if (value) onChange(null); }}
          placeholder="ابحث بالاسم أو رقم الهاتف"
          placeholderTextColor={colors.placeholder}
          style={{ flex: 1, textAlign: language === "ar" ? "right" : "left", color: colors.ink, fontSize: 14, lineHeight: 23 }}
          accessibilityLabel={label}
        />
        {value && !disabled ? <Pressable accessibilityRole="button" accessibilityLabel="إزالة الاختيار" onPress={() => { onChange(null); setQuery(""); }}><X size={15} color={colors.muted} /></Pressable> : null}
      </View>
      {error ? <Text style={{ color: colors.red, fontSize: 14, fontWeight: "600", lineHeight: 23, textAlign: language === "ar" ? "right" : "left" }}>{error}</Text> : null}
      {results.length ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, overflow: "hidden" }}>
          {results.slice(0, 8).map((entity) => (
            <Pressable key={entity.id} onPress={() => { onChange(entity); setQuery(entity.name); setResults([]); }} style={{ padding: 11, borderBottomWidth: 1, borderBottomColor: "#EDF0F4" }}>
              <Text style={{ color: colors.navy, textAlign: language === "ar" ? "right" : "left", fontSize: 14, fontWeight: "600", lineHeight: 23 }}>{entity.name}</Text>
              {entity.phone ? <Text style={{ color: colors.muted, textAlign: language === "ar" ? "right" : "left", fontSize: 14, fontWeight: "500", lineHeight: 22, marginTop: 3 }}>{entity.phone}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {onAdd && !disabled ? <Pressable accessibilityRole="button" onPress={onAdd} style={{ flexDirection: "row", gap: 6, minHeight: 38, alignItems: "center" }}>
        <Plus size={15} color={colors.blue} /><Text style={{ color: colors.blue, fontWeight: "700", fontSize: 13 }}>إضافة زبون جديد</Text>
      </Pressable> : null}
    </View>
  );
}
