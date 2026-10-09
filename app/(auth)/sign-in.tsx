import { useSignIn } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
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
import { colors } from "../../lib/theme";

export default function SignInScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const busy = fetchStatus === "fetching";

  const finish = async () => {
    await signIn.finalize({
      navigate: ({ session }) => {
        if (!session?.currentTask) router.replace("/");
      },
    });
  };

  const submit = async () => {
    setMessage("");
    try {
      const result = await signIn.password({ emailAddress: email.trim(), password });
      if (result.error) {
        setMessage(result.error.message || "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.");
        return;
      }
      if (signIn.status === "complete") {
        await finish();
      } else if (signIn.status === "needs_client_trust") {
        const factor = signIn.supportedSecondFactors?.find((item) => item.strategy === "email_code");
        if (factor) await signIn.mfa.sendEmailCode();
      } else {
        setMessage("يلزم إكمال خطوة تحقق إضافية لتسجيل الدخول.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تسجيل الدخول.");
    }
  };

  const verify = async () => {
    setMessage("");
    try {
      await signIn.mfa.verifyEmailCode({ code });
      if (signIn.status === "complete") await finish();
      else setMessage("رمز التحقق غير مكتمل أو غير صحيح.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر التحقق من الرمز.");
    }
  };

  const inputStyle = {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    backgroundColor: "#FBFCFE",
    color: colors.ink,
    textAlign: "right" as const,
    writingDirection: "rtl" as const,
    fontSize: 15,
    marginTop: 7,
  };

  return (
    <LinearGradient colors={["#F7F9FC", "#EDF2F8", "#E5EDF6"]} style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor="#F7F9FC" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: width < 380 ? 16 : 22, paddingVertical: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
            <View style={{ alignItems: "center", marginBottom: 22, backgroundColor: "transparent" }}>
              <CompanyLogo width={Math.min(width - (width < 380 ? 64 : 100), 230)} height={116} />
              <Text style={{ color: colors.navy, fontSize: 13, fontWeight: "700", marginTop: 5, textAlign: "center" }}>
                منصة موحّدة لإدارة الأشغال والمالية
              </Text>
            </View>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 25,
                padding: width < 380 ? 18 : 24,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 25,
                shadowOffset: { width: 0, height: 12 },
                elevation: 8,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.navy, textAlign: "right" }}>
                أهلاً بعودتك
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "right", marginTop: 6, marginBottom: 22 }}>
                سجّل الدخول للوصول إلى حسابك والأقسام المسموح بها.
              </Text>

              {signIn.status === "needs_client_trust" ? (
                <>
                  <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right" }}>رمز التحقق</Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    placeholder="أدخل الرمز المرسل إلى بريدك"
                    placeholderTextColor="#94A3B8"
                    style={inputStyle}
                  />
                  <Pressable
                    onPress={verify}
                    disabled={busy || !code.trim()}
                    style={{ marginTop: 18, height: 52, borderRadius: 13, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>تأكيد الرمز</Text>}
                  </Pressable>
                  <Pressable onPress={() => signIn.mfa.sendEmailCode()} style={{ padding: 14, alignItems: "center" }}>
                    <Text style={{ color: colors.blue, fontWeight: "700" }}>إعادة إرسال الرمز</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right" }}>البريد الإلكتروني</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder="name@company.dz"
                    placeholderTextColor="#94A3B8"
                    style={inputStyle}
                  />
                  <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right", marginTop: 16 }}>كلمة المرور</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="password"
                    textContentType="password"
                    placeholder="أدخل كلمة المرور"
                    placeholderTextColor="#94A3B8"
                    style={inputStyle}
                  />
                  <Pressable
                    onPress={submit}
                    disabled={busy || !email.trim() || !password}
                    style={{ marginTop: 20, height: 52, borderRadius: 13, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>تسجيل الدخول</Text>}
                  </Pressable>
                  <View style={{ alignItems: "center", marginTop: 17 }}>
                    <Link href="/(auth)/sign-up" asChild>
                      <Pressable><Text style={{ color: colors.blue, fontWeight: "700" }}>إنشاء حساب عضو جديد</Text></Pressable>
                    </Link>
                  </View>
                </>
              )}

              {message ? (
                <Text style={{ color: colors.red, fontSize: 13, textAlign: "right", marginTop: 14, lineHeight: 20 }}>
                  {message}
                </Text>
              ) : null}
              <View style={{ marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ textAlign: "center", color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                  وصول آمن موحّد • صلاحيات الأقسام يحددها المدير
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
