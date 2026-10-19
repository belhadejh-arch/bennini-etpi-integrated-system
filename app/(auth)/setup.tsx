import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useColorScheme, useWindowDimensions } from "react-native";
import { CompanyLogo } from "../components/CompanyLogo";
import { apiRequest } from "../../lib/api";
import { colors, palettes } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { translate } from "../../lib/localization";

export default function InitialAdminSetupScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { language, updatePreferences, appearance } = useAuth();
  const systemScheme = useColorScheme();
  const darkMode = appearance === "dark" || (appearance === "system" && systemScheme === "dark");
  const t = (value: string) => translate(value, language);
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [adminSerial, setAdminSerial] = useState("");
  const [serial, setSerial] = useState("");
  const [serialAction, setSerialAction] = useState<"created" | "reset" | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const setup = async () => {
    setBusy(true);
    setMessage("");
    setSerialAction(null);
    try {
      const result = await apiRequest<{ serial: string }>("/auth/bootstrap", async () => null, {
        method: "POST",
        body: JSON.stringify({ bootstrapToken, serial: adminSerial }),
      });
      setSerial(result.serial);
      setSerialAction("created");
      setBootstrapToken("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تهيئة حساب المدير.");
    } finally {
      setBusy(false);
    }
  };

  const resetAdminCode = async () => {
    setBusy(true);
    setMessage("");
    setSerialAction(null);
    try {
      const result = await apiRequest<{ serial: string }>("/auth/admin-code/reset", async () => null, {
        method: "POST",
        body: JSON.stringify({ bootstrapToken }),
      });
      setSerial(result.serial);
      setSerialAction("reset");
      setBootstrapToken("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إعادة تعيين رمز دخول المدير.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={darkMode ? [palettes.dark.background, palettes.dark.surface, palettes.dark.background] : [palettes.light.background, palettes.light.surface, palettes.light.background]} style={{ flex: 1 }}>
      <StatusBar style={darkMode ? "light" : "dark"} backgroundColor={darkMode ? palettes.dark.background : palettes.light.background} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 22 }}>
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", backgroundColor: colors.surface, borderRadius: 24, padding: 24 }}>
          <View style={{ alignItems: "center", marginBottom: 18 }}>
            <CompanyLogo width={Math.min(width - 90, 220)} height={110} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
            {(["ar", "fr"] as const).map((locale) => <Pressable key={locale} accessibilityRole="radio" accessibilityState={{ selected: language === locale }} onPress={() => void updatePreferences({ language: locale })} style={{ minHeight: 42, minWidth: 88, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: language === locale ? colors.green : colors.border, backgroundColor: language === locale ? colors.greenSoft : colors.background, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: language === locale ? colors.green : colors.ink, fontSize: 14, fontWeight: "700" }}>{locale === "ar" ? "العربية" : "Français"}</Text>
            </Pressable>)}
          </View>
            <Text style={{ color: colors.navy, fontSize: 22, fontWeight: "800", textAlign: "right" }}>
              {t(resetMode ? "استعادة رمز دخول المدير" : "إعداد دخول المدير الأول")}
            </Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 23, textAlign: language === "ar" ? "right" : "left", marginTop: 8, marginBottom: 18 }}>
              {resetMode
                ? t("أدخل رمز التهيئة لإصدار رمز دخول جديد من ستة أرقام. سيتوقف الرمز السابق عن العمل، ولن يظهر الرمز الجديد مرة أخرى.")
                : t("هذه الخطوة لمرة واحدة لإنشاء حساب المدير في قاعدة البيانات. أدخل رمز التهيئة ورقم الدخول المكوّن من ستة أرقام.")}
          </Text>
          {serial ? (
            <View style={{ backgroundColor: colors.background, borderRadius: 14, padding: 18, alignItems: "center" }}>
                <Text style={{ color: colors.ink, textAlign: "center", lineHeight: 23 }}>
                  {serialAction === "reset"
                    ? t("تم إصدار رمز دخول جديد للمدير. احفظه الآن؛ لن يظهر مرة أخرى.")
                    : t("تم إنشاء رقم المدير. احفظه الآن؛ لن يظهر مرة أخرى.")}
                </Text>
              <Text selectable style={{ color: colors.navy, fontSize: 32, fontWeight: "900", letterSpacing: 10, marginVertical: 12 }}>{serial}</Text>
              <Pressable onPress={() => router.replace("/(auth)/sign-in")} style={{ marginTop: 8, minHeight: 48, borderRadius: 12, backgroundColor: colors.action, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{t("العودة لتسجيل الدخول")}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: colors.ink, fontWeight: "700", textAlign: language === "ar" ? "right" : "left" }}>{t("رمز التهيئة")}</Text>
              <TextInput
                value={bootstrapToken}
                onChangeText={setBootstrapToken}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("أدخل رمز التهيئة")}
                placeholderTextColor={colors.placeholder}
                style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, color: colors.ink, marginTop: 8, textAlign: "left", fontSize: 15 }}
              />
              {!resetMode ? (
                <>
                  <Text style={{ color: colors.ink, fontWeight: "700", textAlign: language === "ar" ? "right" : "left", marginTop: 16 }}>{t("الرقم التسلسلي للمدير")}</Text>
                  <TextInput
                    value={adminSerial}
                    onChangeText={(value) => setAdminSerial(value.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    autoComplete="off"
                    placeholder={t("أدخل الرقم المكوّن من ستة أرقام")}
                    placeholderTextColor={colors.placeholder}
                    maxLength={6}
                    style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, color: colors.ink, marginTop: 8, textAlign: "center", letterSpacing: 8, fontSize: 21 }}
                  />
                </>
              ) : null}
              <Pressable
                onPress={() => void (resetMode ? resetAdminCode() : setup())}
                disabled={busy || !bootstrapToken || (!resetMode && adminSerial.length !== 6)}
                style={{ marginTop: 18, minHeight: 52, borderRadius: 13, backgroundColor: colors.action, alignItems: "center", justifyContent: "center", opacity: busy || !bootstrapToken || (!resetMode && adminSerial.length !== 6) ? 0.6 : 1 }}
              >
                {busy
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{t(resetMode ? "إصدار رمز جديد" : "إنشاء رقم المدير")}</Text>}
              </Pressable>
              {message ? <Text accessibilityRole="alert" style={{ color: colors.red, fontSize: 14, fontWeight: "600", lineHeight: 23, textAlign: "right", marginTop: 14 }}>{message}</Text> : null}
              <Pressable
                onPress={() => { setResetMode((current) => !current); setMessage(""); setAdminSerial(""); }}
                style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 8, marginTop: 6 }}
              >
                <Text style={{ color: colors.blue, fontWeight: "700", textAlign: "center" }}>
                  {t(resetMode ? "الانتقال إلى إعداد المدير لأول مرة" : "إعادة إصدار رمز دخول المدير")}
                </Text>
              </Pressable>
            </>
          )}
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <Link href="/(auth)/sign-in" asChild><Pressable><Text style={{ color: colors.blue, fontWeight: "700", fontSize: 15 }}>{t("العودة لتسجيل الدخول")}</Text></Pressable></Link>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
