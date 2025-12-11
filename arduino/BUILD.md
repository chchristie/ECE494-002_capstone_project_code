# Arduino Build Instructions

Guide to building and uploading the Heart Rate Monitor firmware to the Seeed Studio XIAO nRF52840 Sense board.

## Hardware Requirements

- **Seeed Studio XIAO nRF52840 Sense** - Main microcontroller board
- **SparkFun MAX30101 Pulse Oximeter and Heart Rate Sensor** - Bio sensor hub
- **LSM6DS3 Accelerometer** - Integrated on XIAO nRF52840 Sense board

## Prerequisites

1. **Arduino IDE**: Version 2.3.6 or later
2. **Board Support Package**: Seeed nRF52 Boards Version 1.1.12
3. **Required Libraries**: Sparkfun Bio Sensor Hub Library Version 1.1, Seeed Arduino LSM6DS3 Version 2.0.5

## Installation Steps

### 1. Install Board Manager

1. Open Arduino IDE
2. Go to **File → Preferences**
3. In "Additional Board Manager URLs", add:
   ```
   https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json
   ```
4. Go to **Tools → Board → Boards Manager**
5. Search for "Seeed nRF52 Boards"
6. Install **"Seeed nRF52 Boards by Seeed Studio"** (Version 1.1.12)

**Note:** This board package automatically includes the Adafruit Bluefruit nRF52 library, so no separate installation is needed.

### 2. Install Required Libraries

1. Go to **Sketch → Include Library → Manage Libraries** and install:

**SparkFun Bio Sensor Hub Library**
   - Search for: `SparkFun Bio Sensor Hub`
   - Install: **SparkFun_Bio_Sensor_Hub_Library** by SparkFun Electronics
   - Version: 1.1

2. Download the **Seeed Arduino LSM6DS3**  library:
   - Go to: [Seeed Arduino LSM6DS3](https://github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3)
   - Click **Code → Download ZIP**
   - Save the ZIP file

3. Install in Arduino IDE:
   - Go to **Sketch → Include Library → Add .ZIP Library**
   - Select the downloaded ZIP file
   - The library will be installed to your Arduino libraries folder

### 3. Configure Board Settings

1. Connect your XIAO nRF52840 Sense via USB
2. Select board: **Tools → Board → Seeed nRF52 Boards → Seeed XIAO nRF52840 Sense**
3. Select port: **Tools → Port → [Your COM Port]**

## Build and Upload

### Standard Upload

1. Open `arduino.ino` in Arduino IDE
2. Verify the sketch: **Sketch → Verify/Compile** (Ctrl+R / Cmd+R)
3. Upload: **Sketch → Upload** (Ctrl+U / Cmd+U)

### Serial Monitor

To view debug output:

1. Open **Tools → Serial Monitor**
2. Set baud rate to **115200**
3. You should see initialization messages and sensor data

## Additional Resources

- [Seeed XIAO nRF52840 Sense Documentation](https://wiki.seeedstudio.com/XIAO_BLE/)
- [SparkFun MAX30101 Hookup Guide](https://learn.sparkfun.com/tutorials/max30105-pulse-and-proximity-sensor-hookup-guide)

