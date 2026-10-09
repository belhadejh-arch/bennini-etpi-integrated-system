import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { CompanyLogo } from "../components/CompanyLogo";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

export default function SignInScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLoaded, isSignedIn, signInWithSerial } = useAuth();
  const [serial, setSerial] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [canBootstrap, setCanBootstrap] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    void apiRequest<{ administratorConfigured: boolean; bootstrapAvailable: boolean }>(
      "/auth/status",
      async () => null,
    ).then((status) => setCanBootstrap(!status.administratorConfigured && status.bootstrapAvailable))
      .catch(() => setCanBootstrap(false));
  }, []);

  const submit = async () => {
    setMessage("");
    setBusy(true);
    try {
      await signInWithSerial(serial);
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    backgroundColor: "#FBFCFE",
    color: colors.ink,
    textAlign: "center" as const,
    fontSize: 23,
    letterSpacing: 8,
    marginTop: 9,
  };

  return (
    <LinearGradient colors={["#F7F9FC", "#EDF2F8", "#E5EDF6"]} style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor="#F7F9FC" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: width < 380 ? 16 : 22, paddingVertical: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
            <View style={{ alignItems: "center", marginBottom: 22 }}>
              <CompanyLogo width={Math.min(width - (width < 380 ? 64 : 100), 230)} height={116} />
              <Text style={{ color: colors.navy, fontSize: 13, fontWeight: "700", marginTop: 5, textAlign: "center" }}>
                منصة موحّدة لإدارة الأشغال والمالية
              </Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: 25, padding: width < 380 ? 18 : 24, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 25, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.navy, textAlign: "right" }}>تسجيل الدخول</Text>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "right", marginTop: 6, marginBottom: 22 }}>
                أدخل رقم الدخول المكوّن من ستة أرقام.
              </Text>
              <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right" }}>الرقم التسلسلي</Text>
              <TextInput
                value={serial}
                onChangeText={(value) => setSerial(value.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="off"
                textContentType="oneTimeCode"
                placeholder="000000"
                placeholderTextColor="#94A3B8"
                style={inputStyle}
                maxLength={6}
                accessibilityLabel="الرقم التسلسلي المكوّن من ستة أرقام"
                onSubmitEditing={() => { if (serial.length === 6 && !busy) void submit(); }}
              />
              <Pressable
                onPress={() => void submit()}
                disabled={busy || serial.length !== 6}
                style={{ marginTop: 20, height: 52, borderRadius: 13, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", opacity: busy || serial.length !== 6 ? 0.6 : 1 }}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>دخول</Text>}
              </Pressable>
              {message ? <Text style={{ color: colors.red, fontSize: 13, textAlign: "right", marginTop: 14, lineHeight: 20 }}>{message}</Text> : null}
              {canBootstrap ? (
                <View style={{ alignItems: "center", marginTop: 18 }}>
                  <Link href="/(auth)/setup" asChild>
                    <Pressable><Text style={{ color: colors.blue, fontWeight: "700" }}>تهيئة دخول المدير الأول</Text></Pressable>
                  </Link>
                </View>
              ) : null}
              <View style={{ marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ textAlign: "center", color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                  ينشئ المدير حسابات الأعضاء من لوحة التحكم ويمنحهم صلاحيات الأقسام.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
