import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nathanvans.picklerankings',
  appName: 'Pickle Rankings',
  webDir: 'dist',
  server: {
    allowNavigation: ['pickle-rankings.vercel.app', '*.vercel-storage.com'],
  },
  ios: {
    backgroundColor: '#09090b',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#4ade80',
    },
  },
};

export default config;
