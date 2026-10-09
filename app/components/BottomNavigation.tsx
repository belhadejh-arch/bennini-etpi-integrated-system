import { useRouter } from "expo-router";
import { Boxes, FileClock, LayoutDashboard, Wallet } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { hasPermission } from "../../shared/access";
import { sections, type SectionId } from "../../shared/sections";
import type { Member } from "../../lib/api";

const sectionIcons = {
  finance: Wallet,
  inventory: Boxes,
  field: FileClock,
} as const;

export function BottomNavigation({ member, activeId }: { member: Member; activeId: string }) {
  const router = useRouter();
  const tabs = (["finance", "inventory", "field"] as const)
    .filter((id) => hasPermission(member, id, "view"))
    .slice(0, 3);

  const navigate = (section: SectionId) => {
    if (section === "dashboard") {
      router.replace("/");
      return;
    }
    router.replace({ pathname: "/section/[section]", params: { section } });
  };

  return (
    <View style={styles.bar}>
      <Tab label="الرئيسية" selected={activeId === "dashboard"} icon={LayoutDashboard} onPress={() => navigate("dashboard")} />
      {tabs.map((id) => {
        const section = sections.find((entry) => entry.id === id)!;
        return (
          <Tab
            key={id}
            label={section.shortLabel}
            selected={activeId === id}
            icon={sectionIcons[id]}
            onPress={() => navigate(id)}
          />
        );
      })}
    </View>
  );
}

function Tab({
  label,
  selected,
  icon: Icon,
  onPress,
}: {
  label: string;
  selected: boolean;
  icon: typeof LayoutDashboard;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.78 }]}
    >
      <Icon size={19} color={selected ? colors.yellow : "#D7E1EF"} />
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  bar: {
    minHeight: 62,
    backgroundColor: colors.blue,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-around" as const,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
    minHeight: 55,
  },
  label: { color: colors.lightBlue, fontSize: 9, fontWeight: "600" as const },
  selectedLabel: { color: colors.yellow },
};
