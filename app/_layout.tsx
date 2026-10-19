import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../lib/auth";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { useAuth } from "../lib/auth";
import { palettes } from "../lib/theme";
import { useColorScheme } from "react-native";

export default function RootLayout() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

function AdaptiveStatusBar() {
  const { appearance } = useAuth();
  const system = useColorScheme();
  const dark = appearance === "dark" || (appearance === "system" && system === "dark");
  return <StatusBar style={dark ? "light" : "dark"} backgroundColor={dark ? palettes.dark.background : palettes.light.background} />;
}
