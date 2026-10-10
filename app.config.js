module.exports = ({ config }) => {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
    (process.env.VERCEL ? "https://bennini-etpi.onrender.com" : undefined);

  if (process.env.VERCEL && !configuredApiUrl) {
    throw new Error("Set EXPO_PUBLIC_API_URL to the deployed Render API URL in Vercel.");
  }
  if (configuredApiUrl) {
    const parsedApiUrl = new URL(configuredApiUrl);
    if (process.env.VERCEL && parsedApiUrl.protocol !== "https:") {
      throw new Error("EXPO_PUBLIC_API_URL must use HTTPS on Vercel.");
    }
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      webApiUrl: configuredApiUrl,
      apiUrl: configuredApiUrl ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined),
    },
  };
};
