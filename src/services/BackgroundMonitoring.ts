// BackgroundMonitoring.ts - Interface for Android Foreground Service
import { NativeModules, Platform } from 'react-native';

const { ForegroundServiceModule } = NativeModules;

export interface BackgroundMonitoringService {
  startMonitoring: () => Promise<string>;
  stopMonitoring: () => Promise<string>;
  isMonitoring: () => Promise<boolean>;
}

// Android-only implementation
const AndroidBackgroundMonitoring: BackgroundMonitoringService = {
  startMonitoring: async (): Promise<string> => {
    if (!ForegroundServiceModule) {
      throw new Error('ForegroundServiceModule not available');
    }
    await ForegroundServiceModule.startMonitoring();
    return 'Foreground service started - 24/7 monitoring active';
  },

  stopMonitoring: async (): Promise<string> => {
    if (!ForegroundServiceModule) {
      throw new Error('ForegroundServiceModule not available');
    }
    await ForegroundServiceModule.stopMonitoring();
    return 'Foreground service stopped';
  },

  isMonitoring: async (): Promise<boolean> => {
    if (!ForegroundServiceModule) {
      return false;
    }
    return ForegroundServiceModule.isMonitoring();
  },
};

// iOS/other platforms - stub implementation (no-op)
const StubBackgroundMonitoring: BackgroundMonitoringService = {
  startMonitoring: async (): Promise<string> => {
    console.log('Background monitoring not implemented for this platform');
    return 'Not supported';
  },

  stopMonitoring: async (): Promise<string> => {
    console.log('Background monitoring not implemented for this platform');
    return 'Not supported';
  },

  isMonitoring: async (): Promise<boolean> => {
    return false;
  },
};

// Export platform-specific implementation
export const BackgroundMonitoring: BackgroundMonitoringService =
  Platform.OS === 'android' ? AndroidBackgroundMonitoring : StubBackgroundMonitoring;
