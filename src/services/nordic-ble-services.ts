// Nordic nRF52840 + SeedStudio Heart Rate & SpO2 Sensor
// BLE GATT Services and Characteristics - Complete Corrected Version

// Standard BLE Service UUIDs (16-bit format)
export const STANDARD_SERVICES = {
  HEART_RATE: '180D',
  DEVICE_INFORMATION: '180A',
  BATTERY_SERVICE: '180F',
  PULSE_OXIMETER: '1822', // Standard SpO2 service
  MOTION_SERVICE: '1819', // Standard Motion/Movement service
} as const;

// Standard BLE Characteristic UUIDs (16-bit format)
export const STANDARD_CHARACTERISTICS = {
  // Heart Rate Service
  HEART_RATE_MEASUREMENT: '2A37',
  BODY_SENSOR_LOCATION: '2A38',
  HEART_RATE_CONTROL_POINT: '2A39',
  
  // Battery Service
  BATTERY_LEVEL: '2A19',
  
  // Device Information Service
  MANUFACTURER_NAME: '2A29',
  MODEL_NUMBER: '2A24',
  SERIAL_NUMBER: '2A25',
  FIRMWARE_REVISION: '2A26',
  HARDWARE_REVISION: '2A27',
  
  // Pulse Oximeter Service (if using standard)
  PLX_SPOT_CHECK_MEASUREMENT: '2A5E',
  PLX_CONTINUOUS_MEASUREMENT: '2A5F',
  PLX_FEATURES: '2A60',

  // Motion/Accelerometer Service
  ACCELEROMETER: '2A5C', // Generic sensor characteristic
  SENSOR_LOCATION: '2A5D',
} as const;

// SeedStudio Custom Service UUIDs (corrected based on documentation)
export const SEEDSTUDIO_SERVICES = {
  // Primary Seeed Studio service pattern (from MR60BHA1/MR60BHA2 examples)
  RADAR_SERVICE: '19B10000-E8F2-537E-4F6C-D104768A1214',

  // Nordic UART Service (common fallback for Nordic devices)
  NORDIC_UART: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',

  // Custom Accelerometer Service (from Arduino code)
  ACCELEROMETER_SERVICE: '85B49381-5840-0CBE-D14D-0000-0000-00C4-52',

  // Alternative short UUID patterns (if device uses these)
  SENSOR_DATA: 'FF10',
  CONFIGURATION: 'FF20',
} as const;

export const SEEDSTUDIO_CHARACTERISTICS = {
  // Primary Seeed Studio characteristic (documented pattern)
  SENSOR_DATA: '19B10001-E8F2-537E-4F6C-D104768A1214',

  // Nordic UART characteristics (common on nRF52840 devices)
  UART_TX: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E', // Device to phone
  UART_RX: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E', // Phone to device

  // Time synchronization characteristic (phone writes timestamp to Arduino)
  TIME_SYNC: '6E400010-B5A3-F393-E0A9-E50E24DCCA9E',

  // Additional custom characteristics
  SPO2_DATA: 'FF11',
  SENSOR_CONFIG: 'FF21',
  CALIBRATION: 'FF22',

  // Accelerometer custom characteristic (if not using standard)
  ACCELEROMETER_DATA: 'FF12',

  // Custom Accelerometer X, Y, Z characteristics (from Arduino code)
  ACCEL_X: '85B49381-5840-0CBE-D14D-0030-0000-00C4-52',
  ACCEL_Y: '85B49381-5840-0CBE-D14D-0060-0000-00C4-52',
  ACCEL_Z: '85B49381-5840-0CBE-D14D-0090-0000-00C4-52',
} as const;

// Complete service map for Nordic device detection
export const NORDIC_DEVICE_PROFILE = {
  // Required services (must have at least one)
  requiredServices: [
    STANDARD_SERVICES.HEART_RATE,
    SEEDSTUDIO_SERVICES.RADAR_SERVICE,
    SEEDSTUDIO_SERVICES.NORDIC_UART,
  ],
  
  // Optional services (nice to have)
  optionalServices: [
    STANDARD_SERVICES.BATTERY_SERVICE,
    STANDARD_SERVICES.DEVICE_INFORMATION,
    STANDARD_SERVICES.PULSE_OXIMETER,
  ],
  
  // Nordic manufacturer data indicators
  manufacturerIndicators: {
    nordicCompanyId: 0x0059, // Nordic Semiconductor company identifier
    seedStudioPatterns: ['SeedStudio', 'Grove', 'HeartRate', 'SpO2', 'MR60BHA'],
  },
} as const;

// Data parsing interfaces following user's TypeScript strict preferences
export interface HeartRateData {
  heartRate: number;          // BPM (beats per minute)
  contactDetected: boolean;   // Sensor contact with skin
  energyExpended?: number;    // Optional energy in kJ
  rrIntervals?: number[];     // R-R intervals for HRV analysis
  timestamp: Date;
  deviceId: string;
}

export interface SpO2Data {
  spO2: number;               // Oxygen saturation percentage
  pulseRate: number;          // Pulse rate from SpO2 sensor
  timestamp: Date;
  deviceId: string;
  perfusionIndex?: number;    // Optional perfusion index
}

export interface BatteryData {
  level: number;              // 0-100%
  isCharging?: boolean;
  timestamp: Date;
  deviceId: string;
}

export interface AccelerometerData {
  // Raw sensor values (int16 from Arduino)
  raw_x: number;              // Raw X-axis value (-32768 to +32767)
  raw_y: number;              // Raw Y-axis value (-32768 to +32767)
  raw_z: number;              // Raw Z-axis value (-32768 to +32767)

  // Calculated values (app-side processing)
  x: number;                  // X-axis acceleration (m/s² or g)
  y: number;                  // Y-axis acceleration
  z: number;                  // Z-axis acceleration
  magnitude: number;          // Vector magnitude

  // Metadata
  timestamp: Date;
  deviceId: string;
  sampleRate?: number;        // Samples per second
  unit: 'g' | 'ms2';         // Gravity units or m/s²
}

export interface DeviceInformation {
  manufacturerName?: string;
  modelNumber?: string;
  serialNumber?: string;
  firmwareRevision?: string;
  hardwareRevision?: string;
}

export interface CombinedSensorReading {
  heartRate?: HeartRateData;
  spO2?: SpO2Data;
  battery?: BatteryData;
  accelerometer?: AccelerometerData;
  deviceInfo?: DeviceInformation;
  connectionStrength: number; // RSSI in dBm
  timestamp: Date;
}

// Type guards for data validation (following user's preference for validation layer)
export const isValidHeartRateData = (data: unknown): data is HeartRateData => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as HeartRateData).heartRate === 'number' &&
    typeof (data as HeartRateData).contactDetected === 'boolean'
  );
};

export const isValidSpO2Data = (data: unknown): data is SpO2Data => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as SpO2Data).spO2 === 'number' &&
    typeof (data as SpO2Data).pulseRate === 'number'
  );
};

export const isValidAccelerometerData = (data: unknown): data is AccelerometerData => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as AccelerometerData).x === 'number' &&
    typeof (data as AccelerometerData).y === 'number' &&
    typeof (data as AccelerometerData).z === 'number' &&
    typeof (data as AccelerometerData).magnitude === 'number' &&
    !isNaN((data as AccelerometerData).x) &&
    !isNaN((data as AccelerometerData).y) &&
    !isNaN((data as AccelerometerData).z)
  );
};

// BLE data parsing utilities
export class NordicDataParser {
  // Enhanced method to parse Seeed Studio custom data format
  static parseSeedStudioData(data: Uint8Array, deviceId: string): CombinedSensorReading | null {
    if (data.length < 3) return null;
    
    try {
      // Check for Seeed Studio protocol headers (from MR60BHA documentation)
      const header1 = data[0];
      const header2 = data[1];
      
      if (header1 === 0x53 && header2 === 0x59) {
        // This matches Seeed Studio protocol format
        return this.parseSeedStudioProtocol(data, deviceId);
      }
      
      // Try parsing as raw sensor data
      return this.parseRawSensorData(data, deviceId);
    } catch (error) {
      console.error('SeedStudio data parsing error:', error);
      return null;
    }
  }
  
  private static parseSeedStudioProtocol(data: Uint8Array, deviceId: string): CombinedSensorReading | null {
    // Implementation based on Seeed Studio MR60BHA protocol
    // MESSAGE_HEAD1: 0x53, MESSAGE_HEAD2: 0x59
    // HEART_INF: 0x85, HEART_RATE: 0x02
    
    if (data.length < 6) return null;
    
    let heartRateData: HeartRateData | undefined;
    let spO2Data: SpO2Data | undefined;
    
    // Parse according to Seeed Studio frame format
    for (let i = 2; i < data.length - 2; i++) {
      if (data[i] === 0x85 && data[i + 1] === 0x02) {
        // Heart rate data found
        if (i + 3 < data.length) {
          const heartRate = data[i + 2];
          heartRateData = {
            heartRate,
            contactDetected: true,
            timestamp: new Date(),
            deviceId,
          };
        }
      }
      // Add other data types as needed (SpO2, breathing rate, etc.)
    }
    
    return {
      heartRate: heartRateData,
      spO2: spO2Data,
      connectionStrength: -50, // Mock RSSI
      timestamp: new Date(),
    };
  }
  
  private static parseRawSensorData(data: Uint8Array, deviceId: string): CombinedSensorReading | null {
    // Fallback parsing for simple data formats
    if (data.length >= 2) {
      const heartRate = data[0];
      const spO2 = data.length > 1 ? data[1] : undefined;
      
      let heartRateData: HeartRateData | undefined;
      let spO2Data: SpO2Data | undefined;
      
      heartRateData = {
        heartRate,
        contactDetected: true,
        timestamp: new Date(),
        deviceId,
      };
      
      if (spO2 !== undefined) {
        spO2Data = {
          spO2,
          pulseRate: heartRate,
          timestamp: new Date(),
          deviceId,
        };
      }
      
      return {
        heartRate: heartRateData,
        spO2: spO2Data,
        connectionStrength: -50,
        timestamp: new Date(),
      };
    }
    
    return null;
  }
  
  // Parse standard heart rate measurement (Bluetooth SIG specification)
  static parseHeartRateData(data: Uint8Array, deviceId: string): HeartRateData | null {
    if (data.length < 2) return null;
    
    try {
      const flags = data[0];
      const hrFormat16Bit = (flags & 0x01) !== 0;
      const contactDetected = (flags & 0x06) === 0x06;
      const energyExpendedPresent = (flags & 0x08) !== 0;
      const rrIntervalsPresent = (flags & 0x10) !== 0;
      
      let offset = 1;
      let heartRate: number;
      
      // Parse heart rate value
      if (hrFormat16Bit) {
        if (data.length < offset + 2) return null;
        heartRate = data[offset] | (data[offset + 1] << 8);
        offset += 2;
      } else {
        heartRate = data[offset];
        offset += 1;
      }
      
      // Parse optional energy expended
      let energyExpended: number | undefined;
      if (energyExpendedPresent) {
        if (data.length >= offset + 2) {
          energyExpended = data[offset] | (data[offset + 1] << 8);
          offset += 2;
        }
      }
      
      // Parse optional R-R intervals
      let rrIntervals: number[] | undefined;
      if (rrIntervalsPresent) {
        rrIntervals = [];
        while (offset + 1 < data.length) {
          const rrInterval = data[offset] | (data[offset + 1] << 8);
          rrIntervals.push(rrInterval * 1024 / 1000); // Convert to milliseconds
          offset += 2;
        }
      }
      
      const result: HeartRateData = {
        heartRate,
        contactDetected,
        energyExpended,
        rrIntervals,
        timestamp: new Date(),
        deviceId,
      };
      
      return isValidHeartRateData(result) ? result : null;
    } catch (error) {
      console.error('Heart rate parsing error:', error);
      return null;
    }
  }
  
  // Parse PLX Continuous Measurement data (BLE Standard 0x2A5F)
  static parseSpO2Data(data: Uint8Array, deviceId: string): SpO2Data | null {
    if (data.length < 5) return null;  // Need at least 5 bytes: Flags(1) + SpO2(2) + HR(2)
    
    try {
      console.log('🩺 [Parser] Raw PLX Continuous buffer:', Array.from(data));
      
      // BLE PLX Continuous Measurement format:
      // byte[0] = Flags (0x00)
      // byte[1-2] = SpO2 (little endian, LSB first)
      // byte[3-4] = Pulse Rate (little endian, LSB first)
      
      const flags = data[0];
      
      // Extract SpO2 (little endian 16-bit)
      const spO2 = data[1] | (data[2] << 8);
      
      // Extract Pulse Rate (little endian 16-bit)
      const pulseRate = data[3] | (data[4] << 8);
      
      console.log('🩺 [Parser] Parsed - SpO2:', spO2, '% | PulseRate:', pulseRate, 'bpm');
      
      const result: SpO2Data = {
        spO2,
        pulseRate,
        timestamp: new Date(),
        deviceId,
      };
      
      return isValidSpO2Data(result) ? result : null;
    } catch (error) {
      console.error('SpO2 parsing error:', error);
      return null;
    }
  }
  
  // Parse battery level
  static parseBatteryData(data: Uint8Array, deviceId: string): BatteryData | null {
    if (data.length < 1) return null;

    const level = data[0];

    return {
      level,
      timestamp: new Date(),
      deviceId,
    };
  }

  // Parse accelerometer data (multiple formats supported)
  static parseAccelerometerData(data: Uint8Array, deviceId: string): AccelerometerData | null {
    if (data.length < 6) return null;

    try {
      let timestamp: Date;
      let dataOffset = 0;

      // Check for timestamped format: 14 bytes = 8 (timestamp) + 6 (accel data)
      if (data.length >= 14) {
        // Extract 64-bit timestamp (little-endian) - use safe integer check
        let timestampMs = 0;
        for (let i = 0; i < 8; i++) {
          timestampMs += data[i] * Math.pow(2, i * 8);
        }

        const minTimestamp = new Date('2020-01-01').getTime();
        const maxTimestamp = new Date('2030-01-01').getTime();

        if (timestampMs > minTimestamp && timestampMs < maxTimestamp && Number.isSafeInteger(timestampMs)) {
          timestamp = new Date(timestampMs);
        } else {
          timestamp = new Date();
        }

        dataOffset = 8; // Accel data starts at byte 8
      } else {
        // Legacy format: 6 bytes without timestamp
        timestamp = new Date();
        dataOffset = 0;
      }

      // Parse accelerometer values (3x 16-bit signed integers, LSB first)
      const raw_x = this.parseInt16LE(data, dataOffset);
      const raw_y = this.parseInt16LE(data, dataOffset + 2);
      const raw_z = this.parseInt16LE(data, dataOffset + 4);

      // Convert from raw sensor values to g (gravity units)
      // Scale factor for ±2g range: divide by 16384
      const scale = 16384;
      const xG = raw_x / scale;
      const yG = raw_y / scale;
      const zG = raw_z / scale;

      // Calculate magnitude (vector length)
      const magnitude = Math.sqrt(xG * xG + yG * yG + zG * zG);

      const result: AccelerometerData = {
        // Raw values (as received from Arduino)
        raw_x,
        raw_y,
        raw_z,

        // Calculated values (app-side processing)
        x: xG,
        y: yG,
        z: zG,
        magnitude,

        // Metadata
        timestamp,  // Use Arduino's timestamp
        deviceId,
        sampleRate: 1, // 1 Hz from Arduino
        unit: 'g',
      };

      return isValidAccelerometerData(result) ? result : null;
    } catch (error) {
      console.error('Accelerometer parsing error:', error);
      return null;
    }
  }

  // Helper: Parse 16-bit signed integer (little-endian)
  private static parseInt16LE(data: Uint8Array, offset: number): number {
    const value = data[offset] | (data[offset + 1] << 8);
    // Convert to signed integer
    return value > 32767 ? value - 65536 : value;
  }
  
  // Parse device information string characteristics
  static parseStringCharacteristic(data: Uint8Array): string {
    try {
      return new TextDecoder('utf-8').decode(data);
    } catch {
      return '';
    }
  }
  
  // Identify data format for proper parsing
  static identifyDataFormat(data: Uint8Array): 'standard' | 'seedstudio' | 'nordic_uart' | 'unknown' {
    if (data.length >= 2 && data[0] === 0x53 && data[1] === 0x59) {
      return 'seedstudio';
    }
    
    if (data.length >= 2 && (data[0] & 0x01) !== undefined) {
      // Likely standard heart rate format
      return 'standard';
    }
    
    // Check if it's text-based (Nordic UART)
    try {
      const text = new TextDecoder('utf-8').decode(data);
      if (text.match(/^[a-zA-Z0-9\s:,.-]+$/)) {
        return 'nordic_uart';
      }
    } catch {
      // Not valid UTF-8
    }
    
    return 'unknown';
  }
}

// Enhanced Nordic device identification
export const isNordicDevice = (device: any): boolean => {
  const deviceName = device.name?.toLowerCase() || '';
  const advertisedServices = device.advertising?.serviceUUIDs || [];
  
  // Check for Nordic/SeedStudio name patterns
  const nameIndicators = [
    'nordic', 'nrf52', 'seedstudio', 'grove', 
    'heartrate', 'spo2', 'oximeter', 'pulse', 'mr60bha'
  ];
  
  const hasMatchingName = nameIndicators.some(indicator => 
    deviceName.includes(indicator)
  );
  
  // Check for required services (both standard and SeedStudio)
  const hasHeartRateService = advertisedServices.some((service: string) => 
    service.toUpperCase().includes(STANDARD_SERVICES.HEART_RATE)
  );
  
  const hasSeedStudioService = advertisedServices.some((service: string) => 
    service.includes(SEEDSTUDIO_SERVICES.RADAR_SERVICE) ||
    service.includes(SEEDSTUDIO_SERVICES.NORDIC_UART)
  );
  
  // Check manufacturer data for Nordic company ID
  const manufacturerData = device.advertising?.manufacturerData;
  const hasNordicManufacturer = manufacturerData && 
    Object.keys(manufacturerData).includes(NORDIC_DEVICE_PROFILE.manufacturerIndicators.nordicCompanyId.toString());
  
  return hasMatchingName || hasHeartRateService || hasSeedStudioService || hasNordicManufacturer;
};

export default {
  STANDARD_SERVICES,
  STANDARD_CHARACTERISTICS,
  SEEDSTUDIO_SERVICES,
  SEEDSTUDIO_CHARACTERISTICS,
  NORDIC_DEVICE_PROFILE,
  NordicDataParser,
  isNordicDevice,
  isValidHeartRateData,
  isValidSpO2Data,
  isValidAccelerometerData,
};