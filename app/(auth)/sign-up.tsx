import { useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { colors } from "../../lib/theme";

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, fetchStatus } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const busy = fetchStatus === "fetching";

  const inputStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#FBFCFE",
    color: colors.ink,
    textAlign: "right" as const,
    writingDirection: "rtl" as const,
    fontSize: 15,
    marginTop: 7,
  };

  const begin = async () => {
    setMessage("");
    try {
      const result = await signUp.password({ emailAddress: email.trim(), password });
      if (result.error) {
        setMessage(result.error.message || "تعذر إنشاء الحساب.");
        return;
      }
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) setMessage(sent.error.message || "تعذر إرسال رمز التحقق.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إنشاء الحساب.");
    }
  };

  const verify = async () => {
    setMessage("");
    try {
      const result = await signUp.verifications.verifyEmailCode({ code });
      if (result.error) {
        setMessage(result.error.message || "رمز التحقق غير صحيح.");
        return;
      }
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ session }) => {
            if (!session?.currentTask) router.replace("/");
          },
        });
      } else {
        setMessage("يلزم إكمال متطلبات الحساب قبل المتابعة.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تأكيد البريد.");
    }
  };

  return (
    <LinearGradient colors={[colors.navy, "#103E7C", "#5E33AA"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 22 }}>
            <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: colors.yellow, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.navy, fontWeight: "900", fontSize: 21 }}>B</Text>
            </View>
            <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "900", marginTop: 10 }}>حساب منصة BENNINI ETPI</Text>
          </View>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 23 }}>
            <Text style={{ color: colors.navy, fontSize: 21, fontWeight: "800", textAlign: "right" }}>
              إنشاء حساب عضو
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "right", marginTop: 6, marginBottom: 20, lineHeight: 20 }}>
              بعد تأكيد البريد، يبقى الحساب بانتظار تفعيل المدير وتحديد الأقسام.
            </Text>

            {signUp.status === "missing_requirements" &&
            signUp.unverifiedFields.includes("email_address") &&
            signUp.missingFields.length === 0 ? (
              <>
                <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right" }}>رمز التحقق المرسل إلى بريدك</Text>
                <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" placeholderTextColor="#94A3B8" style={inputStyle} />
                <Pressable onPress={verify} disabled={busy || !code.trim()} style={{ backgroundColor: colors.blue, borderRadius: 12, height: 50, marginTop: 17, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>تأكيد البريد وإنشاء الحساب</Text>}
                </Pressable>
                <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={{ alignItems: "center", padding: 14 }}>
                  <Text style={{ color: colors.blue, fontWeight: "700" }}>إعادة إرسال الرمز</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right" }}>البريد الإلكتروني</Text>
                <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="name@company.dz" placeholderTextColor="#94A3B8" style={inputStyle} />
                <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "right", marginTop: 15 }}>كلمة المرور</Text>
                <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="أنشئ كلمة مرور" placeholderTextColor="#94A3B8" style={inputStyle} />
                <Pressable onPress={begin} disabled={busy || !email.trim() || password.length < 8} style={{ backgroundColor: colors.blue, borderRadius: 12, height: 50, marginTop: 18, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>إرسال رمز التحقق</Text>}
                </Pressable>
              </>
            )}

            {message ? <Text style={{ color: colors.red, textAlign: "right", fontSize: 13, marginTop: 12, lineHeight: 19 }}>{message}</Text> : null}
            <View nativeID="clerk-captcha" />
            <View style={{ alignItems: "center", marginTop: 16 }}>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable><Text style={{ color: colors.blue, fontWeight: "700" }}>لديك حساب؟ تسجيل الدخول</Text></Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
