// src/screens/AccelerometerScreen.tsx - Accelerometer data visualization
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import type { SimpleNavigationProps } from '../types/simple-navigation';
import { useBluetooth } from '../context/BluetoothContext';
import { theme } from '../styles/theme';

interface AccelReading {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  timestamp: number;
}

type AccelerometerScreenProps = SimpleNavigationProps & {
  route: { name: 'Accelerometer'; key: string; params: undefined };
};

const AccelerometerScreen: React.FC<AccelerometerScreenProps> = ({ navigation, route }) => {
  const [readings, setReadings] = useState<AccelReading[]>([]);
  const [maxMagnitude, setMaxMagnitude] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const { state, sensorData, isConnected } = useBluetooth();

  // Update readings from real sensor data
  useEffect(() => {
    if (sensorData.accelerometer && isConnected) {
      console.log('✅ Accel Screen received data:', sensorData.accelerometer.magnitude, 'g');

      const newReading: AccelReading = {
        x: sensorData.accelerometer.x,
        y: sensorData.accelerometer.y,
        z: sensorData.accelerometer.z,
        magnitude: sensorData.accelerometer.magnitude,
        timestamp: sensorData.accelerometer.timestamp.getTime(),
      };

      setReadings(prev => {
        const updated = [...prev.slice(-29), newReading];
        
        // Update max magnitude for scaling
        const maxMag = Math.max(...updated.map(r => r.magnitude));
        setMaxMagnitude(maxMag);
        
        return updated;
      });
    }
  }, [sensorData.accelerometer, isConnected]);

  // Simulated accelerometer data for testing
  useEffect(() => {
    if (isSimulating && !isConnected) {
      const interval = setInterval(() => {
        try {
          // Simulate realistic accelerometer motion (gravity + small movements)
          const baseGravity = 1.0; // 1g from gravity
          const randomMotion = (Math.random() - 0.5) * 0.3; // Small random movements

          const x = (Math.random() - 0.5) * 0.2 + randomMotion;
          const y = (Math.random() - 0.5) * 0.2 + randomMotion;
          const z = baseGravity + (Math.random() - 0.5) * 0.15; // Gravity primarily on Z-axis
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          const newReading: AccelReading = {
            x: parseFloat(x.toFixed(3)),
            y: parseFloat(y.toFixed(3)),
            z: parseFloat(z.toFixed(3)),
            magnitude: parseFloat(magnitude.toFixed(3)),
            timestamp: Date.now(),
          };

          setReadings(prev => {
            const updated = [...prev.slice(-29), newReading];
            const maxMag = Math.max(...updated.map(r => r.magnitude));
            setMaxMagnitude(maxMag);
            return updated;
          });
        } catch (error) {
          console.error('Accelerometer simulation error:', error);
        }
      }, 1000); // Update every second

      return () => clearInterval(interval);
    }
  }, [isSimulating, isConnected]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (readings.length === 0) {
      return { avgX: 0, avgY: 0, avgZ: 0, avgMag: 0, peakMag: 0 };
    }

    const avgX = readings.reduce((sum, r) => sum + r.x, 0) / readings.length;
    const avgY = readings.reduce((sum, r) => sum + r.y, 0) / readings.length;
    const avgZ = readings.reduce((sum, r) => sum + r.z, 0) / readings.length;
    const avgMag = readings.reduce((sum, r) => sum + r.magnitude, 0) / readings.length;
    const peakMag = Math.max(...readings.map(r => r.magnitude));

    return { avgX, avgY, avgZ, avgMag, peakMag };
  }, [readings]);

  // Simple bar chart for recent readings
  const renderMagnitudeChart = () => {
    if (readings.length === 0) return null;

    const barWidth = (Dimensions.get('window').width - 80) / 30;
    const maxHeight = 100;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Movement Intensity (last 30 readings)</Text>
        <View style={styles.barsContainer}>
          {readings.map((reading, index) => {
            const barHeight = maxMagnitude > 0
              ? (reading.magnitude / maxMagnitude) * maxHeight
              : 0;

            return (
              <View
                key={`${reading.timestamp}-${index}`}
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: Math.max(barHeight, 2),
                    backgroundColor: reading.magnitude > 1.5 ? theme.colors.error :
                                    reading.magnitude > 1.2 ? theme.colors.tertiary :
                                    theme.colors.primary,
                  }
                ]}
              />
            );
          })}
        </View>
        <View style={styles.chartLabels}>
          <Text style={styles.chartLabel}>30s ago</Text>
          <Text style={styles.chartLabel}>Now</Text>
        </View>
      </View>
    );
  };

  // Current acceleration display
  const currentReading = readings[readings.length - 1];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <Icon
            name={isConnected ? 'sensors' : 'sensors-off'}
            size={16}
            color={isConnected ? theme.colors.success : theme.colors.error}
          />
          <Text style={[styles.statusText, { color: isConnected ? theme.colors.success : theme.colors.error }]}>
            {isConnected ? 'Accelerometer Connected' : 'No Device Connected'}
          </Text>
        </View>

        {/* Current Readings */}
        {currentReading ? (
          <View style={styles.currentReadingContainer}>
            <Text style={styles.sectionTitle}>Current Acceleration</Text>

            <View style={styles.axisGrid}>
              {/* X Axis */}
              <View style={styles.axisCard}>
                <View style={[styles.axisIcon, { backgroundColor: '#FF6B6B40' }]}>
                  <Text style={[styles.axisLabel, { color: '#FF6B6B' }]}>X</Text>
                </View>
                <Text style={[styles.axisValue, { color: '#FF6B6B' }]}>
                  {currentReading.x.toFixed(3)}
                </Text>
                <Text style={styles.axisUnit}>g</Text>
              </View>

              {/* Y Axis */}
              <View style={styles.axisCard}>
                <View style={[styles.axisIcon, { backgroundColor: '#4ECDC440' }]}>
                  <Text style={[styles.axisLabel, { color: '#4ECDC4' }]}>Y</Text>
                </View>
                <Text style={[styles.axisValue, { color: '#4ECDC4' }]}>
                  {currentReading.y.toFixed(3)}
                </Text>
                <Text style={styles.axisUnit}>g</Text>
              </View>

              {/* Z Axis */}
              <View style={styles.axisCard}>
                <View style={[styles.axisIcon, { backgroundColor: '#95E1D340' }]}>
                  <Text style={[styles.axisLabel, { color: '#95E1D3' }]}>Z</Text>
                </View>
                <Text style={[styles.axisValue, { color: '#95E1D3' }]}>
                  {currentReading.z.toFixed(3)}
                </Text>
                <Text style={styles.axisUnit}>g</Text>
              </View>
            </View>

            {/* Magnitude */}
            <View style={styles.magnitudeContainer}>
              <Text style={styles.magnitudeLabel}>Total Magnitude</Text>
              <Text style={styles.magnitudeValue}>
                {currentReading.magnitude.toFixed(3)} g
              </Text>
              <View style={styles.magnitudeBar}>
                <View
                  style={[
                    styles.magnitudeBarFill,
                    {
                      width: `${Math.min((currentReading.magnitude / 2) * 100, 100)}%`,
                      backgroundColor: currentReading.magnitude > 1.5 ? theme.colors.error :
                                      currentReading.magnitude > 1.2 ? theme.colors.tertiary :
                                      theme.colors.primary,
                    }
                  ]}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="smartphone" size={48} color={theme.colors.onSurfaceVariant} />
            <Text style={styles.emptyStateText}>
              {isConnected
                ? 'Waiting for accelerometer data...'
                : 'Connect to a Nordic device to see accelerometer data'}
            </Text>
          </View>
        )}

        {/* Movement Chart */}
        {readings.length > 0 && renderMagnitudeChart()}

        {/* Statistics */}
        {readings.length > 0 && (
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Statistics</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg Magnitude</Text>
                <Text style={styles.statValue}>{stats.avgMag.toFixed(3)} g</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Peak Magnitude</Text>
                <Text style={styles.statValue}>{stats.peakMag.toFixed(3)} g</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg X-Axis</Text>
                <Text style={styles.statValue}>{stats.avgX.toFixed(3)} g</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg Y-Axis</Text>
                <Text style={styles.statValue}>{stats.avgY.toFixed(3)} g</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg Z-Axis</Text>
                <Text style={styles.statValue}>{stats.avgZ.toFixed(3)} g</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Sample Count</Text>
                <Text style={styles.statValue}>{readings.length}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Simulation Button (when not connected) */}
        {!isConnected && (
          <TouchableOpacity
            style={[
              styles.simulationButton,
              { backgroundColor: isSimulating ? theme.colors.error : theme.colors.primary }
            ]}
            onPress={() => setIsSimulating(!isSimulating)}
          >
            <Icon
              name={isSimulating ? 'stop' : 'play-arrow'}
              size={20}
              color={theme.colors.onPrimary}
            />
            <Text style={styles.simulationButtonText}>
              {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="info-outline" size={20} color={theme.colors.secondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoText}>
              Accelerometer measures device movement in 3D space.
              1g ≈ gravity (9.8 m/s²). Higher magnitude indicates more movement.
              {!isConnected && ' Tap "Start Simulation" to see simulated sensor data.'}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  currentReadingContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 16,
  },
  axisGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  axisCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  axisIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  axisLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  axisValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  axisUnit: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  magnitudeContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  magnitudeLabel: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  magnitudeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  magnitudeBar: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
  },
  magnitudeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  chartContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 1,
    marginBottom: 12,
  },
  bar: {
    borderRadius: 2,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
  statsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: theme.colors.surfaceVariant,
    padding: 12,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.secondaryContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 8,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.onSecondaryContainer,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 40,
  },
  simulationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    gap: 8,
  },
  simulationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
});

export default AccelerometerScreen;
