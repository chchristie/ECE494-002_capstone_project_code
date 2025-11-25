# Heart Rate Monitor - BLE Sensor Application

A React Native application for real-time monitoring of heart rate, SpO2, and accelerometer data from Nordic nRF52840-based BLE devices with SeedStudio sensors.

## Features

- Real-time heart rate and SpO2 monitoring via Bluetooth Low Energy
- 3-axis accelerometer data visualization
- Background monitoring with Android Foreground Service
- SQLite database with session-based data organization
- CSV export for data analysis
- Trend visualization and historical data review

## Technology Stack

- **React Native**: 0.73.2
- **TypeScript**: Type-safe development
- **BLE**: react-native-ble-manager for Bluetooth connectivity
- **Storage**: SQLite (primary) with AsyncStorage fallback
- **UI**: Custom tab-based navigation

## Hardware Requirements

- **Arduino**: Nordic nRF52840 microcontroller
- **Sensors**:
  - MAX30101 Biosensor (Heart Rate + SpO2) - I2C 0x57
  - LIS3DH Accelerometer - I2C
  - DS3231 RTC for timestamps
  - Battery monitor

## Quick Start

### Prerequisites

1. **Node.js**: 16+ and npm
2. **Java Development Kit**: JDK 17 or 11
3. **Android Studio**: Android SDK and build tools
4. **React Native CLI**: `npm install -g react-native-cli`

### Installation

```bash
# 1. Install dependencies
npm install

# 2. For Android, ensure Android SDK is configured
# Set ANDROID_HOME environment variable

# 3. Build and run
npm run android
```

### Building APK

```bash
# Method 1: Using npm script
npm run build:android

# Method 2: Manual build
cd android
.\gradlew.bat assembleDebug  # Windows
./gradlew assembleDebug      # macOS/Linux

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

## Arduino Firmware

Upload the firmware to your Nordic nRF52840:

**Location**: `arduino/Arduino_Code_FIXED_MINIMAL.ino`

**BLE Services**:
- Heart Rate Service (0x180D) - Standard
- Pulse Oximeter (0x1822) - Standard
- Battery Service (0x180F) - Standard
- Motion Service (0x1819) - Standard accelerometer

**Transmission Rate**: 1 Hz (once per second) for all sensors

See Arduino file header for detailed hardware setup and timing information.

## Project Structure

```
HeartRateMonitor_Shareable/
├── src/
│   ├── context/          # BluetoothContext - global BLE state
│   ├── screens/          # Main app screens (HeartRate, Accelerometer, Trends, Bluetooth)
│   ├── services/         # DataManager, BLE services, background monitoring
│   ├── components/       # Reusable UI components
│   └── utils/            # Utilities (file export, permissions, etc.)
├── android/
│   └── app/src/main/java/com/heartratemonitorclean/
│       ├── BleMonitoringForegroundService.kt
│       ├── ForegroundServiceModule.kt
│       └── FileExportModule.java
├── arduino/              # Arduino firmware
├── builds/               # Pre-built APK files
└── docs/                 # Additional documentation
```

## Key Components

### BluetoothContext (`src/context/BluetoothContext.tsx`)
- Manages BLE scanning, connection, and data reception
- Handles device discovery with Nordic/SeedStudio filtering
- Provides sensor data to all screens via React Context

### DataManager (`src/services/DataManager.ts`)
- SQLite database management
- Session-based data recording
- CSV export functionality
- Automatic migration from AsyncStorage

### Foreground Service (`android/.../BleMonitoringForegroundService.kt`)
- Enables unlimited background monitoring
- Prevents Android from killing the app
- Uses wake locks to keep CPU and JavaScript thread active

## Usage

### Connecting to Device

1. Open the app and navigate to the Bluetooth tab
2. Tap "Scan for Devices"
3. Select your Nordic device from the list
4. Connection establishes automatically
5. Foreground service starts for background monitoring

### Viewing Data

- **Heart Rate Tab**: Real-time heart rate and contact detection
- **Motion Tab**: Live 3-axis accelerometer readings
- **Trends Tab**: Historical data charts
- **Bluetooth Tab**: Session management and CSV export

### Exporting Data

1. Go to Bluetooth tab
2. Tap on a session to view details
3. Tap "Export to CSV"
4. File saves to Downloads folder with timestamp

## Database Schema

### Sessions Table
- `id`, `device_name`, `device_id`
- `start_time`, `end_time`
- `data_count`, `notes`

### Sensor Readings Table
- `id`, `session_id`, `device_id`, `timestamp`
- `heart_rate`, `hr_contact_detected`, `hr_signal_quality`
- `spo2_value`, `spo2_pulse_rate`, `spo2_signal_quality`
- `battery_level`
- `accel_x`, `accel_y`, `accel_z`, `accel_magnitude`

## Permissions (Android)

Required permissions in `AndroidManifest.xml`:
- `BLUETOOTH`, `BLUETOOTH_ADMIN`
- `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` (Android 12+)
- `ACCESS_FINE_LOCATION` (required for BLE scanning)
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`
- `WAKE_LOCK`

Permissions are requested dynamically on app startup.

## Troubleshooting

### Build Errors

**"Unable to resolve module"**:
- Run `npm install` to ensure all dependencies are installed
- Check import paths match exact file names (case-sensitive)

**Gradle build fails**:
- Ensure JDK 11 or 17 is installed
- Check `ANDROID_HOME` environment variable is set
- Run `cd android && .\gradlew.bat clean`

### BLE Connection Issues

**Device not found**:
- Ensure Arduino firmware is uploaded and running
- Check device is advertising BLE services
- Enable location permissions (required for BLE scanning)

**Shows simulated data**:
- Verify BLE notifications are subscribed after connection
- Check Arduino is sending data (case 10 in timing loop)
- Review console logs for parsing errors

### Background Monitoring

**App stops in background**:
- Foreground service should auto-start on connection
- Check notification appears: "Heart Rate Monitor - Monitoring..."
- Disable battery optimization for the app in Android settings

## Development

### Adding New Screens

1. Create component in `src/screens/`
2. Add to `tabs` array in `App.tsx`
3. Use `useBluetooth()` hook to access sensor data

### Modifying BLE Characteristics

1. Update UUIDs in `src/services/nordic-ble-services.ts`
2. Add parser function in `NordicDataParser` class
3. Update `BluetoothContext` to subscribe to new characteristic
4. Add data type to `DataManager` for storage

## Further Documentation

- **CODE_MAP.md**: Detailed file-by-file documentation
- **BUILD_INSTRUCTIONS.md**: Complete build process guide
- **Arduino code header**: Hardware setup and timing details

## License

This project is for research and educational purposes.

## Support

For issues or questions, refer to:
- Arduino code comments for firmware details
- TypeScript files have inline documentation
- Native modules have KDoc/JavaDoc comments
