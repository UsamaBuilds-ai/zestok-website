import { Capacitor } from '@capacitor/core';

export async function discoverServers() {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await Capacitor.Plugins.Discovery.discoverServers();
      return result.servers || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function getLocalIp() {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await Capacitor.Plugins.Discovery.getLocalIp();
      return result.ip || '';
    }
    return '';
  } catch {
    return '';
  }
}
