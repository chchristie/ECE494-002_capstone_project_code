import React from 'react';

// Simple navigation types for the current mock navigation setup

export interface SimpleNavigation {
  navigate: (routeName: string) => void;
  goBack: () => void;
  canGoBack: () => boolean;
}

export interface SimpleRoute {
  name: string;
  key: string;
  params?: any;
}

export interface SimpleNavigationProps {
  navigation: SimpleNavigation;
  route: SimpleRoute;
}

// Screen component props type
export interface ScreenProps extends SimpleNavigationProps {
  // Add any additional props that screens might need
}

// Specific screen props types
export interface BluetoothScreenProps extends SimpleNavigationProps {}

export interface HeartRateScreenProps extends SimpleNavigationProps {}

export interface TrendsScreenProps extends SimpleNavigationProps {}

export type TabName = 'HeartRate' | 'Accelerometer' | 'Trends' | 'Bluetooth' | 'DataManagement';

// Mock React Navigation hooks for compatibility
export const useFocusEffect = (callback: () => void) => {
  // Mock implementation - just call the callback once
  React.useEffect(() => {
    callback();
  }, []);
};