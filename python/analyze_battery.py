#!/usr/bin/env python3
"""
Analyze battery charging and discharging data
Plots voltage over time and calculates charge/discharge rates
"""

import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from scipy import stats
import csv
from datetime import datetime


def load_battery_data(filepath):
    """Load battery voltage data from CSV file."""
    data = []
    
    # Check for .csv extension if not provided
    csv_path = Path(filepath)
    if not csv_path.exists() and csv_path.suffix != '.csv':
        csv_path = Path(str(filepath) + '.csv')
    
    if not csv_path.exists():
        print(f"⚠️  File not found: {csv_path}")
        return None
    
    try:
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    # Use specific column names from exported session data
                    voltage_str = row.get('Battery_Voltage_V') or row.get('BATTERY_VOLTAGE_V') or row.get('battery_voltage_v')
                    time_str = row.get('Time_Since_Start_Minutes') or row.get('TIME_SINCE_START_MINUTES') or row.get('time_since_start_minutes')
                    
                    # Fallback to case-insensitive search
                    if not voltage_str:
                        for key in row.keys():
                            if 'battery_voltage' in key.lower() and 'v' in key.lower():
                                voltage_str = row[key]
                                break
                    
                    if not time_str:
                        for key in row.keys():
                            if 'time_since_start_minutes' in key.lower():
                                time_str = row[key]
                                break
                    
                    if voltage_str and time_str:
                        voltage = float(voltage_str)
                        time_minutes = float(time_str)
                        time_seconds = time_minutes * 60.0  # Convert minutes to seconds
                        
                        # Skip invalid data
                        if voltage > 0 and voltage < 10:  # Reasonable voltage range
                            data.append({
                                'time': time_seconds,
                                'voltage': voltage
                            })
                except (ValueError, KeyError) as e:
                    continue
    
    except Exception as e:
        print(f"❌ Error reading {csv_path}: {e}")
        import traceback
        traceback.print_exc()
        return None
    
    if not data:
        print(f"⚠️  No data found in {csv_path}")
        return None
    
    # Sort by time
    data.sort(key=lambda x: x['time'])
    
    # Normalize time to start at 0
    if data:
        start_time = data[0]['time']
        for entry in data:
            entry['time'] = entry['time'] - start_time
    
    return data


def calculate_charge_time(voltage_data, empty_voltage=3.3, full_voltage=4.2):
    """Calculate time to charge from empty to full using linear regression."""
    if not voltage_data or len(voltage_data) < 2:
        return None
    
    times = np.array([d['time'] for d in voltage_data])
    voltages = np.array([d['voltage'] for d in voltage_data])
    
    # Perform linear regression
    slope, intercept, r_value, p_value, std_err = stats.linregress(times, voltages)
    
    # Calculate time to go from empty_voltage to full_voltage
    # voltage = slope * time + intercept
    # time = (voltage - intercept) / slope
    
    if abs(slope) < 1e-10:  # Essentially flat
        return None
    
    time_at_empty = (empty_voltage - intercept) / slope
    time_at_full = (full_voltage - intercept) / slope
    
    charge_time = abs(time_at_full - time_at_empty)
    
    return {
        'slope': slope,  # V/s (volts per second)
        'intercept': intercept,
        'r_squared': r_value ** 2,
        'time_to_charge': charge_time,  # seconds
        'time_at_empty': time_at_empty,
        'time_at_full': time_at_full,
        'rate_v_per_s': abs(slope),  # Absolute rate
        'rate_v_per_hour': abs(slope) * 3600,  # Volts per hour
    }


def plot_battery_data(charging_data, discharging_data, charging_stats, discharging_stats):
    """Create plots for charging and discharging data."""
    fig, axes = plt.subplots(2, 1, figsize=(14, 10))
    
    # === Charging Plot ===
    ax1 = axes[0]
    if charging_data:
        times = [d['time'] for d in charging_data]
        voltages = [d['voltage'] for d in charging_data]
        
        ax1.plot(times, voltages, 'b-', linewidth=2, alpha=0.7, label='Voltage Data')
        ax1.plot(times, voltages, 'bo', markersize=4, alpha=0.5)
        
        # Plot linear regression line
        if charging_stats:
            times_array = np.array(times)
            fit_line = charging_stats['slope'] * times_array + charging_stats['intercept']
            ax1.plot(times_array, fit_line, 'r--', linewidth=2, 
                    label=f"Linear Fit (R²={charging_stats['r_squared']:.3f})")
            
            # Mark empty and full voltage points
            ax1.axhline(y=3.3, color='orange', linestyle=':', linewidth=1.5, label='Empty (3.3V)')
            ax1.axhline(y=4.2, color='green', linestyle=':', linewidth=1.5, label='Full (4.2V)')
            
            # Add statistics text
            stats_text = (
                f"Charging Rate: {charging_stats['rate_v_per_hour']:.3f} V/h\n"
                f"Time to Charge (3.3V → 4.2V): {charging_stats['time_to_charge']/3600:.2f} hours\n"
                f"({charging_stats['time_to_charge']/60:.1f} minutes)\n"
                f"Linear Fit R²: {charging_stats['r_squared']:.3f}"
            )
            ax1.text(0.02, 0.98, stats_text,
                    transform=ax1.transAxes, verticalalignment='top',
                    bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.8),
                    fontsize=11, family='monospace')
        
        ax1.set_xlabel('Time (seconds)', fontsize=12)
        ax1.set_ylabel('Voltage (V)', fontsize=12)
        ax1.set_title('Battery Charging', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        ax1.legend(loc='best')
        ax1.set_ylim([3.2, 4.3])
    else:
        ax1.text(0.5, 0.5, 'No charging data available', 
                transform=ax1.transAxes, ha='center', va='center', fontsize=14)
        ax1.set_title('Battery Charging', fontsize=14, fontweight='bold')
    
    # === Discharging Plot ===
    ax2 = axes[1]
    if discharging_data:
        times = [d['time'] for d in discharging_data]
        voltages = [d['voltage'] for d in discharging_data]
        
        ax2.plot(times, voltages, 'r-', linewidth=2, alpha=0.7, label='Voltage Data')
        ax2.plot(times, voltages, 'ro', markersize=4, alpha=0.5)
        
        # Plot linear regression line
        if discharging_stats:
            times_array = np.array(times)
            fit_line = discharging_stats['slope'] * times_array + discharging_stats['intercept']
            ax2.plot(times_array, fit_line, 'b--', linewidth=2,
                    label=f"Linear Fit (R²={discharging_stats['r_squared']:.3f})")
            
            # Mark empty and full voltage points
            ax2.axhline(y=3.3, color='orange', linestyle=':', linewidth=1.5, label='Empty (3.3V)')
            ax2.axhline(y=4.2, color='green', linestyle=':', linewidth=1.5, label='Full (4.2V)')
            
            # Add statistics text
            stats_text = (
                f"Discharging Rate: {discharging_stats['rate_v_per_hour']:.3f} V/h\n"
                f"Time to Discharge (4.2V → 3.3V): {discharging_stats['time_to_charge']/3600:.2f} hours\n"
                f"({discharging_stats['time_to_charge']/60:.1f} minutes)\n"
                f"Linear Fit R²: {discharging_stats['r_squared']:.3f}"
            )
            ax2.text(0.02, 0.98, stats_text,
                    transform=ax2.transAxes, verticalalignment='top',
                    bbox=dict(boxstyle='round', facecolor='lightcoral', alpha=0.8),
                    fontsize=11, family='monospace')
        
        ax2.set_xlabel('Time (seconds)', fontsize=12)
        ax2.set_ylabel('Voltage (V)', fontsize=12)
        ax2.set_title('Battery Discharging', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        ax2.legend(loc='best')
        ax2.set_ylim([3.2, 4.3])
    else:
        ax2.text(0.5, 0.5, 'No discharging data available',
                transform=ax2.transAxes, ha='center', va='center', fontsize=14)
        ax2.set_title('Battery Discharging', fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    
    # Save figure
    output_path = Path(__file__).parent / 'data' / 'battery_analysis.png'
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    print(f"\n📊 Plot saved: {output_path}")
    
    plt.show()


def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir / 'data'
    
    charging_file = data_dir / 'charging.csv'
    discharging_file = data_dir / 'discharging.csv'
    
    print("=" * 70)
    print("🔋 Battery Charging/Discharging Analysis")
    print("=" * 70)
    
    # Load data
    print("\n📥 Loading data...")
    charging_data = load_battery_data(charging_file)
    discharging_data = load_battery_data(discharging_file)
    
    if charging_data:
        print(f"   ✅ Charging data: {len(charging_data)} readings")
        print(f"      Voltage range: {min(d['voltage'] for d in charging_data):.3f}V - {max(d['voltage'] for d in charging_data):.3f}V")
        print(f"      Time range: {min(d['time'] for d in charging_data):.1f}s - {max(d['time'] for d in charging_data):.1f}s")
    else:
        print(f"   ⚠️  No charging data found")
    
    if discharging_data:
        print(f"   ✅ Discharging data: {len(discharging_data)} readings")
        print(f"      Voltage range: {min(d['voltage'] for d in discharging_data):.3f}V - {max(d['voltage'] for d in discharging_data):.3f}V")
        print(f"      Time range: {min(d['time'] for d in discharging_data):.1f}s - {max(d['time'] for d in discharging_data):.1f}s")
    else:
        print(f"   ⚠️  No discharging data found")
    
    # Calculate statistics
    print("\n📊 Calculating charge/discharge rates...")
    
    charging_stats = None
    discharging_stats = None
    
    if charging_data:
        charging_stats = calculate_charge_time(charging_data, empty_voltage=3.3, full_voltage=4.2)
        if charging_stats:
            print(f"\n⚡ Charging Analysis:")
            print(f"   Rate: {charging_stats['rate_v_per_hour']:.3f} V/h ({charging_stats['rate_v_per_s']:.6f} V/s)")
            print(f"   Time to charge (3.3V → 4.2V): {charging_stats['time_to_charge']/3600:.2f} hours ({charging_stats['time_to_charge']/60:.1f} minutes)")
            print(f"   Linear fit quality (R²): {charging_stats['r_squared']:.3f}")
    
    if discharging_data:
        discharging_stats = calculate_charge_time(discharging_data, empty_voltage=3.3, full_voltage=4.2)
        if discharging_stats:
            print(f"\n🔋 Discharging Analysis:")
            print(f"   Rate: {discharging_stats['rate_v_per_hour']:.3f} V/h ({discharging_stats['rate_v_per_s']:.6f} V/s)")
            print(f"   Time to discharge (4.2V → 3.3V): {discharging_stats['time_to_charge']/3600:.2f} hours ({discharging_stats['time_to_charge']/60:.1f} minutes)")
            print(f"   Linear fit quality (R²): {discharging_stats['r_squared']:.3f}")
    
    # Create plots
    print("\n📈 Generating plots...")
    plot_battery_data(charging_data, discharging_data, charging_stats, discharging_stats)
    
    print("\n" + "=" * 70)
    print("✅ Analysis Complete!")
    print("=" * 70)


if __name__ == '__main__':
    main()

