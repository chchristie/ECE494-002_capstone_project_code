// src/services/DataManager.ts - Simplified with AsyncStorage fallback
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HeartRateData,
  SpO2Data,
  BatteryData,
  MiscData,
  AccelerometerData,
  BufferedAccelerometerData,
} from './nordic-ble-services';

// Try to import SQLite, but fallback gracefully if it fails
let SQLite: any = null;
try {
  SQLite = require('react-native-sqlite-storage');
  if (SQLite) {
    SQLite.enablePromise(true);
    console.log('SQLite available');
  }
} catch (error) {
  console.log('SQLite not available, using AsyncStorage fallback');
}

// Legacy type for backward compatibility
export interface HeartRateReading {
  id: string;
  timestamp: Date;
  heartRate: number;
}

// Enhanced sensor reading for research-grade data
export interface EnhancedSensorReading {
  id: string;
  sessionId: string;
  deviceId: string;
  timestamp: Date;
  heartRate?: {
    value: number;
    contactDetected: boolean;
  };
  spO2?: {
    value: number;
    pulseRate: number;
  };
  battery?: {
    level: number;
    voltage?: number;
  };
  sensorStatus?: {
    confidence: number;
  };
  accelerometer?: {
    raw_x: number;        // Raw int16 value
    raw_y: number;        // Raw int16 value
    raw_z: number;        // Raw int16 value
    x: number;            // Calculated g units
    y: number;            // Calculated g units
    z: number;            // Calculated g units
    magnitude: number;    // Calculated magnitude
  };
  rawData?: string;
}

// Session management for research workflows
export interface MonitoringSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  deviceName?: string;
  notes?: string;
  dataCount: number;
  isActive: boolean;
}

// Data export formats
export interface ExportOptions {
  format: 'csv' | 'json';
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeRawData?: boolean;
  sessionId?: string;
}

export class DataManager {
  private static db: any = null;
  private static usingSQLite: boolean = false;
  private static accelTableEnsured: boolean = false;
  private static readonly DB_NAME = 'nordic_sensor_data.db';
  
  // Storage keys for AsyncStorage fallback
  private static readonly LEGACY_STORAGE_KEY = 'HeartRateReadings';
  private static readonly SESSIONS_STORAGE_KEY = 'MonitoringSessions';
  private static readonly ENHANCED_READINGS_KEY = 'EnhancedSensorReadings';
  private static readonly RETENTION_HOURS = 24;

  // Initialize database (SQLite if available, AsyncStorage otherwise)
  static async initialize(): Promise<void> {
    try {
      if (SQLite) {
        this.db = await SQLite.openDatabase({
          name: this.DB_NAME,
          location: 'default',
        });

        if (this.db) {
          this.usingSQLite = true;  // Set BEFORE createTables so migrations can run
          await this.createTables();
          await this.ensureAccelerometerTableExists();
        } else {
          this.usingSQLite = false;
        }
      } else {
        this.usingSQLite = false;
        this.db = null;
      }
    } catch (error) {
      console.error('SQLite initialization failed:', error);
      this.usingSQLite = false;
      this.db = null;
    }

    if (this.usingSQLite) {
      await this.migrateFromAsyncStorage();
    }
  }

  // Database version for migrations
  private static readonly DB_VERSION = 7; // Added battery_voltage and sensor_confidence columns

  // Create database tables (SQLite only)
  private static async createTables(): Promise<void> {
    if (!this.db) return;

    const createSensorReadingsTable = `
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        heart_rate INTEGER,
        hr_contact_detected INTEGER,
        spo2_value INTEGER,
        spo2_pulse_rate INTEGER,
        battery_level INTEGER,
        battery_voltage REAL,
        sensor_confidence INTEGER,
        raw_data TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE
      );
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS monitoring_sessions (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        device_name TEXT,
        notes TEXT,
        data_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `;

    const createAccelerometerTable = `
      CREATE TABLE IF NOT EXISTS accelerometer_readings (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        second_counter INTEGER NOT NULL,
        sample_index INTEGER NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        z INTEGER NOT NULL,
        magnitude INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE
      );
    `;


    try {
      await this.db.executeSql(createSensorReadingsTable);
      await this.db.executeSql(createSessionsTable);
      await this.db.executeSql(createAccelerometerTable);
      // await this.runMigrations();
    } catch (error) {
      console.error('Failed to create SQLite tables:', error);
      this.usingSQLite = false;
      this.db = null;
      throw error;
    }
  }

  // **NEW: Database Migration System**
  private static async runMigrations(): Promise<void> {
    if (!this.db || !this.usingSQLite) {
      return;
    }

    try {
      // Get current database version
      const versionResult = await this.db.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='db_version'`
      );

      let currentVersion = 1;
      if (versionResult[0].rows.length > 0) {
        const verData = await this.db.executeSql('SELECT version FROM db_version LIMIT 1');
        if (verData[0].rows.length > 0) {
          currentVersion = verData[0].rows.item(0).version;
        }
      } else {
        // Create version table
        await this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS db_version (
            version INTEGER PRIMARY KEY
          )
        `);
        await this.db.executeSql('INSERT INTO db_version (version) VALUES (1)');
      }

      if (currentVersion < 2) {
        await this.migrateToV2();
        currentVersion = 2;
      }
      if (currentVersion < 3) {
        await this.migrateToV3();
        currentVersion = 3;
      }
      if (currentVersion < 4) {
        await this.migrateToV4();
        currentVersion = 4;
      }
      if (currentVersion < 5) {
        await this.migrateToV5();
        currentVersion = 5;
      }
      if (currentVersion < 6) {
        await this.migrateToV6();
        currentVersion = 6;
      }
      if (currentVersion < 7) {
        await this.migrateToV7();
        currentVersion = 7;
      }

      if (currentVersion < this.DB_VERSION) {
        await this.db.executeSql('UPDATE db_version SET version = ?', [this.DB_VERSION]);
      }

      // Safety: ensure accelerometer table exists even if version metadata says it should
      await this.ensureAccelerometerTableExists();
    } catch (error) {
      console.error('Migration error:', error);
      // Don't throw - allow app to continue even if migration fails
    }
  }

  private static async migrateToV2(): Promise<void> {
    if (!this.db) return;

    try {
      const tableInfo = await this.db.executeSql('PRAGMA table_info(sensor_readings)');
      const columns = [];
      for (let i = 0; i < tableInfo[0].rows.length; i++) {
        columns.push(tableInfo[0].rows.item(i).name);
      }

      if (!columns.includes('accel_x')) {
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN accel_x REAL');
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN accel_y REAL');
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN accel_z REAL');
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN accel_magnitude REAL');
      }
    } catch (error) {
      console.error('Failed to migrate to v2:', error);
      throw error;
    }
  }

  private static async migrateToV3(): Promise<void> {
    if (!this.db) return;

    try {
      const tableInfo = await this.db.executeSql('PRAGMA table_info(sensor_readings)');
      const columns = [];
      for (let i = 0; i < tableInfo[0].rows.length; i++) {
        columns.push(tableInfo[0].rows.item(i).name);
      }

      if (!columns.includes('accel_raw_x')) {
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN accel_raw_x INTEGER');
      }
      if (!columns.includes('accel_raw_y')) {
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN accel_raw_y INTEGER');
      }
      if (!columns.includes('accel_raw_z')) {
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN accel_raw_z INTEGER');
      }
    } catch (error) {
      console.error('Failed to migrate to v3:', error);
      throw error;
    }
  }

  private static async migrateToV4(): Promise<void> {
    if (!this.db) return;

    try {
      console.log('🔄 [Migration] Starting v4 migration - removing signal quality columns');
      console.log('⚠️  [Migration] This will delete all existing sensor data');
      
      // Drop old tables
      await this.db.executeSql('DROP TABLE IF EXISTS sensor_readings');
      await this.db.executeSql('DROP TABLE IF EXISTS monitoring_sessions');
      
      console.log('✅ [Migration] Old tables dropped');
      
      // Recreate tables with new schema (without signal quality)
      const createSensorReadingsTable = `
        CREATE TABLE sensor_readings (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          heart_rate INTEGER,
          hr_contact_detected INTEGER,
          hr_rr_intervals TEXT,
          spo2_value INTEGER,
          spo2_pulse_rate INTEGER,
          battery_level INTEGER,
          accel_raw_x INTEGER,
          accel_raw_y INTEGER,
          accel_raw_z INTEGER,
          accel_x REAL,
          accel_y REAL,
          accel_z REAL,
          accel_magnitude REAL,
          raw_data TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `;

      const createSessionsTable = `
        CREATE TABLE monitoring_sessions (
          id TEXT PRIMARY KEY,
          start_time INTEGER NOT NULL,
          end_time INTEGER,
          device_name TEXT,
          notes TEXT,
          data_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `;

      await this.db.executeSql(createSensorReadingsTable);
      await this.db.executeSql(createSessionsTable);
      
      console.log('✅ [Migration] New tables created without signal quality columns');
      console.log('✅ [Migration] v4 migration complete');
    } catch (error) {
      console.error('❌ [Migration] Failed to migrate to v4:', error);
      throw error;
    }
  }

  private static async ensureAccelerometerTableExists(): Promise<void> {
    if (!this.db) return;

    try {
      // Drop existing table to recreate with correct schema
      await this.db.executeSql('DROP TABLE IF EXISTS accelerometer_readings');
      
      const createAccelerometerTable = `
        CREATE TABLE IF NOT EXISTS accelerometer_readings (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          second_counter INTEGER NOT NULL,
          sample_index INTEGER NOT NULL,
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,
          z INTEGER NOT NULL,
          magnitude INTEGER NOT NULL,
          FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE
        )
      `;
      
      await this.db.executeSql(createAccelerometerTable);
      
      // Create indices for faster queries
      await this.db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_accel_session 
        ON accelerometer_readings(session_id)
      `);
      
      await this.db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_accel_second_counter 
        ON accelerometer_readings(second_counter)
      `);
            
      console.log('✅ [DB] Accelerometer table ensured');
      this.accelTableEnsured = true;
    } catch (error) {
      console.error('❌ [DB] Failed to ensure accelerometer table:', error);
      throw error;
    }
  }

  private static async migrateToV5(): Promise<void> {
    if (!this.db) return;

    try {
      console.log('🔄 [Migration] Starting v5 migration - creating separate accelerometer table');
      
      await this.ensureAccelerometerTableExists();
      
      console.log('✅ [Migration] v5 migration complete');
    } catch (error) {
      console.error('❌ [Migration] Failed to migrate to v5:', error);
      throw error;
    }
  }

  private static async migrateToV6(): Promise<void> {
    if (!this.db) return;

    try {
      console.log('🔄 [Migration] Starting v6 migration - removing RR intervals and accelerometer columns');
      console.log('⚠️  [Migration] This will drop and recreate sensor_readings table');
      
      // Drop old sensor_readings table
      await this.db.executeSql('DROP TABLE IF EXISTS sensor_readings');
      
      console.log('✅ [Migration] Old sensor_readings table dropped');
      
      // Recreate sensor_readings without RR intervals and accelerometer columns
      const createSensorReadingsTable = `
        CREATE TABLE sensor_readings (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          heart_rate INTEGER,
          hr_contact_detected INTEGER,
          spo2_value INTEGER,
          spo2_pulse_rate INTEGER,
          battery_level INTEGER,
          raw_data TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `;

      await this.db.executeSql(createSensorReadingsTable);
      
      console.log('✅ [Migration] New sensor_readings table created without RR intervals and accelerometer columns');
      console.log('✅ [Migration] v6 migration complete');
    } catch (error) {
      console.error('❌ [Migration] Failed to migrate to v6:', error);
      throw error;
    }
  }

  private static async migrateToV7(): Promise<void> {
    if (!this.db) return;

    try {
      // Check if columns already exist
      const tableInfo = await this.db.executeSql(`PRAGMA table_info(sensor_readings)`);
      const columns = tableInfo[0].rows.raw().map((row: any) => row.name);
      
      // Add battery_voltage column if it doesn't exist
      if (!columns.includes('battery_voltage')) {
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN battery_voltage REAL');
      }
      
      // Add sensor_confidence column if it doesn't exist
      if (!columns.includes('sensor_confidence')) {
        await this.db.executeSql('ALTER TABLE sensor_readings ADD COLUMN sensor_confidence INTEGER');
      }
    } catch (error) {
      console.error('Failed to migrate to v7:', error);
      throw error;
    }
  }

  private static async migrateFromAsyncStorage(): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(this.LEGACY_STORAGE_KEY);
      if (!existingData) {
        return;
      }

      const legacyReadings: any[] = JSON.parse(existingData);
      if (legacyReadings.length === 0) return;

      const migrationSession = await this.createSession('Legacy Data Migration', 'Migrated from AsyncStorage');

      const enhancedReadings: EnhancedSensorReading[] = legacyReadings.map(reading => ({
        id: reading.id || this.generateId(),
        sessionId: migrationSession.id,
        deviceId: 'legacy_device',
        timestamp: new Date(reading.timestamp),
        heartRate: {
          value: reading.heartRate,
          contactDetected: true,
          signalQuality: 50,
        },
      }));

      await this.saveEnhancedReadings(enhancedReadings);
      await this.endSession(migrationSession.id);
      await AsyncStorage.removeItem(this.LEGACY_STORAGE_KEY);

    } catch (error) {
      console.error('Failed to migrate legacy data:', error);
    }
  }

  // Session Management
  static async createSession(deviceName?: string, notes?: string): Promise<MonitoringSession> {
    const session: MonitoringSession = {
      id: this.generateSessionId(),
      startTime: new Date(),
      deviceName,
      notes,
      dataCount: 0,
      isActive: true,
    };

    if (this.usingSQLite && this.db) {
      // SQLite storage
      const sql = `
        INSERT INTO monitoring_sessions 
        (id, start_time, device_name, notes, data_count, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      try {
        await this.db.executeSql(sql, [
          session.id,
          session.startTime.getTime(),
          session.deviceName || null,
          session.notes || null,
          session.dataCount,
          session.isActive ? 1 : 0,
        ]);
      } catch (error) {
        console.error('Failed to create session in SQLite:', error);
        throw error;
      }
    } else {
      // AsyncStorage fallback
      try {
        const sessions = await this.getActiveSessions();
        sessions.push(session);
        await AsyncStorage.setItem(this.SESSIONS_STORAGE_KEY, JSON.stringify(sessions.map(s => ({
          ...s,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime?.toISOString(),
        }))));
      } catch (error) {
        console.error('Failed to create session in AsyncStorage:', error);
        throw error;
      }
    }

    return session;
  }

  static async endSession(sessionId: string): Promise<void> {
    if (this.usingSQLite && this.db) {
      // SQLite storage
      const sql = `
        UPDATE monitoring_sessions 
        SET end_time = ?, is_active = 0 
        WHERE id = ?
      `;

      try {
        await this.db.executeSql(sql, [Date.now(), sessionId]);
      } catch (error) {
        console.error('Failed to end session in SQLite:', error);
        throw error;
      }
    } else {
      // AsyncStorage fallback
      try {
        const sessions = await this.getActiveSessions();
        const updatedSessions = sessions.map(session => 
          session.id === sessionId 
            ? { ...session, endTime: new Date(), isActive: false }
            : session
        );
        await AsyncStorage.setItem(this.SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions.map(s => ({
          ...s,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime?.toISOString(),
        }))));
      } catch (error) {
        console.error('Failed to end session in AsyncStorage:', error);
        throw error;
      }
    }
  }

  static async getActiveSessions(): Promise<MonitoringSession[]> {
    if (this.usingSQLite && this.db) {
      // SQLite storage
      const sql = `
        SELECT * FROM monitoring_sessions
        WHERE is_active = 1
        ORDER BY start_time DESC
      `;

      try {
        const results = await this.db.executeSql(sql);
        const sessions: MonitoringSession[] = [];

        if (results && results.length > 0) {
          const rows = results[0].rows;
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            sessions.push({
              id: row.id,
              startTime: new Date(row.start_time),
              endTime: row.end_time ? new Date(row.end_time) : undefined,
              deviceName: row.device_name,
              notes: row.notes,
              dataCount: row.data_count,
              isActive: Boolean(row.is_active),
            });
          }
        }

        return sessions;
      } catch (error) {
        console.error('Failed to get active sessions from SQLite:', error);
        return [];
      }
    } else {
      // AsyncStorage fallback
      try {
        const data = await AsyncStorage.getItem(this.SESSIONS_STORAGE_KEY);
        if (!data) return [];

        const sessions = JSON.parse(data);
        return sessions
          .filter((s: any) => s.isActive)
          .map((s: any) => ({
            ...s,
            startTime: new Date(s.startTime),
            endTime: s.endTime ? new Date(s.endTime) : undefined,
          }));
      } catch (error) {
        console.error('Failed to get active sessions from AsyncStorage:', error);
        return [];
      }
    }
  }

  static async getAllSessions(): Promise<MonitoringSession[]> {
    if (this.usingSQLite && this.db) {
      // SQLite storage
      const sql = `
        SELECT * FROM monitoring_sessions
        ORDER BY start_time DESC
      `;

      try {
        const results = await this.db.executeSql(sql);
        const sessions: MonitoringSession[] = [];

        if (results && results.length > 0) {
          const rows = results[0].rows;
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            sessions.push({
              id: row.id,
              startTime: new Date(row.start_time),
              endTime: row.end_time ? new Date(row.end_time) : undefined,
              deviceName: row.device_name,
              notes: row.notes,
              dataCount: row.data_count,
              isActive: Boolean(row.is_active),
            });
          }
        }

        return sessions;
      } catch (error) {
        console.error('Failed to get all sessions from SQLite:', error);
        return [];
      }
    } else {
      // AsyncStorage fallback
      try {
        const data = await AsyncStorage.getItem(this.SESSIONS_STORAGE_KEY);
        if (!data) return [];

        const sessions = JSON.parse(data);
        return sessions.map((s: any) => ({
          ...s,
          startTime: new Date(s.startTime),
          endTime: s.endTime ? new Date(s.endTime) : undefined,
        }));
      } catch (error) {
        console.error('Failed to get all sessions from AsyncStorage:', error);
        return [];
      }
    }
  }

  static async getSession(sessionId: string): Promise<MonitoringSession | null> {
    if (this.usingSQLite && this.db) {
      const sql = `SELECT * FROM monitoring_sessions WHERE id = ?`;
      try {
        const results = await this.db.executeSql(sql, [sessionId]);
        if (results && results.length > 0 && results[0].rows.length > 0) {
          const row = results[0].rows.item(0);
          return {
            id: row.id,
            startTime: new Date(row.start_time),
            endTime: row.end_time ? new Date(row.end_time) : undefined,
            deviceName: row.device_name,
            notes: row.notes,
            dataCount: row.data_count,
            isActive: Boolean(row.is_active),
          };
        }
        return null;
      } catch (error) {
        console.error('Failed to get session from SQLite:', error);
        return null;
      }
    } else {
      // AsyncStorage fallback
      try {
        const data = await AsyncStorage.getItem(this.SESSIONS_STORAGE_KEY);
        if (!data) return null;

        const sessions = JSON.parse(data);
        const session = sessions.find((s: any) => s.id === sessionId);
        if (!session) return null;

        return {
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
        };
      } catch (error) {
        console.error('Failed to get session from AsyncStorage:', error);
        return null;
      }
    }
  }

  static async getSessionReadings(sessionId: string): Promise<EnhancedSensorReading[]> {
    if (this.usingSQLite && this.db) {
      const sql = `
        SELECT * FROM sensor_readings
        WHERE session_id = ?
        ORDER BY timestamp DESC
      `;

      try {
        const results = await this.db.executeSql(sql, [sessionId]);
        const readings: EnhancedSensorReading[] = [];

        if (results && results.length > 0) {
          const rows = results[0].rows;
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            readings.push(this.rowToEnhancedReading(row));
          }
        }

        return readings;
      } catch (error) {
        console.error('Failed to get session readings from SQLite:', error);
        return [];
      }
    } else {
      // AsyncStorage fallback
      try {
        const data = await AsyncStorage.getItem(this.ENHANCED_READINGS_KEY);
        if (!data) return [];

        const allReadings = JSON.parse(data);
        return allReadings
          .filter((r: any) => r.sessionId === sessionId)
          .map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp),
          }))
          .sort((a: EnhancedSensorReading, b: EnhancedSensorReading) =>
            b.timestamp.getTime() - a.timestamp.getTime()
          );
      } catch (error) {
        console.error('Failed to get session readings from AsyncStorage:', error);
        return [];
      }
    }
  }

  // Enhanced data storage supporting Nordic sensor types
  static async saveNordicReading(
    sessionId: string,
    heartRateData?: HeartRateData,
    spO2Data?: SpO2Data,
    batteryData?: BatteryData,
    miscData?: MiscData,
  ): Promise<void> {
    if (!heartRateData && !spO2Data && !batteryData && !miscData) {
      return;
    }
    let timestamp: Date;

    if (heartRateData?.timestamp) {
      timestamp = heartRateData.timestamp;
    } else if (spO2Data?.timestamp) {
      timestamp = spO2Data.timestamp;
    } else if (miscData?.timestamp) {
      timestamp = miscData.timestamp;
    } else {
      timestamp = new Date();
    }

    const reading: EnhancedSensorReading = {
      id: this.generateId(),
      sessionId,
      deviceId: heartRateData?.deviceId || spO2Data?.deviceId || batteryData?.deviceId || miscData?.deviceId || 'unknown',
      timestamp,
      heartRate: heartRateData ? {
        value: heartRateData.heartRate,
        contactDetected: heartRateData.contactDetected,
      } : undefined,
      spO2: spO2Data ? {
        value: spO2Data.spO2,
        pulseRate: spO2Data.pulseRate,
      } : undefined,
      battery: batteryData ? {
        level: batteryData.level,
        voltage: miscData?.voltage,
      } : undefined,
      sensorStatus: miscData ? {
        confidence: miscData.confidence,
      } : undefined,
      rawData: JSON.stringify({
        heartRateData,
        spO2Data,
        batteryData,
        miscData,
      }),
    };

    await this.saveEnhancedReadings([reading]);
  }

  // Save buffered accelerometer readings (20 samples) to separate table
  static async saveAccelerometerReadings(
    sessionId: string,
    samples: BufferedAccelerometerData[]
  ): Promise<void> {
    if (!samples || samples.length === 0) {
      return;
    }

    if (this.usingSQLite && this.db) {
      const sql = `
          INSERT INTO accelerometer_readings
          (id, session_id, second_counter, sample_index, x, y, z, magnitude)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

      for (const sample of samples) {
        const values = [
          this.generateId(),
          sessionId,
          sample.secondCounter,
          sample.sampleIndex,
          sample.x,
          sample.y,
          sample.z,
          sample.magnitude,
        ];

        await this.db.executeSql(sql, values);
      }
    }
  }

  private static async saveEnhancedReadings(readings: EnhancedSensorReading[]): Promise<void> {
    if (this.usingSQLite && this.db) {
      // SQLite storage
      const sql = `
        INSERT INTO sensor_readings
        (id, session_id, device_id, timestamp, heart_rate, hr_contact_detected,
         spo2_value, spo2_pulse_rate, battery_level, battery_voltage, sensor_confidence, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      try {
        for (const reading of readings) {
          const values = [
            reading.id,
            reading.sessionId,
            reading.deviceId,
            reading.timestamp.getTime(),
            reading.heartRate?.value ?? null,
            reading.heartRate?.contactDetected ? 1 : (reading.heartRate ? 0 : null),
            reading.spO2?.value ?? null,
            reading.spO2?.pulseRate ?? null,
            reading.battery?.level ?? null,
            reading.battery?.voltage ?? null,
            reading.sensorStatus?.confidence ?? null,
            reading.rawData ?? null,
          ];

          await this.db.executeSql(sql, values);
          await this.incrementSessionDataCount(reading.sessionId);
        }
      } catch (error) {
        console.error('Failed to save enhanced readings to SQLite:', error);
        throw error;
      }
    } else {
      // AsyncStorage fallback
      try {
        const existingData = await AsyncStorage.getItem(this.ENHANCED_READINGS_KEY);
        const existingReadings = existingData ? JSON.parse(existingData) : [];

        const allReadings = [...existingReadings, ...readings.map(r => ({
          ...r,
          timestamp: r.timestamp.toISOString(),
        }))];

        await AsyncStorage.setItem(this.ENHANCED_READINGS_KEY, JSON.stringify(allReadings));

        // Update session data counts
        for (const reading of readings) {
          await this.incrementSessionDataCount(reading.sessionId);
        }
      } catch (error) {
        console.error('Failed to save enhanced readings to AsyncStorage:', error);
        throw error;
      }
    }
  }

  // Increment session data count
  private static async incrementSessionDataCount(sessionId: string): Promise<void> {
    if (this.usingSQLite && this.db) {
      try {
        await this.db.executeSql(
          'UPDATE monitoring_sessions SET data_count = data_count + 1 WHERE id = ?',
          [sessionId]
        );
      } catch (error) {
        console.error('Failed to increment session data count in SQLite:', error);
      }
    } else {
      try {
        const data = await AsyncStorage.getItem(this.SESSIONS_STORAGE_KEY);
        if (data) {
          const sessions = JSON.parse(data);
          const updated = sessions.map((s: any) =>
            s.id === sessionId
              ? { ...s, dataCount: (s.dataCount || 0) + 1 }
              : s
          );
          await AsyncStorage.setItem(this.SESSIONS_STORAGE_KEY, JSON.stringify(updated));
        }
      } catch (error) {
        console.error('Failed to increment session data count in AsyncStorage:', error);
      }
    }
  }

  // Legacy API compatibility for existing components
  static async addReading(heartRate: number): Promise<HeartRateReading[]> {
    try {
      // Get or create active session
      const activeSessions = await this.getActiveSessions();
      let sessionId = activeSessions[0]?.id;
      
      if (!sessionId) {
        const session = await this.createSession('Default Session', 'Auto-created session');
        sessionId = session.id;
      }

      // Create Nordic-compatible heart rate data
      const heartRateData: HeartRateData = {
        heartRate,
        contactDetected: true,
        timestamp: new Date(),
        deviceId: 'legacy_device',
      };

      await this.saveNordicReading(sessionId, heartRateData);

      // Return legacy format for compatibility
      return this.loadReadings();
    } catch (error) {
      console.error('Failed to add reading:', error);
      throw new Error('Failed to add heart rate reading');
    }
  }

  static async loadReadings(): Promise<HeartRateReading[]> {
    try {
      const readings = await this.getRecentReadings(this.RETENTION_HOURS);
      
      // Convert to legacy format
      return readings
        .filter(reading => reading.heartRate)
        .map(reading => ({
          id: reading.id,
          timestamp: reading.timestamp,
          heartRate: reading.heartRate!.value,
        }));
    } catch (error) {
      console.error('Failed to load readings:', error);
      return [];
    }
  }

  static async saveReadings(readings: HeartRateReading[]): Promise<void> {
    // Legacy compatibility method - just use addReading for each
    for (const reading of readings) {
      await this.addReading(reading.heartRate);
    }
  }

  // Enhanced data retrieval methods
  static async getRecentReadings(hours: number = 24): Promise<EnhancedSensorReading[]> {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

    if (this.usingSQLite && this.db) {
      // SQLite storage
      const sql = `
        SELECT * FROM sensor_readings 
        WHERE timestamp > ?
        ORDER BY timestamp DESC
        LIMIT 10000
      `;

      try {
        const results = await this.db.executeSql(sql, [cutoffTime]);
        const readings: EnhancedSensorReading[] = [];
        
        if (results && results.length > 0) {
          const rows = results[0].rows;
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            readings.push(this.rowToEnhancedReading(row));
          }
        }
        
        return readings;
      } catch (error) {
        console.error('Failed to get recent readings from SQLite:', error);
        return [];
      }
    } else {
      // AsyncStorage fallback
      try {
        const data = await AsyncStorage.getItem(this.ENHANCED_READINGS_KEY);
        if (!data) return [];

        const allReadings = JSON.parse(data);
        return allReadings
          .map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp),
          }))
          .filter((r: EnhancedSensorReading) => r.timestamp.getTime() > cutoffTime)
          .sort((a: EnhancedSensorReading, b: EnhancedSensorReading) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 10000);
      } catch (error) {
        console.error('Failed to get recent readings from AsyncStorage:', error);
        return [];
      }
    }
  }

  // Get accelerometer readings from separate table
  static async getAccelerometerReadings(sessionId: string, limit?: number, offset?: number): Promise<BufferedAccelerometerData[]> {
    if (this.usingSQLite && this.db) {
      try {
        let query = `SELECT * FROM accelerometer_readings 
           WHERE session_id = ? 
           ORDER BY second_counter ASC, sample_index ASC`;
        const params: any[] = [sessionId];
        
        if (limit !== undefined) {
          query += ` LIMIT ?`;
          params.push(limit);
        }
        if (offset !== undefined) {
          query += ` OFFSET ?`;
          params.push(offset);
        }

        const result = await this.db.executeSql(query, params);

        const readings: BufferedAccelerometerData[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);
          readings.push({
            x: row.x,
            y: row.y,
            z: row.z,
            magnitude: row.magnitude,
            secondCounter: row.second_counter,
            sampleIndex: row.sample_index,
          });
        }

        return readings;
      } catch (error) {
        console.error('Failed to get accelerometer readings:', error);
        return [];
      }
    } else {
      // AsyncStorage fallback
      try {
        const key = `${this.LEGACY_STORAGE_KEY}_accel_${sessionId}`;
        const data = await AsyncStorage.getItem(key);
        if (!data) return [];

        const readings = JSON.parse(data);
        return readings.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          unit: 'g' as const,
        }));
      } catch (error) {
        console.error('Failed to get accelerometer readings from AsyncStorage:', error);
        return [];
      }
    }
  }

  // Get downsampled accelerometer readings for charting
  // Gets the first sample from every Nth secondCounter (default: every 10th = one sample per 20 seconds)
  static async getAccelerometerReadingsDownsampled(
    sessionId: string, 
    secondCounterInterval: number = 10
  ): Promise<BufferedAccelerometerData[]> {
    if (this.usingSQLite && this.db) {
      try {
        // Get first sample (sample_index = 0) from every Nth secondCounter using modulus
        const result = await this.db.executeSql(
          `SELECT * FROM accelerometer_readings 
           WHERE session_id = ? 
           AND sample_index = 0
           AND second_counter % ? = 0
           ORDER BY second_counter ASC`,
          [sessionId, secondCounterInterval]
        );

        const readings: BufferedAccelerometerData[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);
          readings.push({
            x: row.x,
            y: row.y,
            z: row.z,
            magnitude: row.magnitude,
            secondCounter: row.second_counter,
            sampleIndex: row.sample_index,
          });
        }

        console.log(`📊 Loaded ${readings.length} downsampled accelerometer readings (first sample from every ${secondCounterInterval}th secondCounter)`);
        return readings;
      } catch (error) {
        console.error('Failed to get downsampled accelerometer readings:', error);
        return [];
      }
    } else {
      // AsyncStorage fallback - manually filter
      try {
        const key = `${this.LEGACY_STORAGE_KEY}_accel_${sessionId}`;
        const data = await AsyncStorage.getItem(key);
        if (!data) return [];

        const readings = JSON.parse(data);
        const downsampled = readings.filter((r: any) => 
          r.sampleIndex === 0 && r.secondCounter % secondCounterInterval === 0
        );
        return downsampled.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          unit: 'g' as const,
        }));
      } catch (error) {
        console.error('Failed to get downsampled accelerometer readings from AsyncStorage:', error);
        return [];
      }
    }
  }

  private static rowToEnhancedReading(row: any): EnhancedSensorReading {
    return {
      id: row.id,
      sessionId: row.session_id,
      deviceId: row.device_id,
      timestamp: new Date(row.timestamp),
      heartRate: row.heart_rate !== null && row.heart_rate !== undefined ? {
        value: row.heart_rate,
        contactDetected: Boolean(row.hr_contact_detected),
      } : undefined,
      spO2: row.spo2_value !== null && row.spo2_value !== undefined ? {
        value: row.spo2_value,
        pulseRate: row.spo2_pulse_rate || 0,
      } : undefined,
      battery: row.battery_level !== null && row.battery_level !== undefined ? {
        level: row.battery_level,
        voltage: row.battery_voltage ?? undefined,
      } : undefined,
      sensorStatus: row.sensor_confidence !== null && row.sensor_confidence !== undefined ? {
        confidence: row.sensor_confidence,
      } : undefined,
      accelerometer: undefined, // Accelerometer now in separate table
      rawData: row.raw_data,
    };
  }

  // Data analysis methods (enhanced)
  static calculateAverage(readings: HeartRateReading[]): number | null {
    const validReadings = readings.filter(reading => reading.heartRate > 0);
    if (validReadings.length === 0) return null;
    
    const sum = validReadings.reduce((acc, reading) => acc + reading.heartRate, 0);
    return Math.round(sum / validReadings.length);
  }

  static getReadingsInTimeRange(
    readings: HeartRateReading[], 
    hours: number
  ): HeartRateReading[] {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return readings.filter(reading => reading.timestamp >= cutoffTime);
  }

  static getMinMaxHeartRate(readings: HeartRateReading[]): { min: number; max: number } | null {
    if (readings.length === 0) return null;
    
    const heartRates = readings.map(r => r.heartRate);
    return {
      min: Math.min(...heartRates),
      max: Math.max(...heartRates),
    };
  }

  static formatTimeString(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  static async clearAllData(): Promise<void> {
    if (this.usingSQLite && this.db) {
      try {
        await this.db.executeSql('DELETE FROM sensor_readings');
        await this.db.executeSql('DELETE FROM monitoring_sessions');
      } catch (error) {
        console.error('Failed to clear SQLite data:', error);
      }
    }
    
    // Also clear AsyncStorage
    try {
      await AsyncStorage.removeItem(this.ENHANCED_READINGS_KEY);
      await AsyncStorage.removeItem(this.SESSIONS_STORAGE_KEY);
      await AsyncStorage.removeItem(this.LEGACY_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear AsyncStorage data:', error);
    }
  }

  private static generateId(): string {
    return `hr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Delete a session and all its readings
  static async deleteSession(sessionId: string): Promise<void> {
    if (this.usingSQLite && this.db) {
      try {
        // Delete readings first (foreign key relationship)
        await this.db.executeSql(
          'DELETE FROM sensor_readings WHERE session_id = ?',
          [sessionId]
        );

        // Then delete session
        await this.db.executeSql(
          'DELETE FROM monitoring_sessions WHERE id = ?',
          [sessionId]
        );
      } catch (error) {
        console.error('Failed to delete session from SQLite:', error);
        throw error;
      }
    } else {
      // AsyncStorage fallback
      try {
        // Delete session
        const sessionsData = await AsyncStorage.getItem(this.SESSIONS_STORAGE_KEY);
        if (sessionsData) {
          const sessions = JSON.parse(sessionsData);
          const filteredSessions = sessions.filter((s: any) => s.id !== sessionId);
          await AsyncStorage.setItem(
            this.SESSIONS_STORAGE_KEY,
            JSON.stringify(filteredSessions)
          );
        }

        // Delete readings
        const readingsData = await AsyncStorage.getItem(this.ENHANCED_READINGS_KEY);
        if (readingsData) {
          const readings = JSON.parse(readingsData);
          const filteredReadings = readings.filter((r: any) => r.sessionId !== sessionId);
          await AsyncStorage.setItem(
            this.ENHANCED_READINGS_KEY,
            JSON.stringify(filteredReadings)
          );
        }
      } catch (error) {
        console.error('Failed to delete session from AsyncStorage:', error);
        throw error;
      }
    }
  }

  // **NEW: Data Export Functionality**
  static async exportSessionData(sessionId: string): Promise<string> {
    try {
      const session = await this.getSession(sessionId);
      const readings = await this.getSessionReadings(sessionId);

      const exportData = {
        session: {
          id: session?.id,
          deviceName: session?.deviceName,
          startTime: session?.startTime,
          endTime: session?.endTime,
          duration: session?.endTime && session?.startTime
            ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
            : 0,
          dataCount: session?.dataCount || 0,
          notes: session?.notes,
        },
        readings: readings.map(r => ({
          timestamp: r.timestamp,
          deviceId: r.deviceId,
          heartRate: r.heartRate,
          spO2: r.spO2,
          battery: r.battery,
          sensorStatus: r.sensorStatus,
        })),
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export session data:', error);
      throw error;
    }
  }

  static async exportAllData(): Promise<string> {
    try {
      const sessions = await this.getAllSessions();
      const allData = [];

      for (const session of sessions) {
        const readings = await this.getSessionReadings(session.id);
        allData.push({
          session: {
            id: session.id,
            deviceName: session.deviceName,
            startTime: session.startTime.toISOString(),
            endTime: session.endTime?.toISOString(),
            durationSeconds: session.endTime
              ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
              : null,
            dataCount: session.dataCount,
            notes: session.notes,
            isActive: session.isActive,
          },
          readings: readings.map(r => ({
            timestamp: r.timestamp.toISOString(),
            timestampMs: r.timestamp.getTime(),
            deviceId: r.deviceId,
            heartRate: r.heartRate ? {
              bpm: r.heartRate.value,
              contactDetected: r.heartRate.contactDetected,
            } : null,
            spO2: r.spO2 ? {
              percentage: r.spO2.value,
              pulseRate: r.spO2.pulseRate,
            } : null,
            battery: r.battery ? {
              level: r.battery.level,
              voltage: r.battery.voltage ? Number(r.battery.voltage.toFixed(2)) : null,
            } : null,
            sensorStatus: r.sensorStatus ? {
              confidence: r.sensorStatus.confidence,
            } : null,
          })),
        });
      }

      const exportData = {
        exportInfo: {
          exportedAt: new Date().toISOString(),
          appVersion: '1.0.0',
          totalSessions: sessions.length,
          totalReadings: allData.reduce((sum, s) => sum + s.readings.length, 0),
        },
        sessions: allData,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export all data:', error);
      throw error;
    }
  }

  // **NEW: CSV Export - Research-friendly format**
  static async exportAllDataCSV(): Promise<string> {
    try {
      const sessions = await this.getAllSessions();

      // Enhanced CSV header - only columns from sensor_readings table
      let csv = 'Session_End,Session_Duration_Minutes,Timestamp_Unix_ms,Timestamp_ISO,Time_Since_Session_Start_Seconds,HR_BPM,HR_Contact_Detected,SpO2_Percent,SpO2_Pulse_Rate_BPM,Battery_Percent,Battery_Voltage_V,Sensor_Confidence_Percent,Device_ID\n';

      // Process each session
      for (const session of sessions) {
        const readings = await this.getSessionReadings(session.id);
        const sessionStartMs = session.startTime.getTime();
        const sessionEndMs = session.endTime?.getTime();
        const durationMinutes = sessionEndMs
          ? ((sessionEndMs - sessionStartMs) / 1000 / 60).toFixed(2)
          : '';

        for (const reading of readings) {
          const timestampMs = reading.timestamp.getTime();
          const secondsSinceStart = ((timestampMs - sessionStartMs) / 1000).toFixed(3);

          const row = [
            // Session End
            session.endTime?.toISOString() || '',

            // Session Duration
            durationMinutes,

            // Timestamp Info
            timestampMs,
            reading.timestamp.toISOString(),
            secondsSinceStart,

            // Heart Rate Data
            reading.heartRate?.value ?? '',
            reading.heartRate?.contactDetected ? 'YES' : (reading.heartRate ? 'NO' : ''),

            // SpO2 Data
            reading.spO2?.value ?? '',
            reading.spO2?.pulseRate ?? '',

            // Battery Data
            reading.battery?.level ?? '',
            reading.battery?.voltage?.toFixed(2) ?? '',

            // Sensor Status
            reading.sensorStatus?.confidence ?? '',

            // Device ID
            reading.deviceId,
          ];
          csv += row.join(',') + '\n';
        }
      }

      return csv;
    } catch (error) {
      console.error('Failed to export CSV:', error);
      throw error;
    }
  }

  static async exportSessionCSV(sessionId: string): Promise<string> {
    try {
      const session = await this.getSession(sessionId);
      const readings = await this.getSessionReadings(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      // Enhanced CSV header - same format as exportAllDataCSV
      let csv = '';

      // Section 1: Timestamp Info
      csv += 'Timestamp_Unix_ms,Timestamp_ISO,Time_Since_Start_Seconds,Time_Since_Start_Minutes,';

      // Section 2: Heart Rate Data
      csv += 'HR_BPM,HR_Contact_Detected,';

      // Section 3: SpO2 Data
      csv += 'SpO2_Percent,SpO2_Pulse_Rate_BPM,';

      // Section 4: Battery Data
      csv += 'Battery_Percent,Battery_Voltage_V,';

      // Section 5: Sensor Status
      csv += 'Sensor_Confidence_Percent,';

      // Section 6: Metadata
      csv += 'Device_ID\n';

      const sessionStartMs = session.startTime.getTime();

      for (const reading of readings) {
        const timestampMs = reading.timestamp.getTime();
        const secondsSinceStart = ((timestampMs - sessionStartMs) / 1000).toFixed(3);
        const minutesSinceStart = ((timestampMs - sessionStartMs) / 1000 / 60).toFixed(3);

        const row = [
          // Timestamp Info
          timestampMs,
          reading.timestamp.toISOString(),
          secondsSinceStart,
          minutesSinceStart,

          // Heart Rate Data
          reading.heartRate?.value ?? '',
          reading.heartRate?.contactDetected ? 'YES' : (reading.heartRate ? 'NO' : ''),

          // SpO2 Data
          reading.spO2?.value ?? '',
          reading.spO2?.pulseRate ?? '',

          // Battery Data
          reading.battery?.level ?? '',
          reading.battery?.voltage?.toFixed(2) ?? '',

          // Sensor Status
          reading.sensorStatus?.confidence ?? '',

          // Metadata
          reading.deviceId,
        ];
        csv += row.join(',') + '\n';
      }

      return csv;
    } catch (error) {
      console.error('Failed to export session CSV:', error);
      throw error;
    }
  }

  // Export accelerometer data as CSV
  static async exportSessionAccelerometerCSV(sessionId: string): Promise<string> {
    try {
      const session = await this.getSession(sessionId);
      const accelReadings = await this.getAccelerometerReadings(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      // CSV header for accelerometer data
      let csv = 'Second_Counter,Sample_Index,X_mG,Y_mG,Z_mG,Magnitude_mG\n';

      for (const reading of accelReadings) {
        const row = [
          reading.secondCounter,
          reading.sampleIndex,
          reading.x,
          reading.y,
          reading.z,
          reading.magnitude,
        ];
        csv += row.join(',') + '\n';
      }

      return csv;
    } catch (error) {
      console.error('Failed to export accelerometer CSV:', error);
      throw error;
    }
  }

  // Export accelerometer data as JSON
  static async exportSessionAccelerometerJSON(sessionId: string): Promise<string> {
    try {
      const session = await this.getSession(sessionId);
      const accelReadings = await this.getAccelerometerReadings(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      const exportData = {
        session: {
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          deviceName: session.deviceName,
          notes: session.notes,
        },
        accelerometerReadings: accelReadings.map(reading => ({
          secondCounter: reading.secondCounter,
          sampleIndex: reading.sampleIndex,
          x: reading.x,
          y: reading.y,
          z: reading.z,
          magnitude: reading.magnitude,
        })),
        metadata: {
          totalSamples: accelReadings.length,
          exportDate: new Date().toISOString(),
        },
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export accelerometer JSON:', error);
      throw error;
    }
  }

  // **NEW: Lightweight session summary (NO data loading)**
  static async getSessionSummary(sessionId: string): Promise<{
    session: MonitoringSession | null;
    readingCount: number;
    firstReading: Date | null;
    lastReading: Date | null;
    duration: number; // seconds
  } | null> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;

      let readingCount = 0;
      let firstReading: Date | null = null;
      let lastReading: Date | null = null;

      if (this.usingSQLite && this.db) {
        // Fast count query (no data loading)
        const countResult = await this.db.executeSql(
          'SELECT COUNT(*) as count, MIN(timestamp) as first, MAX(timestamp) as last FROM sensor_readings WHERE session_id = ?',
          [sessionId]
        );
        if (countResult && countResult.length > 0) {
          const row = countResult[0].rows.item(0);
          readingCount = row.count;
          firstReading = row.first ? new Date(row.first) : null;
          lastReading = row.last ? new Date(row.last) : null;
        }
      } else {
        // AsyncStorage - still need to load but only count
        const data = await AsyncStorage.getItem(this.ENHANCED_READINGS_KEY);
        if (data) {
          const readings = JSON.parse(data).filter((r: any) => r.sessionId === sessionId);
          readingCount = readings.length;
          if (readings.length > 0) {
            const timestamps = readings.map((r: any) => new Date(r.timestamp).getTime());
            firstReading = new Date(Math.min(...timestamps));
            lastReading = new Date(Math.max(...timestamps));
          }
        }
      }

      const duration = lastReading && firstReading
        ? (lastReading.getTime() - firstReading.getTime()) / 1000
        : 0;

      return {
        session,
        readingCount,
        firstReading,
        lastReading,
        duration,
      };
    } catch (error) {
      console.error('Failed to get session summary:', error);
      return null;
    }
  }

  // **NEW: Database Statistics**
  static async getDatabaseStats(): Promise<{
    totalReadings: number;
    totalSessions: number;
    oldestReading: Date | null;
    newestReading: Date | null;
    databaseSize: string;
    storageType: 'SQLite' | 'AsyncStorage';
  }> {
    let totalReadings = 0;
    let totalSessions = 0;
    let oldestReading: Date | null = null;
    let newestReading: Date | null = null;

    if (this.usingSQLite && this.db) {
      try {
        // Count total readings
        const countResult = await this.db.executeSql(
          'SELECT COUNT(*) as count FROM sensor_readings'
        );
        totalReadings = countResult[0].rows.item(0).count;

        // Count total sessions
        const sessionCountResult = await this.db.executeSql(
          'SELECT COUNT(*) as count FROM monitoring_sessions'
        );
        totalSessions = sessionCountResult[0].rows.item(0).count;

        // Get oldest and newest readings
        const rangeResult = await this.db.executeSql(
          'SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM sensor_readings'
        );
        const range = rangeResult[0].rows.item(0);
        oldestReading = range.oldest ? new Date(range.oldest) : null;
        newestReading = range.newest ? new Date(range.newest) : null;
      } catch (error) {
        console.error('Failed to get SQLite stats:', error);
      }
    } else {
      // AsyncStorage fallback
      try {
        const readingsData = await AsyncStorage.getItem(this.ENHANCED_READINGS_KEY);
        if (readingsData) {
          const readings = JSON.parse(readingsData);
          totalReadings = readings.length;
          if (readings.length > 0) {
            const timestamps = readings.map((r: any) => new Date(r.timestamp).getTime());
            oldestReading = new Date(Math.min(...timestamps));
            newestReading = new Date(Math.max(...timestamps));
          }
        }

        const sessionsData = await AsyncStorage.getItem(this.SESSIONS_STORAGE_KEY);
        if (sessionsData) {
          const sessions = JSON.parse(sessionsData);
          totalSessions = sessions.length;
        }
      } catch (error) {
        console.error('Failed to get AsyncStorage stats:', error);
      }
    }

    // Estimate database size (rough calculation)
    const avgRecordSize = 200; // bytes per record (estimated)
    const estimatedBytes = totalReadings * avgRecordSize;
    const databaseSize = this.formatBytes(estimatedBytes);

    return {
      totalReadings,
      totalSessions,
      oldestReading,
      newestReading,
      databaseSize,
      storageType: this.usingSQLite ? 'SQLite' : 'AsyncStorage',
    };
  }

  // **NEW: Database Maintenance - Clean old data**
  static async cleanOldData(daysToKeep: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    if (this.usingSQLite && this.db) {
      try {
        // Delete old sensor readings
        const result = await this.db.executeSql(
          'DELETE FROM sensor_readings WHERE timestamp < ?',
          [cutoffTime]
        );
        deletedCount = result[0].rowsAffected;

        // Delete old accelerometer readings (IMPORTANT: This table grows fastest!)
        // Delete by session_id since accelerometer_readings doesn't have timestamp
        const accelResult = await this.db.executeSql(
          `DELETE FROM accelerometer_readings 
           WHERE session_id IN (
             SELECT id FROM monitoring_sessions WHERE start_time < ?
           )`,
          [cutoffTime]
        );
        console.log(`🗑️ Deleted ${accelResult[0].rowsAffected} old accelerometer readings`);

        // Delete old sessions
        await this.db.executeSql(
          'DELETE FROM monitoring_sessions WHERE start_time < ?',
          [cutoffTime]
        );

        console.log(`🗑️ Deleted ${deletedCount} old sensor readings and associated data`);
      } catch (error) {
        console.error('Failed to clean old SQLite data:', error);
      }
    } else {
      // AsyncStorage fallback
      try {
        const readingsData = await AsyncStorage.getItem(this.ENHANCED_READINGS_KEY);
        if (readingsData) {
          const readings = JSON.parse(readingsData);
          const filtered = readings.filter((r: any) =>
            new Date(r.timestamp).getTime() >= cutoffTime
          );
          deletedCount = readings.length - filtered.length;
          await AsyncStorage.setItem(this.ENHANCED_READINGS_KEY, JSON.stringify(filtered));
        }

        const sessionsData = await AsyncStorage.getItem(this.SESSIONS_STORAGE_KEY);
        if (sessionsData) {
          const sessions = JSON.parse(sessionsData);
          const filtered = sessions.filter((s: any) =>
            new Date(s.startTime).getTime() >= cutoffTime
          );
          await AsyncStorage.setItem(this.SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch (error) {
        console.error('Failed to clean old AsyncStorage data:', error);
      }
    }

    return deletedCount;
  }

  static async optimizeDatabase(): Promise<void> {
    if (this.usingSQLite && this.db) {
      try {
        await this.db.executeSql('VACUUM');
        await this.db.executeSql('ANALYZE');
      } catch (error) {
        console.error('Failed to optimize database:', error);
      }
    }
  }

  // Helper: Format bytes to human-readable
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default DataManager;