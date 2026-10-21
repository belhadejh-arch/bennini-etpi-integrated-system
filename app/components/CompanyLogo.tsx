import { Image, View } from "react-native";

type CompanyLogoProps = {
  width: number;
  height: number;
  framed?: boolean;
};

export function CompanyLogo({ width, height, framed = false }: CompanyLogoProps) {
  return (
    <View
      accessibilityLabel="شعار شركة BENNINI ETPI"
      style={{
        width: width + (framed ? 12 : 0),
        height: height + (framed ? 12 : 0),
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: framed ? 13 : 0,
        backgroundColor: framed ? "#08244C" : "transparent",
        borderWidth: framed ? 1 : 0,
        borderColor: framed ? "rgba(247,201,40,0.58)" : "transparent",
      }}
    >
      <Image
        source={require("../assets/brand-mark-cropped.png")}
        resizeMode="contain"
        style={{ width, height }}
        accessible={false}
        accessibilityLabel="شعار شركة BENNINI ETPI"
      />
    </View>
  );
}
