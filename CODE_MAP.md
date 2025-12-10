# CODE MAP - Heart Rate Monitor Clean

**Comprehensive architectural documentation for the React Native Heart Rate Monitor app with Arduino firmware.**

**Last Updated:** 2025-11-09
**Project Version:** 1.0.0
**React Native:** 0.73.2
**Target Platform:** Android (with iOS stubs)

---

## Project Overview

This is a **React Native mobile application** for continuous monitoring of:
- Heart Rate (BPM)
- SpO2 (blood oxygen saturation %)
- Accelerometer data (3-axis motion tracking)
- Battery level

**Key Features:**
- Real-time BLE data streaming
- 24/7 background monitoring via Android Foreground Service
- SQLite database with session management
- CSV export for research data analysis

---



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
- `exportSessionData()` - Export session as JSON (sensor readings only)
- `exportAllData()` - Export all sessions as JSON (sensor readings only)
- `exportAllDataCSV()` - Export all sensor readings as CSV
- `exportSessionCSV()` - Export single session sensor readings as CSV
- `exportSessionAccelerometerCSV()` - Export single session accelerometer data as CSV
- `exportSessionAccelerometerJSON()` - Export single session accelerometer data as JSON

**CSV Export Format:**

**Sensor Readings CSV** (`exportSessionCSV`):
  - Timestamp info: Unix ms, ISO string, seconds/minutes since start
  - Heart Rate: BPM, contact detected
  - SpO2: Percentage, pulse rate
  - Battery: Percentage, voltage
  - Sensor Status: Confidence level
  - Metadata: Device ID

**Accelerometer CSV** (`exportSessionAccelerometerCSV`):
  - Timestamp: Unix ms, ISO string
  - Second Counter: 2-second cycle counter from Arduino
  - Sample Index: Index within buffer (0-19)
  - Accelerometer: X_mG, Y_mG, Z_mG, Magnitude_mG (all in milli-gs)

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
- Line 66-71: `AccelerometerData`
  - `x`, `y`, `z` - Acceleration values in milli-gs (int16)
  - `magnitude` - Vector magnitude in milli-gs

- Line 74-77: `BufferedAccelerometerData` - Extends AccelerometerData
  - `secondCounter` - 2-second cycle counter from Arduino
  - `sampleIndex` - Index within buffer (0-19)

**Parsing Class:**
`NordicDataParser`:
- `parseHeartRateData()` - Standard BLE Heart Rate format
  - Parses flags, HR value (8-bit or 16-bit)
  - Returns null if validation fails

- `parseSpO2Data()` - SeedStudio SpO2 format
  - Expects: [SpO2%, PulseRate, SignalQuality]
  - Validates: SpO2 70-100%, Pulse 30-220 BPM

- `parseBatteryData()` - Single byte (0-100%)

- `parseBufferedAccelerometerData()` - Parses 124-byte buffered format
  - Bytes 0-3: `secondCounter` (uint32_t, little-endian)
  - Bytes 4-43: 20 X-axis samples (int16, little-endian)
  - Bytes 44-83: 20 Y-axis samples (int16, little-endian)
  - Bytes 84-123: 20 Z-axis samples (int16, little-endian)
  - Values are in milli-gs (no conversion applied)
  - Calculates magnitude: √(x² + y² + z²) in milli-gs
  - Returns array of 20 `BufferedAccelerometerData` objects

---

#### `src/services/BackgroundMonitoring.ts`
**Location:** `src/services/BackgroundMonitoring.ts`

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

## Database Schema

### **SQLite Database:** `nordic_sensor_data.db`

### **Table: sensor_readings**

**Location:** DataManager.ts Line 102-117

```sql
CREATE TABLE IF NOT EXISTS sensor_readings (
  id TEXT PRIMARY KEY,                    -- Unique reading ID
  session_id TEXT NOT NULL,               -- Foreign key to monitoring_sessions
  device_id TEXT NOT NULL,                -- BLE device MAC address
  timestamp INTEGER NOT NULL,             -- Unix milliseconds

  -- Heart Rate Data
  heart_rate INTEGER,                     -- BPM (30-220)
  hr_contact_detected INTEGER,            -- 1=contact, 0=no contact, NULL=no HR data

  -- SpO2 Data
  spo2_value INTEGER,                     -- Oxygen saturation (70-100%)
  spo2_pulse_rate INTEGER,                -- Pulse from SpO2 sensor (30-220 BPM)

  -- Battery Data
  battery_level INTEGER,                  -- 0-100%
  battery_voltage REAL,                   -- Battery voltage

  -- Sensor Status
  sensor_confidence INTEGER,              -- Confidence level (0-100)

  -- Metadata
  raw_data TEXT,                          -- JSON string of original BLE packets
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE
);
```

**Note:** Accelerometer data is stored in a separate `accelerometer_readings` table.

**Row Counts:** Typical 1-hour session = ~3,600 readings (1 Hz rate for HR/SpO2/Battery)

---

### **Table: accelerometer_readings**

**Location:** DataManager.ts Line 134-145

```sql
CREATE TABLE IF NOT EXISTS accelerometer_readings (
  id TEXT PRIMARY KEY,                    -- Unique reading ID
  session_id TEXT NOT NULL,               -- Foreign key to monitoring_sessions
  timestamp INTEGER NOT NULL,             -- Unix milliseconds
  second_counter INTEGER NOT NULL,        -- 2-second cycle counter from Arduino
  sample_index INTEGER NOT NULL,          -- Sample index within buffer (0-19)
  x INTEGER NOT NULL,                     -- X-axis value in milli-g's (int16)
  y INTEGER NOT NULL,                     -- Y-axis value in milli-g's (int16)
  z INTEGER NOT NULL,                     -- Z-axis value in milli-g's (int16)
  magnitude INTEGER NOT NULL,             -- Magnitudei-g's
  FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_accel_session` on `session_id`
- `idx_accel_timestamp` on `timestamp`
- `idx_accel_second_counter` on `second_counter`

**Data Rate:** 100 Hz sampling, buffered into 20-sample packets transmitted at 5 Hz
**Row Counts:** Typical 1-hour session = ~36,000 readings (~5.4 MB)

---

### **Table: monitoring_sessions**

**Location:** DataManager.ts Line 121-130

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
1. Created on device connection (BluetoothContext.tsx)
2. Readings linked via `session_id` foreign key in both `sensor_readings` and `accelerometer_readings`
3. `data_count` incremented on each sensor reading
4. Ended on device disconnect (BluetoothContext.tsx)
5. Cascade delete removes all associated readings when session is deleted

---

**END OF CODE MAP**
