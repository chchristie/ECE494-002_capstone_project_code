// Nordic nRF52840 + SeedStudio Heart Rate & SpO2 Sensor
// BLE GATT Services and Characteristics - Complete Corrected Version

// Standard BLE Service UUIDs (16-bit format)
export const STANDARD_SERVICES = {
  HEART_RATE: '180D',
  DEVICE_INFORMATION: '180A',
  BATTERY_SERVICE: '180F',
  PULSE_OXIMETER: '1822',
} as const;

// Standard BLE Characteristic UUIDs (16-bit format)
export const STANDARD_CHARACTERISTICS = {
  HEART_RATE_MEASUREMENT: '2A37',
  BATTERY_LEVEL: '2A19',
  PLX_CONTINUOUS_MEASUREMENT: '2A5F',
} as const;

// Custom Service UUIDs
export const SEEDSTUDIO_SERVICES = {
  RADAR_SERVICE: '19B10000-E8F2-537E-4F6C-D104768A1214',
  ACCELEROMETER_SERVICE: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
} as const;

export const SEEDSTUDIO_CHARACTERISTICS = {
  ACCELEROMETER_DATA: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E',
  MISC_DATA: '6E400004-B5A3-F393-E0A9-E50E24DCCA9E',
} as const;


// Data parsing interfaces following user's TypeScript strict preferences
export interface HeartRateData {
  heartRate: number;          // BPM (beats per minute)
  contactDetected: boolean;   // Sensor contact with skin
  energyExpended?: number;    // Optional energy in kJ
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
  voltage?: number;           // Battery voltage (V)
  isCharging?: boolean;
  timestamp: Date;
  deviceId: string;
}

export interface MiscData {
  status: number;             // 0-3 (0,1=No Contact, 2=Object, 3=Skin)
  confidence: number;         // 0-100%
  voltage: number;            // Battery voltage (V)
  charging: boolean;          // true if device is charging
  timestamp: Date;
  deviceId: string;
}

export interface AccelerometerData {
  x: number;                  // X-axis acceleration (m/s² or g)
  y: number;                  // Y-axis acceleration
  z: number;                  // Z-axis acceleration
  magnitude: number;          // Vector magnitude
}

// Buffered accelerometer data - includes secondCounter and sample index
export interface BufferedAccelerometerData extends AccelerometerData {
  secondCounter: number;      // Counter from Arduino to group 20 samples
  sampleIndex: number;        // Index within the buffer (0-19)
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
      
      const result: HeartRateData = {
        heartRate,
        contactDetected,
        energyExpended,
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
      
      // BLE PLX Continuous Measurement format:
      // byte[0] = Flags (0x00)
      // byte[1-2] = SpO2 (little endian, LSB first)
      // byte[3-4] = Pulse Rate (little endian, LSB first)
      
      const flags = data[0];
      
      // Extract SpO2 (little endian 16-bit)
      const spO2 = data[1] | (data[2] << 8);
      
      // Extract Pulse Rate (little endian 16-bit)
      const pulseRate = data[3] | (data[4] << 8);
            
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

  // Parse miscellaneous data (status, confidence, voltage)
  static parseMiscData(data: Uint8Array, deviceId: string): MiscData | null {
    if (data.length < 5) return null;

    const status = data[0];        // 0-3 (0,1=No Contact, 2=Object, 3=Skin)
    const confidence = data[1];    // 0-100%
    
    // Reconstruct 16-bit voltage from low and high bytes (little-endian)
    const voltageLow = data[2];
    const voltageHigh = data[3];
    const voltageScaled = voltageLow | (voltageHigh << 8);
    
    // Convert voltage back from scaled value (0-65535 represents 0-5V)
    const voltage = voltageScaled / 13107.0; // 65535/5 = 13107
    
    // Parse charging status (1 = charging, 0 = not charging)
    const charging = data[4] === 1;

    return {
      status,
      confidence,
      voltage,
      charging,
      timestamp: new Date(),
      deviceId,
    };
  }

  // Parse buffered accelerometer data - extracts all 20 samples from 124-byte packet
  static parseBufferedAccelerometerData(data: Uint8Array, deviceId: string): BufferedAccelerometerData[] | null {
    // Buffered format: 124 bytes
    // Bytes 0-3: secondCounter (uint32_t)
    // Bytes 4-43: accelStoredBuffX[20] (20 * int16_t = 40 bytes)
    // Bytes 44-83: accelStoredBuffY[20] (40 bytes)
    // Bytes 84-123: accelStoredBuffZ[20] (40 bytes)
    
    if (data.length !== 124) {
      console.warn(`⚠️ Expected 124 bytes for buffered accel data, got ${data.length}`);
      if (data.length === 20) {
        console.warn('💡 Hint: MTU size may be too small. The app should request MTU=512 when connecting.');
      }
      return null;
    }

    try {
      // Extract secondCounter (4 bytes, little-endian)
      const secondCounter = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
      
      const samples: BufferedAccelerometerData[] = [];

      // Extract all 20 samples
      for (let i = 0; i < 20; i++) {
        // Extract X, Y, Z for this sample
        const xG = this.parseInt16LE(data, 4 + i * 2);   // accelStoredBuffX[i]
        const yG = this.parseInt16LE(data, 44 + i * 2);  // accelStoredBuffY[i]
        const zG = this.parseInt16LE(data, 84 + i * 2);  // accelStoredBuffZ[i]

        // Calculate magnitude (rounded to integer)
        const magnitude = Math.round(Math.sqrt(xG * xG + yG * yG + zG * zG));

        samples.push({
          x: xG,
          y: yG,
          z: zG,
          magnitude,
          secondCounter,
          sampleIndex: i,
        });
      }

      return samples;
    } catch (error) {
      console.error('Buffered accelerometer parsing error:', error);
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


export default {
  STANDARD_SERVICES,
  STANDARD_CHARACTERISTICS,
  SEEDSTUDIO_SERVICES,
  SEEDSTUDIO_CHARACTERISTICS,
  NordicDataParser,
  isValidHeartRateData,
  isValidSpO2Data,
};