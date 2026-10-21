import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme, View } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../lib/auth";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { useAuth } from "../lib/auth";
import { palettes } from "../lib/theme";
import { StartupSplash } from "./components/StartupSplash";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { isLoaded } = useAuth();
  const [fontsLoaded, fontError] = useFonts({ Changa: require("./assets/fonts/Changa.ttf") });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || !isLoaded) return <StartupSplash />;

  return (
    <View style={{ flex: 1, minHeight: "100%" }}>
      <AdaptiveStatusBar />
      <WorkspaceShell>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/sign-in" />
          <Stack.Screen name="(auth)/setup" />
          <Stack.Screen name="section/[section]" />
          <Stack.Screen name="members" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="notifications" />
        </Stack>
      </WorkspaceShell>
    </View>
  );
}

function AdaptiveStatusBar() {
  const { appearance } = useAuth();
  const system = useColorScheme();
  const dark = appearance === "dark" || (appearance === "system" && system === "dark");
  return <StatusBar style={dark ? "light" : "dark"} backgroundColor={dark ? palettes.dark.background : palettes.light.background} />;
}
