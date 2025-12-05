# Arduino Serial Data Logger

Python script to capture heart rate and SpO2 data from Arduino serial output and save to CSV.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Find your Arduino's serial port:**
   ```bash
   python serial_monitor.py --list
   ```

## Usage

**Basic usage** (saves to `python/data/sensor_data.csv`):
```bash
python serial_monitor.py --port /dev/cu.usbmodem101
```

**With manual input for external device comparison:**
```bash
python serial_monitor.py --port /dev/cu.usbmodem101 --manual
```

This will save two files:
- `python/data/sensor_data.csv` - Arduino data
- `python/data/manual_sensor_data.csv` - Your manual entries

This enables you to enter heart rate readings from an external device (e.g., Polar chest strap, Apple Watch) for comparison. Serial data is monitored in the background while you can type HR values in the terminal.

Example manual input:
```
Enter HR (BPM): 72
Enter HR (BPM): 75 Polar
Enter HR (BPM): 68 AppleWatch during exercise
Enter HR (BPM): [Press Enter to quit]
```

**Custom output location:**
```bash
python serial_monitor.py --port /dev/cu.usbmodem101 --output ~/Desktop/my_data.csv
```

**Change baud rate:**
```bash
python serial_monitor.py --port /dev/cu.usbmodem101 --baud 9600
```

## Output Format

### Arduino Data CSV (`python/data/sensor_data.csv`)
- `System_Timestamp` - Computer's timestamp (YYYY-MM-DD HH:MM:SS.mmm)
- `Arduino_Timestamp_ms` - Milliseconds since Arduino connection
- `Heart_Rate_BPM` - Heart rate in beats per minute
- `SpO2_Percent` - Blood oxygen saturation percentage

### Manual Input CSV (`python/data/manual_sensor_data.csv`)
Created when using `--manual` flag:
- `System_Timestamp` - Computer's timestamp (YYYY-MM-DD HH:MM:SS.mmm)
- `Estimated_Arduino_Timestamp_ms` - Synced Arduino timestamp for comparison
- `Heart_Rate_BPM` - Heart rate from external device
- `Device` - Device name (e.g., "Polar", "AppleWatch")
- `Notes` - Optional notes about the reading

## Data Storage

By default, CSV files are saved in the `python/data/` subdirectory, which is ignored by git.

Press `Ctrl+C` to stop monitoring (or press Enter with empty input in manual mode).

## Battery Analysis

Analyze battery charging and discharging characteristics:

```bash
python analyze_battery.py
```

**Requirements:** Ensure you have battery voltage data files in `python/data/`:
- `charging.csv` - Battery voltage data during charging
- `discharging.csv` - Battery voltage data during discharging

**Expected CSV format:**
- Must contain columns: `Time_Since_Start_Minutes` and `Battery_Voltage_V`
- Same format as exported session data from the app

**What it does:**
1. Loads voltage data from both files
2. Performs linear regression to calculate charge/discharge rates
3. Calculates time to charge/discharge between 3.3V (empty) and 4.2V (full)
4. Creates dual-panel visualization with:
   - Raw voltage data points
   - Linear regression fit line
   - Empty (3.3V) and Full (4.2V) reference lines
   - Statistics box with rates and time estimates
5. Saves plot as `python/data/battery_analysis.png`

**Example output:**
```
🔋 Battery Charging/Discharging Analysis
======================================================================

📥 Loading data...
   ✅ Charging data: 1200 readings
      Voltage range: 3.350V - 4.180V
      Time range: 0.0s - 7200.0s

📊 Calculating charge/discharge rates...

⚡ Charging Analysis:
   Rate: 0.450 V/h (0.000125 V/s)
   Time to charge (3.3V → 4.2V): 2.00 hours (120.0 minutes)
   Linear fit quality (R²): 0.987

🔋 Discharging Analysis:
   Rate: 0.180 V/h (0.000050 V/s)
   Time to discharge (4.2V → 3.3V): 5.00 hours (300.0 minutes)
   Linear fit quality (R²): 0.995
```

## Comprehensive Data Analysis

For detailed comparison of phone app data (from exported session), serial sensor data, and manual watch readings:

```bash
python analyze_comparison.py
```

**Requirements:** Ensure you have the following files in `python/data/`:
- `sensor_data.csv` - Serial Arduino data (from this script)
- `phone_data.csv` - Exported session data from the phone app
- `watch_data.csv` - Manual watch readings (from `--manual` mode)

**What it does:**
1. **Compares Phone vs Serial Sensor** (One-to-One):
   - Assumes same number of readings in both files
   - Automatically reverses phone data (newest→oldest) to match sensor order (oldest→newest)
   - Compares readings index-by-index
   - Reports HR inconsistencies (>5 BPM difference)
   - Reports SpO2 inconsistencies (>2% difference)
   - Shows average and maximum differences

2. **Plots Phone vs Watch HR**:
   - Single combined visualization
   - Phone HR: Solid blue lines for active readings, dashed blue lines connecting across zero-value gaps
   - Watch HR: Red line with square markers (reference data)
   - Calculates percentage of time phone has valid readings
   - Computes absolute percent error (watch as expected/reference):
     - Average absolute percent error
     - Maximum absolute percent error
   - Matched pairs count printed to terminal only
   - Saves plot as `python/data/hr_comparison_plot.png`

**Example output:**
```
📊 Heart Rate & SpO2 Data Comparison Analysis
======================================================================

📥 Loading data...
   Note: Phone data is newest→oldest, Sensor is oldest→newest
         Will reverse phone data for one-to-one comparison

   Sensor: 156 readings (oldest→newest)
   Phone:  156 readings (newest→oldest)
   Watch:  38 readings

🔍 Comparing Phone App vs Serial Sensor Data (One-to-One)
======================================================================

📊 One-to-One Comparison:
   Phone readings:  156
   Sensor readings: 156

❤️  Heart Rate Analysis:
   Matched pairs: 45
   Average difference: 1.23 BPM
   Maximum difference: 8.00 BPM
   Inconsistencies (>5 BPM): 3

💨 SpO2 Analysis:
   Matched pairs: 52
   Average difference: 0.87%
   Maximum difference: 3.00%
   Inconsistencies (>2%): 2

📈 Plotting Phone vs Watch HR Data
======================================================================
📊 Plot saved: python/data/hr_comparison_plot.png

✅ Phone Data Activity: 87.2% of time has non-zero heart rate

📊 Phone vs Watch Absolute Percent Error (Watch = Reference):
   Matched pairs: 38
   Average absolute error: 2.34%
   Maximum absolute error: 8.92%
   ✓  Good agreement (avg < 5% error)

======================================================================
✅ Analysis Complete!
```

