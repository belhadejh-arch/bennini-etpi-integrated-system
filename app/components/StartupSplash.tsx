import { LinearGradient } from "expo-linear-gradient";
import { Image, Text, View, useWindowDimensions } from "react-native";

export function StartupSplash() {
  const { width } = useWindowDimensions();
  const markSize = Math.min(width * 0.42, 190);
  return (
    <View style={{ flex: 1, minHeight: "100%", backgroundColor: "#0B3F98", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      <LinearGradient
        colors={["#124FB0", "#0D429C", "#082D72"]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />
      <View style={{ position: "absolute", width: width * 1.12, height: width * 1.12, borderRadius: width, borderWidth: Math.max(30, width * 0.08), borderColor: "rgba(39,105,202,0.24)", top: -width * 0.72, left: -width * 0.58 }} />
      <View style={{ position: "absolute", width: width * 1.2, height: width * 1.2, borderRadius: width, borderWidth: Math.max(30, width * 0.09), borderColor: "rgba(35,101,201,0.22)", bottom: -width * 0.84, right: -width * 0.65 }} />
      <Image
        source={require("../assets/brand-mark-cropped.png")}
        resizeMode="contain"
        style={{ width: markSize, height: markSize * 0.84 }}
        accessibilityLabel="BENNINI ETPI"
      />
      <Text style={{ color: "#FFFFFF", fontSize: 23, fontWeight: "800", letterSpacing: 1.6, marginTop: 17 }}>BENNINI ETPI</Text>
      <View style={{ width: 34, height: 3, borderRadius: 4, backgroundColor: "#F7C928", marginTop: 18 }} />
    </View>
  );
}
