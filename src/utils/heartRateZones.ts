// src/utils/heartRateZones.ts
import { HeartRateZone } from '../types';

export const HEART_RATE_ZONES: HeartRateZone[] = [
  {
    name: 'No Signal',
    color: '#6B7280',
    range: '--',
    description: 'Connect your heart rate sensor to start monitoring',
    minHR: 0,
    maxHR: 0,
  },
  {
    name: 'Active Recovery',
    color: '#10B981',
    range: '50-60%',
    description: 'Light activity, promotes recovery and builds aerobic base.',
    minHR: 1,
    maxHR: 99,
  },
  {
    name: 'Fat Burn',
    color: '#06B6D4',
    range: '60-70%',
    description: 'Comfortable pace that builds aerobic fitness efficiently.',
    minHR: 100,
    maxHR: 119,
  },
  {
    name: 'Aerobic Base',
    color: '#F97316',
    range: '70-80%',
    description: 'Moderate intensity training that improves cardiovascular fitness.',
    minHR: 120,
    maxHR: 139,
  },
  {
    name: 'Lactate Threshold',
    color: '#EF4444',
    range: '80-90%',
    description: 'High intensity training that improves performance.',
    minHR: 140,
    maxHR: 159,
  },
  {
    name: 'Max Effort',
    color: '#8B5CF6',
    range: '90-100%',
    description: 'Maximum intensity for short bursts of power training.',
    minHR: 160,
    maxHR: 300,
  },
];

export const getHeartRateZone = (heartRate: number): HeartRateZone => {
  const zone = HEART_RATE_ZONES.find(
    zone => heartRate >= zone.minHR && heartRate <= zone.maxHR
  );
  
  return zone || HEART_RATE_ZONES[0]; // Fallback to 'No Signal'
};

export const getZoneColor = (heartRate: number): string => {
  return getHeartRateZone(heartRate).color;
};

export const getZoneName = (heartRate: number): string => {
  return getHeartRateZone(heartRate).name;
};

// Age-based max heart rate calculation (optional enhancement)
export const calculateMaxHeartRate = (age: number): number => {
  return Math.round(220 - age);
};

// Calculate target heart rate zones based on max HR
export const calculateTargetZones = (maxHR: number) => {
  return {
    zone1: { min: Math.round(maxHR * 0.5), max: Math.round(maxHR * 0.6) },
    zone2: { min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7) },
    zone3: { min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.8) },
    zone4: { min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9) },
    zone5: { min: Math.round(maxHR * 0.9), max: maxHR },
  };
};