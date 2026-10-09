import type { ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Menu } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { CompanyLogo } from "./CompanyLogo";
import { useSidebarAction } from "./AppSidebar";

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
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const sidebar = useSidebarAction();
  const logoWidth = compact ? 58 : 68;
  const logoHeight = compact ? 31 : 37;

  return (
    <View style={styles.header}>
      <View style={styles.actionSlot}>
        {sidebar?.visible ? (
          <HeaderAction label="فتح قائمة الأقسام" onPress={sidebar.toggle}>
            <Menu size={20} color="#FFFFFF" />
          </HeaderAction>
        ) : leftAction}
      </View>
      <View style={styles.brand}>
        <CompanyLogo width={logoWidth} height={logoHeight} framed />
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
      </View>
      <View style={styles.actionSlot}>{rightAction}</View>
    </View>
  );
}

const styles = {
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    backgroundColor: colors.navy,
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
  action: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF1A",
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
