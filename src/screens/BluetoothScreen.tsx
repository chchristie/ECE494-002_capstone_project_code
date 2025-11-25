// src/screens/BluetoothScreen.tsx - Simplified for Nordic connection only
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import type { BluetoothScreenProps } from '../types/simple-navigation';
import { useBluetooth } from '../context/BluetoothContext';
import { theme } from '../styles/theme';

// Simple device item component with battery indicator
const DeviceItem: React.FC<{
  device: any;
  onConnect: (id: string) => void;
  isConnecting: boolean;
  batteryLevel?: number | null;
}> = ({ device, onConnect, isConnecting, batteryLevel }) => (
  <View style={styles.deviceItem}>
    <View style={styles.deviceInfo}>
      <Text style={styles.deviceName}>{device.name}</Text>
      <View style={styles.deviceDetails}>
        <View style={styles.signalContainer}>
          <Icon name="signal-cellular-alt" size={14} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.deviceId}>{device.rssi}dBm</Text>
        </View>
        {batteryLevel !== null && batteryLevel !== undefined && (
          <View style={styles.batteryContainer}>
            <Icon
              name={batteryLevel > 20 ? "battery-full" : "battery-alert"}
              size={14}
              color={batteryLevel > 20 ? theme.colors.success : theme.colors.warning}
            />
            <Text style={styles.batteryText}>{batteryLevel}%</Text>
          </View>
        )}
      </View>
    </View>
    <TouchableOpacity
      style={[styles.connectButton, isConnecting && styles.connectingButton]}
      onPress={() => onConnect(device.id)}
      disabled={isConnecting}
    >
      {isConnecting ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <Text style={styles.connectButtonText}>Connect</Text>
      )}
    </TouchableOpacity>
  </View>
);

const BluetoothScreen: React.FC<BluetoothScreenProps> = ({ navigation }) => {
  const {
    state,
    sensorData,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    getNordicDevices,
  } = useBluetooth();

  const nordicDevices = getNordicDevices();
  const isConnected = state.connectedDevice !== null;

  // Auto-scan on mount
  useEffect(() => {
    if (!isConnected && !state.isScanning) {
      startScan();
    }
  }, []);

  const handleConnect = async (deviceId: string) => {
    // **FIXED: Removed duplicate subscription calls**
    // BluetoothContext now auto-subscribes in connectToDevice()
    const success = await connectToDevice(deviceId);
    if (success) {
      // Navigate back to main screen
      navigation.navigate('HeartRate');
    }
  };

  const handleDisconnect = async () => {
    await disconnectDevice();
  };

  const handleRefresh = () => {
    if (state.isScanning) {
      stopScan();
    } else {
      startScan();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('HeartRate')}>
          <Icon name="arrow-back" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Nordic Devices</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Icon name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

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

      {/* Scan Status */}
      <View style={styles.scanRow}>
        {state.isScanning && <ActivityIndicator size="small" color={theme.colors.primary} />}
        <Text style={styles.scanText}>
          {state.isScanning ? 'Scanning...' : `Found ${nordicDevices.length} Nordic devices`}
        </Text>
      </View>

      {/* Device List */}
      <FlatList
        data={nordicDevices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DeviceItem
            device={item}
            onConnect={handleConnect}
            isConnecting={state.isConnecting}
            batteryLevel={item.id === state.connectedDevice?.id ? sensorData.battery?.level : null}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {state.isScanning
                ? 'Searching for Nordic devices...'
                : 'No Nordic devices found. Tap refresh to scan again.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
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
    marginBottom: 16,
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
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.onErrorContainer,
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.onSurface,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
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
    marginTop: 2,
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
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default BluetoothScreen;
