import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { View, Text } from "react-native";
import { colors } from "../lib/theme";

const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined;
const clerkProxyUrl = Constants.expoConfig?.extra?.clerkProxyUrl as string | undefined;

export default function RootLayout() {
  if (!publishableKey) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: colors.background }}>
        <Text style={{ color: colors.ink, textAlign: "center", lineHeight: 24 }}>
          إعداد تسجيل الدخول غير مكتمل. تحقق من إعداد Clerk في بيئة التشغيل.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={clerkProxyUrl}
    >
      <StatusBar style="light" backgroundColor={colors.navy} />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/sign-up" />
        <Stack.Screen name="section/[section]" />
        <Stack.Screen name="members" />
      </Stack>
    </ClerkProvider>
  );
}
