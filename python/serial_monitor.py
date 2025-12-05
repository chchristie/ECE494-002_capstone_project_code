#!/usr/bin/env python3
"""
Serial Monitor for Arduino Heart Rate & SpO2 Data
Captures timestamped sensor data and saves to CSV in data/ folder

Parses lines in format: "TIMESTAMP_MS: 12345 | HR: 72 | SpO2: 98"

Usage:
    python serial_monitor.py [--port PORT] [--baud BAUD] [--output OUTPUT.csv] [--manual]

Examples:
    # Basic monitoring:
    python serial_monitor.py --port /dev/cu.usbmodem101
    
    # With manual input for external device comparison:
    python serial_monitor.py --port /dev/cu.usbmodem101 --manual
    
    # Custom output location:
    python serial_monitor.py --port /dev/cu.usbmodem101 --output ~/Desktop/heart_data.csv
"""

import serial
import re
import csv
import argparse
import time
import threading
from datetime import datetime
from pathlib import Path


class SerialDataLogger:
    def __init__(self, port, baud=115200, output_file='sensor_data.csv', enable_manual_input=False):
        """Initialize the serial data logger."""
        self.port = port
        self.baud = baud
        self.output_file = output_file
        self.enable_manual_input = enable_manual_input
        self.serial_conn = None
        self.csv_writer = None
        self.csv_file = None
        self.manual_csv_writer = None
        self.manual_csv_file = None
        self.connection_start_time = None  # Track when Arduino connection started
        self.running = True
        
        # Regex pattern to match combined serial output
        # Example: "TIMESTAMP_MS: 12345 | HR: 72 | SpO2: 98"
        self.combined_pattern = re.compile(r'TIMESTAMP_MS:\s*(\d+)\s*\|\s*HR:\s*(\d+)\s*\|\s*SpO2:\s*(\d+)')
        
        # Pattern to detect connection start for timestamp sync
        self.connection_pattern = re.compile(r'Connection timestamp set at millis:\s*(\d+)')
        
    def open_serial(self):
        """Open serial connection."""
        try:
            print(f"Opening serial port {self.port} at {self.baud} baud...")
            self.serial_conn = serial.Serial(
                self.port,
                self.baud,
                timeout=1,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
            # Wait for Arduino to reset after serial connection
            time.sleep(2)
            # Initialize connection start time (will be updated when Arduino connects)
            self.connection_start_time = time.time()
            print(f"✅ Connected to {self.port}")
            if self.enable_manual_input:
                print(f"⏱️  Timestamp sync initialized (will update when Arduino connection detected)")
            return True
        except serial.SerialException as e:
            print(f"❌ Failed to open serial port: {e}")
            return False
    
    def open_csv(self):
        """Open CSV file for writing."""
        try:
            # Create data directory if it doesn't exist
            output_path = Path(self.output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Check if file exists to determine if we need to write header
            file_exists = output_path.exists()
            
            self.csv_file = open(output_path, 'a', newline='')
            self.csv_writer = csv.writer(self.csv_file)
            
            # Get absolute path for display
            abs_path = output_path.absolute()
            
            # Write header if file is new
            if not file_exists:
                self.csv_writer.writerow([
                    'System_Timestamp',
                    'Arduino_Timestamp_ms',
                    'Heart_Rate_BPM',
                    'SpO2_Percent'
                ])
                self.csv_file.flush()
                print(f"✅ Created CSV file: {abs_path}")
            else:
                print(f"✅ Appending to CSV file: {abs_path}")
            
            # Open manual input CSV if enabled
            if self.enable_manual_input:
                manual_output_path = output_path.parent / f"manual_{output_path.name}"
                manual_file_exists = manual_output_path.exists()
                
                self.manual_csv_file = open(manual_output_path, 'a', newline='')
                self.manual_csv_writer = csv.writer(self.manual_csv_file)
                
                manual_abs_path = manual_output_path.absolute()
                
                if not manual_file_exists:
                    self.manual_csv_writer.writerow([
                        'System_Timestamp',
                        'Estimated_Arduino_Timestamp_ms',
                        'Heart_Rate_BPM',
                        'Device',
                        'Notes'
                    ])
                    self.manual_csv_file.flush()
                    print(f"✅ Created manual input CSV: {manual_abs_path}")
                else:
                    print(f"✅ Appending to manual input CSV: {manual_abs_path}")
            
            return True
        except IOError as e:
            print(f"❌ Failed to open CSV file: {e}")
            return False
    
    def process_line(self, line):
        """Process a line of serial data."""
        line = line.strip()
        
        # Check for connection start to sync timestamps more precisely
        connection_match = self.connection_pattern.search(line)
        if connection_match:
            # Update timestamp sync point
            self.connection_start_time = time.time()
            if self.enable_manual_input:
                print(f"🔗 Arduino connection detected - timestamp sync updated")
        
        # Match combined sensor data (timestamp, HR, SpO2 in one line)
        combined_match = self.combined_pattern.search(line)
        if combined_match:
            timestamp = int(combined_match.group(1))
            hr_value = int(combined_match.group(2))
            spo2_value = int(combined_match.group(3))
            
            system_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            
        # Write directly to CSV
            row = [
                system_time,
                timestamp,
            hr_value,
            spo2_value
            ]
            
            self.csv_writer.writerow(row)
            self.csv_file.flush()
                
            print(f"💾 {timestamp}ms | HR: {hr_value} BPM | SpO2: {spo2_value}%")
    def log_manual_heart_rate(self, hr_value, device='External', notes=''):
        """Log a manually entered heart rate value."""
        if not self.manual_csv_writer:
            print("⚠️  Manual input not enabled")
            return
        
        system_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
                
        # Calculate estimated Arduino timestamp
        arduino_timestamp = ''
        if self.connection_start_time is not None:
            elapsed_ms = int((time.time() - self.connection_start_time) * 1000)
            arduino_timestamp = elapsed_ms
        else:
            print("⚠️  Warning: Arduino connection not yet detected, timestamp may be inaccurate")
            # Use time since serial open as fallback
            arduino_timestamp = int((time.time() - self.connection_start_time if self.connection_start_time else 0) * 1000)
        
        row = [
            system_time,
            arduino_timestamp if arduino_timestamp != '' else 0,
            hr_value,
            device,
            notes
        ]
        
        self.manual_csv_writer.writerow(row)
        self.manual_csv_file.flush()
        
        timestamp_str = f"{arduino_timestamp}ms" if arduino_timestamp != '' else "0ms (not synced)"
        print(f"✏️  Manual entry saved: {timestamp_str} | HR: {hr_value} BPM | Device: {device}")
    
    def manual_input_loop(self):
        """Handle manual heart rate input from user."""
        print("\n" + "="*60)
        print("✏️  MANUAL INPUT MODE")
        print("   Type heart rate values (e.g., '72' or '72 Polar' or '72 Polar with notes')")
        print("   Press Enter with empty input to quit")
        print("="*60 + "\n")
        
        while self.running:
            try:
                user_input = input("Enter HR (BPM): ").strip()
                
                if not user_input:
                    # Empty input = quit
                    print("\n🛑 Stopping...")
                    self.running = False
                    break
                
                # Parse input: "HR" or "HR Device" or "HR Device notes"
                parts = user_input.split(maxsplit=2)
                
                try:
                    hr_value = int(parts[0])
                    device = parts[1] if len(parts) > 1 else 'External'
                    notes = parts[2] if len(parts) > 2 else ''
                    
                    self.log_manual_heart_rate(hr_value, device, notes)
                except ValueError:
                    print("⚠️  Invalid input. Please enter a number (e.g., '72' or '72 Polar')")
            
            except KeyboardInterrupt:
                print("\n\n🛑 Stopping...")
                self.running = False
                break
    
    def serial_monitor_loop(self):
        """Monitor serial data in background thread."""
        while self.running:
            try:
                if self.serial_conn.in_waiting > 0:
                    try:
                        line = self.serial_conn.readline().decode('utf-8', errors='ignore')
                        if line:
                            # Echo all serial output
                            print(f"[SERIAL] {line.strip()}")
                            self.process_line(line)
                    except UnicodeDecodeError:
                        pass  # Skip lines that can't be decoded
                else:
                    time.sleep(0.01)  # Small delay to prevent CPU spinning
            except Exception as e:
                if self.running:
                    print(f"⚠️  Serial error: {e}")
                break
    
    def run(self):
        """Main loop to read serial data and log to CSV."""
        if not self.open_serial():
            return
        
        if not self.open_csv():
            self.serial_conn.close()
            return
        
        print("\n" + "="*60)
        print("🎯 Monitoring serial output for sensor data...")
        if self.enable_manual_input:
            print("   Manual input mode enabled")
        else:
            print("   Press Ctrl+C to stop")
            print("="*60 + "\n")
        
        try:
            if self.enable_manual_input:
                # Run serial monitor in background thread
                serial_thread = threading.Thread(target=self.serial_monitor_loop, daemon=True)
                serial_thread.start()
                
                # Run manual input in main thread (blocking)
                self.manual_input_loop()
                
                # Wait for serial thread to finish
                serial_thread.join(timeout=1)
            else:
                # Simple mode - just monitor serial
                while self.running:
                    if self.serial_conn.in_waiting > 0:
                        try:
                            line = self.serial_conn.readline().decode('utf-8', errors='ignore')
                            if line:
                                # Echo all serial output
                                print(f"[SERIAL] {line.strip()}")
                                self.process_line(line)
                        except UnicodeDecodeError:
                            pass  # Skip lines that can't be decoded
                else:
                    time.sleep(0.01)  # Small delay to prevent CPU spinning
        
        except KeyboardInterrupt:
            print("\n\n" + "="*60)
            print("🛑 Stopped by user")
            print("="*60)
            self.running = False
        
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Close connections and files."""
        print("\n📊 Session complete:")
        abs_path = Path(self.output_file).absolute()
        print(f"   Arduino data: {abs_path}")
        
        if self.csv_file:
            self.csv_file.close()
            print("✅ Arduino CSV closed")
        
        if self.manual_csv_file:
            self.manual_csv_file.close()
            manual_path = abs_path.parent / f"manual_{abs_path.name}"
            print(f"   Manual data: {manual_path}")
            print("✅ Manual CSV closed")
        
        if self.serial_conn:
            self.serial_conn.close()
            print("✅ Serial connection closed")


def list_serial_ports():
    """List available serial ports."""
    try:
        import serial.tools.list_ports
        ports = serial.tools.list_ports.comports()
        if ports:
            print("\n📡 Available serial ports:")
            for port in ports:
                print(f"   - {port.device}: {port.description}")
        else:
            print("\n⚠️  No serial ports found")
    except ImportError:
        print("⚠️  pyserial not fully installed. Install with: pip install pyserial")


def main():
    parser = argparse.ArgumentParser(
        description='Monitor Arduino serial output and log sensor data to CSV'
    )
    parser.add_argument(
        '--port', '-p',
        type=str,
        help='Serial port (e.g., /dev/ttyACM0 on Linux, COM3 on Windows, /dev/cu.usbmodem* on Mac)'
    )
    parser.add_argument(
        '--baud', '-b',
        type=int,
        default=115200,
        help='Baud rate (default: 115200)'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default=None,
        help='Output CSV filename (default: python/data/sensor_data.csv relative to script)'
    )
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='List available serial ports and exit'
    )
    parser.add_argument(
        '--manual', '-m',
        action='store_true',
        help='Enable manual heart rate input for external device comparison'
    )
    
    args = parser.parse_args()
    
    # Set default output path relative to script location
    if args.output is None:
        script_dir = Path(__file__).parent
        args.output = script_dir / 'data' / 'sensor_data.csv'
    
    # List ports if requested
    if args.list:
        list_serial_ports()
        return
    
    # Check if port was specified
    if not args.port:
        print("❌ Error: Serial port not specified")
        print("\nUse --list to see available ports:")
        list_serial_ports()
        print("\nThen run with: python serial_monitor.py --port /dev/ttyACM0")
        return
    
    # Create logger and run
    logger = SerialDataLogger(args.port, args.baud, args.output, args.manual)
    logger.run()


if __name__ == '__main__':
    main()

