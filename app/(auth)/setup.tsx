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
  const [serial, setSerial] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const setup = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest<{ serial: string }>("/auth/bootstrap", async () => null, {
        method: "POST",
        body: JSON.stringify({ bootstrapToken }),
      });
      setSerial(result.serial);
      setBootstrapToken("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تهيئة حساب المدير.");
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
          <Text style={{ color: colors.navy, fontSize: 22, fontWeight: "800", textAlign: "right" }}>إعداد دخول المدير الأول</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 8, marginBottom: 18 }}>
            هذه الخطوة لمرة واحدة لإنشاء رقم المدير في قاعدة البيانات. أدخل رمز التهيئة الذي أُضيف إلى أسرار المشروع.
          </Text>
          {serial ? (
            <View style={{ backgroundColor: "#F1F6FB", borderRadius: 14, padding: 18, alignItems: "center" }}>
              <Text style={{ color: colors.ink, textAlign: "center", lineHeight: 23 }}>
                تم إنشاء رقم المدير. احفظه الآن؛ لن يظهر مرة أخرى.
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
              <Pressable onPress={() => void setup()} disabled={busy || !bootstrapToken} style={{ marginTop: 18, height: 52, borderRadius: 13, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", opacity: busy || !bootstrapToken ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>إنشاء رقم المدير</Text>}
              </Pressable>
              {message ? <Text style={{ color: colors.red, fontSize: 13, textAlign: "right", marginTop: 14 }}>{message}</Text> : null}
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
