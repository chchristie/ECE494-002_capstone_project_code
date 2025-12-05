#!/usr/bin/env python3
"""
Analyze and compare heart rate data from phone, sensor, and watch
"""

import csv
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from collections import defaultdict


def load_sensor_data(filepath):
    """Load Arduino sensor data (oldest to newest order)."""
    data = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                time_seconds = float(row['Arduino_Timestamp_ms']) / 1000.0
                hr = int(row['Heart_Rate_BPM'])
                spo2 = int(row['SpO2_Percent'])
                data.append({
                    'time': time_seconds,
                    'hr': hr,
                    'spo2': spo2
                })
            except (ValueError, KeyError):
                pass
    return data


def load_phone_data(filepath):
    """Load phone app data (newest to oldest order in file)."""
    data = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                time_seconds = float(row['Time_Since_Start_Seconds'])
                hr = int(row['HR_BPM'])
                spo2 = int(row['SpO2_Percent'])
                data.append({
                    'time': time_seconds,
                    'hr': hr,
                    'spo2': spo2
                })
            except (ValueError, KeyError):
                pass
    return data


def load_watch_data(filepath):
    """Load manual watch data."""
    data = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                time_ms = float(row['Estimated_Arduino_Timestamp_ms'])
                time_seconds = time_ms / 1000.0
                hr = int(row['Heart_Rate_BPM'])
                # Filter out obviously bad data (like 65456)
                if hr > 0 and hr < 250:
                    data.append({
                        'time': time_seconds,
                        'hr': hr
                    })
            except (ValueError, KeyError):
                pass
    return data


def find_closest_match(target_time, data_list, time_tolerance=2.0):
    """Find closest data point within time tolerance."""
    closest = None
    min_diff = float('inf')
    
    for item in data_list:
        diff = abs(item['time'] - target_time)
        if diff <= time_tolerance and diff < min_diff:
            min_diff = diff
            closest = item
    
    return closest, min_diff if closest else None


def compare_data(phone_data, sensor_data):
    """Compare phone and sensor data one-to-one (same number of readings expected)."""
    # Phone data is newest to oldest, sensor is oldest to newest
    # Reverse phone data to match sensor order
    phone_reversed = list(reversed(phone_data))
    
    print(f"\n📊 One-to-One Comparison:")
    print(f"   Phone readings:  {len(phone_reversed)}")
    print(f"   Sensor readings: {len(sensor_data)}")
    
    # Ensure same length
    min_len = min(len(phone_reversed), len(sensor_data))
    if len(phone_reversed) != len(sensor_data):
        print(f"   ⚠️  Length mismatch! Using first {min_len} readings from each")
    
    # Compare HR and SpO2 one-to-one
    hr_inconsistencies = []
    spo2_inconsistencies = []
    hr_matches = []
    spo2_matches = []
    
    for i in range(min_len):
        phone_reading = phone_reversed[i]
        sensor_reading = sensor_data[i]
        
        # Only compare non-zero values
        if phone_reading['hr'] > 0 and sensor_reading['hr'] > 0:
            hr_diff = abs(phone_reading['hr'] - sensor_reading['hr'])
            hr_matches.append({
                'phone': phone_reading['hr'],
                'sensor': sensor_reading['hr'],
                'diff': hr_diff,
                'time': phone_reading['time'],
                'index': i
            })
            
            # Flag as inconsistency if difference > 5 BPM
            if hr_diff > 5:
                hr_inconsistencies.append({
                    'index': i,
                    'time': phone_reading['time'],
                    'phone_hr': phone_reading['hr'],
                    'sensor_hr': sensor_reading['hr'],
                    'diff': hr_diff
                })
        
        if phone_reading['spo2'] > 0 and sensor_reading['spo2'] > 0:
            spo2_diff = abs(phone_reading['spo2'] - sensor_reading['spo2'])
            spo2_matches.append({
                'phone': phone_reading['spo2'],
                'sensor': sensor_reading['spo2'],
                'diff': spo2_diff,
                'time': phone_reading['time'],
                'index': i
            })
            
            # Flag as inconsistency if difference > 2%
            if spo2_diff > 2:
                spo2_inconsistencies.append({
                    'index': i,
                    'time': phone_reading['time'],
                    'phone_spo2': phone_reading['spo2'],
                    'sensor_spo2': sensor_reading['spo2'],
                    'diff': spo2_diff
                })
    
    return {
        'hr_matches': hr_matches,
        'spo2_matches': spo2_matches,
        'hr_inconsistencies': hr_inconsistencies,
        'spo2_inconsistencies': spo2_inconsistencies
    }


def calculate_percent_differences(phone_data, watch_data, time_tolerance=2.0):
    """Calculate absolute percent error between phone and watch HR (watch is expected)."""
    percent_errors = []
    
    for phone_reading in phone_data:
        if phone_reading['hr'] == 0:
            continue
            
        watch_reading, time_diff = find_closest_match(
            phone_reading['time'], 
            watch_data, 
            time_tolerance
        )
        
        if watch_reading and time_diff is not None and watch_reading['hr'] > 0:
            # Absolute percent error: |phone - watch| / watch * 100
            abs_percent_error = (abs(phone_reading['hr'] - watch_reading['hr']) / watch_reading['hr']) * 100
            percent_errors.append({
                'time': phone_reading['time'],
                'phone_hr': phone_reading['hr'],
                'watch_hr': watch_reading['hr'],
                'abs_percent_error': abs_percent_error,
                'time_offset': time_diff
            })
    
    if not percent_errors:
        return None
    
    error_values = [d['abs_percent_error'] for d in percent_errors]
    
    return {
        'matches': percent_errors,
        'avg_abs_error': np.mean(error_values),
        'max_abs_error': np.max(error_values),
        'count': len(percent_errors)
    }


def plot_phone_vs_watch(phone_data, watch_data):
    """Plot phone HR vs watch HR with solid/dashed lines based on phone data."""
    # Phone data is newest to oldest, reverse it to oldest to newest for plotting
    phone_sorted = list(reversed(phone_data))
    watch_sorted = sorted(watch_data, key=lambda x: x['time'])
    
    # Extract phone HR data
    phone_times = np.array([d['time'] for d in phone_sorted])
    phone_hrs = np.array([d['hr'] for d in phone_sorted])
    
    # Calculate percentage of non-zero phone data
    nonzero_count = np.sum(phone_hrs > 0)
    total_count = len(phone_hrs)
    nonzero_percent = (nonzero_count / total_count * 100) if total_count > 0 else 0
    
    # Extract watch data
    watch_times = np.array([d['time'] for d in watch_sorted])
    watch_hrs = np.array([d['hr'] for d in watch_sorted])
    
    # Create figure
    fig, ax = plt.subplots(figsize=(14, 8))
    
    ax.set_title('Phone vs Watch Heart Rate Comparison', fontsize=16, fontweight='bold')
    ax.set_xlabel('Time Since Start (seconds)', fontsize=13)
    ax.set_ylabel('Heart Rate (BPM)', fontsize=13)
    ax.grid(True, alpha=0.3)
    
    # Plot phone data with smart dashed line handling for zero regions
    i = 0
    while i < len(phone_times):
        if phone_hrs[i] > 0:
            # Find the run of non-zero values
            j = i
            while j < len(phone_hrs) and phone_hrs[j] > 0:
                j += 1
            
            # Plot solid line for non-zero region
            ax.plot(phone_times[i:j], phone_hrs[i:j], 'b-', linewidth=2.5, alpha=0.8)
            ax.plot(phone_times[i:j], phone_hrs[i:j], 'bo', markersize=7, label='Phone (App)' if i == 0 else '')
            
            # If there's a zero region after this, draw dashed connector
            if j < len(phone_hrs):
                # Find next non-zero value
                k = j
                while k < len(phone_hrs) and phone_hrs[k] == 0:
                    k += 1
                
                if k < len(phone_hrs):
                    # Draw dashed line from last non-zero to next non-zero
                    ax.plot([phone_times[j-1], phone_times[k]], 
                           [phone_hrs[j-1], phone_hrs[k]], 
                           'b--', linewidth=2, alpha=0.4)
                else:
                    # No more non-zero values, draw horizontal dashed to end
                    ax.plot([phone_times[j-1], phone_times[-1]], 
                           [phone_hrs[j-1], phone_hrs[j-1]], 
                           'b--', linewidth=2, alpha=0.4)
            
            i = j
        else:
            # Skip zero values
            i += 1
    
    # Handle case where data starts with zeros - draw horizontal dashed to first non-zero
    first_nonzero_idx = np.argmax(phone_hrs > 0)
    if first_nonzero_idx > 0 and phone_hrs[first_nonzero_idx] > 0:
        ax.plot([phone_times[0], phone_times[first_nonzero_idx]], 
               [phone_hrs[first_nonzero_idx], phone_hrs[first_nonzero_idx]], 
               'b--', linewidth=2, alpha=0.4)
    
    # Plot watch data
    ax.plot(watch_times, watch_hrs, 'r-', linewidth=2.5, label='Watch (Reference)', alpha=0.8)
    ax.plot(watch_times, watch_hrs, 'rs', markersize=9)
    
    # Calculate and display percent differences
    percent_stats = calculate_percent_differences(phone_sorted, watch_sorted, time_tolerance=3.0)
    
    if percent_stats:
        stats_text = (
            f'Phone Data Activity: {nonzero_percent:.1f}%\n'
            f'({nonzero_count}/{total_count} readings)\n\n'
            f'Absolute Percent Error:\n'
            f'  Average: {percent_stats["avg_abs_error"]:.2f}%\n'
            f'  Maximum: {percent_stats["max_abs_error"]:.2f}%'
        )
    else:
        stats_text = (
            f'Phone Data Activity: {nonzero_percent:.1f}%\n'
            f'({nonzero_count}/{total_count} readings)\n\n'
            f'No matching watch data found'
        )
    
    ax.text(0.02, 0.98, stats_text,
            transform=ax.transAxes, verticalalignment='top',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.9),
            fontsize=11, fontweight='bold', family='monospace')
    
    # Create legend with clear descriptions
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], color='blue', linewidth=2.5, marker='o', markersize=7, 
               label='Phone HR (solid=active, dashed=gaps)'),
        Line2D([0], [0], color='red', linewidth=2.5, marker='s', markersize=9, 
               label='Watch HR (reference)')
    ]
    ax.legend(handles=legend_elements, fontsize=12, loc='upper right')
    
    plt.tight_layout()
    
    # Save figure
    output_path = Path(__file__).parent / 'data' / 'hr_comparison_plot.png'
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    print(f"\n📊 Plot saved: {output_path}")
    
    plt.show()
    
    return nonzero_percent, percent_stats


def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir / 'data'
    
    sensor_file = data_dir / 'sensor_data.csv'
    phone_file = data_dir / 'phone_data.csv'
    watch_file = data_dir / 'watch_data.csv'
    
    # Check files exist
    if not all([sensor_file.exists(), phone_file.exists(), watch_file.exists()]):
        print("❌ Missing data files!")
        print(f"   Sensor: {sensor_file.exists()}")
        print(f"   Phone:  {phone_file.exists()}")
        print(f"   Watch:  {watch_file.exists()}")
        return
    
    print("=" * 70)
    print("📊 Heart Rate & SpO2 Data Comparison Analysis")
    print("=" * 70)
    
    # Load data
    print("\n📥 Loading data...")
    print("   Note: Phone data is newest→oldest, Sensor is oldest→newest")
    print("         Will reverse phone data for one-to-one comparison")
    
    sensor_data = load_sensor_data(sensor_file)
    phone_data = load_phone_data(phone_file)
    watch_data = load_watch_data(watch_file)
    
    print(f"\n   Sensor: {len(sensor_data)} readings (oldest→newest)")
    print(f"   Phone:  {len(phone_data)} readings (newest→oldest)")
    print(f"   Watch:  {len(watch_data)} readings")
    
    # Compare phone vs sensor (serial data)
    print("\n" + "=" * 70)
    print("🔍 Comparing Phone App vs Serial Sensor Data (One-to-One)")
    print("=" * 70)
    
    comparison = compare_data(phone_data, sensor_data)
    
    # Heart Rate Analysis
    print(f"\n❤️  Heart Rate Analysis:")
    print(f"   Matched pairs: {len(comparison['hr_matches'])}")
    if comparison['hr_matches']:
        hr_diffs = [m['diff'] for m in comparison['hr_matches']]
        avg_hr_diff = np.mean(hr_diffs)
        max_hr_diff = np.max(hr_diffs)
        print(f"   Average difference: {avg_hr_diff:.2f} BPM")
        print(f"   Maximum difference: {max_hr_diff:.2f} BPM")
        print(f"   Inconsistencies (>5 BPM): {len(comparison['hr_inconsistencies'])}")
        
        if comparison['hr_inconsistencies']:
            print(f"\n   ⚠️  HR Inconsistencies:")
            for inc in comparison['hr_inconsistencies'][:10]:  # Show first 10
                print(f"      Index {inc['index']:3d} (Time {inc['time']:.1f}s): Phone={inc['phone_hr']} vs Sensor={inc['sensor_hr']} (diff={inc['diff']})")
    
    # SpO2 Analysis
    print(f"\n💨 SpO2 Analysis:")
    print(f"   Matched pairs: {len(comparison['spo2_matches'])}")
    if comparison['spo2_matches']:
        spo2_diffs = [m['diff'] for m in comparison['spo2_matches']]
        avg_spo2_diff = np.mean(spo2_diffs)
        max_spo2_diff = np.max(spo2_diffs)
        print(f"   Average difference: {avg_spo2_diff:.2f}%")
        print(f"   Maximum difference: {max_spo2_diff:.2f}%")
        print(f"   Inconsistencies (>2%): {len(comparison['spo2_inconsistencies'])}")
        
        if comparison['spo2_inconsistencies']:
            print(f"\n   ⚠️  SpO2 Inconsistencies:")
            for inc in comparison['spo2_inconsistencies'][:10]:  # Show first 10
                print(f"      Index {inc['index']:3d} (Time {inc['time']:.1f}s): Phone={inc['phone_spo2']}% vs Sensor={inc['sensor_spo2']}% (diff={inc['diff']})")
    
    # Plot phone vs watch
    print("\n" + "=" * 70)
    print("📈 Plotting Phone vs Watch HR Data")
    print("=" * 70)
    
    nonzero_percent, percent_stats = plot_phone_vs_watch(phone_data, watch_data)
    
    print(f"\n✅ Phone Data Activity: {nonzero_percent:.1f}% of time has non-zero heart rate")
    
    if percent_stats:
        print(f"\n📊 Phone vs Watch Absolute Percent Error (Watch = Reference):")
        print(f"   Matched pairs: {percent_stats['count']}")
        print(f"   Average absolute error: {percent_stats['avg_abs_error']:.2f}%")
        print(f"   Maximum absolute error: {percent_stats['max_abs_error']:.2f}%")
        
        # Interpretation
        avg_err = percent_stats['avg_abs_error']
        if avg_err < 2:
            print(f"   ✅ Excellent agreement (avg < 2% error)")
        elif avg_err < 5:
            print(f"   ✓  Good agreement (avg < 5% error)")
        elif avg_err < 10:
            print(f"   ⚠️  Moderate agreement (avg 5-10% error)")
        else:
            print(f"   ❌ Poor agreement (avg > 10% error)")
    
    print("\n" + "=" * 70)
    print("✅ Analysis Complete!")
    print("=" * 70)


if __name__ == '__main__':
    main()

