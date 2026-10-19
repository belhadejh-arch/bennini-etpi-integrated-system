import { useAuth } from "../../lib/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import { apiRequest } from "../../lib/api";

type NotificationContextValue = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refresh: async () => undefined,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    if (Platform.OS === "web" && typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      const result = await apiRequest<{ unreadCount: number }>("/notifications", () => getToken());
      setUnreadCount(result.unreadCount);
    } catch {
      // Keep the last known badge count if the notification endpoint is temporarily unavailable.
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setUnreadCount(0);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [isLoaded, isSignedIn, refresh]);

  const value = useMemo(() => ({ unreadCount, refresh }), [refresh, unreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationBadge() {
  return useContext(NotificationContext);
}
