// src/types/index.ts
export interface HeartRateReading {
  id: string;
  timestamp: Date;
  heartRate: number;
}

export interface HeartRateZone {
  name: string;
  color: string;
  range: string;
  description: string;
  minHR: number;
  maxHR: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  batteryLevel?: number;
  rssi?: number;
}

export interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
}

export interface ConnectionState {
  isConnected: boolean;
  isScanning: boolean;
  status: ConnectionStatus;
  connectedDevice?: DeviceInfo;
}

export type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'scanning'
  | 'bluetooth_off'
  | 'bluetooth_unavailable'
  | 'permission_denied'
  | 'scan_complete';

export interface BluetoothContextType {
  connectionState: ConnectionState;
  heartRate: number;
  discoveredDevices: BluetoothDevice[];
  startScanning: () => Promise<void>;
  stopScanning: () => void;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  recordCurrentHeartRate: () => void;
}

export interface DataManagerContextType {
  readings: HeartRateReading[];
  addReading: (heartRate: number) => Promise<void>;
  clearAllData: () => Promise<void>;
  getAverageHeartRate: () => number | null;
  getReadingsInRange: (hours: number) => HeartRateReading[];
}

// Error types for better error handling
export interface BluetoothError extends Error {
  code: 'PERMISSION_DENIED' | 'BLUETOOTH_OFF' | 'CONNECTION_FAILED' | 'SCAN_FAILED';
  originalError?: Error;
}

// Validation schemas
export const HeartRateReadingSchema = {
  validate: (data: any): data is HeartRateReading => {
    return (
      typeof data === 'object' &&
      typeof data.id === 'string' &&
      data.timestamp instanceof Date &&
      typeof data.heartRate === 'number' &&
      data.heartRate >= 0 &&
      data.heartRate <= 300
    );
  }
};

export const DeviceInfoSchema = {
  validate: (data: any): data is DeviceInfo => {
    return (
      typeof data === 'object' &&
      typeof data.id === 'string' &&
      typeof data.name === 'string' &&
      (data.batteryLevel === undefined || 
       (typeof data.batteryLevel === 'number' && 
        data.batteryLevel >= 0 && 
        data.batteryLevel <= 100))
    );
  }
};