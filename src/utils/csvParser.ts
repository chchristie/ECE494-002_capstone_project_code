// csvParser.ts - CSV parser matching DataManager's actual export format
// COMPLETELY REWRITTEN to match the actual CSV schema exported by DataManager

/**
 * Enhanced sensor reading interface matching DataManager's CSV export format
 * Format from DataManager.exportSessionCSV() and exportAllDataCSV():
 * - Session CSV (17 columns): Timestamp_Unix_ms, Timestamp_ISO, Time_Since_Start_Seconds, Time_Since_Start_Minutes, HR_BPM, HR_Contact_Detected, HR_Signal_Quality, SpO2_Percent, SpO2_Pulse_Rate_BPM, SpO2_Signal_Quality, Battery_Percent, Accel_X_g, Accel_Y_g, Accel_Z_g, Accel_Magnitude_g, Device_ID
 * - All Data CSV (17 columns): Session_End, Session_Duration_Minutes, Timestamp_Unix_ms, Timestamp_ISO, Time_Since_Session_Start_Seconds, HR_BPM, HR_Contact_Detected, HR_Signal_Quality, SpO2_Percent, SpO2_Pulse_Rate_BPM, SpO2_Signal_Quality, Battery_Percent, Accel_X_g, Accel_Y_g, Accel_Z_g, Accel_Magnitude_g, Device_ID
 */

export interface ParsedSensorReading {
  // Timestamp data
  timestampUnixMs: number;
  timestampISO: string;
  timestamp: Date;
  timeSinceStartSeconds?: number;  // Only in session CSV
  timeSinceStartMinutes?: number;  // Only in session CSV

  // Session data (only in all-data CSV)
  sessionEnd?: string;
  sessionDurationMinutes?: number;

  // Heart Rate data
  heartRate?: {
    bpm: number;
    contactDetected: boolean;
    signalQuality: number;
  };

  // SpO2 data
  spO2?: {
    percent: number;
    pulseRate: number;
    signalQuality: number;
  };

  // Battery data
  battery?: {
    percent: number;
  };

  // Accelerometer data
  accelerometer?: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
  };

  // Device metadata
  deviceId: string;
}

export interface ParsedCSVData {
  readings: ParsedSensorReading[];
  sessionStats: {
    totalReadings: number;
    startTime: Date;
    endTime: Date;
    duration: number; // seconds
    heartRateReadings: number;
    spO2Readings: number;
    accelReadings: number;
    batteryReadings: number;
    avgHeartRate?: number;
    avgSpO2?: number;
    avgAccelMagnitude?: number;
    maxHeartRate?: number;
    minHeartRate?: number;
    maxSpO2?: number;
    minSpO2?: number;
  };
  csvFormat: 'session' | 'allData' | 'unknown';
}

/**
 * Parse CSV string into structured sensor readings
 * Auto-detects format based on header row
 */
export function parseCSV(csvContent: string): ParsedCSVData {
  const lines = csvContent.trim().split('\n');

  if (lines.length < 2) {
    return {
      readings: [],
      sessionStats: emptyStats(),
      csvFormat: 'unknown',
    };
  }

  // Parse header to detect format
  const header = lines[0].trim();
  const csvFormat = detectCSVFormat(header);

  if (csvFormat === 'unknown') {
    console.error('Unknown CSV format. Expected headers from DataManager export.');
    return {
      readings: [],
      sessionStats: emptyStats(),
      csvFormat: 'unknown',
    };
  }

  // Parse data rows
  const dataLines = lines.slice(1);
  const readings: ParsedSensorReading[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;

    const values = parseCSVLine(line);

    // Validate column count
    const expectedColumns = csvFormat === 'session' ? 17 : 18;
    if (values.length < expectedColumns) {
      console.warn(`Skipping row with ${values.length} columns (expected ${expectedColumns})`);
      continue;
    }

    try {
      const reading = csvFormat === 'session'
        ? parseSessionCSVRow(values)
        : parseAllDataCSVRow(values);

      if (reading) {
        readings.push(reading);
      }
    } catch (error) {
      console.warn('Failed to parse CSV row:', line, error);
    }
  }

  // Calculate statistics
  const sessionStats = calculateStats(readings);

  return { readings, sessionStats, csvFormat };
}

/**
 * Detect CSV format based on header row
 */
function detectCSVFormat(header: string): 'session' | 'allData' | 'unknown' {
  const headerLower = header.toLowerCase();

  // Session CSV starts with: Timestamp_Unix_ms
  if (headerLower.startsWith('timestamp_unix_ms')) {
    return 'session';
  }

  // All Data CSV starts with: Session_End
  if (headerLower.startsWith('session_end')) {
    return 'allData';
  }

  return 'unknown';
}

/**
 * Parse a single Session CSV row
 * Format: Timestamp_Unix_ms,Timestamp_ISO,Time_Since_Start_Seconds,Time_Since_Start_Minutes,HR_BPM,HR_Contact_Detected,HR_Signal_Quality,SpO2_Percent,SpO2_Pulse_Rate_BPM,SpO2_Signal_Quality,Battery_Percent,Accel_X_g,Accel_Y_g,Accel_Z_g,Accel_Magnitude_g,Device_ID
 */
function parseSessionCSVRow(values: string[]): ParsedSensorReading | null {
  try {
    const timestampUnixMs = parseNumber(values[0]);
    const timestampISO = values[1];
    const timeSinceStartSeconds = parseNumber(values[2]);
    const timeSinceStartMinutes = parseNumber(values[3]);

    const hrBpm = parseNumber(values[4]);
    const hrContactDetected = parseBoolean(values[5]);
    const hrSignalQuality = parseNumber(values[6]);

    const spO2Percent = parseNumber(values[8]);
    const spO2PulseRate = parseNumber(values[9]);
    const spO2SignalQuality = parseNumber(values[10]);

    const batteryPercent = parseNumber(values[11]);

    const accelX = parseNumber(values[12]);
    const accelY = parseNumber(values[13]);
    const accelZ = parseNumber(values[14]);
    const accelMagnitude = parseNumber(values[15]);

    const deviceId = values[16] || '';

    return {
      timestampUnixMs: timestampUnixMs ?? 0,
      timestampISO,
      timestamp: new Date(timestampUnixMs ?? 0),
      timeSinceStartSeconds,
      timeSinceStartMinutes,
      heartRate: hrBpm !== undefined ? {
        bpm: hrBpm,
        contactDetected: hrContactDetected ?? false,
        signalQuality: hrSignalQuality ?? 0,
      } : undefined,
      spO2: spO2Percent !== undefined ? {
        percent: spO2Percent,
        pulseRate: spO2PulseRate ?? 0,
        signalQuality: spO2SignalQuality ?? 0,
      } : undefined,
      battery: batteryPercent !== undefined ? {
        percent: batteryPercent,
      } : undefined,
      accelerometer: accelX !== undefined && accelY !== undefined && accelZ !== undefined ? {
        x: accelX,
        y: accelY,
        z: accelZ,
        magnitude: accelMagnitude ?? Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ),
      } : undefined,
      deviceId,
    };
  } catch (error) {
    console.error('Error parsing session CSV row:', error);
    return null;
  }
}

/**
 * Parse a single All Data CSV row
 * Format: Session_End,Session_Duration_Minutes,Timestamp_Unix_ms,Timestamp_ISO,Time_Since_Session_Start_Seconds,HR_BPM,HR_Contact_Detected,HR_Signal_Quality,SpO2_Percent,SpO2_Pulse_Rate_BPM,SpO2_Signal_Quality,Battery_Percent,Accel_X_g,Accel_Y_g,Accel_Z_g,Accel_Magnitude_g,Device_ID
 */
function parseAllDataCSVRow(values: string[]): ParsedSensorReading | null {
  try {
    const sessionEnd = values[0];
    const sessionDurationMinutes = parseNumber(values[1]);

    const timestampUnixMs = parseNumber(values[2]);
    const timestampISO = values[3];
    const timeSinceStartSeconds = parseNumber(values[4]);

    const hrBpm = parseNumber(values[5]);
    const hrContactDetected = parseBoolean(values[6]);
    const hrSignalQuality = parseNumber(values[7]);

    const spO2Percent = parseNumber(values[9]);
    const spO2PulseRate = parseNumber(values[10]);
    const spO2SignalQuality = parseNumber(values[11]);

    const batteryPercent = parseNumber(values[12]);

    const accelX = parseNumber(values[13]);
    const accelY = parseNumber(values[14]);
    const accelZ = parseNumber(values[15]);
    const accelMagnitude = parseNumber(values[16]);

    const deviceId = values[17] || '';

    return {
      sessionEnd,
      sessionDurationMinutes,
      timestampUnixMs: timestampUnixMs ?? 0,
      timestampISO,
      timestamp: new Date(timestampUnixMs ?? 0),
      timeSinceStartSeconds,
      heartRate: hrBpm !== undefined ? {
        bpm: hrBpm,
        contactDetected: hrContactDetected ?? false,
        signalQuality: hrSignalQuality ?? 0,
      } : undefined,
      spO2: spO2Percent !== undefined ? {
        percent: spO2Percent,
        pulseRate: spO2PulseRate ?? 0,
        signalQuality: spO2SignalQuality ?? 0,
      } : undefined,
      battery: batteryPercent !== undefined ? {
        percent: batteryPercent,
      } : undefined,
      accelerometer: accelX !== undefined && accelY !== undefined && accelZ !== undefined ? {
        x: accelX,
        y: accelY,
        z: accelZ,
        magnitude: accelMagnitude ?? Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ),
      } : undefined,
      deviceId,
    };
  } catch (error) {
    console.error('Error parsing all-data CSV row:', error);
    return null;
  }
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Add last value
  values.push(currentValue.trim());

  return values;
}

/**
 * Parse number from CSV value (handles empty strings)
 */
function parseNumber(value: string): number | undefined {
  if (!value || value === '') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse boolean from CSV value
 */
function parseBoolean(value: string): boolean | undefined {
  if (!value || value === '') return undefined;
  const valueLower = value.toLowerCase().trim();
  if (valueLower === 'yes' || valueLower === 'true' || valueLower === '1') {
    return true;
  }
  if (valueLower === 'no' || valueLower === 'false' || valueLower === '0') {
    return false;
  }
  return undefined;
}

/**
 * Calculate session statistics from readings
 */
function calculateStats(readings: ParsedSensorReading[]): ParsedCSVData['sessionStats'] {
  if (readings.length === 0) {
    return emptyStats();
  }

  const heartRates = readings.filter(r => r.heartRate !== undefined).map(r => r.heartRate!.bpm);
  const spO2Values = readings.filter(r => r.spO2 !== undefined).map(r => r.spO2!.percent);
  const accelMagnitudes = readings.filter(r => r.accelerometer !== undefined).map(r => r.accelerometer!.magnitude);
  const batteryLevels = readings.filter(r => r.battery !== undefined).map(r => r.battery!.percent);

  const timestamps = readings.map(r => r.timestamp.getTime());
  const startTime = new Date(Math.min(...timestamps));
  const endTime = new Date(Math.max(...timestamps));
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;

  return {
    totalReadings: readings.length,
    startTime,
    endTime,
    duration,
    heartRateReadings: heartRates.length,
    spO2Readings: spO2Values.length,
    accelReadings: accelMagnitudes.length,
    batteryReadings: batteryLevels.length,
    avgHeartRate: heartRates.length > 0 ? average(heartRates) : undefined,
    avgSpO2: spO2Values.length > 0 ? average(spO2Values) : undefined,
    avgAccelMagnitude: accelMagnitudes.length > 0 ? average(accelMagnitudes) : undefined,
    maxHeartRate: heartRates.length > 0 ? Math.max(...heartRates) : undefined,
    minHeartRate: heartRates.length > 0 ? Math.min(...heartRates) : undefined,
    maxSpO2: spO2Values.length > 0 ? Math.max(...spO2Values) : undefined,
    minSpO2: spO2Values.length > 0 ? Math.min(...spO2Values) : undefined,
  };
}

/**
 * Empty statistics object
 */
function emptyStats(): ParsedCSVData['sessionStats'] {
  return {
    totalReadings: 0,
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
    heartRateReadings: 0,
    spO2Readings: 0,
    accelReadings: 0,
    batteryReadings: 0,
  };
}

/**
 * Calculate average of number array
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / numbers.length) * 100) / 100; // Round to 2 decimals
}

/**
 * Sample data for display efficiency (reduce 10,000 points to maxPoints for charts)
 */
export function sampleData(readings: ParsedSensorReading[], maxPoints: number = 500): ParsedSensorReading[] {
  if (readings.length <= maxPoints) {
    return readings;
  }

  const interval = Math.floor(readings.length / maxPoints);
  const sampled: ParsedSensorReading[] = [];

  for (let i = 0; i < readings.length; i += interval) {
    sampled.push(readings[i]);
  }

  return sampled;
}

/**
 * Validate CSV format matches expected DataManager export schema
 */
export function validateCSVFormat(csvContent: string): {
  isValid: boolean;
  format: 'session' | 'allData' | 'unknown';
  errors: string[];
} {
  const lines = csvContent.trim().split('\n');
  const errors: string[] = [];

  if (lines.length < 1) {
    errors.push('CSV file is empty');
    return { isValid: false, format: 'unknown', errors };
  }

  const header = lines[0].trim();
  const format = detectCSVFormat(header);

  if (format === 'unknown') {
    errors.push('Unknown CSV format - header does not match DataManager export');
    return { isValid: false, format: 'unknown', errors };
  }

  const expectedColumnCount = format === 'session' ? 17 : 18;
  const headerColumns = parseCSVLine(header);

  if (headerColumns.length !== expectedColumnCount) {
    errors.push(`Expected ${expectedColumnCount} columns, found ${headerColumns.length}`);
  }

  // Validate data rows
  const dataLines = lines.slice(1);
  let validRows = 0;
  let invalidRows = 0;

  for (let i = 0; i < Math.min(10, dataLines.length); i++) {
    const line = dataLines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);
    if (values.length >= expectedColumnCount) {
      validRows++;
    } else {
      invalidRows++;
    }
  }

  if (invalidRows > validRows) {
    errors.push(`Most data rows have incorrect column count (expected ${expectedColumnCount})`);
  }

  return {
    isValid: errors.length === 0,
    format,
    errors,
  };
}
