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
      style={{ width: width + (framed ? 8 : 0), height: height + (framed ? 8 : 0), alignItems: "center", justifyContent: "center" }}
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
