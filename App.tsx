// App.tsx - Enhanced with SQLite DataManager initialization
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import your existing screens
import DashboardScreen from './src/screens/DashboardScreen';
import HeartRateScreen from './src/screens/HeartRateScreen';
import AccelerometerScreen from './src/screens/AccelerometerScreen';
import TrendsScreen from './src/screens/TrendsScreen';
import DataManagementScreen from './src/screens/DataManagementScreen';
import SessionsScreen from './src/screens/SessionsScreen';

// Import components
import ErrorBoundary from './src/components/ErrorBoundary';
import { BluetoothProvider } from './src/context/BluetoothContext';
import BluetoothContext from './src/context/BluetoothContext';

const BluetoothConsumer = BluetoothContext.Consumer;

// Import enhanced DataManager (case-sensitive fix)
import DataManager from './src/services/DataManager';

// Import theme
import { theme } from './src/styles/theme';

// Import types
import type { SimpleNavigationProps } from './src/types/simple-navigation';

// Type definitions
type TabName = 'Dashboard' | 'HeartRate' | 'Accelerometer' | 'Trends' | 'Bluetooth' | 'DataManagement' | 'Sessions';

interface TabConfig {
  name: TabName;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
}

// Tab configuration - Max 4 tabs for optimal UX (industry best practice)
const tabs: TabConfig[] = [
  {
    name: 'Dashboard',
    label: 'Home',
    icon: 'home',
    component: DashboardScreen,
  },
  {
    name: 'HeartRate',
    label: 'Activity',
    icon: 'favorite',
    component: HeartRateScreen,
  },
  {
    name: 'Trends',
    label: 'Trends',
    icon: 'insights',
    component: TrendsScreen,
  },
  {
    name: 'Accelerometer',
    label: 'Motion',
    icon: 'directions-run',
    component: AccelerometerScreen,
  },
];

// Premium tab bar button with Apple Fitness+ style
const TabButton: React.FC<{
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
}> = ({ tab, isActive, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.tabButton}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
    >
      <View style={styles.tabContent}>
        <Icon
          name={tab.icon}
          size={26}
          color={isActive ? theme.colors.primary : theme.colors.inactive}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: isActive ? theme.colors.primary : theme.colors.inactive,
              fontWeight: isActive ? '600' : '400',
            }
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Component wrapper to safely pass props
const ScreenWrapper: React.FC<{
  Component: React.ComponentType<any>;
  navigation: SimpleNavigationProps['navigation'];
  route: SimpleNavigationProps['route'];
}> = ({ Component, navigation, route }) => {
  try {
    return <Component navigation={navigation} route={route} />;
  } catch (error) {
    console.error('Screen rendering error:', error);
    return (
      <View style={styles.errorFallback}>
        <Text style={styles.errorText}>Unable to load screen</Text>
      </View>
    );
  }
};

// Loading screen component
const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={theme.colors.primary} />
    <Text style={styles.loadingText}>Initializing database...</Text>
  </View>
);

// Connection status badge component
const ConnectionStatusBadge: React.FC<{ isConnected: boolean }> = ({ isConnected }) => {
  if (!isConnected) return null;

  return (
    <View style={styles.connectionBadge}>
      <View style={styles.connectionDot} />
      <Text style={styles.connectionText}>Connected</Text>
    </View>
  );
};

// Main App component
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('Dashboard');
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize SQLite database on app startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing SQLite DataManager...');
        await DataManager.initialize();
        console.log('DataManager initialized successfully');

        // Small delay to ensure smooth transition
        setTimeout(() => {
          setIsInitializing(false);
        }, 500);

      } catch (error) {
        console.error('Failed to initialize DataManager:', error);
        setInitError('Failed to initialize database. The app may not function properly.');
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.surface}
        />
        <LoadingScreen />
      </View>
    );
  }

  // Get the active screen component (including DataManagement, Sessions, and Accelerometer)
  const activeTabConfig = tabs.find(tab => tab.name === activeTab);
  const ActiveScreenComponent = activeTabConfig?.component ||
    (activeTab === 'DataManagement' ? DataManagementScreen :
     activeTab === 'Sessions' ? SessionsScreen :
     activeTab === 'Accelerometer' ? AccelerometerScreen :
     DashboardScreen);

  // Create mock navigation prop for screens
  const mockNavigation = {
    navigate: (routeName: string) => {
      console.log('Navigation called:', routeName);
      if (routeName === 'Dashboard' || routeName === 'HeartRate' || routeName === 'Trends' ||
          routeName === 'Accelerometer' || routeName === 'DataManagement' || routeName === 'Sessions') {
        setActiveTab(routeName as TabName);
      }
    },
    goBack: () => {
      setActiveTab('Dashboard');
    },
    canGoBack: () => activeTab !== 'Dashboard',
  };

  // Mock route prop
  const mockRoute = {
    name: activeTab,
    key: activeTab,
    params: undefined,
  };

  const handleTabPress = (tabName: TabName) => {
    console.log('handleTabPress called:', tabName);
    setActiveTab(tabName);
  };

  return (
    <ErrorBoundary>
      <BluetoothProvider>
        <BluetoothConsumer>
          {(bluetoothContext) => (
            <View style={styles.container}>
              <StatusBar
                barStyle="dark-content"
                backgroundColor={theme.colors.surface}
              />

              <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>
                      {activeTab === 'Dashboard' ? 'Dashboard' :
                       activeTab === 'HeartRate' ? 'Activity' :
                       activeTab === 'Trends' ? 'Trends' :
                       activeTab === 'Accelerometer' ? 'Motion' :
                       activeTab === 'DataManagement' ? 'Settings' :
                       activeTab === 'Sessions' ? 'Sessions' :
                       'Home'}
                    </Text>
                    <ConnectionStatusBadge isConnected={bluetoothContext?.isConnected || false} />
                  </View>
                  {/* Settings button for Data Management */}
                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => setActiveTab('DataManagement')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="settings" size={24} color={theme.colors.onSurface} />
                  </TouchableOpacity>
                  {initError && (
                    <View style={styles.warningIndicator}>
                      <Icon name="warning" size={20} color={theme.colors.warning} />
                    </View>
                  )}
                </View>

                {/* Initialization error message */}
                {initError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{initError}</Text>
                  </View>
                )}

                {/* Screen Content */}
                <View style={styles.screenContainer}>
                  <ScreenWrapper
                    Component={ActiveScreenComponent}
                    navigation={mockNavigation}
                    route={mockRoute}
                  />
                </View>
              </SafeAreaView>

              {/* Tab Bar - Outside SafeAreaView to prevent clipping */}
              <View style={styles.tabBar}>
                {tabs.map((tab) => (
                  <TabButton
                    key={tab.name}
                    tab={tab}
                    isActive={activeTab === tab.name}
                    onPress={() => handleTabPress(tab.name)}
                  />
                ))}
              </View>

              {/* Bottom safe area for devices with home indicator */}
              <View style={styles.bottomSafeArea} />
            </View>
          )}
        </BluetoothConsumer>
      </BluetoothProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.onSurface,
    letterSpacing: -0.5,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  settingsButton: {
    position: 'absolute',
    right: 20,
    padding: 8,
    borderRadius: 8,
  },
  warningIndicator: {
    position: 'absolute',
    right: 20,
  },
  errorBanner: {
    backgroundColor: theme.colors.warningContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  errorBannerText: {
    fontSize: 12,
    color: theme.colors.onWarningContainer,
    textAlign: 'center',
  },
  screenContainer: {
    flex: 1,
  },
  errorFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.outline,
    paddingVertical: 12,
    paddingHorizontal: 8,
    paddingBottom: 20,
    elevation: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    minHeight: 72,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 48,
  },
  tabContentActive: {
    // Removed - color handled dynamically
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.3,
    marginTop: 2,
    textAlign: 'center',
  },
  bottomSafeArea: {
    backgroundColor: theme.colors.surface,
    paddingBottom: 8, // Extra padding for devices with home indicator
  },
});

export default App;
