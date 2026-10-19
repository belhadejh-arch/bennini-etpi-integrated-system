import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance as NativeAppearance, Platform } from "react-native";
import { apiRequest, setResponseLanguage, type Appearance, type Language, type Member } from "./api";
import { setActiveLanguage, setActivePalette } from "./theme";
import { setTranslationLanguage } from "./localization";

type SignInResult = { token: string; member: Member };
type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  signInWithSerial: (serial: string) => Promise<void>;
  signOut: () => Promise<void>;
  member: Member | null;
  language: Language;
  appearance: Appearance;
  isDark: boolean;
  updatePreferences: (preferences: { language?: Language; appearance?: Appearance }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const storageKey = "bennini_session_token";
const prefsKey = "bennini_device_preferences";
type Preferences = { language: Language; appearance: Appearance };
function activatePresentation(value: Preferences, systemDark: boolean) {
  // Set reactive values before notifying context consumers (important on native).
  setActivePalette(value.appearance === "dark" || (value.appearance === "system" && systemDark) ? "dark" : "light");
  setActiveLanguage(value.language);
  setTranslationLanguage(value.language);
  setResponseLanguage(value.language);
}
async function readPreferences(): Promise<Preferences> {
  let raw: string | null = null;
  if (Platform.OS === "web") raw = globalThis.localStorage?.getItem(prefsKey) ?? null;
  else raw = await SecureStore.getItemAsync(prefsKey);
  try {
    const parsed = raw ? JSON.parse(raw) as Partial<Preferences> : {};
    return { language: parsed.language === "fr" ? "fr" : "ar", appearance: ["dark", "system"].includes(parsed.appearance ?? "") ? parsed.appearance as Appearance : "light" };
  } catch { return { language: "ar", appearance: "light" }; }
}
async function savePreferences(value: Preferences) {
  const raw = JSON.stringify(value);
  if (Platform.OS === "web") globalThis.localStorage?.setItem(prefsKey, raw);
  else await SecureStore.setItemAsync(prefsKey, raw);
}

async function readToken() {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(storageKey) ?? null;
  return SecureStore.getItemAsync(storageKey);
}

async function saveToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) globalThis.localStorage?.setItem(storageKey, token);
    else globalThis.localStorage?.removeItem(storageKey);
  } else if (token) {
    await SecureStore.setItemAsync(storageKey, token);
  } else {
    await SecureStore.deleteItemAsync(storageKey);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({ language: "ar", appearance: "light" });
  const [systemDark, setSystemDark] = useState(NativeAppearance.getColorScheme() === "dark");
  useEffect(() => {
    const sub = NativeAppearance.addChangeListener(({ colorScheme }) => {
      const nextDark = colorScheme === "dark";
      if (preferences.appearance === "system") setActivePalette(nextDark ? "dark" : "light");
      setSystemDark(nextDark);
    });
    return () => sub.remove();
  }, [preferences.appearance]);
  useEffect(() => {
    const resolved = preferences.appearance === "system" ? systemDark : preferences.appearance === "dark";
    setActivePalette(resolved ? "dark" : "light");
    setActiveLanguage(preferences.language);
    setTranslationLanguage(preferences.language);
    setResponseLanguage(preferences.language);
  }, [preferences, systemDark]);
  const getToken = useCallback(async () => sessionToken, [sessionToken]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const storedToken = await readToken();
        const devicePreferences = await readPreferences();
        if (alive) {
          activatePresentation(devicePreferences, systemDark);
          setPreferences(devicePreferences);
          setTranslationLanguage(devicePreferences.language);
          setActiveLanguage(devicePreferences.language);
        }
        if (alive) setSessionToken(storedToken);
        const result = await apiRequest<{ member: Member }>("/auth/session", async () => storedToken);
        if (alive) {
          setMember(result.member);
          const accountPrefs = { language: result.member.language ?? devicePreferences.language, appearance: result.member.appearance ?? devicePreferences.appearance };
          activatePresentation(accountPrefs, systemDark);
          setPreferences(accountPrefs);
          setTranslationLanguage(accountPrefs.language);
          setActiveLanguage(accountPrefs.language);
          await savePreferences(accountPrefs);
        }
      } catch {
        await saveToken(null);
        if (alive) {
          setSessionToken(null);
          setMember(null);
        }
      } finally {
        if (alive) setIsLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const signInWithSerial = useCallback(async (serial: string) => {
    const result = await apiRequest<SignInResult>("/auth/login", async () => null, {
      method: "POST",
      body: JSON.stringify({ serial }),
    });
    await saveToken(result.token ?? null);
    setSessionToken(result.token ?? null);
    setMember(result.member);
    const prefs = { language: result.member.language ?? preferences.language, appearance: result.member.appearance ?? preferences.appearance };
    activatePresentation(prefs, systemDark);
    setPreferences(prefs);
    setTranslationLanguage(prefs.language);
    setActiveLanguage(prefs.language);
    await savePreferences(prefs);
  }, [preferences, systemDark]);

  const updatePreferences = useCallback(async (next: { language?: Language; appearance?: Appearance }) => {
    const updated = { ...preferences, ...next };
    activatePresentation(updated, systemDark);
    setPreferences(updated);
    setTranslationLanguage(updated.language);
    setActiveLanguage(updated.language);
    try {
      await savePreferences(updated);
      if (member) {
        const result = await apiRequest<{ member: Member }>("/me/preferences", getToken, {
          method: "PATCH", body: JSON.stringify(next),
        });
        setMember(result.member);
      }
    } catch (error) {
      activatePresentation(preferences, systemDark);
      setPreferences(preferences);
      try { await savePreferences(preferences); } catch { /* Preserve the original persistence error. */ }
      throw error;
    }
  }, [getToken, member, preferences, systemDark]);

  const signOut = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", getToken, { method: "POST" });
    } finally {
      await saveToken(null);
      setSessionToken(null);
      setMember(null);
    }
  }, [getToken]);

  const value = useMemo<AuthContextValue>(() => ({
    isLoaded,
    isSignedIn: Boolean(member),
    getToken,
    signInWithSerial,
    signOut,
    member,
    language: preferences.language,
    appearance: preferences.appearance,
    isDark: preferences.appearance === "system" ? systemDark : preferences.appearance === "dark",
    updatePreferences,
  }), [getToken, isLoaded, member, preferences, signInWithSerial, signOut, updatePreferences, systemDark]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider.");
  return auth;
}

export function useUser() {
  const { member } = useAuth();
  return {
    user: member ? {
      id: member.clerk_user_id,
      firstName: member.name,
      fullName: member.name,
      primaryEmailAddress: member.email ? { emailAddress: member.email } : null,
    } : null,
  };
}
