module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    clerkProxyUrl: process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined),
  },
});
