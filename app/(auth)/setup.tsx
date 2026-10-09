import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { CompanyLogo } from "../components/CompanyLogo";
import { apiRequest } from "../../lib/api";
import { colors } from "../../lib/theme";

export default function InitialAdminSetupScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
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
    <LinearGradient colors={["#F7F9FC", "#EDF2F8", "#E5EDF6"]} style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor="#F7F9FC" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 22 }}>
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", backgroundColor: colors.surface, borderRadius: 24, padding: 24 }}>
          <View style={{ alignItems: "center", marginBottom: 18 }}>
            <CompanyLogo width={Math.min(width - 90, 220)} height={110} />
          </View>
            <Text style={{ color: colors.navy, fontSize: 22, fontWeight: "800", textAlign: "right" }}>
              {resetMode ? "استعادة رمز دخول المدير" : "إعداد دخول المدير الأول"}
            </Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 8, marginBottom: 18 }}>
              {resetMode
                ? "أدخل رمز التهيئة لإصدار رمز دخول جديد من ستة أرقام. سيتوقف الرمز السابق عن العمل، ولن يظهر الرمز الجديد مرة أخرى."
                : "هذه الخطوة لمرة واحدة لإنشاء حساب المدير في قاعدة البيانات. أدخل رمز التهيئة ورقم الدخول المكوّن من ستة أرقام."}
          </Text>
          {serial ? (
            <View style={{ backgroundColor: "#F1F6FB", borderRadius: 14, padding: 18, alignItems: "center" }}>
                <Text style={{ color: colors.ink, textAlign: "center", lineHeight: 23 }}>
                  {serialAction === "reset"
                    ? "تم إصدار رمز دخول جديد للمدير. احفظه الآن؛ لن يظهر مرة أخرى."
                    : "تم إنشاء رقم المدير. احفظه الآن؛ لن يظهر مرة أخرى."}
                </Text>
              <Text selectable style={{ color: colors.navy, fontSize: 32, fontWeight: "900", letterSpacing: 10, marginVertical: 12 }}>{serial}</Text>
              <Pressable onPress={() => router.replace("/(auth)/sign-in")} style={{ marginTop: 8, height: 48, borderRadius: 12, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>العودة لتسجيل الدخول</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right" }}>رمز التهيئة</Text>
              <TextInput
                value={bootstrapToken}
                onChangeText={setBootstrapToken}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="أدخل رمز التهيئة"
                placeholderTextColor="#94A3B8"
                style={{ height: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, color: colors.ink, marginTop: 8, textAlign: "left" }}
              />
              {!resetMode ? (
                <>
                  <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right", marginTop: 16 }}>الرقم التسلسلي للمدير</Text>
                  <TextInput
                    value={adminSerial}
                    onChangeText={(value) => setAdminSerial(value.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    autoComplete="off"
                    placeholder="أدخل الرقم المكوّن من ستة أرقام"
                    placeholderTextColor="#94A3B8"
                    maxLength={6}
                    style={{ height: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, color: colors.ink, marginTop: 8, textAlign: "center", letterSpacing: 8, fontSize: 21 }}
                  />
                </>
              ) : null}
              <Pressable
                onPress={() => void (resetMode ? resetAdminCode() : setup())}
                disabled={busy || !bootstrapToken || (!resetMode && adminSerial.length !== 6)}
                style={{ marginTop: 18, height: 52, borderRadius: 13, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", opacity: busy || !bootstrapToken || (!resetMode && adminSerial.length !== 6) ? 0.6 : 1 }}
              >
                {busy
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{resetMode ? "إصدار رمز جديد" : "إنشاء رقم المدير"}</Text>}
              </Pressable>
              {message ? <Text style={{ color: colors.red, fontSize: 13, textAlign: "right", marginTop: 14 }}>{message}</Text> : null}
              <Pressable
                onPress={() => { setResetMode((current) => !current); setMessage(""); setAdminSerial(""); }}
                style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 8, marginTop: 6 }}
              >
                <Text style={{ color: colors.blue, fontWeight: "700", textAlign: "center" }}>
                  {resetMode ? "الانتقال إلى إعداد المدير لأول مرة" : "إعادة إصدار رمز دخول المدير"}
                </Text>
              </Pressable>
            </>
          )}
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <Link href="/(auth)/sign-in" asChild><Pressable><Text style={{ color: colors.blue, fontWeight: "700" }}>العودة لتسجيل الدخول</Text></Pressable></Link>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
