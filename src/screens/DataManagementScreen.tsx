// src/screens/DataManagementScreen.tsx - Premium data management interface
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataManager from '../services/DataManager';
import type { SimpleNavigationProps } from '../types/simple-navigation';
import { theme } from '../styles/theme';
import { useBluetooth } from '../context/BluetoothContext';

type DataManagementScreenProps = SimpleNavigationProps & {
  route: { name: 'DataManagement'; key: string; params: undefined };
};

interface DatabaseStats {
  totalReadings: number;
  totalSessions: number;
  oldestReading: Date | null;
  newestReading: Date | null;
  databaseSize: string;
  storageType: 'SQLite' | 'AsyncStorage';
}

const DataManagementScreen: React.FC<DataManagementScreenProps> = ({ navigation }) => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [showBluetoothSection, setShowBluetoothSection] = useState(false);
  const [bluetoothCheckLog, setBluetoothCheckLog] = useState<Array<{timestamp: Date, connected: boolean}>>([]);
  const [accelerometerEnabled, setAccelerometerEnabled] = useState(true);

  const {
    state,
    sensorData,
    isConnected,
    activeSessionId,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    getNordicDevices,
  } = useBluetooth();

  const nordicDevices = getNordicDevices();

  const loadStats = async () => {
    setLoading(true);
    try {
      const dbStats = await DataManager.getDatabaseStats();
      setStats(dbStats);
    } catch (error) {
      console.error('Failed to load database stats:', error);
      Alert.alert('Error', 'Failed to load database statistics');
    } finally {
      setLoading(false);
    }
  };

  // Load accelerometer setting from AsyncStorage
  const loadAccelerometerSetting = async () => {
    try {
      const stored = await AsyncStorage.getItem('accelerometer_enabled');
      if (stored !== null) {
        setAccelerometerEnabled(stored === 'true');
      }
    } catch (error) {
      console.error('Failed to load accelerometer setting:', error);
    }
  };

  // Save accelerometer setting to AsyncStorage
  const saveAccelerometerSetting = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem('accelerometer_enabled', enabled.toString());
    } catch (error) {
      console.error('Failed to save accelerometer setting:', error);
    }
  };

  // Handle accelerometer toggle
  const handleAccelerometerToggle = (value: boolean) => {
    setAccelerometerEnabled(value);
    saveAccelerometerSetting(value);
    
    if (value) {
      Alert.alert(
        'Accelerometer Enabled',
        'Accelerometer data will be collected on next connection. If already connected, please reconnect the device.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Accelerometer Disabled',
        'Accelerometer data will not be collected. This reduces battery usage and storage.',
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    loadStats();
    loadAccelerometerSetting();
  }, []);

  // Bluetooth connection checker - logs every 5 minutes
  useEffect(() => {
    const checkConnection = () => {
      const timestamp = new Date();
      const logEntry = {
        timestamp,
        connected: isConnected,
      };

      setBluetoothCheckLog(prev => {
        const updated = [...prev, logEntry];
        // Keep last 50 checks (up to ~4 hours of history)
        return updated.slice(-50);
      });

      // Console log for debugging (will appear in Metro logs)
      console.log(`[BT-CHECK ${timestamp.toLocaleTimeString()}] Bluetooth Connected: ${isConnected ? 'YES' : 'NO'}`);
    };

    // Initial check when component mounts
    checkConnection();

    // Set up 5-minute interval (300,000 ms)
    const intervalId = setInterval(checkConnection, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isConnected]);

  const handleCleanOldData = () => {
    Alert.alert(
      'Clean Old Data',
      'Delete readings older than 30 days? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedCount = await DataManager.cleanOldData(30);
              Alert.alert('Success', `Deleted ${deletedCount} old readings`);
              loadStats();
            } catch (error) {
              console.error('Cleanup failed:', error);
              Alert.alert('Error', 'Failed to clean old data');
            }
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'Delete ALL readings and sessions? This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await DataManager.cleanOldData(0); // Delete everything
              Alert.alert('Success', 'All data cleared');
              loadStats();
            } catch (error) {
              console.error('Clear failed:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handleConnect = async (deviceId: string) => {
    const success = await connectToDevice(deviceId);
    if (success) {
      setShowBluetoothSection(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectDevice();
  };

  const handleRefreshScan = () => {
    if (state.isScanning) {
      stopScan();
    } else {
      startScan();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="settings" size={40} color={theme.colors.primary} />
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Device connection and data management
          </Text>
        </View>

        {/* Bluetooth Connection Section */}
        <View style={styles.bluetoothSection}>
          <TouchableOpacity
            style={styles.sectionHeaderButton}
            onPress={() => setShowBluetoothSection(!showBluetoothSection)}
          >
            <View style={styles.sectionHeaderContent}>
              <Icon name="bluetooth" size={24} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Device Connection</Text>
            </View>
            <Icon
              name={showBluetoothSection ? "expand-less" : "expand-more"}
              size={24}
              color={theme.colors.onSurface}
            />
          </TouchableOpacity>

          {/* Connection Status */}
          {isConnected && state.connectedDevice && (
            <View style={styles.connectedCard}>
              <Icon name="bluetooth-connected" size={20} color={theme.colors.success} />
              <Text style={styles.connectedText}>
                Connected: {state.connectedDevice.name}
              </Text>
              <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectButton}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sensor Data Preview */}
          {isConnected && (sensorData.heartRate || sensorData.spO2) && (
            <View style={styles.sensorCard}>
              {sensorData.heartRate && (
                <Text style={styles.sensorText}>
                  Heart Rate: {sensorData.heartRate.heartRate} BPM
                </Text>
              )}
              {sensorData.spO2 && (
                <Text style={styles.sensorText}>
                  SpO2: {sensorData.spO2.spO2}%
                </Text>
              )}
            </View>
          )}

          {showBluetoothSection && (
            <View style={styles.bluetoothContent}>
              {/* Error Display */}
              {state.lastError && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{state.lastError}</Text>
                </View>
              )}

              {/* Bluetooth Status */}
              <View style={styles.statusRow}>
                <Icon
                  name={state.isEnabled ? "bluetooth" : "bluetooth-disabled"}
                  size={16}
                  color={state.isEnabled ? theme.colors.success : theme.colors.error}
                />
                <Text style={styles.statusText}>
                  Bluetooth: {state.isEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>

              {/* Scan Controls */}
              <View style={styles.scanControls}>
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={handleRefreshScan}
                >
                  <Icon name="refresh" size={20} color={theme.colors.primary} />
                  <Text style={styles.scanButtonText}>
                    {state.isScanning ? 'Stop Scan' : 'Scan for Devices'}
                  </Text>
                </TouchableOpacity>
                {state.isScanning && <ActivityIndicator size="small" color={theme.colors.primary} />}
                <Text style={styles.scanText}>
                  {state.isScanning ? 'Scanning...' : `Found ${nordicDevices.length} Nordic devices`}
                </Text>
              </View>

              {/* Device List */}
              {nordicDevices.length > 0 ? (
                nordicDevices.map((device) => (
                  <View key={device.id} style={styles.deviceItem}>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <View style={styles.deviceDetails}>
                        <View style={styles.signalContainer}>
                          <Icon name="signal-cellular-alt" size={14} color={theme.colors.onSurfaceVariant} />
                          <Text style={styles.deviceId}>{device.rssi}dBm</Text>
                        </View>
                        {device.id === state.connectedDevice?.id && sensorData.battery?.level !== undefined && (
                          <View style={styles.batteryContainer}>
                            <Icon
                              name={sensorData.battery.level > 20 ? "battery-full" : "battery-alert"}
                              size={14}
                              color={sensorData.battery.level > 20 ? theme.colors.success : theme.colors.warning}
                            />
                            <Text style={styles.batteryText}>{sensorData.battery.level}%</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.connectButton, state.isConnecting && styles.connectingButton]}
                      onPress={() => handleConnect(device.id)}
                      disabled={state.isConnecting}
                    >
                      {state.isConnecting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.connectButtonText}>Connect</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {state.isScanning
                      ? 'Searching for Nordic devices...'
                      : 'No Nordic devices found. Tap "Scan for Devices" to search.'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Sensor Settings Section */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Sensor Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon name="track-changes" size={24} color={theme.colors.primary} />
                <Text style={styles.settingTitle}>Accelerometer Data</Text>
              </View>
              <Text style={styles.settingDescription}>
                Collect 3-axis accelerometer data at ~100Hz. Disable to reduce battery usage and storage.
              </Text>
              <Text style={[styles.settingStatus, { 
                color: accelerometerEnabled ? theme.colors.success : theme.colors.outline 
              }]}>
                {accelerometerEnabled ? 'Enabled - Data will be collected' : 'Disabled - Not collecting data'}
              </Text>
            </View>
            <Switch
              value={accelerometerEnabled}
              onValueChange={handleAccelerometerToggle}
              trackColor={{ false: theme.colors.outline, true: theme.colors.primary }}
              thumbColor={accelerometerEnabled ? theme.colors.surface : theme.colors.surfaceVariant}
            />
          </View>
        </View>

        {/* Storage Stats */}
        {!loading && stats && (
          <>
            <View style={styles.statsCard}>
              <Text style={styles.sectionTitle}>Storage Statistics</Text>

              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Icon name="timeline" size={24} color={theme.colors.primary} />
                  <View style={styles.statContent}>
                    <Text style={styles.statValue}>{stats.totalReadings.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Total Readings</Text>
                  </View>
                </View>

                <View style={styles.statItem}>
                  <Icon name="folder" size={24} color={theme.colors.secondary} />
                  <View style={styles.statContent}>
                    <Text style={styles.statValue}>{stats.totalSessions}</Text>
                    <Text style={styles.statLabel}>Sessions</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Icon name="sd-storage" size={24} color={theme.colors.tertiary} />
                  <View style={styles.statContent}>
                    <Text style={styles.statValue}>{stats.databaseSize}</Text>
                    <Text style={styles.statLabel}>Database Size</Text>
                  </View>
                </View>

                <View style={styles.statItem}>
                  <Icon name="storage" size={24} color={theme.colors.success} />
                  <View style={styles.statContent}>
                    <Text style={styles.statValue}>{stats.storageType}</Text>
                    <Text style={styles.statLabel}>Storage Type</Text>
                  </View>
                </View>
              </View>

              <View style={styles.dateRange}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Oldest Reading</Text>
                  <Text style={styles.dateValue}>{formatDate(stats.oldestReading)}</Text>
                </View>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Newest Reading</Text>
                  <Text style={styles.dateValue}>{formatDate(stats.newestReading)}</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsSection}>
              <Text style={styles.sectionTitle}>Data Actions</Text>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Sessions')}
              >
                <Icon name="event-note" size={24} color={theme.colors.secondary} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>View Sessions</Text>
                  <Text style={styles.actionSubtitle}>
                    Manage and export monitoring sessions
                  </Text>
                </View>
                <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={loadStats}>
                <Icon name="refresh" size={24} color={theme.colors.secondary} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Refresh Statistics</Text>
                  <Text style={styles.actionSubtitle}>
                    Update storage statistics
                  </Text>
                </View>
                <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={styles.dangerSection}>
              <Text style={styles.sectionTitle}>Danger Zone</Text>

              <TouchableOpacity
                style={[styles.actionButton, styles.warningButton]}
                onPress={handleCleanOldData}
              >
                <Icon name="delete-sweep" size={24} color={theme.colors.error} />
                <View style={styles.actionContent}>
                  <Text style={[styles.actionTitle, styles.warningText]}>
                    Clean Old Data
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    Delete readings older than 30 days
                  </Text>
                </View>
                <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={handleClearAllData}
              >
                <Icon name="delete-forever" size={24} color={theme.colors.error} />
                <View style={styles.actionContent}>
                  <Text style={[styles.actionTitle, styles.dangerText]}>
                    Clear All Data
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    Permanently delete all stored data
                  </Text>
                </View>
                <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Debug Section */}
            <View style={styles.debugSection}>
              <TouchableOpacity
                style={styles.debugHeader}
                onPress={() => setShowDebug(!showDebug)}
              >
                <View style={styles.debugHeaderContent}>
                  <Icon name="bug-report" size={24} color={theme.colors.tertiary} />
                  <Text style={styles.sectionTitle}>Debug Panel</Text>
                </View>
                <Icon
                  name={showDebug ? "expand-less" : "expand-more"}
                  size={24}
                  color={theme.colors.onSurface}
                />
              </TouchableOpacity>

              {showDebug && (
                <View style={styles.debugContent}>
                  {/* System Status */}
                  <View style={styles.debugCard}>
                    <Text style={styles.debugCardTitle}>System Status</Text>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>BLE Connected:</Text>
                      <Text style={[styles.debugValue, {
                        color: isConnected ? theme.colors.success : theme.colors.error
                      }]}>
                        {isConnected ? '✓ Yes' : '✗ No'}
                      </Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Connected Device:</Text>
                      <Text style={styles.debugValue}>
                        {state.connectedDevice?.name || 'None'}
                      </Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Active Session:</Text>
                      <Text style={styles.debugValue}>
                        {activeSessionId ? activeSessionId.substring(0, 16) + '...' : 'None'}
                      </Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Storage Type:</Text>
                      <Text style={styles.debugValue}>{stats?.storageType || 'Unknown'}</Text>
                    </View>
                  </View>

                  {/* Sensor Data */}
                  <View style={styles.debugCard}>
                    <Text style={styles.debugCardTitle}>Live Sensor Data</Text>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Heart Rate:</Text>
                      <Text style={styles.debugValue}>
                        {sensorData.heartRate?.heartRate || '--'} BPM
                      </Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>SpO2:</Text>
                      <Text style={styles.debugValue}>
                        {sensorData.spO2?.spO2 ? `${sensorData.spO2.spO2}%` : '--'}
                      </Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Battery:</Text>
                      <Text style={styles.debugValue}>
                        {sensorData.battery?.level !== undefined ? `${sensorData.battery.level}%` : '--'}
                      </Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Data Rate:</Text>
                      <Text style={styles.debugValue}>
                        {sensorData.dataRate || 0} readings/sec
                      </Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Total Readings:</Text>
                      <Text style={styles.debugValue}>{sensorData.totalReadings || 0}</Text>
                    </View>
                    <View style={styles.debugRow}>
                      <Text style={styles.debugLabel}>Last Update:</Text>
                      <Text style={styles.debugValue}>
                        {sensorData.lastUpdate.toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>

                  {/* Bluetooth Connection Checker (5-minute interval) */}
                  <View style={styles.debugCard}>
                    <View style={styles.debugCardHeader}>
                      <Text style={styles.debugCardTitle}>Bluetooth Checker (Every 5 Minutes)</Text>
                      <TouchableOpacity onPress={() => setBluetoothCheckLog([])}>
                        <Text style={styles.clearLogsText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.logsContainer} nestedScrollEnabled>
                      {bluetoothCheckLog.length === 0 ? (
                        <Text style={styles.noLogsText}>Waiting for first check...</Text>
                      ) : (
                        <>
                          <View style={styles.btCheckSummary}>
                            <Text style={styles.btCheckSummaryText}>
                              Total Checks: {bluetoothCheckLog.length} | Connected: {bluetoothCheckLog.filter(l => l.connected).length} | Disconnected: {bluetoothCheckLog.filter(l => !l.connected).length}
                            </Text>
                          </View>
                          {bluetoothCheckLog.slice().reverse().map((entry, index) => (
                            <View key={index} style={styles.btCheckEntry}>
                              <Text style={styles.btCheckTime}>
                                {entry.timestamp.toLocaleTimeString()}
                              </Text>
                              <Text style={[styles.btCheckStatus, {
                                color: entry.connected ? theme.colors.success : theme.colors.error
                              }]}>
                                {entry.connected ? '✓ YES' : '✗ NO'}
                              </Text>
                            </View>
                          ))}
                        </>
                      )}
                    </ScrollView>
                  </View>

                </View>
              )}
            </View>
          </>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading statistics...</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
  },
  settingsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginLeft: 12,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.colors.outline,
    lineHeight: 18,
    marginBottom: 6,
  },
  settingStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  dateRange: {
    borderTopWidth: 1,
    borderTopColor: `${theme.colors.outline}30`,
    paddingTop: 16,
    gap: 12,
  },
  dateItem: {
    gap: 4,
  },
  dateLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 14,
    color: theme.colors.onSurface,
  },
  actionsSection: {
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    elevation: 1,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  actionSubtitle: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  dangerSection: {
    marginBottom: 32,
  },
  warningButton: {
    borderWidth: 1,
    borderColor: `${theme.colors.error}30`,
  },
  warningText: {
    color: theme.colors.error,
  },
  dangerButton: {
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  dangerText: {
    color: theme.colors.error,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  debugSection: {
    marginTop: 24,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    padding: 16,
    borderRadius: 12,
    marginBottom: 2,
  },
  debugHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debugContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  debugCard: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.tertiary,
  },
  debugCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  debugCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  debugLabel: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    flex: 0.6,
  },
  debugValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
    flex: 1.4,
    textAlign: 'right',
  },
  logsContainer: {
    maxHeight: 200,
    backgroundColor: theme.colors.background,
    borderRadius: 4,
    padding: 8,
  },
  logText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  noLogsText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  clearLogsText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  bluetoothSection: {
    marginBottom: 16,
  },
  sectionHeaderButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bluetoothContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  connectedText: {
    flex: 1,
    marginLeft: 8,
    color: theme.colors.onSuccessContainer,
    fontWeight: '500',
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: theme.colors.error,
    borderRadius: 4,
  },
  disconnectText: {
    color: theme.colors.onError,
    fontSize: 12,
    fontWeight: '500',
  },
  sensorCard: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  sensorText: {
    fontSize: 14,
    color: theme.colors.onSurface,
    fontWeight: '500',
  },
  errorCard: {
    backgroundColor: theme.colors.errorContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: theme.colors.onErrorContainer,
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.onSurface,
  },
  scanControls: {
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  scanText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.onSurface,
  },
  deviceId: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  connectButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  connectingButton: {
    backgroundColor: theme.colors.inactive,
  },
  connectButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    textAlign: 'center',
  },
  btCheckSummary: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  btCheckSummaryText: {
    fontSize: 11,
    color: theme.colors.onSurface,
    fontWeight: '600',
    textAlign: 'center',
  },
  btCheckEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  btCheckTime: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.onSurfaceVariant,
    flex: 1,
  },
  btCheckStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    minWidth: 60,
    textAlign: 'right',
  },
});

export default DataManagementScreen;
