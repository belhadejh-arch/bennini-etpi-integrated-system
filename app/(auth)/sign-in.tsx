import { useRouter } from "expo-router";
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
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { CompanyLogo } from "../components/CompanyLogo";
import { useAuth } from "../../lib/auth";
import { colors, palettes } from "../../lib/theme";
import { translate } from "../../lib/localization";

export default function SignInScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLoaded, isSignedIn, signInWithSerial, language, updatePreferences, appearance } = useAuth();
  const systemScheme = useColorScheme();
  const darkMode = appearance === "dark" || (appearance === "system" && systemScheme === "dark");
  const t = (value: string) => translate(value, language);
  const [serial, setSerial] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/");
  }, [isLoaded, isSignedIn, router]);

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
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    backgroundColor: colors.surface,
    color: colors.ink,
    textAlign: "center" as const,
    fontSize: 23,
    letterSpacing: 8,
    marginTop: 9,
  };

  return (
    <LinearGradient colors={darkMode ? [palettes.dark.background, palettes.dark.surface, palettes.dark.background] : [palettes.light.background, palettes.light.surface, palettes.light.background]} style={{ flex: 1 }}>
      <StatusBar style={darkMode ? "light" : "dark"} backgroundColor={darkMode ? palettes.dark.background : palettes.light.background} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: width < 380 ? 16 : 22, paddingVertical: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
            <View style={{ alignItems: "center", marginBottom: 22 }}>
              <CompanyLogo width={Math.min(width - (width < 380 ? 64 : 100), 230)} height={116} />
              <Text style={{ color: colors.navy, fontSize: 15, lineHeight: 24, fontWeight: "700", marginTop: 5, textAlign: "center" }}>
                {t("منصة موحّدة لإدارة الأشغال والمالية")}
              </Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: 25, padding: width < 380 ? 18 : 24, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 25, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginBottom: 18 }}>
                {(["ar", "fr"] as const).map((locale) => <Pressable key={locale} accessibilityRole="radio" accessibilityState={{ selected: language === locale }} onPress={() => void updatePreferences({ language: locale })} style={{ minHeight: 42, minWidth: 86, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: language === locale ? colors.green : colors.border, backgroundColor: language === locale ? colors.greenSoft : colors.background, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: language === locale ? colors.green : colors.ink, fontSize: 14, fontWeight: "700" }}>{locale === "ar" ? "العربية" : "Français"}</Text>
                </Pressable>)}
              </View>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.navy, textAlign: language === "ar" ? "right" : "left" }}>{t("تسجيل الدخول")}</Text>
              <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "500", lineHeight: 24, textAlign: language === "ar" ? "right" : "left", marginTop: 6, marginBottom: 22 }}>
                {t("أدخل رقم الدخول المكوّن من ستة أرقام.")}
              </Text>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700", textAlign: language === "ar" ? "right" : "left" }}>{t("الرقم التسلسلي")}</Text>
              <TextInput
                value={serial}
                onChangeText={(value) => setSerial(value.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="off"
                textContentType="oneTimeCode"
                placeholder="000000"
                placeholderTextColor={colors.placeholder}
                style={inputStyle}
                maxLength={6}
                accessibilityLabel={t("الرقم التسلسلي")}
                onSubmitEditing={() => { if (serial.length === 6 && !busy) void submit(); }}
              />
              <Pressable
                onPress={() => void submit()}
                disabled={busy || serial.length !== 6}
                style={{ marginTop: 20, minHeight: 52, borderRadius: 13, backgroundColor: colors.action, alignItems: "center", justifyContent: "center", opacity: busy || serial.length !== 6 ? 0.6 : 1 }}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{language === "ar" ? "دخول" : "Entrer"}</Text>}
              </Pressable>
              {message ? <Text accessibilityRole="alert" style={{ color: colors.red, fontSize: 14, fontWeight: "600", textAlign: "right", marginTop: 14, lineHeight: 23 }}>{message}</Text> : null}
              <View style={{ marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ textAlign: "center", color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 23 }}>
                  تُنشأ حسابات الأعضاء من لوحة التحكم وتُحدَّد لهم صلاحيات الأقسام.
                </Text>
                <Pressable onPress={() => router.push("/(auth)/setup")} style={{ alignSelf: "center", paddingTop: 12, paddingHorizontal: 8 }}>
                  <Text style={{ textAlign: "center", color: colors.blue, fontSize: 14, fontWeight: "600", lineHeight: 23 }}>
                    استعادة رمز الدخول
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
