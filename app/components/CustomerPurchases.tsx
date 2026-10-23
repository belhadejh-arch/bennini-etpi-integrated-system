import { Pressable, Text, View } from "react-native";
import { colors, formatDate, formatExactDzd as formatDzd } from "../../lib/theme";

export type CustomerPurchase = {
  id: number; name: string; supplier: string; invoice_number: string; purchase_date: string;
  total_cost: number | string; total_sale: number | string | null; profit: number | string | null;
  notes: string; paid: boolean; paid_by_cheque: boolean;
};

export default function CustomerPurchases({ purchases, canEdit, saving, onPayment }: {
  purchases: CustomerPurchase[]; canEdit: boolean; saving: boolean;
  onPayment: (purchase: CustomerPurchase) => void;
}) {
  return <View style={{ gap: 12 }}>
    <Text style={{ color: colors.navy, fontWeight: "800", fontSize: 15, textAlign: "right" }}>عمليات شراء الزبون</Text>
    {!purchases.length ? <Text style={{ color: colors.muted, textAlign: "right" }}>لا توجد مشتريات مرتبطة بهذا الزبون.</Text> : null}
    {purchases.map((purchase) => <View testID={`customer-purchase-${purchase.id}`} key={purchase.id}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.surface, gap: 9 }}>
      <Text style={{ color: colors.ink, fontWeight: "800", textAlign: "right" }}>{purchase.name}</Text>
      <Text style={{ color: colors.muted, textAlign: "right" }}>المورد: {purchase.supplier} · فاتورة: {purchase.invoice_number} · {formatDate(purchase.purchase_date)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          ["إجمالي الشراء", formatDzd(Number(purchase.total_cost))],
          ["إجمالي البيع", purchase.total_sale == null ? "غير محدد (سجل قديم)" : formatDzd(Number(purchase.total_sale))],
          ["الفائدة", purchase.profit == null ? "غير محددة" : formatDzd(Number(purchase.profit))],
        ].map(([label, value]) => <View key={label} style={{ flexGrow: 1, flexBasis: 135, borderRadius: 9, padding: 9, backgroundColor: label === "الفائدة" ? colors.greenSoft : colors.background }}>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "right" }}>{label}</Text>
          <Text style={{ color: label === "الفائدة" ? colors.green : colors.ink, fontWeight: "800", textAlign: "right" }}>{value}</Text>
        </View>)}
      </View>
      <Text style={{ color: purchase.paid ? colors.green : colors.red, textAlign: "right", fontWeight: "700" }}>حالة الدفع: {purchase.paid ? "مدفوعة" : "غير مدفوعة"}{purchase.paid_by_cheque ? " — بشيك" : ""}</Text>
      <Text style={{ color: colors.ink, textAlign: "right" }}>ملاحظات: {purchase.notes || "—"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {canEdit && !purchase.paid_by_cheque ? <Pressable disabled={saving} accessibilityRole="button"
          accessibilityLabel={`${purchase.paid ? "جعل الشراء غير مدفوع" : "تسجيل تسديد الشراء"} ${purchase.id}`}
          onPress={() => onPayment(purchase)}
          style={{ minHeight: 42, paddingHorizontal: 12, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: colors.blue, opacity: saving ? 0.5 : 1 }}>
          <Text style={{ color: colors.blue, fontWeight: "700" }}>{purchase.paid ? "تغيير إلى غير مدفوعة" : "تسجيل التسديد — مدفوعة"}</Text>
        </Pressable> : null}
      </View>
    </View>)}
  </View>;
}
