import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockmgmt.mobile',
  appName: 'Stock Management',
  webDir: 'dist',
  server: {
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
