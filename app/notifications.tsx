import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Check,
  ClipboardCheck,
  FileClock,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppHeader, HeaderAction } from "./components/AppHeader";
import { useNotificationBadge } from "./components/NotificationContext";
import { apiRequest, type AppNotification, type NotificationsResult } from "../lib/api";
import { colors } from "../lib/theme";

const icons = {
  cheque_due: ReceiptText,
  rental_ending: Building2,
  new_expense: Wallet,
  field_operation: FileClock,
  field_review: ClipboardCheck,
  low_inventory: PackageOpen,
  low_spare_part: AlertTriangle,
} as const;

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("ar-DZ", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { refresh: refreshBadge } = useNotificationBadge();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<NotificationsResult>("/notifications", () => getToken());
      setItems(result.items);
      setUnreadCount(result.unreadCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل الإشعارات.");
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/(auth)/sign-in");
    else if (isSignedIn) void refresh();
  }, [isLoaded, isSignedIn, refresh, router]);

  const unreadItems = useMemo(() => items.filter((item) => !item.read), [items]);
  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter((item) =>
      (readFilter === "all" || (readFilter === "unread" ? !item.read : item.read)) &&
      (!term || `${item.title} ${item.message} ${item.type} ${item.section}`.toLocaleLowerCase().includes(term)),
    );
  }, [items, readFilter, search]);

  const markRead = async (notificationIds: string[]) => {
    if (!notificationIds.length) return;
    await apiRequest("/notifications/read", () => getToken(), {
      method: "POST",
      body: JSON.stringify({ notificationIds }),
    });
    const readSet = new Set(notificationIds);
    setItems((current) => current.map((item) => readSet.has(item.id) ? { ...item, read: true } : item));
    setUnreadCount((count) => Math.max(0, count - notificationIds.filter((id) => items.some((item) => item.id === id && !item.read)).length));
    void refreshBadge();
  };

  const openNotification = async (item: AppNotification) => {
    setError("");
    try {
      if (!item.read) await markRead([item.id]);
    } catch {
      setError("تعذر حفظ حالة القراءة، وسيتم فتح السجل على أي حال.");
    }
    router.push({
      pathname: "/section/[section]",
      params: {
        section: item.section,
        focusId: String(item.recordId),
        ...(item.view ? { view: item.view } : {}),
      },
    });
  };

  const markAllRead = async () => {
    const ids = unreadItems.map((item) => item.id);
    if (!ids.length) return;
    setSaving(true);
    setError("");
    try {
      await markRead(ids);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحديث الإشعارات.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title="الإشعارات"
        leftAction={
          <HeaderAction label="رجوع" onPress={() => router.back()}>
            <ArrowRight size={19} color="#FFFFFF" />
          </HeaderAction>
        }
        rightAction={
          <HeaderAction label="تحديث الإشعارات" onPress={() => void refresh()}>
            <RefreshCw size={17} color="#FFFFFF" />
          </HeaderAction>
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.headingRow}>
          <View style={styles.headingIcon}><Bell size={21} color={colors.blue} /></View>
          <View style={styles.headingCopy}>
            <Text style={styles.heading}>مركز الإشعارات</Text>
            <Text style={styles.subheading}>
              {unreadCount ? `${unreadCount} إشعار غير مقروء` : "كل الإشعارات مقروءة"}
            </Text>
          </View>
          {unreadItems.length ? (
            <Pressable onPress={() => void markAllRead()} disabled={saving} style={styles.readAllButton}>
              {saving ? <ActivityIndicator size="small" color={colors.blue} /> : <Check size={15} color={colors.blue} />}
              <Text style={styles.readAllText}>قراءة الكل</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 10, gap: 9 }}>
          <View style={{ minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}>
            <Search size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, color: colors.ink, textAlign: "right", writingDirection: "rtl", fontSize: 12 }}
              placeholder="ابحث في عنوان الإشعار أو تفاصيله"
              placeholderTextColor={colors.muted}
              accessibilityLabel="البحث في الإشعارات"
            />
            {search ? <Pressable onPress={() => setSearch("")} accessibilityLabel="مسح البحث"><X size={16} color={colors.muted} /></Pressable> : null}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {[
              { value: "all" as const, label: "الكل" },
              { value: "unread" as const, label: "غير مقروء" },
              { value: "read" as const, label: "مقروء" },
            ].map((option) => (
              <Pressable key={option.value} onPress={() => setReadFilter(option.value)}
                style={{ minHeight: 32, justifyContent: "center", paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: readFilter === option.value ? colors.blue : colors.border, backgroundColor: readFilter === option.value ? "#E7F0FB" : "#FFFFFF" }}>
                <Text style={{ color: readFilter === option.value ? colors.blue : colors.muted, fontSize: 10, fontWeight: "800" }}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.stateText}>جارٍ تحميل الإشعارات...</Text>
          </View>
        ) : visibleItems.length ? (
          <View style={styles.list}>
            {visibleItems.map((item) => {
              const Icon = icons[item.type];
              const urgent = item.type === "cheque_due" || item.type === "rental_ending" || item.type === "field_review";
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.message}. فتح السجل المرتبط`}
                  onPress={() => void openNotification(item)}
                  style={({ pressed }) => [
                    styles.card,
                    !item.read && styles.unreadCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.iconBox, urgent && styles.urgentIconBox]}>
                    <Icon size={19} color={urgent ? colors.amber : colors.blue} />
                  </View>
                  <View style={styles.cardCopy}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      {!item.read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.message}>{item.message}</Text>
                    <Text style={styles.date}>{timeLabel(item.createdAt)}</Text>
                  </View>
                  <ArrowRight size={16} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}><Bell size={24} color={colors.muted} /></View>
            <Text style={styles.emptyTitle}>{items.length ? "لا توجد إشعارات مطابقة" : "لا توجد إشعارات حالياً"}</Text>
            <Text style={styles.stateText}>{items.length ? "غيّر عبارة البحث أو حالة القراءة." : "ستظهر هنا تنبيهات الاستحقاق والمراجعة والعمليات والمخزون."}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = {
  screen: { flex: 1 as const, backgroundColor: colors.background, direction: "rtl" as const },
  page: { width: "100%" as const, maxWidth: 1040, alignSelf: "center" as const, padding: 20, gap: 16 },
  headingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 11, marginBottom: 2 },
  headingIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EAF2FC", alignItems: "center" as const, justifyContent: "center" as const },
  headingCopy: { flex: 1, minWidth: 0 },
  heading: { color: colors.navy, fontSize: 19, fontWeight: "900" as const, textAlign: "right" as const },
  subheading: { color: colors.muted, fontSize: 11, textAlign: "right" as const, marginTop: 4 },
  readAllButton: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, minHeight: 36, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "#C8D9EE", backgroundColor: "#FFFFFF" },
  readAllText: { color: colors.blue, fontSize: 10, fontWeight: "800" as const },
  list: { gap: 9 },
  card: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, padding: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  unreadCard: { borderColor: "#A9C8EC", backgroundColor: "#F6FAFF" },
  pressed: { opacity: 0.78 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EAF2FC", alignItems: "center" as const, justifyContent: "center" as const },
  urgentIconBox: { backgroundColor: "#FFF3D7" },
  cardCopy: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7 },
  cardTitle: { flex: 1, color: colors.navy, fontSize: 12, fontWeight: "900" as const, textAlign: "right" as const },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.blue },
  message: { color: colors.ink, fontSize: 10, lineHeight: 16, textAlign: "right" as const },
  date: { color: colors.muted, fontSize: 9, textAlign: "right" as const, marginTop: 2 },
  stateCard: { minHeight: 210, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, padding: 24, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#F1F4F8", alignItems: "center" as const, justifyContent: "center" as const },
  emptyTitle: { color: colors.navy, fontSize: 14, fontWeight: "900" as const },
  stateText: { color: colors.muted, fontSize: 11, textAlign: "center" as const, lineHeight: 18 },
  error: { padding: 12, borderRadius: 10, backgroundColor: "#FDEBEC", color: colors.red, textAlign: "right" as const, fontSize: 11 },
};
