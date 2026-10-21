import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
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
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { translate } from "../../lib/localization";

export default function InitialAdminSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { width } = useWindowDimensions();
  const { language, updatePreferences } = useAuth();
  const t = (value: string) => translate(value, language);
  const initialMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [adminSerial, setAdminSerial] = useState("");
  const [serial, setSerial] = useState("");
  const [serialAction, setSerialAction] = useState<"created" | "reset" | null>(null);
  // The sign-in recovery link currently opens /setup without a query string.
  // Keep recovery as the safe default; first-admin bootstrap remains available
  // through the explicit mode switch (or mode=setup).
  const [resetMode, setResetMode] = useState(initialMode !== "setup");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isWide = width >= 900;
  const isFrench = language === "fr";

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

  const languagePicker = (
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
  );

  const panel = (
    <View style={[styles.formPanel, width < 400 && styles.compactPanel]}>
      {languagePicker}
      <View style={[styles.headingBlock, isFrench && styles.alignLeft]}>
        <Text style={[styles.eyebrow, isFrench && styles.alignLeft]}>
          {t("منصة موحّدة لإدارة الأشغال والمالية")}
        </Text>
        <Text style={[styles.heading, isFrench && styles.alignLeft]}>
          {t(resetMode ? "استعادة رمز دخول المدير" : "إعداد دخول المدير الأول")}
        </Text>
        <Text style={[styles.intro, isFrench && styles.alignLeft]}>
          {t(resetMode
            ? "أدخل رمز التهيئة لإصدار رمز دخول جديد من ستة أرقام. سيتوقف الرمز السابق عن العمل، ولن يظهر الرمز الجديد مرة أخرى."
            : "هذه الخطوة لمرة واحدة لإنشاء حساب المدير في قاعدة البيانات. أدخل رمز التهيئة ورقم الدخول المكوّن من ستة أرقام.")}
        </Text>
      </View>

      {serial ? (
        <View style={styles.resultPanel}>
          <View style={styles.resultMark}><Text style={styles.resultMarkText}>✓</Text></View>
          <Text style={styles.resultTitle}>
            {t(serialAction === "reset"
              ? "تم إصدار رمز دخول جديد للمدير. احفظه الآن؛ لن يظهر مرة أخرى."
              : "تم إنشاء رقم المدير. احفظه الآن؛ لن يظهر مرة أخرى.")}
          </Text>
          <Text selectable accessibilityLabel={t("الرقم التسلسلي")} style={styles.serialResult}>{serial}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/(auth)/sign-in")}
            style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
          >
            <Text style={styles.submitText}>{t("العودة لتسجيل الدخول")}</Text>
            <Text accessibilityElementsHidden style={styles.submitArrow}>{isFrench ? "←" : "→"}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={[styles.fieldLabel, isFrench && styles.alignLeft]}>{t("رمز التهيئة")}</Text>
          <TextInput
            value={bootstrapToken}
            onChangeText={setBootstrapToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("أدخل رمز التهيئة")}
            placeholderTextColor="rgba(225,237,249,0.48)"
            accessibilityLabel={t("رمز التهيئة")}
            returnKeyType={resetMode ? "done" : "next"}
            style={[styles.textInput, isFrench && styles.alignLeft]}
          />
          {!resetMode ? (
            <>
              <Text style={[styles.fieldLabel, styles.secondLabel, isFrench && styles.alignLeft]}>
                {t("الرقم التسلسلي للمدير")}
              </Text>
              <TextInput
                value={adminSerial}
                onChangeText={(value) => setAdminSerial(value.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="off"
                placeholder={t("أدخل الرقم المكوّن من ستة أرقام")}
                placeholderTextColor="rgba(225,237,249,0.48)"
                maxLength={6}
                accessibilityLabel={t("الرقم التسلسلي للمدير")}
                style={styles.serialInput}
              />
              <Text style={styles.fieldHint}>{t("يتكوّن الرمز من ستة أرقام")}</Text>
            </>
          ) : (
            <View style={styles.securityNote}>
              <Text style={styles.securityIcon}>⌑</Text>
              <Text style={styles.securityCopy}>
                {t("سيتم إبطال الرمز السابق فور إصدار رمز جديد. احفظ الرمز الجديد في مكان آمن.")}
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => void (resetMode ? resetAdminCode() : setup())}
            disabled={busy || !bootstrapToken || (!resetMode && adminSerial.length !== 6)}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              (busy || !bootstrapToken || (!resetMode && adminSerial.length !== 6)) && styles.disabled,
            ]}
          >
            {busy
              ? <ActivityIndicator color="#102B52" />
              : <Text style={styles.submitText}>{t(resetMode ? "إصدار رمز جديد" : "إنشاء رقم المدير")}</Text>}
            {!busy && <Text accessibilityElementsHidden style={styles.submitArrow}>{isFrench ? "←" : "→"}</Text>}
          </Pressable>
          {message ? (
            <Text accessibilityRole="alert" style={[styles.errorText, isFrench && styles.alignLeft]}>{message}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => { setResetMode((current) => !current); setMessage(""); setAdminSerial(""); }}
            style={styles.modeSwitch}
          >
            <Text style={styles.modeSwitchText}>
              {t(resetMode ? "الانتقال إلى إعداد المدير لأول مرة" : "إعادة إصدار رمز دخول المدير")}
            </Text>
          </Pressable>
        </>
      )}
      <View style={styles.footerRule}>
        <View style={styles.rule} />
        <Text style={styles.lockMark}>⌑</Text>
        <View style={styles.rule} />
      </View>
      <Link href="/(auth)/sign-in" asChild>
        <Pressable accessibilityRole="link" style={styles.backLink}>
          <Text style={styles.backLinkText}>{t("العودة لتسجيل الدخول")}</Text>
        </Pressable>
      </Link>
    </View>
  );

  return (
    <View style={styles.page}>
      <StatusBar style="light" backgroundColor="#08244C" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isWide && styles.desktopScroll]}
          keyboardShouldPersistTaps="handled"
        >
          {isWide ? (
            <View style={styles.desktopLayout}>
              <View style={styles.brandSide}>
                <ImageBackground
                  source={require("../assets/construction-backdrop.jpg")}
                  resizeMode="cover"
                  style={styles.constructionImage}
                  imageStyle={styles.constructionImageStyle}
                >
                  <LinearGradient colors={["rgba(4,25,58,0.08)", "rgba(4,25,58,0.62)", "#08244C"]} style={styles.imageShade} />
                </ImageBackground>
                <View style={styles.brandContent}>
                  <CompanyLogo width={160} height={116} framed />
                  <Text style={styles.brandName}>BENNINI <Text style={styles.yellowWord}>ETPI</Text></Text>
                  <Text style={styles.brandDescriptor}>{t("شركة البناء والأشغال العمومية والصناعية")}</Text>
                  <View style={styles.yellowRule} />
                  <Text style={styles.brandMotto}>{t("معاً نبني المستقبل")}</Text>
                  <Text style={styles.brandCaption}>{t("البناء يبدأ بخطوة آمنة")}</Text>
                </View>
                <View style={styles.cornerSlashOne} />
                <View style={styles.cornerSlashTwo} />
              </View>
              <View style={styles.formSide}>{panel}</View>
            </View>
          ) : (
            <View style={styles.mobileLayout}>
              <ImageBackground
                source={require("../assets/construction-backdrop.jpg")}
                resizeMode="cover"
                style={styles.mobileBackdrop}
                imageStyle={styles.mobileBackdropImage}
              >
                <LinearGradient colors={["rgba(4,24,56,0.2)", "rgba(4,24,56,0.78)", "#08244C"]} style={styles.mobileShade} />
              </ImageBackground>
              <View style={styles.mobileBrand}>
                <CompanyLogo width={112} height={82} framed />
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
  scrollContent: { flexGrow: 1, justifyContent: "center" as const, paddingHorizontal: 18, paddingVertical: 24 },
  desktopScroll: { padding: 0 },
  desktopLayout: { flex: 1, minHeight: 760, flexDirection: "row" as const, backgroundColor: "#08244C" },
  brandSide: { flex: 1.03, minHeight: 760, overflow: "hidden" as const, position: "relative" as const, backgroundColor: "#0B2F68", justifyContent: "center" as const },
  constructionImage: { position: "absolute" as const, top: 0, bottom: 0, left: 0, right: 0, width: "100%" as const, height: "100%" as const },
  constructionImageStyle: { opacity: 0.78 },
  imageShade: { flex: 1, minHeight: "100%" as const },
  brandContent: { alignItems: "center" as const, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 28 },
  brandName: { color: "#FFFFFF", fontFamily: "Changa", fontSize: 36, lineHeight: 48, fontWeight: "900" as const, letterSpacing: 1.2, marginTop: 13 },
  yellowWord: { color: "#F7C928" },
  brandDescriptor: { color: "#D8E6F5", fontFamily: "Changa", fontSize: 13, letterSpacing: 0.7, marginTop: 1, textAlign: "center" as const },
  yellowRule: { width: 46, height: 3, borderRadius: 4, backgroundColor: "#F7C928", marginTop: 36, marginBottom: 19 },
  brandMotto: { color: "#FFF4D0", fontFamily: "Changa", fontSize: 24, fontWeight: "600" as const },
  brandCaption: { color: "#B8CBE2", fontFamily: "Changa", fontSize: 13, marginTop: 12 },
  cornerSlashOne: { position: "absolute" as const, width: 105, height: 15, backgroundColor: "#F7C928", top: 55, left: -25, transform: [{ rotate: "-48deg" }] },
  cornerSlashTwo: { position: "absolute" as const, width: 140, height: 12, backgroundColor: "#1760C0", top: 74, left: -40, transform: [{ rotate: "-48deg" }] },
  formSide: { flex: 0.97, minWidth: 450, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 32, paddingVertical: 44, backgroundColor: "#08244C" },
  formPanel: { width: "100%" as const, maxWidth: 500, borderWidth: 1, borderColor: "rgba(89,151,219,0.38)", backgroundColor: "rgba(5,29,67,0.86)", borderRadius: 22, paddingHorizontal: 34, paddingVertical: 29, shadowColor: "#020E22", shadowOpacity: 0.28, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 9 },
  compactPanel: { paddingHorizontal: 22, paddingVertical: 23 },
  languageRow: { flexDirection: "row" as const, justifyContent: "flex-end" as const, gap: 8, marginBottom: 23 },
  languageOption: { minHeight: 38, minWidth: 78, borderRadius: 10, borderWidth: 1, borderColor: "rgba(155,190,226,0.24)", alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 10 },
  languageSelected: { borderColor: "#F7C928", backgroundColor: "rgba(247,201,40,0.12)" },
  languageText: { color: "#D6E2F0", fontFamily: "Changa", fontSize: 14, fontWeight: "600" as const },
  languageSelectedText: { color: "#FFE27A" },
  headingBlock: { marginBottom: 24, alignItems: "flex-end" as const },
  alignLeft: { textAlign: "left" as const, alignSelf: "flex-start" as const },
  eyebrow: { color: "#EBCB62", fontFamily: "Changa", fontSize: 13, fontWeight: "600" as const, textAlign: "right" as const, marginBottom: 6 },
  heading: { color: "#FFFFFF", fontFamily: "Changa", fontSize: 27, lineHeight: 39, fontWeight: "800" as const, textAlign: "right" as const },
  intro: { color: "#BACBE0", fontFamily: "Changa", fontSize: 14, lineHeight: 24, textAlign: "right" as const, marginTop: 5 },
  fieldLabel: { color: "#EDF3FC", fontFamily: "Changa", fontSize: 14, fontWeight: "700" as const, textAlign: "right" as const },
  secondLabel: { marginTop: 16 },
  textInput: { width: "100%" as const, minHeight: 54, marginTop: 9, borderWidth: 1, borderColor: "rgba(85,156,234,0.58)", borderRadius: 13, paddingHorizontal: 15, backgroundColor: "rgba(7,34,76,0.9)", color: "#FFFFFF", textAlign: "right" as const, fontFamily: "Changa", fontSize: 15 },
  serialInput: { width: "100%" as const, minHeight: 58, marginTop: 9, borderWidth: 1, borderColor: "rgba(85,156,234,0.72)", borderRadius: 13, paddingHorizontal: 17, backgroundColor: "rgba(7,34,76,0.9)", color: "#FFFFFF", textAlign: "center" as const, fontFamily: "Changa", fontSize: 23, fontWeight: "700" as const, letterSpacing: 10 },
  fieldHint: { color: "#91A8C4", fontFamily: "Changa", fontSize: 12, textAlign: "right" as const, marginTop: 6 },
  submitButton: { minHeight: 56, borderRadius: 14, marginTop: 20, backgroundColor: "#F7C928", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, position: "relative" as const, paddingHorizontal: 24 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  disabled: { opacity: 0.58 },
  submitText: { color: "#122A4D", fontFamily: "Changa", fontWeight: "800" as const, fontSize: 16, textAlign: "center" as const },
  submitArrow: { color: "#122A4D", fontSize: 23, fontWeight: "700" as const, position: "absolute" as const, right: 18, top: 12 },
  errorText: { color: "#FFAAA2", fontFamily: "Changa", fontSize: 14, fontWeight: "600" as const, textAlign: "right" as const, marginTop: 13, lineHeight: 22 },
  modeSwitch: { alignSelf: "center" as const, paddingHorizontal: 12, paddingVertical: 12, marginTop: 4 },
  modeSwitchText: { color: "#F4D66E", fontFamily: "Changa", fontSize: 14, fontWeight: "600" as const, textAlign: "center" as const, textDecorationLine: "underline" as const, textDecorationColor: "rgba(244,214,110,0.4)" },
  securityNote: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginTop: 17, borderWidth: 1, borderColor: "rgba(247,201,40,0.22)", backgroundColor: "rgba(247,201,40,0.06)", borderRadius: 12, padding: 12 },
  securityIcon: { color: "#F7C928", fontSize: 22, fontWeight: "700" as const },
  securityCopy: { flex: 1, color: "#BDCCE0", fontFamily: "Changa", fontSize: 12, lineHeight: 20, textAlign: "right" as const },
  resultPanel: { alignItems: "center" as const, paddingTop: 5 },
  resultMark: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(247,201,40,0.14)", borderWidth: 1, borderColor: "rgba(247,201,40,0.5)", alignItems: "center" as const, justifyContent: "center" as const },
  resultMarkText: { color: "#F7C928", fontSize: 22, fontWeight: "800" as const },
  resultTitle: { color: "#DCE8F6", fontFamily: "Changa", fontSize: 14, textAlign: "center" as const, lineHeight: 23, marginTop: 14 },
  serialResult: { color: "#FFE27A", fontFamily: "Changa", fontSize: 32, fontWeight: "900" as const, letterSpacing: 9, marginVertical: 15 },
  footerRule: { flexDirection: "row" as const, alignItems: "center" as const, gap: 13, marginTop: 22 },
  rule: { flex: 1, height: 1, backgroundColor: "rgba(156,184,214,0.18)" },
  lockMark: { color: "#F7C928", fontSize: 22, fontWeight: "700" as const },
  backLink: { alignSelf: "center" as const, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 1 },
  backLinkText: { color: "#B9CBE1", fontFamily: "Changa", fontSize: 13, fontWeight: "600" as const },
  mobileLayout: { flexGrow: 1, alignItems: "center" as const, justifyContent: "center" as const, width: "100%" as const, paddingVertical: 20, position: "relative" as const },
  mobileBackdrop: { position: "absolute" as const, top: 0, left: 0, right: 0, height: 390, overflow: "hidden" as const },
  mobileBackdropImage: { opacity: 0.62 },
  mobileShade: { flex: 1, minHeight: "100%" as const },
  mobileBrand: { alignItems: "center" as const, marginTop: 0, marginBottom: 14 },
  mobileBrandName: { color: "#FFFFFF", fontFamily: "Changa", fontSize: 22, lineHeight: 30, fontWeight: "900" as const, letterSpacing: 1, marginTop: 7 },
  mobileDescriptor: { color: "#D1DDF0", fontFamily: "Changa", fontSize: 11, marginTop: 1, letterSpacing: 0.3 },
  mobileFooter: { color: "#B9CBE1", fontFamily: "Changa", fontSize: 13, marginTop: 17 },
};
