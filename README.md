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
- **Storage**: SQLite database
- **UI**: Custom tab-based navigation

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

# 2. Build and run (requires connected device)
npm run android
```

### Building APK

**Debug build:**
```bash
cd android && ./gradlew assembleDebug
```

**Standalone build (no Metro server):**
```bash
npm run android:assemble
```

See [BUILD.md](BUILD.md) for detailed build instructions.

## Key Components

### BluetoothContext (`src/context/BluetoothContext.tsx`)
- Manages BLE scanning, connection, and data reception
- Handles device discovery with Nordic/SeedStudio filtering
- Provides sensor data to all screens via React Context

### DataManager (`src/services/DataManager.ts`)
- SQLite database management
- Session-based data recording
- CSV/JSON export functionality

### Foreground Service (`android/.../BleMonitoringForegroundService.kt`)
- Enables unlimited background monitoring
- Prevents Android from killing the app
- Uses wake locks to keep CPU and JavaScript thread active

## Usage

### Connecting to Device

1. Open the app and navigate to the Data Management tab
2. Tap "Scan for Devices"
3. Select your device (must advertise HRM or SpO2 service)
4. Connection establishes automatically
5. Foreground service starts for background monitoring

### Viewing Data

- **Heart Rate Tab**: Real-time heart rate and contact detection
- **Motion Tab**: Live 3-axis accelerometer readings
- **Trends Tab**: Historical data charts
- **Data Management Tab**: Session management, CSV/JSON export, device control

### Device Control

In Data Management → Sensor Settings:
- **Reset Biosensor**: Reinitializes the biosensor on the Arduino
- **Reset Device**: Restarts the Arduino device

### Exporting Data

1. Go to Data Management tab
2. Tap on a session to view details
3. Tap "Export to CSV" or "Export to JSON"
4. File saves to Downloads folder with timestamp

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

**Connection issues**:
- Verify device is advertising HRM (0x180D) or SpO2 (0x1822) service
- Check BLE notifications are subscribed after connection
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
- **BUILD.md**: Build instructions (debug and standalone)
- **Arduino code header**: Hardware setup and timing details

## License

This project is for research and educational purposes.

## Support

For issues or questions, refer to:
- Arduino code comments for firmware details
- TypeScript files have inline documentation
- Native modules have KDoc/JavaDoc comments
