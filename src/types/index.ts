// src/types/index.ts
// Core type definitions used across the application

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