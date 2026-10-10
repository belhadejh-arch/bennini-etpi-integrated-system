import { useAuth, useUser } from "../../lib/auth";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { colors } from "../../lib/theme";
import { AppSidebar, SidebarBackdrop, SidebarProvider, type SidebarEntry } from "./AppSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { NotificationProvider } from "./NotificationContext";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ view?: string | string[] }>();
  const { isLoaded, isSignedIn, member, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const compact = Platform.OS !== "web" || width < 960;
  const onNavigate = useCallback((entry: SidebarEntry) => {
    setDrawerOpen(false);
    if (entry.id === "dashboard") router.replace("/");
    else if (entry.id === "users") router.push("/members");
    else if (entry.id === "settings") router.push("/settings");
    else if (entry.section) {
      router.push({
        pathname: "/section/[section]",
        params: { section: entry.section, ...(entry.view ? { view: entry.view } : {}) },
      });
    }
  }, [router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const visibleMember = isSignedIn && member?.active && member.role !== "pending" ? member : null;
  const routeParts = pathname.split("/").filter(Boolean);
  const section = routeParts[0] === "section" ? routeParts[1] : undefined;
  const selectedView = Array.isArray(params.view) ? params.view[0] : params.view;
  const activeId = useMemo(() => {
    if (pathname === "/") return "dashboard";
    if (pathname === "/members") return "users";
    if (pathname === "/settings") return "settings";
    if (section === "inventory") return selectedView === "purchases" ? "purchases" : "inventory";
    if (section === "machinery") return selectedView === "spare-parts" ? "spare-parts" : "machinery";
    return section ?? "";
  }, [pathname, section, selectedView]);

  const sidebarAction = useMemo(
    () => visibleMember
      ? { visible: compact, toggle: () => setDrawerOpen((open) => !open) }
      : null,
    [compact, visibleMember],
  );
  const isAuthRoute = pathname.includes("/sign-in") || pathname.includes("/setup");
  const canShowSidebar = !!visibleMember && !isAuthRoute;

  return (
    <NotificationProvider>
      <SidebarProvider value={sidebarAction}>
        <View style={[styles.shell, canShowSidebar && !compact && styles.desktopShell]}>
          {canShowSidebar && !compact ? (
            <AppSidebar member={visibleMember!} activeId={activeId} onNavigate={onNavigate} />
          ) : null}
          <View style={styles.content}>{children}</View>
          {canShowSidebar && compact && drawerOpen ? (
            <>
              <SidebarBackdrop onPress={() => setDrawerOpen(false)} />
              <AppSidebar member={visibleMember!} activeId={activeId} onNavigate={onNavigate} onClose={() => setDrawerOpen(false)} drawer />
            </>
          ) : null}
        </View>
        {canShowSidebar && compact ? <BottomNavigation member={visibleMember!} activeId={activeId} /> : null}
      </SidebarProvider>
    </NotificationProvider>
  );
}

const styles = {
  shell: { flex: 1 as const, position: "relative" as const, backgroundColor: colors.background },
  desktopShell: { flexDirection: "row" as const, direction: "rtl" as const },
  content: { flex: 1 as const, minWidth: 0 as const, minHeight: 0 as const },
};
