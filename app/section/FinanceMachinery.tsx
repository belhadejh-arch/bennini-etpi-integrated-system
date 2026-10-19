import { useAuth } from "../../lib/auth";
import { useRouter } from "expo-router";
import { ArrowRight, RefreshCw, Wrench } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { AppHeader, HeaderAction } from "../components/AppHeader";
import { apiRequest, type Member } from "../../lib/api";
import { colors, formatDzd } from "../../lib/theme";
import { hasPermission } from "../../shared/access";

type MachineryFinance = { id: number; code: string; name: string; repair_count: number; total_expenses: number | string; driver_name: string | null; driver_monthly_salary: number | string | null };
export default function FinanceMachinery({ member, onNavigate }: { member: Member | null; onNavigate: (area: string) => void }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MachineryFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await apiRequest<{ items: MachineryFinance[] }>("/finance/machinery", getToken);
      setItems(result.items);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل ملخص الآليات."); }
    finally { setLoading(false); }
  }, [getToken]);
  useEffect(() => { void refresh(); }, [refresh]);
  const canOpenMachinery = hasPermission(member, "machinery", "view");
  const expenses = items.reduce((sum, item) => sum + (Number(item.total_expenses) || 0), 0);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: "rtl" }}>
      <AppHeader title="الآليات · ملخص مالي" leftAction={<HeaderAction label="رجوع" onPress={() => router.back()}><ArrowRight size={19} color="#FFFFFF" /></HeaderAction>} rightAction={<HeaderAction label="تحديث" onPress={() => void refresh()}><RefreshCw size={17} color="#FFFFFF" /></HeaderAction>} />
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 1120, alignSelf: "center", padding: 18, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          <Nav label="العمليات الأخرى" onPress={() => onNavigate("transactions")} />
          <Nav label="الزبائن" onPress={() => onNavigate("customers")} />
          <Nav label="الشركاء" onPress={() => onNavigate("partners")} />
          <Nav label="الآليات" active onPress={() => onNavigate("machinery")} />
        </View>
        <View style={{ backgroundColor: colors.navy, borderRadius: 16, padding: 19, gap: 8 }}>
          <Text style={{ color: colors.yellow, fontSize: 11, fontWeight: "900", textAlign: "right" }}>لا إدخال مكرر</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", textAlign: "right" }}>تكاليف الأسطول المسجلة</Text>
          <Text style={{ color: "#D8E4F2", fontSize: 11, textAlign: "right", lineHeight: 18 }}>هذه قراءة مجمعة من سجل الآليات الحقيقي؛ تُدار المصروفات والإصلاحات في صفحتها الأصلية.</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
          <Metric label="عدد الآليات" value={String(items.length)} />
          <Metric label="إجمالي مصروفات الإصلاح" value={formatDzd(expenses)} />
          <Metric label="الآليات المسجلة لها إصلاحات" value={String(items.filter((item) => Number(item.repair_count) > 0).length)} />
        </View>
        {error ? <View style={{ backgroundColor: colors.redSoft, borderRadius: 10, padding: 12, gap: 8 }}><Text style={{ color: colors.red, textAlign: "right" }}>{error}</Text><Pressable onPress={() => void refresh()}><Text style={{ color: colors.blue, textAlign: "right", fontWeight: "800" }}>إعادة المحاولة</Text></Pressable></View> : null}
        {loading && !items.length ? <View style={card}><ActivityIndicator color={colors.blue} /></View> : items.length ? items.map((item) => (
          <View key={item.id} style={card}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={title}>{item.name}</Text>
                <Text style={muted}>{item.code || `رقم ${item.id}`}</Text>
              </View>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#EAF1FA", alignItems: "center", justifyContent: "center" }}><Wrench size={18} color={colors.blue} /></View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Mini label="عمليات الإصلاح" value={String(item.repair_count)} />
              <Mini label="تكاليف الإصلاح" value={formatDzd(Number(item.total_expenses))} />
              <Mini label="السائق" value={item.driver_name || "غير محدد"} />
              <Mini label="الراتب الشهري" value={item.driver_monthly_salary == null ? "غير مسجل" : formatDzd(Number(item.driver_monthly_salary))} />
            </View>
            {canOpenMachinery ? <Pressable onPress={() => router.push("/section/machinery")} style={{ alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#EEF3FB" }}><Text style={{ color: colors.blue, fontSize: 10, fontWeight: "800" }}>فتح سجل الآليات</Text></Pressable> : null}
          </View>
        )) : !error ? <View style={card}><Text style={title}>لا توجد آليات مسجلة</Text><Text style={muted}>تظهر هنا الآليات المسجلة في القسم الأصلي فقط.</Text></View> : null}
      </ScrollView>
    </View>
  );
}
function Nav({ label, active = false, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: active ? colors.navy : "#FFFFFF", borderWidth: 1, borderColor: active ? colors.navy : colors.border }}><Text style={{ color: active ? "#FFFFFF" : colors.blue, fontWeight: "800", fontSize: 11 }}>{label}</Text></Pressable>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ flexGrow: 1, flexBasis: 160, padding: 14, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, gap: 7 }}><Text style={muted}>{label}</Text><Text style={title}>{value}</Text></View>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <View style={{ flexGrow: 1, flexBasis: 140, padding: 10, borderRadius: 9, backgroundColor: "#F4F7FB", gap: 5 }}><Text style={muted}>{label}</Text><Text style={{ color: colors.navy, fontSize: 12, fontWeight: "800", textAlign: "right" }}>{value}</Text></View>;
}
const card = { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 12 } as const;
const title = { color: colors.navy, fontSize: 14, fontWeight: "900" as const, textAlign: "right" as const };
const muted = { color: colors.muted, fontSize: 10, textAlign: "right" as const, lineHeight: 16 };
