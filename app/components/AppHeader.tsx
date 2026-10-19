import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Bell, Menu } from "lucide-react-native";
import { colors, makeStylesReactive } from "../../lib/theme";
import { CompanyLogo } from "./CompanyLogo";
import { useSidebarAction } from "./AppSidebar";
import { useNotificationBadge } from "./NotificationContext";
import { useAuth } from "../../lib/auth";
import { translate } from "../../lib/localization";

type AppHeaderProps = {
  title: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
};

export function HeaderAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        pressed && { opacity: 0.72 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function AppHeader({ title, leftAction, rightAction }: AppHeaderProps) {
  const { language, isDark } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const sidebar = useSidebarAction();
  const router = useRouter();
  const { unreadCount } = useNotificationBadge();
  const logoWidth = compact ? 58 : 68;
  const logoHeight = compact ? 31 : 37;

  return (
    <View style={[styles.header, { backgroundColor: colors.action, direction: language === "ar" ? "rtl" : "ltr" }]}>
      <View style={styles.actionSlot}>
        {sidebar?.visible ? (
          <HeaderAction label={translate("فتح قائمة الأقسام", language)} onPress={sidebar.toggle}>
            <Menu size={20} color={colors.lightBeige} />
          </HeaderAction>
        ) : leftAction}
      </View>
      <View style={styles.brand}>
        <CompanyLogo width={logoWidth} height={logoHeight} framed />
        <Text style={[styles.title, { textAlign: language === "ar" ? "right" : "left" }]}>{title}</Text>
      </View>
      <View style={[styles.actionSlot, styles.rightActions]}>
        {rightAction}
        <View style={styles.notificationWrap}>
          <HeaderAction label={`${language === "ar" ? "الإشعارات" : "Notifications"}${unreadCount ? `, ${unreadCount}` : ""}`} onPress={() => router.push("/notifications")}>
            <Bell size={19} color={colors.lightBeige} />
          </HeaderAction>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={[styles.badgeText, { color: isDark ? colors.onAccent : colors.white }]}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = {
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    backgroundColor: colors.action,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FFFFFF18",
  },
  actionSlot: {
    minWidth: 38,
    minHeight: 38,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  rightActions: {
    flexDirection: "row" as const,
    gap: 6,
    minWidth: 84,
  },
  notificationWrap: { position: "relative" as const },
  badge: {
    position: "absolute" as const,
    top: -7,
    right: -7,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: colors.red,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: colors.blue,
  },
  badgeText: { color: "#FFFFFF", fontSize: 14, lineHeight: 22, fontWeight: "900" as const, textAlign: "center" as const },
  action: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF1F",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  title: {
    flex: 1,
    color: "#FFFFFF",
    fontWeight: "700" as const,
    fontSize: 14,
    textAlign: "right" as const,
    letterSpacing: 0.1,
  },
};
makeStylesReactive(styles);
