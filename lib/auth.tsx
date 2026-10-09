import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { apiRequest, type Member } from "./api";

type SignInResult = { token?: string; member: Member };
type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  signInWithSerial: (serial: string) => Promise<void>;
  signOut: () => Promise<void>;
  member: Member | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const storageKey = "bennini_session_token";

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
  const getToken = useCallback(async () => sessionToken, [sessionToken]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const storedToken = await readToken();
        if (alive) setSessionToken(storedToken);
        const result = await apiRequest<{ member: Member }>("/auth/session", async () => storedToken);
        if (alive) setMember(result.member);
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
  }, []);

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
  }), [getToken, isLoaded, member, signInWithSerial, signOut]);

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
