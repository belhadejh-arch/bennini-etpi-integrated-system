import { useAuth, useUser } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  ChevronLeft,
  Clock3,
  FileClock,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShoppingCart,
  Wallet,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AppHeader, HeaderAction } from "./components/AppHeader";
import { CompanyLogo } from "./components/CompanyLogo";
import { apiRequest, type DashboardData, type Member } from "../lib/api";
import { colors, formatDzd } from "../lib/theme";
import { sections, type SectionId } from "../shared/sections";

type ApiError = Error & { status?: number; body?: { pending?: boolean; error?: string } };

const icons: Record<string, typeof Wallet> = {
  dashboard: LayoutDashboard,
  finance: Wallet,
  inventory: Boxes,
  cheques: ReceiptText,
  rentals: Building2,
  machinery: HardHat,
  field: FileClock,
  users: LayoutDashboard,
  audit: Clock3,
};

export default function HomeScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const { isLoaded: authLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [member, setMember] = useState<Member | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError("");
    try {
      const token = () => getToken();
      const me = await apiRequest<{ member: Member }>("/me", token);
      setMember(me.member);
      setPending(false);
      const data = await apiRequest<DashboardData>("/dashboard", token);
      setDashboard(data);
    } catch (caught) {
      const issue = caught as ApiError;
      if (issue.status === 403 && issue.body?.pending) {
        setPending(true);
        setMember((issue.body as { member?: Member }).member ?? null);
      } else {
        setError(issue.message || "تعذر تحميل لوحة القيادة.");
      }
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (authLoaded && isSignedIn) void refresh();
  }, [authLoaded, isSignedIn, refresh]);

  const isAdmin = member?.role === "admin";
  const permitted = useMemo(
    () => new Set(isAdmin ? sections.map((section) => section.id) : member?.allowed_sections ?? []),
    [isAdmin, member],
  );
  const goToSection = (section: SectionId) => {
    if (section === "dashboard") router.push("/");
    else if (section === "users") router.push("/members");
    else router.push({ pathname: "/section/[section]", params: { section } });
    setMenuOpen(false);
  };

  if (!authLoaded || (isSignedIn && loading && !member)) {
    return <Centered><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.muted}>جارٍ التحقق من الحساب...</Text></Centered>;
  }
  if (!isSignedIn) return <PublicWelcome />;
  const compact = viewportWidth < 560;

  if (pending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, direction: "rtl" }}>
        <AppHeader
          title="طلب الوصول"
          rightAction={
            <HeaderAction label="تسجيل الخروج" onPress={() => void signOut()}>
              <LogOut size={18} color="#D8E2EF" />
            </HeaderAction>
          }
        />
        <Centered>
          <View style={styles.pendingIcon}><Clock3 size={25} color={colors.amber} /></View>
          <Text style={[styles.title, { marginTop: 18 }]}>الحساب بانتظار التفعيل</Text>
          <Text style={[styles.muted, { textAlign: "center", lineHeight: 22, maxWidth: 330 }]}>
            تم تأكيد البريد {user?.primaryEmailAddress?.emailAddress ? `(${user.primaryEmailAddress.emailAddress})` : ""}. سيحدد المدير الأقسام المتاحة لحسابك.
          </Text>
          <Pressable onPress={() => void signOut()} style={styles.outlineButton}>
            <LogOut size={16} color={colors.blue} />
            <Text style={styles.outlineButtonText}>تسجيل الخروج</Text>
          </Pressable>
        </Centered>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: "rtl" }}>
      <AppHeader
        title="لوحة القيادة"
        leftAction={
          <HeaderAction
            label={menuOpen ? "إغلاق قائمة الأقسام" : "فتح قائمة الأقسام"}
            onPress={() => setMenuOpen((open) => !open)}
          >
            <Menu size={21} color="#FFFFFF" />
          </HeaderAction>
        }
        rightAction={
          <HeaderAction label="تسجيل الخروج" onPress={() => void signOut()}>
            <LogOut size={18} color="#D8E2EF" />
          </HeaderAction>
        }
      />
      {menuOpen ? (
        <View style={styles.menuPanel}>
          <View style={styles.menuTop}>
            <Text style={styles.menuTitle}>أقسام المنصة</Text>
            <Pressable onPress={() => setMenuOpen(false)} hitSlop={8}><X size={20} color={colors.muted} /></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {sections.filter((section) => section.id === "dashboard" || permitted.has(section.id)).map((section) => {
              const Icon = icons[section.id];
              return (
                <Pressable key={section.id} onPress={() => goToSection(section.id)} style={styles.menuItem}>
                  <Icon size={16} color={colors.blue} />
                  <Text style={styles.menuItemText}>{section.shortLabel}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {isAdmin ? (
            <Pressable onPress={() => { setMenuOpen(false); router.push("/members"); }} style={[styles.menuItem, { marginTop: 6, alignSelf: "flex-start" }]}>
              <LayoutDashboard size={16} color={colors.violet} />
              <Text style={[styles.menuItemText, { color: colors.violet }]}>إدارة الأعضاء والصلاحيات</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.welcome}>
          <View style={styles.welcomeCopy}>
            <Text style={styles.eyebrow}>BENNINI ETPI · النظام الموحد</Text>
            <Text style={styles.welcomeTitle}>مرحباً، {member?.name || user?.firstName || "عضو الفريق"}</Text>
            <Text style={styles.welcomeSubtitle}>ملخص مالي وتشغيلي واضح لمتابعة المؤسسة.</Text>
            <View style={styles.rolePill}><Text style={styles.rolePillText}>{roleLabel(member?.role)}</Text></View>
          </View>
          <View style={styles.welcomeMark}><CompanyLogo width={91} height={48} /></View>
        </View>

        {error ? <InlineError message={error} onRetry={() => void refresh()} /> : null}

        {loading && !dashboard ? (
          <Centered compact><ActivityIndicator size="large" color={colors.blue} /><Text style={styles.muted}>جارٍ تحميل المؤشرات...</Text></Centered>
        ) : dashboard ? (
          <>
            <SectionHeading title="المؤشرات الرئيسية" description="اضغط على بطاقة لفتح تفاصيل القسم." />
            <View style={styles.statsGrid}>
              {permitted.has("finance") ? (
                <>
                  <StatCard compact={compact} title="الرصيد الحالي" value={formatDzd(dashboard.stats.balance)} icon={Wallet} tone="blue" onPress={() => goToSection("finance")} />
                  <StatCard compact={compact} title="الأموال الداخلة" value={formatDzd(dashboard.stats.incoming)} icon={ArrowDownLeft} tone="green" onPress={() => goToSection("finance")} />
                  <StatCard compact={compact} title="الأموال الخارجة" value={formatDzd(dashboard.stats.outgoing)} icon={ArrowUpRight} tone="red" onPress={() => goToSection("finance")} />
                </>
              ) : null}
              {permitted.has("inventory") ? (
                <>
                  <StatCard compact={compact} title="إجمالي المشتريات" value={formatDzd(dashboard.stats.purchases)} icon={ShoppingCart} tone="amber" onPress={() => goToSection("inventory")} />
                  <StatCard compact={compact} title="قيمة المخزون" value={formatDzd(dashboard.stats.inventoryValue)} icon={Boxes} tone="blue" onPress={() => goToSection("inventory")} />
                </>
              ) : null}
              {permitted.has("cheques") ? (
                <>
                  <StatCard compact={compact} title="الشيكات قيد الانتظار" value={formatDzd(dashboard.stats.pendingCheques)} detail={`${dashboard.stats.pendingChequeCount} شيك`} icon={ReceiptText} tone="violet" onPress={() => goToSection("cheques")} />
                  <StatCard compact={compact} title="الشيكات المستحقة" value={formatDzd(dashboard.stats.dueCheques)} detail={`${dashboard.stats.dueChequeCount} شيك مستحق`} icon={Clock3} tone="amber" onPress={() => goToSection("cheques")} />
                </>
              ) : null}
              {permitted.has("rentals") ? (
                  <StatCard compact={compact} title="المبالغ المتبقية في الكراء" value={formatDzd(dashboard.stats.rentalRemaining)} icon={Building2} tone="blue" onPress={() => goToSection("rentals")} />
              ) : null}
            </View>

            {permitted.has("finance") ? (
              <View style={styles.panel}>
                <SectionHeading title="آخر العمليات" action="عرض الكل" onAction={() => goToSection("finance")} />
                {dashboard.recentOperations.length ? dashboard.recentOperations.map((item) => (
                  <View key={item.id} style={styles.activityRow}>
                    <View style={[styles.activityIcon, { backgroundColor: item.type === "income" ? colors.greenSoft : colors.redSoft }]}>
                      {item.type === "income" ? <ArrowDownLeft size={18} color={colors.green} /> : <ArrowUpRight size={18} color={colors.red} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{item.party}</Text>
                      <Text style={styles.activityDetail} numberOfLines={1}>{item.reason || "عملية مالية"} · {item.recorded_by}</Text>
                    </View>
                    <View style={{ alignItems: "flex-start" }}>
                      <Text style={[styles.activityAmount, { color: item.type === "income" ? colors.green : colors.red }]}>
                        {item.type === "income" ? "+" : "−"}{formatDzd(Number(item.amount))}
                      </Text>
                      <Text style={styles.activityDate}>{formatDate(item.date)}</Text>
                    </View>
                  </View>
                )) : <EmptyState message="لا توجد عمليات مالية مسجلة بعد." />}
              </View>
            ) : null}

            {permitted.has("field") ? (
              <View style={styles.panel}>
                <SectionHeading title="آخر مصاريف الميدان" action="فتح السجل" onAction={() => goToSection("field")} />
                {dashboard.fieldExpenses.length ? dashboard.fieldExpenses.map((item) => (
                  <View key={item.id} style={styles.activityRow}>
                    <View style={[styles.activityIcon, { backgroundColor: colors.amberSoft }]}><HardHat size={18} color={colors.amber} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{item.category}</Text>
                      <Text style={styles.activityDetail} numberOfLines={1}>
                        {item.site_name} · {item.created_by_name}
                        {item.fuel_liters ? ` · ${item.fuel_liters} لتر` : ""}
                        {item.review_status === "pending" ? " · بانتظار المراجعة" : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-start" }}>
                      <Text style={styles.activityAmount}>{formatDzd(Number(item.amount))}</Text>
                      <Text style={styles.activityDate}>{formatDate(item.created_at)}</Text>
                    </View>
                  </View>
                )) : <EmptyState message="لا توجد مصاريف ميدانية مسجلة بعد." />}
              </View>
            ) : null}
            <Text style={styles.footerNote}>يتم إظهار الأقسام حسب الصلاحيات التي يحددها المدير.</Text>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <BottomAction label="الرئيسية" icon={LayoutDashboard} selected onPress={() => router.replace("/")} />
        {(["finance", "inventory", "field"] as SectionId[]).filter((id) => permitted.has(id)).slice(0, 3).map((id) => {
          const section = sections.find((entry) => entry.id === id)!;
          const Icon = icons[id];
          return <BottomAction key={id} label={section.shortLabel} icon={Icon} onPress={() => goToSection(id)} />;
        })}
      </View>
    </View>
  );
}

function PublicWelcome() {
  const { width } = useWindowDimensions();
  const compact = width < 620;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 20 }}>
      <View style={{ width: "100%", maxWidth: 790, alignSelf: "center", borderRadius: 25, overflow: "hidden", backgroundColor: "#FFFFFF", flexDirection: compact ? "column" : "row", minHeight: compact ? undefined : 390, borderWidth: 1, borderColor: colors.border }}>
        <LinearGradient colors={[colors.navy, colors.blue, "#6232A7"]} style={{ flex: compact ? undefined : 1, minWidth: 0, minHeight: compact ? 210 : undefined, justifyContent: "space-between", padding: compact ? 22 : 26 }}>
          <View>
            <CompanyLogo width={142} height={78} framed />
            <Text style={{ color: "#E1E8F4", fontSize: 12, marginTop: 6 }}>منصة العمل الموحدة</Text>
          </View>
          <Text style={{ color: "#E1E8F4", fontSize: 13, lineHeight: 23, textAlign: "right" }}>
            متابعة مالية وتشغيلية واضحة، مع وصول آمن لكل عضو بحسب صلاحياته.
          </Text>
        </LinearGradient>
        <View style={{ flex: compact ? undefined : 1.12, minWidth: 0, justifyContent: "center", padding: compact ? 22 : 27 }}>
          <Text style={{ color: colors.navy, fontSize: 22, fontWeight: "900", textAlign: "right" }}>الدخول إلى المنصة</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 8, marginBottom: 23 }}>
            واجهة موحدة للإدارة والفريق الميداني. تظهر الأقسام المتاحة بعد اعتماد حسابك.
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable style={{ height: 51, borderRadius: 13, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>تسجيل الدخول</Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={{ height: 49, borderRadius: 13, backgroundColor: "#F0F4F9", alignItems: "center", justifyContent: "center", marginTop: 11 }}>
              <Text style={{ color: colors.blue, fontSize: 13, fontWeight: "800" }}>إنشاء حساب عضو</Text>
            </Pressable>
          </Link>
          <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 17, textAlign: "center", marginTop: 19 }}>
            الحسابات الجديدة تحتاج إلى تفعيل المدير وتحديد الصلاحيات قبل عرض بيانات المؤسسة.
          </Text>
        </View>
      </View>
    </View>
  );
}

function StatCard({
  title, value, detail, icon: Icon, tone, onPress, compact,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: typeof Wallet;
  tone: "blue" | "green" | "red" | "amber" | "violet";
  onPress: () => void;
  compact: boolean;
}) {
  const palette = {
    blue: { fg: colors.blue, bg: "#EAF1FB" },
    green: { fg: colors.green, bg: colors.greenSoft },
    red: { fg: colors.red, bg: colors.redSoft },
    amber: { fg: colors.amber, bg: colors.amberSoft },
    violet: { fg: colors.violet, bg: "#F2EDFF" },
  }[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statCard, { width: compact ? "100%" : "48.2%" }, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: palette.bg }]}><Icon size={19} color={palette.fg} /></View>
        <ChevronLeft size={16} color="#A6B2C1" />
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {detail ? <Text style={styles.statDetail}>{detail}</Text> : null}
      <View style={[styles.statAccent, { backgroundColor: palette.fg }]} />
    </Pressable>
  );
}

function SectionHeading({ title, description, action, onAction }: { title: string; description?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {action && onAction ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

function BottomAction({ label, icon: Icon, selected, onPress }: { label: string; icon: typeof Wallet; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.bottomAction}>
      <Icon size={19} color={selected ? colors.yellow : "#D7E1EF"} />
      <Text style={[styles.bottomLabel, selected && { color: colors.yellow }]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ message }: { message: string }) {
  return <View style={styles.emptyState}><Text style={styles.emptyText}>{message}</Text></View>;
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={{ color: colors.red, textAlign: "right", flex: 1, lineHeight: 20 }}>{message}</Text>
      <Pressable onPress={onRetry}><Text style={{ color: colors.blue, fontWeight: "700" }}>إعادة المحاولة</Text></Pressable>
    </View>
  );
}

function Centered({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return <View style={{ minHeight: compact ? 150 : "100%", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, direction: "rtl" }}>{children}</View>;
}

function roleLabel(role?: string) {
  return ({ admin: "مدير النظام", finance: "الإدارة المالية", field: "رئيس أشغال", supervisor: "مشرف", viewer: "عضو" } as Record<string, string>)[role ?? ""] ?? "عضو";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ar-DZ", { day: "numeric", month: "short" }).format(date);
}

const styles = {
  page: { width: "100%" as const, maxWidth: 1000, alignSelf: "center" as const, padding: 18, paddingBottom: 30, gap: 18 },
  welcome: { minHeight: 142, borderRadius: 19, padding: 20, backgroundColor: colors.blue, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, overflow: "hidden" as const },
  welcomeCopy: { flex: 1, alignItems: "flex-start" as const },
  eyebrow: { color: colors.yellow, fontSize: 10, fontWeight: "800" as const, letterSpacing: 0.3 },
  welcomeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "800" as const, marginTop: 11, textAlign: "right" as const },
  welcomeSubtitle: { color: "#D8E4F2", fontSize: 12, marginTop: 5, textAlign: "right" as const },
  rolePill: { marginTop: 11, borderRadius: 20, backgroundColor: "#FFFFFF20", paddingHorizontal: 11, paddingVertical: 5 },
  rolePillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" as const },
  welcomeMark: { borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center" as const, justifyContent: "center" as const, padding: 7, marginLeft: 14 },
  statsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 11 },
  statCard: { minHeight: 145, borderRadius: 16, backgroundColor: "#FFFFFF", padding: 13, borderWidth: 1, borderColor: colors.border, overflow: "hidden" as const },
  statTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const },
  statTitle: { color: colors.muted, fontSize: 11, fontWeight: "600" as const, textAlign: "right" as const, marginTop: 12 },
  statValue: { color: colors.navy, fontSize: 16, fontWeight: "900" as const, textAlign: "right" as const, marginTop: 4 },
  statDetail: { color: colors.muted, fontSize: 10, textAlign: "right" as const, marginTop: 3 },
  statAccent: { position: "absolute" as const, right: 0, top: 0, bottom: 0, width: 3, opacity: 0.75 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, paddingVertical: 14 },
  sectionHeading: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10, marginBottom: 9 },
  sectionTitle: { color: colors.navy, fontSize: 15, fontWeight: "800" as const, textAlign: "right" as const },
  sectionDescription: { color: colors.muted, fontSize: 11, textAlign: "right" as const, marginTop: 4 },
  sectionAction: { color: colors.blue, fontSize: 12, fontWeight: "700" as const },
  activityRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#EEF1F5" },
  activityIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center" as const, justifyContent: "center" as const },
  activityTitle: { color: colors.ink, fontSize: 12, fontWeight: "700" as const, textAlign: "right" as const },
  activityDetail: { color: colors.muted, fontSize: 10, textAlign: "right" as const, marginTop: 3 },
  activityAmount: { color: colors.navy, fontSize: 11, fontWeight: "800" as const },
  activityDate: { color: colors.muted, fontSize: 10, marginTop: 4 },
  emptyState: { borderTopWidth: 1, borderTopColor: "#EEF1F5", paddingVertical: 18, alignItems: "center" as const },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: "center" as const },
  footerNote: { color: colors.muted, textAlign: "center" as const, fontSize: 10 },
  bottomBar: { minHeight: 62, backgroundColor: colors.navy, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-around" as const, paddingHorizontal: 8, paddingBottom: 4 },
  bottomAction: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: 4, minHeight: 55 },
  bottomLabel: { color: "#D7E1EF", fontSize: 9, fontWeight: "600" as const },
  menuPanel: { backgroundColor: "#FFFFFF", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: 10 },
  menuTitle: { color: colors.navy, fontWeight: "800" as const },
  menuItem: { backgroundColor: colors.background, borderRadius: 11, minHeight: 40, paddingHorizontal: 12, flexDirection: "row" as const, alignItems: "center" as const, gap: 7 },
  menuItemText: { color: colors.ink, fontSize: 11, fontWeight: "700" as const },
  pendingIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.amberSoft },
  title: { color: colors.navy, fontWeight: "800" as const, fontSize: 20, textAlign: "center" as const },
  muted: { color: colors.muted, fontSize: 13, textAlign: "center" as const },
  outlineButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 18, minHeight: 44, flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginTop: 12 },
  outlineButtonText: { color: colors.blue, fontWeight: "700" as const },
  errorBox: { borderRadius: 12, backgroundColor: colors.redSoft, padding: 13, gap: 10, flexDirection: "row" as const, alignItems: "center" as const },
};
