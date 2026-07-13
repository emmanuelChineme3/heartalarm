import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.heartalarm.app",
  appName: "Heart Alarm",
  // The Android shell loads the live PWA so every web release ships instantly.
  // To ship a fully offline build, remove `server.url` and run `bunx cap sync`
  // after `bun run build` — the `dist/` folder is used as `webDir`.
  webDir: "dist",
  server: {
    url: "https://heartalarm.lovable.app",
    androidScheme: "https",
    cleartext: false,
    errorPath: "error.html",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#1a0610",
      showSpinner: false,
      androidSplashResourceName: "splash",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      backgroundColor: "#1a0610",
      style: "DARK",
    },
  },
};

export default config;
