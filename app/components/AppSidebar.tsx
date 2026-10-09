import { createContext, useContext } from "react";
import {
  Boxes,
  Building2,
  FileClock,
  HardHat,
  History,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Wallet,
  Wrench,
  X,
  Users,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import type { Member } from "../../lib/api";
import { hasPermission } from "../../shared/access";
import type { SectionId } from "../../shared/sections";
import { CompanyLogo } from "./CompanyLogo";

type SidebarAction = { toggle: () => void; visible: boolean };
const SidebarContext = createContext<SidebarAction | null>(null);

export const SidebarProvider = SidebarContext.Provider;

export function useSidebarAction() {
  return useContext(SidebarContext);
}

export type SidebarEntry = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  section?: SectionId;
  view?: string;
  adminOnly?: boolean;
};

export const sidebarEntries: SidebarEntry[] = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard, section: "dashboard" },
  { id: "finance", label: "التسيير المالي", icon: Wallet, section: "finance" },
  { id: "purchases", label: "المشتريات", icon: ShoppingCart, section: "inventory", view: "purchases" },
  { id: "inventory", label: "المخزون", icon: Boxes, section: "inventory", view: "stock" },
  { id: "cheques", label: "الشيكات", icon: ReceiptText, section: "cheques" },
  { id: "rentals", label: "الكراء", icon: Building2, section: "rentals" },
  { id: "machinery", label: "المركبات والآليات", icon: Truck, section: "machinery", view: "vehicles" },
  { id: "spare-parts", label: "قطع الغيار", icon: Wrench, section: "machinery", view: "spare-parts" },
  { id: "field", label: "تطبيق / عمليات رئيس الأشغال", icon: HardHat, section: "field" },
  { id: "users", label: "المستخدمون والصلاحيات", icon: Users, section: "users", adminOnly: true },
  { id: "audit", label: "سجل العمليات", icon: History, section: "audit", adminOnly: true },
  { id: "settings", label: "الإعدادات", icon: Settings, adminOnly: true },
];

export function AppSidebar({
  member,
  activeId,
  onNavigate,
  onClose,
  drawer = false,
}: {
  member: Member;
  activeId: string;
  onNavigate: (entry: SidebarEntry) => void;
  onClose?: () => void;
  drawer?: boolean;
}) {
  const isAdmin = member.role === "admin";
  const entries = sidebarEntries.filter((entry) =>
    entry.adminOnly ? isAdmin : entry.section ? hasPermission(member, entry.section, "view") : false,
  );

  return (
    <View style={[styles.sidebar, drawer && styles.drawer]}>
      <View style={styles.brand}>
        <CompanyLogo width={104} height={56} framed />
        <View style={styles.brandCopy}>
          <Text style={styles.brandTitle}>BENNINI ETPI</Text>
          <Text style={styles.brandSubtitle}>منصة العمل الموحدة</Text>
        </View>
        {drawer ? (
          <Pressable accessibilityRole="button" accessibilityLabel="إغلاق القائمة" onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <X size={19} color="#DCE6F3" />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.navCaption}>القائمة الرئيسية</Text>
      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navList} showsVerticalScrollIndicator={false}>
        {entries.map((entry) => {
          const Icon = entry.icon;
          const selected = entry.id === activeId;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onNavigate(entry)}
              style={({ pressed }) => [
                styles.navItem,
                selected && styles.navItemSelected,
                pressed && styles.navItemPressed,
              ]}
            >
              {selected ? <View style={styles.activeMark} /> : null}
              <Icon size={18} color={selected ? colors.yellow : "#B8C7DA"} />
              <Text style={[styles.navLabel, selected && styles.navLabelSelected]} numberOfLines={1}>
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.account}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{member.name?.trim().charAt(0) || "م"}</Text></View>
        <View style={styles.accountCopy}>
          <Text numberOfLines={1} style={styles.accountName}>{member.name || "عضو الفريق"}</Text>
          <Text numberOfLines={1} style={styles.accountRole}>{member.role_name || roleLabel(member.role)}</Text>
        </View>
      </View>
    </View>
  );
}

export function SidebarBackdrop({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="إغلاق القائمة" onPress={onPress} style={styles.backdrop} />;
}

const styles = {
  sidebar: {
    width: 256,
    height: "100%" as const,
    backgroundColor: colors.navy,
    borderLeftWidth: 1,
    borderLeftColor: "#FFFFFF12",
    paddingHorizontal: 14,
    paddingTop: 17,
    paddingBottom: 12,
    direction: "rtl" as const,
  },
  drawer: {
    position: "absolute" as const,
    zIndex: 20,
    top: 0,
    right: 0,
    bottom: 0,
    width: 292,
    maxWidth: "86%" as const,
    height: "100%" as const,
    elevation: 16,
  },
  brand: {
    minHeight: 77,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FFFFFF1A",
    paddingHorizontal: 2,
    paddingBottom: 12,
  },
  brandCopy: { flex: 1, minWidth: 0 },
  brandTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" as const, textAlign: "right" as const },
  brandSubtitle: { color: "#A8B9D0", fontSize: 10, marginTop: 4, textAlign: "right" as const },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 10,
    backgroundColor: "#FFFFFF14",
  },
  navCaption: { color: "#8FA4BE", fontSize: 10, fontWeight: "700" as const, marginTop: 18, marginBottom: 9, paddingHorizontal: 10, textAlign: "right" as const },
  navScroll: { flex: 1, minHeight: 0 },
  navList: { gap: 4, paddingBottom: 14 },
  navItem: {
    minHeight: 43,
    position: "relative" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 11,
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  navItemSelected: { backgroundColor: "#FFFFFF16" },
  navItemPressed: { opacity: 0.76 },
  activeMark: { position: "absolute" as const, right: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, backgroundColor: colors.yellow },
  navLabel: { flex: 1, color: "#D0DBE9", fontSize: 12, fontWeight: "600" as const, textAlign: "right" as const },
  navLabelSelected: { color: "#FFFFFF", fontWeight: "800" as const },
  account: {
    minHeight: 60,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF1A",
    paddingTop: 11,
    paddingHorizontal: 3,
  },
  avatar: { width: 35, height: 35, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#FFFFFF1A" },
  avatarText: { color: colors.yellow, fontSize: 15, fontWeight: "800" as const },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" as const, textAlign: "right" as const },
  accountRole: { color: "#A8B9D0", fontSize: 10, marginTop: 4, textAlign: "right" as const },
  backdrop: { position: "absolute" as const, zIndex: 19, top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#07152F80" },
};

function roleLabel(role: string) {
  return ({ admin: "مدير النظام", finance: "الإدارة المالية", field: "رئيس أشغال", supervisor: "مشرف", viewer: "عضو" } as Record<string, string>)[role] ?? "عضو";
}
