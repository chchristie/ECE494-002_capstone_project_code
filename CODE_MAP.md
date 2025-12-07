# CODE MAP - Heart Rate Monitor Clean

**Comprehensive architectural documentation for the React Native Heart Rate Monitor app with Arduino firmware.**

**Last Updated:** 2025-11-09
**Project Version:** 1.0.0
**React Native:** 0.73.2
**Target Platform:** Android (with iOS stubs)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Summary](#architecture-summary)
3. [React Native Files](#react-native-files)
4. [Android Native Modules](#android-native-modules)
5. [Arduino Firmware](#arduino-firmware)
6. [Database Schema](#database-schema)
7. [BLE Service UUIDs](#ble-service-uuids)
8. [Configuration Files](#configuration-files)
9. [Data Flow Diagram](#data-flow-diagram)
10. [Development Workflow](#development-workflow)

---

## Project Overview

This is a **React Native mobile application** for continuous monitoring of:
- Heart Rate (BPM)
- SpO2 (blood oxygen saturation %)
- Accelerometer data (3-axis motion tracking)
- Battery level

**Hardware:**
- XIAO Seeed nRF52840
- SparkFun MAX30101 biosensor (Heart Rate + SpO2)
- LSM6DS3 IMU (Accelerometer)
- RTC for timestamps

**Key Features:**
- Real-time BLE data streaming (10 Hz)
- 24/7 background monitoring (Android Foreground Service)
- SQLite database with session management
- CSV export for research data analysis

---

## Architecture Summary

### **Three-Tier Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│  React Native Screens (Dashboard, HeartRate, Trends, Motion)   │
│  Custom Tab Navigation | ErrorBoundary | Loading States        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       BUSINESS LOGIC LAYER                      │
│  BluetoothContext (useReducer state management)                 │
│  DataManager (SQLite database)                                  │
│  NordicDataParser (BLE packet parsing)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│  SQLite Database (sensor_readings, monitoring_sessions, accelerometer_readings) │
│  Android Foreground Service (background wake locks)            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         HARDWARE LAYER                          │
│  Arduino nRF52840 | BLE GATT Services | Sensor I2C Bus         │
│  Services: 0x180D (HR), 0x1822 (SpO2), 0x1819 (Accel)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## React Native Files

### **Core Application**

#### `App.tsx`
**Location:** `App.tsx`

**Purpose:** Main entry point, custom tab navigation, database initialization

**Key Exports:**
- `App` component (default export)

**Important Functions:**
- Line 158-178: `initializeApp()` - Initializes SQLite DataManager on startup
- Line 202-214: `mockNavigation` - Mock navigation object for screen routing
- Line 223-226: `handleTabPress()` - Tab switching logic

**Dependencies:**
- BluetoothProvider (context wrapper)
- DataManager (database initialization)
- All screen components (Dashboard, HeartRate, Trends, Accelerometer, etc.)

**State Management:**
- `activeTab` - Currently displayed screen
- `isInitializing` - Database loading state
- `initError` - Initialization error message

**Navigation:**
Custom tab bar with 4 main tabs (no React Navigation dependency):
- Dashboard (Home)
- Activity (Heart Rate)
- Trends (Historical data)
- Motion (Accelerometer)

---

### **Context & State Management**

#### `src/context/BluetoothContext.tsx`
**Location:** `src/context/BluetoothContext.tsx`

**Purpose:** Global Bluetooth state management, BLE event handling, data buffering

**Key Exports:**
- `BluetoothProvider` - Context provider component
- `useBluetooth()` - Hook to access Bluetooth context
- `BluetoothContextValue` - TypeScript interface

**Important Functions:**

**BLE Core:**
- Line 617-627: `checkBluetoothState()` - Check if BLE is enabled
- Line 629-661: `requestPermissions()` - Request Android BLE permissions
- Line 663-697: `startScan()` - Scan for Nordic devices (20 seconds)
- Line 699-711: `stopScan()` - Stop scanning
- Line 713-782: `connectToDevice()` - Connect to device, auto-subscribe to characteristics
- Line 823-852: `disconnectDevice()` - Disconnect and cleanup

**Subscription Methods:**
- Line 854-893: `subscribeToHeartRate()` - Subscribe to HR notifications (UUID 2A37)
- Line 895-932: `subscribeToSpO2()` - Subscribe to SpO2 notifications (UUID 2A5E)
- Line 934-971: `subscribeToBattery()` - Subscribe to battery notifications (UUID 2A19)
- Line 973-1011: `subscribeToAccelerometer()` - Subscribe to accel notifications (UUID 2A5C)

**Device Control:**
- `writeControlCharacteristic()` - Write reset commands to Arduino control characteristic

**Data Flow:**
- Line 360-584: `handleCharacteristicValueUpdate()` - Main BLE event handler
  - Parses incoming BLE packets using NordicDataParser
  - Accumulates sensor data into buffer (Line 482-497)
  - Writes to database immediately (Line 501-534)
  - Throttles UI updates to 2 Hz (Line 537-578)

**Key State:**
- `state` - Bluetooth state (reducer pattern)
- `sensorData` - Current sensor readings (HR, SpO2, Battery, Accel)
- `activeSessionId` - Current monitoring session ID
- `dbWriteBufferRef` - Buffer for batching database writes

**Device Detection:**
- Filters devices by advertising HRM (0x180D) or SpO2 (0x1822) service
- Generic filtering - no device name or manufacturer restrictions

**Background Monitoring:**
- Line 747-756: Starts Android Foreground Service on connection
- Line 834-839: Stops Foreground Service on disconnection

---

### **Services**

#### `src/services/DataManager.ts`
**Location:** `src/services/DataManager.ts`

**Purpose:** SQLite database management and data export

**Key Exports:**
- `DataManager` class (default export)
- `EnhancedSensorReading` interface
- `MonitoringSession` interface
- `HeartRateReading` interface (legacy)

**Database Schema:**
- Line 144-167: `sensor_readings` table definition
- Line 169-180: `monitoring_sessions` table definition

**Core Functions:**

**Initialization:**
- `initialize()` - Opens SQLite database
- `createTables()` - Creates sensor_readings, monitoring_sessions, and accelerometer_readings tables

**Session Management:**
- Line 365-413: `createSession()` - Create new monitoring session
- Line 415-449: `endSession()` - Mark session as ended
- Line 451-504: `getActiveSessions()` - Get all active sessions
- Line 506-556: `getAllSessions()` - Get all sessions (active + ended)
- Line 558-600: `getSession()` - Get session by ID
- Line 602-648: `getSessionReadings()` - Get all readings for a session

**Data Storage:**
- `saveNordicReading()` - Save heart rate, SpO2, battery, and accelerometer data
- `saveEnhancedReadings()` - SQLite INSERT for sensor readings
- `saveAccelerometerReadings()` - SQLite INSERT for accelerometer data with timestamps

**Data Retrieval:**
- Line 906-955: `getRecentReadings()` - Get readings from last N hours
- Line 957-988: `rowToEnhancedReading()` - Convert SQLite row to TypeScript object

**Data Export:**
- Line 1107-1141: `exportSessionData()` - Export session as JSON
- Line 1143-1206: `exportAllData()` - Export all sessions as JSON
- Line 1209-1273: `exportAllDataCSV()` - Export all data as research-grade CSV
- Line 1275-1353: `exportSessionCSV()` - Export single session as CSV
  - **CSV Headers:**
    - Timestamp info: Unix ms, ISO string, seconds/minutes since start
    - Heart Rate: BPM, contact detected, signal quality, RR intervals
    - SpO2: Percentage, pulse rate, signal quality
    - Battery: Percentage
    - Accelerometer: Raw X/Y/Z (int16), Calculated X/Y/Z (g), Magnitude
    - Metadata: Device ID

**Legacy API (backward compatibility):**
- Line 850-878: `addReading()` - Add legacy heart rate reading
- Line 880-896: `loadReadings()` - Load legacy readings
- Line 898-903: `saveReadings()` - Save legacy readings

**Database Maintenance:**
- Line 1024-1042: `clearAllData()` - Delete all data
- Line 1053-1104: `deleteSession()` - Delete session and all its readings
- Line 1492-1542: `cleanOldData()` - Delete data older than N days
- Line 1545-1555: `optimizeDatabase()` - Run SQLite VACUUM and ANALYZE

**Statistics:**
- Line 1356-1412: `getSessionSummary()` - Lightweight summary (no data loading)
- Line 1415-1489: `getDatabaseStats()` - Total readings, sessions, size estimate

---

#### `src/services/nordic-ble-services.ts`
**Location:** `C:\Users\julia\Documents\HeartRateMonitorClean\src\services\nordic-ble-services.ts`

**Purpose:** BLE service/characteristic UUIDs, data parsing utilities

**Key Exports:**

**Service UUIDs:**
- `STANDARD_SERVICES` (Line 5-11):
  - HEART_RATE: '180D'
  - BATTERY_SERVICE: '180F'
  - PULSE_OXIMETER: '1822'
  - MOTION_SERVICE: '1819'

**Characteristic UUIDs:**
- `STANDARD_CHARACTERISTICS` (Line 14-38):
  - HEART_RATE_MEASUREMENT: '2A37'
  - BATTERY_LEVEL: '2A19'
  - PLX_SPOT_CHECK_MEASUREMENT: '2A5E'
  - ACCELEROMETER: '2A5C'

**SeedStudio Custom:**
- `SEEDSTUDIO_SERVICES` - Accelerometer service
- `SEEDSTUDIO_CHARACTERISTICS` - Accelerometer data, misc data, control

**Data Interfaces:**
- Line 105-113: `HeartRateData`
- Line 115-122: `SpO2Data`
- Line 124-129: `BatteryData`
- Line 131-148: `AccelerometerData`
  - `raw_x`, `raw_y`, `raw_z` - Int16 values from Arduino
  - `x`, `y`, `z` - Calculated g units
  - `magnitude` - Vector magnitude
  - `timestamp` - Timestamp in milliseconds

**Parsing Class:**
`NordicDataParser` (Line 214-540):
- Line 316-378: `parseHeartRateData()` - Standard BLE Heart Rate format
  - Parses flags, HR value (8-bit or 16-bit)
  - Optional: energy expended, RR intervals
  - Returns null if validation fails

- Line 381-409: `parseSpO2Data()` - SeedStudio SpO2 format
  - Expects: [SpO2%, PulseRate, SignalQuality]
  - Validates: SpO2 70-100%, Pulse 30-220 BPM

- Line 412-423: `parseBatteryData()` - Single byte (0-100%)

- Line 426-499: `parseAccelerometerData()` - **CRITICAL FUNCTION**
  - **Line 434-458:** Checks for 14-byte timestamped format
    - Bytes 0-7: Unix timestamp (little-endian, 64-bit)
    - Bytes 8-13: Accelerometer data (X, Y, Z as int16)
  - **Line 440-450:** Validates Arduino timestamp is reasonable (2020-2030)
    - If invalid (e.g., 0 or future date), falls back to phone time
  - **Line 461-463:** Parses 3x 16-bit signed integers (LSB first)
  - **Line 467-470:** Converts raw values to g units (scale factor 16384 for ±2g)
  - **Line 473:** Calculates magnitude: √(x² + y² + z²)
  - Returns null if validation fails

**Type Guards:**
- Line 169-181: `isValidHeartRateData()` - Validates HR 30-220 BPM (or 0 for no contact)
- Line 183-194: `isValidSpO2Data()` - Validates SpO2 70-100%, Pulse 30-220
- Line 196-211: `isValidAccelerometerData()` - Validates accel range ±200g (raw sensor values)

---

#### `src/services/BackgroundMonitoring.ts`
**Location:** `C:\Users\julia\Documents\HeartRateMonitorClean\src\services\BackgroundMonitoring.ts`

**Purpose:** React Native bridge to Android Foreground Service

**Key Exports:**
- `BackgroundMonitoring` - Platform-specific implementation
- `BackgroundMonitoringService` interface

**Methods:**
- Line 14-20: `startMonitoring()` - Starts foreground service (Android only)
- Line 22-28: `stopMonitoring()` - Stops foreground service
- Line 30-35: `isMonitoring()` - Check if service is running

**Platform Support:**
- Android: Uses native `ForegroundServiceModule` (Kotlin bridge)
- iOS: Stub implementation (returns "Not supported")

---

### **Screens**

#### `src/screens/DashboardScreen.tsx`
**Purpose:** Overview screen with quick stats and connection status

**Key Features:**
- Connection status indicator
- Current heart rate, SpO2, battery level
- Quick navigation to other screens

---

#### `src/screens/HeartRateScreen.tsx`
**Purpose:** Real-time heart rate monitoring with live chart

**Key Features:**
- Large BPM display
- Real-time line chart
- Heart rate zones (resting, fat burn, cardio, peak)
- Contact detection indicator

---

#### `src/screens/AccelerometerScreen.tsx`
**Purpose:** 3D accelerometer visualization

**Key Features:**
- X, Y, Z axis values in g units
- Vector magnitude
- Bar chart visualization
- Movement intensity indicator (normal/medium/high)
- Statistics: average, peak, sample count

**Data Format:**
- Reads from `BluetoothContext.sensorData.accelerometer`
- Updates every 100ms from Arduino

---

#### `src/screens/TrendsScreen.tsx`
**Purpose:** Historical data visualization with charts

**Key Features:**
- Time-series line charts (heart rate, SpO2 over time)
- Date range selection
- Average/min/max statistics
- Export button for CSV download

---

#### `src/screens/BluetoothScreen.tsx`
**Purpose:** Device scanning, connection management, session list

**Key Features:**
- Start/stop scanning
- Device list with RSSI signal strength
- Connect/disconnect buttons
- Active session indicator
- Session list with "View Details" buttons
- Export session data to CSV

---

#### `src/screens/SessionsScreen.tsx`
**Purpose:** Session history and management

**Key Features:**
- List all monitoring sessions
- Session duration, data count
- Delete sessions
- Export individual sessions

---

#### `src/screens/DataManagementScreen.tsx`
**Purpose:** Settings and data management

**Key Features:**
- Database statistics (total readings, sessions, storage size)
- Clear all data button
- Export all data (JSON/CSV)
- Sensor settings (accelerometer enable/disable)
- Device control (biosensor reset, system reset)
- App version info

---

### **Utilities**

#### `src/utils/csvParser.ts`
**Purpose:** Parse CSV files for data import/export

---

---

### **Types**

#### `src/types/simple-navigation.ts`
**Purpose:** TypeScript types for custom navigation

**Key Exports:**
- `SimpleNavigationProps` - Screen navigation props
- Mock navigation interface (navigate, goBack, canGoBack)

---

#### `src/types/index.ts`
**Purpose:** Global type definitions

---

## Android Native Modules

### **Foreground Service**

#### `android/app/src/main/java/com/heartratemonitorclean/BleMonitoringForegroundService.kt`
**Location:** Full path as above

**Purpose:** Native Android foreground service for 24/7 background monitoring

**Key Features:**

**Service Lifecycle:**
- Line 71-108: `onCreate()` - Creates notification channel, acquires wake locks
  - **Line 92-97:** CPU wake lock (PARTIAL_WAKE_LOCK)
  - **Line 101-105:** JavaScript thread wake lock (prevents RN thread pause)

- Line 110-116: `onStartCommand()` - Updates notification, returns START_STICKY
  - `START_STICKY` ensures service auto-restarts if killed by system

- Line 122-140: `onDestroy()` - Releases wake locks, stops foreground

**Wake Locks:**
Two wake locks ensure uninterrupted monitoring:
1. **CPU Wake Lock** - Prevents CPU sleep during screen off
2. **JS Wake Lock** - Prevents React Native JavaScript thread from pausing

**Notification:**
- Line 146-192: `createNotification()` - Persistent notification
  - Title: "Heart Rate Monitor"
  - Text: "Monitoring heart rate and sensors"
  - Action: "Stop" button to end monitoring
  - Tapping notification opens app

**Capabilities:**
- Unlimited duration (24/7 monitoring until battery dies or user stops)
- Real-time database writes continue in background
- BLE events process immediately (not queued)

---

#### `android/app/src/main/java/com/heartratemonitorclean/ForegroundServiceModule.kt`
**Location:** Full path as above

**Purpose:** React Native bridge module for foreground service

**Key Methods:**
- Line 31-40: `startService()` - Starts service via bridge
- Line 45-54: `stopService()` - Stops service via bridge
- Line 59-62: `startMonitoring()` - Alias for startService
- Line 67-70: `stopMonitoring()` - Alias for stopService
- Line 75-83: `isMonitoring()` - Returns boolean service state

**Bridge Name:** `ForegroundServiceModule` (exposed to JavaScript)

---

#### `android/app/src/main/java/com/heartratemonitorclean/ForegroundServicePackage.kt`
**Purpose:** Registers ForegroundServiceModule with React Native

---

#### `android/app/src/main/java/com/heartratemonitorclean/FileExportModule.java`
**Purpose:** Native file export functionality (CSV download)

---

#### `android/app/src/main/java/com/heartratemonitorclean/FileExportPackage.java`
**Purpose:** Registers FileExportModule with React Native

---

#### `android/app/src/main/java/com/heartratemonitorclean/MainApplication.kt`
**Purpose:** Main Android application class, registers native modules

**Key Sections:**
- Registers ForegroundServicePackage
- Registers FileExportPackage
- React Native package initialization

---

#### `android/app/src/main/java/com/heartratemonitorclean/MainActivity.kt`
**Purpose:** Main activity entry point

---

## Arduino Firmware

### **Main Firmware**

#### `arduino code/Arduino_Code_With_Accel_Battery_FIXED/Arduino_Code_With_Accel_Battery_FIXED.ino`
**Location:** Full path as above

**Purpose:** Nordic nRF52840 firmware with BLE GATT services

**Hardware Configuration:**

**Sensors:**
- Line 24-31: LSM6DS3 IMU (accelerometer)
  - Address: 0x6A
  - Range: ±2g
  - Sample rate: 104 Hz
  - Buffer: 20 samples

- Line 35-49: SparkFun MAX30101 biosensor
  - Address: 0x55
  - Pulse width: 411 µs
  - Sample rate: 100 samples/second
  - I2C-based communication

- Line 52-55: Battery monitoring
  - Pin: A0
  - Voltage divider: 2.0
  - Range: 3.0V - 4.2V

**BLE Services:**

**1. Battery Service (0x180F)** - Line 62-64
- Characteristic: 0x2A19 (Battery Level)
- Format: 1 byte (0-100%)
- Transmission: 10 Hz

**2. Heart Rate Service (0x180D)** - Line 66-68
- Characteristic: 0x2A37 (Heart Rate Measurement)
- Format: 2 bytes [flags, HR_value]
- Flags: 0b00000110 when contact detected, 0b00000000 otherwise
- Transmission: 10 Hz

**3. Pulse Oximeter Service (0x1822)** - Line 71-72
- Characteristic: 0x2A5E (SpO2 Spot Check)
- Format: Variable bytes (SpO2 + pulse rate)
- Transmission: 10 Hz

**4. Motion Service (0x1819)** - Line 75-76
- Characteristic: 0x2A5C (Accelerometer)
- **Format: 14 bytes** - Line 234
  - Bytes 0-7: Unix timestamp (64-bit little-endian, milliseconds)
  - Bytes 8-9: X-axis (16-bit signed integer, LSB first)
  - Bytes 10-11: Y-axis (16-bit signed integer, LSB first)
  - Bytes 12-13: Z-axis (16-bit signed integer, LSB first)
- Scale: ±2g range (divide by 16384 to get g units)
- Transmission: 10 Hz

**5. Control Characteristic**
- UUID: 6E400005-B5A3-F393-E0A9-E50E24DCCA9E
- Purpose: Device control (sensor reset, system reset)
- Format: 2 bytes (byte 0 = sensor reset flag, byte 1 = device reset flag)
- Writeable by phone, read by Arduino every 10 seconds

**Main Loop Timing System:**

**Line 289-368: Main loop with 100ms intervals (10 Hz)**

Uses RTC-driven interrupt system:
- `intCounter` increments every 100ms
- State machine based on counter value:

```
case 2:  (DISABLED) checkBiohubStatusAfterAccelerometer
case 3:  requestBiohubStatus
case 4:  readBiohubStatus
case 5:  requestBiohubNumFifoSamples
case 6:  readBiohubNumFifoSamples
case 7:  requestBiohubData
case 8:  readBiohubData (MAX30101 I2C read)
case 10: Send ALL BLE notifications (HR, SpO2, Battery, Accel)
case 20: Reset counter to 0
```

**Key Functions:**

**BLE Transmission Functions:**

- Line 678-689: `sendHrmBLE()` - Send heart rate
  - Sets contact-detected flag only when `biohubData.status == 3`
  - Status 3 = valid finger detection on sensor
  - If status != 3, sends flags = 0 (no contact)

- `sendPulseOxBLE()` - Send SpO2 data

- `sendBatteryBLE()` - Send battery percentage

- Line 719-755: `sendAccelerometerBLE()` - **CRITICAL FUNCTION**
  - Reads from circular buffers: `accelBuffX`, `accelBuffY`, `accelBuffZ`
  - Gets current Unix timestamp from `getCurrentTimestamp()`
  - Packs 14-byte packet:
    - Bytes 0-7: Timestamp (little-endian loop, Line 727-729)
    - Bytes 8-13: Accel data (X, Y, Z as int16, LSB first)
  - Calls `accelChar.notify(accelData, 14)`

**Device Control:**
- Control characteristic read in case 20 (when `secondCounter % 10 == 0`)
- Byte 0 = 1: Calls `initBiosensor()` to reset sensor
- Byte 1 = 1: Calls `NVIC_SystemReset()` to restart device

**I2C Communication:**

MAX30101 biosensor read sequence:
1. Request status (check sensor ready)
2. Request FIFO sample count
3. Request biosensor data
4. Read data via I2C (Line 331)

**Accelerometer Read:**
- Direct IMU read every 100ms
  - Raw int16 values stored in circular buffer
  - Timestamp included in BLE packet

**Advertising:**
- Line 247-262: BLE advertising setup
  - Advertises ALL services (0x180D, 0x180F, 0x1822, 0x1819)
  - Device name: "HeartRate_SpO2_Accel"
  - Interval: 32-244 (20ms - 152.5ms)
  - Fast timeout: 30 seconds

**Callbacks:**
- Line 372-387: `cccd_callback()` - Client subscribe/unsubscribe notifications
- `connect_callback()` - Device connected
- `disconnect_callback()` - Device disconnected

**Known Issues:**
- Line 141-150: `enableHostSideAccelerometer()` **DISABLED**
  - This function causes device freeze/hang
  - Not needed - app reads accel directly from IMU
- Line 357-360: `sendAccelerometerDataToBiohub()` **DISABLED**
  - Causes Wire buffer overflow
  - Not needed for basic monitoring

---

## Database Schema

### **SQLite Database:** `nordic_sensor_data.db`

**Database Version:** 3 (see DataManager.ts Line 137)

### **Table: sensor_readings**

**Location:** DataManager.ts Line 144-167

```sql
CREATE TABLE IF NOT EXISTS sensor_readings (
  id TEXT PRIMARY KEY,                    -- Unique reading ID (hr_TIMESTAMP_RANDOM)
  session_id TEXT NOT NULL,               -- Foreign key to monitoring_sessions
  device_id TEXT NOT NULL,                -- BLE device MAC address
  timestamp INTEGER NOT NULL,             -- Unix milliseconds (from Arduino RTC)

  -- Heart Rate Data
  heart_rate INTEGER,                     -- BPM (30-220)
  hr_contact_detected INTEGER,            -- 1=contact, 0=no contact, NULL=no HR data
  hr_signal_quality INTEGER,              -- 0-100%
  hr_rr_intervals TEXT,                   -- JSON array of RR intervals (ms)

  -- SpO2 Data
  spo2_value INTEGER,                     -- Oxygen saturation (70-100%)
  spo2_pulse_rate INTEGER,                -- Pulse from SpO2 sensor (30-220 BPM)
  spo2_signal_quality INTEGER,            -- 0-100%

  -- Battery Data
  battery_level INTEGER,                  -- 0-100%

  -- Accelerometer Data (Added in v2 migration)
  accel_raw_x INTEGER,                    -- Raw int16 value from Arduino
  accel_raw_y INTEGER,                    -- Raw int16 value from Arduino
  accel_raw_z INTEGER,                    -- Raw int16 value from Arduino
  accel_x REAL,                           -- Calculated g units
  accel_y REAL,                           -- Calculated g units
  accel_z REAL,                           -- Calculated g units
  accel_magnitude REAL,                   -- Vector magnitude

  -- Metadata
  raw_data TEXT,                          -- JSON string of original BLE packets
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

**Indexes:** None explicitly defined (consider adding for performance)

**Row Counts:** Typical 1-hour session = 36,000 readings (~5.4 MB)

---

### **Table: monitoring_sessions**

**Location:** DataManager.ts Line 169-180

```sql
CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id TEXT PRIMARY KEY,                    -- Session ID (session_TIMESTAMP_RANDOM)
  start_time INTEGER NOT NULL,            -- Unix milliseconds
  end_time INTEGER,                       -- Unix milliseconds (NULL if active)
  device_name TEXT,                       -- Bluetooth device name
  notes TEXT,                             -- User notes
  data_count INTEGER DEFAULT 0,           -- Number of readings in session
  is_active INTEGER DEFAULT 1,            -- 1=active, 0=ended
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

**Session Lifecycle:**
1. Created on device connection (BluetoothContext.tsx Line 735-741)
2. Readings linked via `session_id` foreign key
3. `data_count` incremented on each reading (DataManager.ts Line 821-847)
4. Ended on device disconnect (BluetoothContext.tsx Line 842-845)

---

---

## BLE Service UUIDs

### **Standard BLE Services (Bluetooth SIG)**

All UUIDs can be used in 16-bit or 128-bit format. Standard base:
`0000XXXX-0000-1000-8000-00805F9B34FB`

| Service                | UUID (16-bit) | UUID (128-bit)                         | Arduino Line | App Line |
|------------------------|---------------|----------------------------------------|--------------|----------|
| Heart Rate             | 0x180D        | 0000180D-0000-1000-8000-00805F9B34FB | Line 66      | nordic-ble-services.ts Line 6 |
| Battery Service        | 0x180F        | 0000180F-0000-1000-8000-00805F9B34FB | Line 62      | Line 8 |
| Pulse Oximeter (SpO2)  | 0x1822        | 00001822-0000-1000-8000-00805F9B34FB | Line 71      | Line 9 |
| Motion (Accelerometer) | 0x1819        | 00001819-0000-1000-8000-00805F9B34FB | Line 75      | Line 10 |

---

### **Standard BLE Characteristics**

| Characteristic          | UUID (16-bit) | Service      | Format        | Arduino Line | App Line |
|-------------------------|---------------|--------------|---------------|--------------|----------|
| Heart Rate Measurement  | 0x2A37        | 0x180D       | 2 bytes       | Line 67      | nordic-ble-services.ts Line 16 |
| Battery Level           | 0x2A19        | 0x180F       | 1 byte        | Line 63      | Line 21 |
| PLX Spot Check (SpO2)   | 0x2A5E        | 0x1822       | Variable      | Line 72      | Line 31 |
| Accelerometer Data      | 0x2A5C        | 0x1819       | 14 bytes      | Line 76      | Line 36 |

---

### **Custom Characteristics**

| Name                  | UUID                                   | Purpose                         | Arduino Line | App Line |
|-----------------------|----------------------------------------|---------------------------------|--------------|----------|
| Control (Writable)    | 6E400005-B5A3-F393-E0A9-E50E24DCCA9E | Device control commands | Line 94 | nordic-ble-services.ts |

---

### **Data Packet Formats**

#### **Heart Rate (0x2A37)** - 2 bytes
```
Byte 0: Flags
  - Bit 0: HR format (0=uint8, 1=uint16)
  - Bit 1-2: Contact status (0b11=detected, 0b00=not detected)
  - Bit 3: Energy expended present
  - Bit 4: RR intervals present

Byte 1: Heart rate value (0-255 BPM)
```

**Arduino:** Line 678-689
**Parser:** nordic-ble-services.ts Line 316-378

---

#### **Battery Level (0x2A19)** - 1 byte
```
Byte 0: Battery percentage (0-100%)
```

**Arduino:** sendBatteryBLE()
**Parser:** nordic-ble-services.ts Line 412-423

---

#### **Accelerometer (0x2A5C)** - 14 bytes
```
Bytes 0-7:   Unix timestamp (64-bit little-endian, milliseconds)
Bytes 8-9:   X-axis (16-bit signed int, LSB first)
Bytes 10-11: Y-axis (16-bit signed int, LSB first)
Bytes 12-13: Z-axis (16-bit signed int, LSB first)
```

**Scale Factor:** 16384 (for ±2g range)
**Conversion:** `g_units = raw_value / 16384`

**Arduino:** Line 719-755 (sendAccelerometerBLE)
**Parser:** nordic-ble-services.ts Line 426-499

**Example:**
```
Raw value: 8192
g units: 8192 / 16384 = 0.5g
```

---

## Configuration Files

### **React Native Configuration**

#### `package.json`
**Location:** `C:\Users\julia\Documents\HeartRateMonitorClean\package.json`

**Key Dependencies:**
```json
{
  "react-native": "0.73.2",
  "react-native-ble-manager": "^10.0.0",        // BLE communication
  "react-native-sqlite-storage": "^6.0.1",      // Database
  "@react-native-async-storage/async-storage": "^2.2.0",  // Fallback storage
  "react-native-fs": "^2.20.0",                 // File system (CSV export)
  "react-native-svg": "^13.14.1",               // Charts
  "react-native-permissions": "^5.4.2"          // BLE permissions
}
```

**Scripts:**
- `npm start` - Start Metro bundler
- `npm run android` - Build and run on Android
- `npm run lint` - Run ESLint

---

#### `tsconfig.json`
**Purpose:** TypeScript compiler configuration

**Key Settings:**
- Strict mode enabled
- Target: ES2020
- Module: commonjs

---

#### `babel.config.js`
**Purpose:** Babel transpiler configuration

---

#### `metro.config.js`
**Purpose:** Metro bundler configuration for React Native

---

### **Android Configuration**

#### `android/app/build.gradle`
**Purpose:** App-level Gradle configuration

**Key Settings:**
- minSdkVersion: 21 (Android 5.0)
- targetSdkVersion: 33 (Android 13)
- compileSdkVersion: 33

---

#### `android/build.gradle`
**Purpose:** Project-level Gradle configuration

---

#### `android/gradle.properties`
**Purpose:** Gradle project properties

---

#### `android/app/src/main/AndroidManifest.xml`
**Location:** Full path as above (see Line 1-62 in earlier read)

**Key Permissions:**
```xml
<!-- BLE Permissions -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />  <!-- Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />     <!-- Android 12+ -->

<!-- Location (required for BLE scanning) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- Background Execution -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

**Service Registration:**
```xml
<service
  android:name=".BleMonitoringForegroundService"
  android:enabled="true"
  android:exported="false"
  android:foregroundServiceType="connectedDevice" />
```

---

## Data Flow Diagram

### **Real-Time Data Flow (10 Hz)**

```
┌──────────────────────────────────────────────────────────────────────┐
│                            ARDUINO                                   │
│  Loop: 100ms intervals (10 Hz, controlled by RTC interrupt)          │
└──────────────────────────────────────────────────────────────────────┘
   │
   │ case 8: Read MAX30101 biosensor (I2C)
   │   → biohubData.heartRate, .oxygen, .confidence, .status
   │
   │ case 10: Send ALL BLE notifications
   │   ├─ sendHrmBLE()          → Service 0x180D, Char 0x2A37 (2 bytes)
   │   ├─ sendPulseOxBLE()      → Service 0x1822, Char 0x2A5E (variable)
   │   ├─ sendBatteryBLE()      → Service 0x180F, Char 0x2A19 (1 byte)
   │   └─ sendAccelerometerBLE() → Service 0x1819, Char 0x2A5C (14 bytes)
   │
   ↓ BLE Radio (Nordic nRF52840)
   │
┌──────────────────────────────────────────────────────────────────────┐
│                      REACT NATIVE APP                                │
│  BluetoothContext.tsx - Event: BleManagerDidUpdateValueForCharacteristic │
└──────────────────────────────────────────────────────────────────────┘
   │
   │ Line 360-584: handleCharacteristicValueUpdate()
   │   ├─ Match UUID → determine data type (HR, SpO2, Battery, Accel)
   │   ├─ Parse with NordicDataParser (nordic-ble-services.ts)
   │   └─ Validation (isValidHeartRateData, etc.)
   │
   ├─ Line 482-497: Accumulate sensor data into dbWriteBufferRef
   │   {
   │     hr: HeartRateData,
   │     spo2: SpO2Data,
   │     battery: BatteryData,
   │     accel: AccelerometerData  ← Includes Arduino timestamp!
   │   }
   │
   ├─ Line 517-525: DataManager.saveNordicReading(sessionId, hr, spo2, battery, accel)
   │   │
   │   ├─ Line 672-702: Timestamp prioritization logic
   │   │   Priority: accelerometer.timestamp > heartRate.timestamp > spO2.timestamp > phone time
   │   │   Validates Arduino timestamp is between 2020-2030
   │   │
   │   └─ Line 746-818: saveEnhancedReadings() → SQLite INSERT
   │       → sensor_readings table (all sensor types in ONE row)
   │
   └─ Line 544-578: UI Update (throttled to 2 Hz, 500ms interval)
       → setSensorData({ heartRate, spO2, battery, accelerometer })
       → Screens re-render (HeartRateScreen, TrendsScreen, AccelerometerScreen)
```

---

### **Background Monitoring Flow**

```
User connects to device (BluetoothScreen)
   ↓
BluetoothContext.connectToDevice() - Line 713-782
   ├─ BleManager.connect(deviceId)
   ├─ Create monitoring session (DataManager.createSession)
   ├─ Start Android Foreground Service (Line 748-756)
   │   → ForegroundServiceModule.startMonitoring()
   │   → BleMonitoringForegroundService.onCreate()
   │       ├─ Create notification channel
   │       ├─ Acquire CPU wake lock
   │       ├─ Acquire JS wake lock
   │       └─ startForeground(notification)
   └─ Auto-subscribe to all characteristics (HR, SpO2, Battery, Accel)

   ↓
User locks phone or switches app
   ↓
Android keeps service alive (START_STICKY flag)
   ├─ BLE events continue processing (JavaScript thread stays active)
   ├─ Database writes continue (SQLite INSERT every 100ms)
   └─ Wake locks prevent CPU sleep

   ↓
User disconnects or stops monitoring
   ↓
BluetoothContext.disconnectDevice() - Line 823-852
   ├─ Stop Android Foreground Service (Line 835-839)
   ├─ End monitoring session (DataManager.endSession)
   └─ Release wake locks
```

---

## Development Workflow

### **1. Initial Setup**

```bash
# Clone repository
git clone <repo-url>
cd HeartRateMonitorClean

# Install dependencies
npm install

# Android setup
cd android
./gradlew clean

# Return to root
cd ..
```

---

### **2. Running the App**

```bash
# Start Metro bundler
npm start

# In another terminal, run on Android
npm run android

# Or use Android Studio:
# Open android/ folder in Android Studio
# Run app on emulator or physical device
```

---

### **3. Building APK**

**Quick Method:**
```batch
# Windows
build-apk.bat

# Mac/Linux
chmod +x build-apk.sh
./build-apk.sh
```

**Manual Method:**
```bash
# 1. Bundle JavaScript
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res/

# 2. Build APK (Windows)
cd android
.\gradlew.bat assembleDebug

# 2. Build APK (Mac/Linux)
cd android
./gradlew assembleDebug

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

### **4. Arduino Firmware Upload**

**Prerequisites:**
- Arduino IDE 1.8.x or 2.x
- Adafruit nRF52 board support
- Libraries:
  - Adafruit Bluefruit nRF52
  - SparkFun Bio Sensor Hub Library
  - LSM6DS3 (SparkFun or Seeed Studio)

**Steps:**
1. Open `Arduino_Code_With_Accel_Battery_FIXED.ino`
2. Select board: "Adafruit Feather nRF52840 Express" or "Seeed XIAO nRF52840"
3. Select correct COM port
4. Upload firmware (Ctrl+U)

**Troubleshooting:**
- If upload fails: Double-press reset button to enter bootloader mode
- Check serial monitor (115200 baud) for initialization messages

---

### **5. Testing BLE Connection**

**Phone Side:**
1. Enable Bluetooth
2. Enable Location (required for BLE scanning on Android)
3. Grant app permissions (Bluetooth, Location)
4. Open app → Bluetooth screen
5. Tap "Start Scan"
6. Device should appear: "HeartRate_SpO2_Accel"
7. Tap "Connect"

**Arduino Side (Serial Monitor):**
```
Serial initialized
===========================================
Arduino Code for React Native Heart Rate App
Outputs: Heart Rate, SpO2, Battery, Accelerometer
===========================================
I2C initialized
RTC initialized
IMU initialized!
Biosensor started!
...
Advertising started with services:
   - Heart Rate (0x180D)
   - Battery (0x180F)
   - Pulse Oximeter (0x1822)
   - Motion (0x1819)
Waiting for BLE connection from React Native app...
```

**After Connection:**
```
Heart Rate CCCD updated: Notifications enabled
SpO2 CCCD updated: Notifications enabled
Battery CCCD updated: Notifications enabled
Accelerometer CCCD updated: Notifications enabled
```

---

### **6. Debugging**

**React Native Logs:**
```bash
# Full logcat
npx react-native log-android

# Filtered logs
adb logcat | grep -i "bluetooth\|ble\|datamanager"
```

**Key Log Messages:**

**Connection Success:**
```
✅ Created session: session_1699545825123_abc123
✅ Foreground service started - JavaScript thread will stay active in background
✅ Subscribed to Heart Rate
✅ Subscribed to SpO2
✅ Subscribed to Battery
✅ Subscribed to Accelerometer
```

**Data Flow:**
```
📊 Received accelerometer data: 14 bytes
✅ Parsed accelerometer: X=0.123 Y=-0.456 Z=1.012 mag=1.145 timestamp=2025-11-09T14:23:45.123Z
🔵 Accumulated accel in buffer: X=0.123 Y=-0.456 Z=1.012
🟢 Saving reading with accel: X=0.123 timestamp=2025-11-09T14:23:45.123Z
💾 DataManager.saveNordicReading() received accel: X=0.1234 Y=-0.4560 Z=1.0120
✅ Using Arduino timestamp: 2025-11-09T14:23:45.123Z
💾 Attempting SQLite INSERT: id=hr_1699545825123_xyz, session=session_1699545825123_abc123, device=AA:BB:CC:DD:EE:FF, timestamp=1699545825123, accel_x=0.123
```

**Errors:**
```
⚠️ Invalid Arduino timestamp 0, using phone time: 2025-11-09T14:23:45.123Z
Failed to save enhanced readings to SQLite: [Error: NOT NULL constraint failed: sensor_readings.session_id]
```

---

### **7. Data Export**

**Export Session CSV:**
1. Open Bluetooth screen
2. Tap session in list
3. Tap "Export to CSV"
4. File saved to: `/storage/emulated/0/Download/HeartRate_Session_TIMESTAMP.csv`

**Export All Data:**
1. Open Settings (gear icon in header)
2. Tap "Export All Data (CSV)"
3. File saved to Downloads folder

**CSV Format:**
```csv
Timestamp_Unix_ms,Timestamp_ISO,Time_Since_Start_Seconds,Time_Since_Start_Minutes,HR_BPM,HR_Contact_Detected,HR_Signal_Quality,HR_RR_Interval_ms,SpO2_Percent,SpO2_Pulse_Rate_BPM,SpO2_Signal_Quality,Battery_Percent,Accel_Raw_X,Accel_Raw_Y,Accel_Raw_Z,Accel_X_g,Accel_Y_g,Accel_Z_g,Accel_Magnitude_g,Device_ID
1699545825123,2025-11-09T14:23:45.123Z,0.000,0.000,72,YES,85,856,98,72,90,95,8192,-4096,16384,0.5000,-0.2500,1.0000,1.1180,AA:BB:CC:DD:EE:FF
```

---

### **8. Database Inspection**

**Access SQLite Database (Android):**
```bash
# 1. Copy database to computer
adb pull /data/data/com.heartratemonitorclean/databases/nordic_sensor_data.db

# 2. Open with SQLite browser
sqlite3 nordic_sensor_data.db

# 3. Inspect tables
.tables
.schema sensor_readings
SELECT COUNT(*) FROM sensor_readings;
SELECT * FROM monitoring_sessions;

# 4. Check accelerometer data
SELECT
  timestamp,
  heart_rate,
  accel_x,
  accel_y,
  accel_z
FROM sensor_readings
WHERE accel_x IS NOT NULL
LIMIT 10;
```

---

### **9. Performance Monitoring**

**Data Collection Rates:**
- Arduino: 10 Hz (100ms intervals)
- BLE transmission: 10 Hz (40 packets/second total: HR + SpO2 + Battery + Accel)
- Database writes: 10 Hz (immediate writes, no batching)
- UI updates: 2 Hz (throttled to prevent freezing)

**Capacity:**
- 1 hour: 36,000 readings (~5.4 MB)
- 8 hours: 288,000 readings (~43 MB)
- 24 hours: 864,000 readings (~130 MB)

**Battery Consumption:**
- Foreground: ~15-20% per hour
- Background: ~10-15% per hour (with wake locks)

---

### **10. Common Issues & Solutions**

**Issue:** Accelerometer data not saving to database
- **Symptom:** Motion tab shows data, but CSV export is empty
- **Cause:** NULL constraint error (session_id, device_id, or timestamp is NULL)
- **Debug:** Check logs for "💾 Attempting SQLite INSERT" and error details

**Issue:** Arduino crashes, heart rate sensor stops working
- **Symptom:** Accelerometer works, but HR/SpO2 stop updating
- **Cause:** I2C bus lockup or memory overflow
- **Debug:** Check Arduino serial monitor for crash messages
- **Solution:** Reduce BLE notification rate, add I2C error handling

**Issue:** App shows "Unknown Device" during scan
- **Symptom:** Device appears but without name
- **Cause:** Arduino not advertising or insufficient permissions
- **Debug:** Check Arduino serial for "Advertising started"
- **Solution:** Re-upload Arduino firmware, ensure Bluetooth is on

---

## File Location Reference

**Quick lookup for absolute paths:**

### React Native
- App entry: `C:\Users\julia\Documents\HeartRateMonitorClean\App.tsx`
- Bluetooth context: `...\src\context\BluetoothContext.tsx`
- Data manager: `...\src\services\DataManager.ts`
- BLE services: `...\src\services\nordic-ble-services.ts`
- Background service: `...\src\services\BackgroundMonitoring.ts`

### Android Native
- Foreground service: `...\android\app\src\main\java\com\heartratemonitorclean\BleMonitoringForegroundService.kt`
- Service module: `...\android\app\src\main\java\com\heartratemonitorclean\ForegroundServiceModule.kt`
- Manifest: `...\android\app\src\main\AndroidManifest.xml`
- Main application: `...\android\app\src\main\java\com\heartratemonitorclean\MainApplication.kt`

### Arduino
- Main firmware: `...\arduino code\Arduino_Code_With_Accel_Battery_FIXED\Arduino_Code_With_Accel_Battery_FIXED.ino`

### Configuration
- package.json: `...\package.json`
- tsconfig.json: `...\tsconfig.json`
- App build.gradle: `...\android\app\build.gradle`

---

## Version History

**Current Version**
- SQLite database with session management
- Android Foreground Service (24/7 monitoring)
- Accelerometer data with timestamps
- CSV/JSON export functionality
- Device control via BLE (biosensor reset, system reset)
- Generic device filtering (HRM or SpO2 service)

---

## Glossary

**BLE:** Bluetooth Low Energy
**GATT:** Generic Attribute Profile (BLE protocol)
**UUID:** Universally Unique Identifier (service/characteristic IDs)
**RTC:** Real-Time Clock
**IMU:** Inertial Measurement Unit (accelerometer)
**SpO2:** Blood oxygen saturation percentage
**HRV:** Heart Rate Variability (RR interval analysis)
**LSB:** Least Significant Byte (little-endian byte order)
**RSSI:** Received Signal Strength Indicator (Bluetooth signal strength)
**CCCD:** Client Characteristic Configuration Descriptor (enable/disable notifications)

---

**END OF CODE MAP**

*This document is a living reference - update as the codebase evolves.*
