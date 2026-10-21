import { useCallback, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect } from "expo-router";

/** Sync only the visible screen. Never poll inactive routes or a background app. */
export function useReconnectRefresh(refresh: (background?: boolean) => Promise<unknown>, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let closed = false;
    let running = false;
    const foreground = () => AppState.currentState !== "background" &&
      (Platform.OS !== "web" || (document.visibilityState !== "hidden" && navigator.onLine !== false));
    const run = async () => {
      if (closed || running || !foreground()) return;
      running = true;
      try { await latest.current(true); } catch { /* Screen owns its visible error and retained data. */ }
      finally { running = false; }
    };
    // The screen already loads on mount. Return navigation should refresh again.
    if (firstFocus.current) firstFocus.current = false;
    else void run();
    const timer = setInterval(() => void run(), 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });
    if (Platform.OS === "web") {
      window.addEventListener("online", run);
      document.addEventListener("visibilitychange", run);
    }
    return () => {
      closed = true;
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("online", run);
        document.removeEventListener("visibilitychange", run);
      }
    };
  }, [enabled]));
}
