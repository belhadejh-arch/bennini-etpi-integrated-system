import { Image, View } from "react-native";
import { useAuth } from "../../lib/auth";

type CompanyLogoProps = {
  width: number;
  height: number;
  framed?: boolean;
};

export function CompanyLogo({ width, height, framed = false }: CompanyLogoProps) {
  const { isDark } = useAuth();
  return (
    <View
      accessibilityLabel="شعار شركة BENNINI ETPI"
      style={[
        (framed || isDark) && {
          width: width + 10,
          height: height + 8,
          paddingHorizontal: 5,
          paddingVertical: 4,
          borderRadius: 9,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Image
        source={require("../assets/company-logo.png")}
        resizeMode="contain"
        style={{ width, height }}
        accessibilityLabel="شعار شركة BENNINI ETPI"
      />
    </View>
  );
}
