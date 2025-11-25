// src/utils/validation.ts
import { HeartRateReading, DeviceInfo, BluetoothDevice } from '../types';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateHeartRate = (value: number): boolean => {
  return value >= 0 && value <= 300 && Number.isInteger(value);
};

export const validateHeartRateReading = (reading: any): reading is HeartRateReading => {
  if (!reading || typeof reading !== 'object') {
    throw new ValidationError('Reading must be an object');
  }

  if (!reading.id || typeof reading.id !== 'string') {
    throw new ValidationError('Reading must have a valid ID', 'id');
  }

  if (!reading.timestamp || !(reading.timestamp instanceof Date)) {
    throw new ValidationError('Reading must have a valid timestamp', 'timestamp');
  }

  if (!validateHeartRate(reading.heartRate)) {
    throw new ValidationError('Heart rate must be between 0 and 300', 'heartRate');
  }

  return true;
};

export const validateDeviceInfo = (device: any): device is DeviceInfo => {
  if (!device || typeof device !== 'object') {
    throw new ValidationError('Device must be an object');
  }

  if (!device.id || typeof device.id !== 'string') {
    throw new ValidationError('Device must have a valid ID', 'id');
  }

  if (!device.name || typeof device.name !== 'string') {
    throw new ValidationError('Device must have a valid name', 'name');
  }

  if (device.batteryLevel !== undefined) {
    if (typeof device.batteryLevel !== 'number' || 
        device.batteryLevel < 0 || 
        device.batteryLevel > 100) {
      throw new ValidationError('Battery level must be between 0 and 100', 'batteryLevel');
    }
  }

  return true;
};

export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const sanitizeHeartRateValue = (value: any): number => {
  const numValue = Number(value);
  if (isNaN(numValue)) return 0;
  return Math.max(0, Math.min(300, Math.round(numValue)));
};