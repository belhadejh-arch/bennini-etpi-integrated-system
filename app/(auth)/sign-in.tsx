import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  ImageBackground,
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
import { useAuth } from "../../lib/auth";
import { translate } from "../../lib/localization";

export default function SignInScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLoaded, isSignedIn, signInWithSerial, language, updatePreferences } = useAuth();
  const t = (value: string) => translate(value, language);
  const [serial, setSerial] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isWide = width >= 900;
  const isFrench = language === "fr";

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/");
  }, [isLoaded, isSignedIn, router]);

  const submit = async () => {
    if (serial.length !== 6 || busy) return;
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

  const panel = (
    <View style={[styles.formPanel, isWide && styles.desktopPanel, width < 400 && styles.compactPanel]}>
      <View style={styles.languageRow}>
        {(["ar", "fr"] as const).map((locale) => (
          <Pressable
            key={locale}
            accessibilityRole="radio"
            accessibilityState={{ selected: language === locale }}
            onPress={() => void updatePreferences({ language: locale })}
            style={[styles.languageOption, language === locale && styles.languageSelected]}
          >
            <Text style={[styles.languageText, language === locale && styles.languageSelectedText]}>
              {locale === "ar" ? "العربية" : "Français"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.headingBlock, isFrench && styles.alignLeft]}>
        <Text style={[styles.eyebrow, isFrench && styles.alignLeft]}>{t("منصة موحّدة لإدارة الأشغال والمالية")}</Text>
        <Text style={[styles.heading, isFrench && styles.alignLeft]}>{t("مرحباً بكم")}</Text>
        <Text style={[styles.intro, isFrench && styles.alignLeft]}>{t("أدخل رقم الدخول المكوّن من ستة أرقام.")}</Text>
      </View>

      <Text style={[styles.fieldLabel, isFrench && styles.alignLeft]}>{t("الرقم التسلسلي")}</Text>
      <TextInput
        value={serial}
        onChangeText={(value) => setSerial(value.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="off"
        textContentType="oneTimeCode"
        placeholder="000000"
        placeholderTextColor="rgba(225,237,249,0.48)"
        style={styles.serialInput}
        maxLength={6}
        accessibilityLabel={t("الرقم التسلسلي")}
        onSubmitEditing={() => void submit()}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => void submit()}
        disabled={busy || serial.length !== 6}
        style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, (busy || serial.length !== 6) && styles.disabled]}
      >
        {busy
          ? <ActivityIndicator color="#102B52" />
          : <Text style={styles.submitText}>{isFrench ? "Se connecter" : "دخول"}</Text>}
        {!busy && <Text accessibilityElementsHidden style={styles.submitArrow}>{isFrench ? "←" : "→"}</Text>}
      </Pressable>
      {message ? <Text accessibilityRole="alert" style={[styles.errorText, isFrench && styles.alignLeft]}>{message}</Text> : null}
      <View style={styles.secureNote}>
        <View style={styles.rule} />
        <Text style={styles.lockMark}>⌑</Text>
        <Text style={styles.secureCopy}>{t("تُنشأ حسابات الأعضاء من لوحة التحكم وتُحدَّد لهم صلاحيات الأقسام.")}</Text>
      </View>
      <Pressable onPress={() => router.push("/(auth)/setup")} accessibilityRole="link" style={styles.recoveryLink}>
        <Text style={styles.recoveryText}>{t("استعادة رمز الدخول")}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.page}>
      <StatusBar style="light" backgroundColor="#08244C" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={[styles.scrollContent, isWide && styles.desktopScroll]} keyboardShouldPersistTaps="handled">
          {isWide ? (
            <View style={styles.desktopLayout}>
              <View style={styles.brandSide}>
                <ImageBackground source={require("../assets/construction-backdrop.jpg")} resizeMode="cover" style={styles.constructionImage} imageStyle={styles.constructionImageStyle}>
                  <LinearGradient colors={["rgba(4,25,58,0.04)", "rgba(4,25,58,0.58)", "#08244C"]} style={styles.imageShade} />
                </ImageBackground>
                <View style={styles.brandContent}>
                  <CompanyLogo width={144} height={120} />
                  <Text style={styles.brandName}>BENNINI ETPI</Text>
                  <Text style={styles.brandDescriptor}>{t("شركة البناء والأشغال العمومية والصناعية")}</Text>
                  <View style={styles.yellowRule} />
                  <Text style={styles.brandMotto}>{t("معاً نبني المستقبل")}</Text>
                </View>
                <View style={styles.cornerSlashOne} />
                <View style={styles.cornerSlashTwo} />
              </View>
              <View style={styles.formSide}>{panel}</View>
            </View>
          ) : (
            <View style={styles.mobileLayout}>
              <ImageBackground source={require("../assets/construction-backdrop.jpg")} resizeMode="cover" style={styles.mobileBackdrop} imageStyle={styles.mobileBackdropImage}>
                <LinearGradient colors={["rgba(4,24,56,0.28)", "rgba(4,24,56,0.82)", "#08244C"]} style={styles.mobileShade} />
              </ImageBackground>
              <View style={styles.mobileBrand}>
                <CompanyLogo width={124} height={104} />
                <Text style={styles.mobileBrandName}>BENNINI <Text style={styles.yellowWord}>ETPI</Text></Text>
                <Text style={styles.mobileDescriptor}>{t("شركة البناء والأشغال العمومية والصناعية")}</Text>
              </View>
              {panel}
              <Text style={styles.mobileFooter}>{t("معاً نبني المستقبل")}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = {
  page: { flex: 1, minHeight: "100%" as any, backgroundColor: "#08244C" },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" as const, paddingHorizontal: 19, paddingVertical: 27 },
  desktopScroll: { padding: 0 },
  desktopLayout: { flex: 1, minHeight: 720, flexDirection: "row" as const, backgroundColor: "#08244C" },
  brandSide: { flex: 1.08, minHeight: 720, overflow: "hidden" as const, position: "relative" as const, backgroundColor: "#0B2F68", justifyContent: "center" as const },
  constructionImage: { position: "absolute" as const, top: 0, bottom: 0, left: 0, right: 0, width: "100%" as const, height: "100%" as const },
  constructionImageStyle: { opacity: 0.78 },
  imageShade: { flex: 1, minHeight: "100%" as const },
  brandContent: { alignItems: "center" as const, paddingHorizontal: 28, paddingTop: 35, paddingBottom: 28 },
  brandName: { color: "#FFFFFF", fontSize: 37, lineHeight: 47, fontWeight: "900" as const, letterSpacing: 1.5 },
  brandDescriptor: { color: "#D8E6F5", fontSize: 13, letterSpacing: 1.2, marginTop: 2, textAlign: "center" as const },
  yellowRule: { width: 44, height: 3, borderRadius: 4, backgroundColor: "#F7C928", marginTop: 36, marginBottom: 19 },
  brandMotto: { color: "#FFF4D0", fontSize: 24, fontWeight: "600" as const },
  cornerSlashOne: { position: "absolute" as const, width: 95, height: 15, backgroundColor: "#F7C928", top: 53, left: -23, transform: [{ rotate: "-48deg" }] },
  cornerSlashTwo: { position: "absolute" as const, width: 130, height: 12, backgroundColor: "#1760C0", top: 72, left: -37, transform: [{ rotate: "-48deg" }] },
  formSide: { flex: 0.92, minWidth: 440, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 38, paddingVertical: 48, backgroundColor: "#08244C" },
  formPanel: { width: "100%" as const, maxWidth: 470, borderWidth: 1, borderColor: "rgba(89,151,219,0.38)", backgroundColor: "rgba(5,29,67,0.83)", borderRadius: 22, paddingHorizontal: 34, paddingVertical: 30, shadowColor: "#020E22", shadowOpacity: 0.28, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 9 },
  desktopPanel: { maxWidth: 470 },
  compactPanel: { paddingHorizontal: 23, paddingVertical: 23 },
  languageRow: { flexDirection: "row" as const, justifyContent: "flex-end" as const, gap: 8, marginBottom: 25 },
  languageOption: { minHeight: 38, minWidth: 78, borderRadius: 10, borderWidth: 1, borderColor: "rgba(155,190,226,0.24)", alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 10 },
  languageSelected: { borderColor: "#F7C928", backgroundColor: "rgba(247,201,40,0.12)" },
  languageText: { color: "#D6E2F0", fontSize: 14, fontWeight: "600" as const },
  languageSelectedText: { color: "#FFE27A" },
  headingBlock: { marginBottom: 26, alignItems: "flex-end" as const },
  alignLeft: { textAlign: "left" as const, alignSelf: "flex-start" as const },
  eyebrow: { color: "#EBCB62", fontSize: 13, fontWeight: "600" as const, textAlign: "right" as const, marginBottom: 8 },
  heading: { color: "#FFFFFF", fontSize: 30, lineHeight: 42, fontWeight: "800" as const, textAlign: "right" as const },
  intro: { color: "#BACBE0", fontSize: 15, lineHeight: 24, textAlign: "right" as const, marginTop: 5 },
  fieldLabel: { color: "#EDF3FC", fontSize: 14, fontWeight: "700" as const, textAlign: "right" as const },
  serialInput: { width: "100%" as const, minHeight: 58, marginTop: 10, borderWidth: 1, borderColor: "rgba(85,156,234,0.72)", borderRadius: 13, paddingHorizontal: 17, backgroundColor: "rgba(7,34,76,0.9)", color: "#FFFFFF", textAlign: "center" as const, fontSize: 24, fontWeight: "700" as const, letterSpacing: 10 },
  submitButton: { minHeight: 56, borderRadius: 14, marginTop: 20, backgroundColor: "#F7C928", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, position: "relative" as const, paddingHorizontal: 24 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  disabled: { opacity: 0.58 },
  submitText: { color: "#122A4D", fontWeight: "800" as const, fontSize: 17 },
  submitArrow: { color: "#122A4D", fontSize: 23, fontWeight: "700" as const, position: "absolute" as const, right: 18, top: 12 },
  errorText: { color: "#FFAAA2", fontSize: 14, fontWeight: "600" as const, textAlign: "right" as const, marginTop: 13, lineHeight: 22 },
  secureNote: { alignItems: "center" as const, marginTop: 25 },
  rule: { height: 1, width: "100%" as const, backgroundColor: "rgba(156,184,214,0.18)", marginBottom: 16 },
  lockMark: { color: "#F7C928", fontSize: 24, lineHeight: 27, fontWeight: "700" as const },
  secureCopy: { color: "#A9BED7", fontSize: 13, lineHeight: 21, marginTop: 3, textAlign: "center" as const },
  recoveryLink: { alignSelf: "center" as const, paddingHorizontal: 12, paddingTop: 13, paddingBottom: 2 },
  recoveryText: { color: "#F4D66E", fontSize: 14, fontWeight: "600" as const, textDecorationLine: "underline" as const, textDecorationColor: "rgba(244,214,110,0.55)" },
  mobileLayout: { flexGrow: 1, alignItems: "center" as const, justifyContent: "center" as const, width: "100%" as const, paddingVertical: 27, position: "relative" as const },
  mobileBackdrop: { position: "absolute" as const, top: 0, left: 0, right: 0, height: 360, overflow: "hidden" as const },
  mobileBackdropImage: { opacity: 0.62 },
  mobileShade: { flex: 1, minHeight: "100%" as const },
  mobileBrand: { alignItems: "center" as const, marginTop: 4, marginBottom: 22 },
  mobileBrandName: { color: "#FFFFFF", fontSize: 22, lineHeight: 30, fontWeight: "900" as const, letterSpacing: 1 },
  yellowWord: { color: "#F7C928" },
  mobileDescriptor: { color: "#D1DDF0", fontSize: 11, marginTop: 1, letterSpacing: 0.4 },
  mobileFooter: { color: "#B9CBE1", fontSize: 13, marginTop: 20 },
};
