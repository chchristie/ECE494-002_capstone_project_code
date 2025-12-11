// HeartRateScreen.tsx -  Displays Heart Rate: Where most components are used since this was the original screen, components were part of the early app when i was messing around with react native ui effects
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import type { HeartRateScreenProps } from '../types/simple-navigation';
import { useBluetooth } from '../context/BluetoothContext';
import { HeartRateChart } from '../components/HeartRateChart';
import { GlassContainer } from '../components/GlassContainer';
import { NeumorphicCard } from '../components/NeumorphicCard';
import { Heart3D } from '../components/3DHeart';
import { SimpleGradientText } from '../components/GradientText';
import { ConnectionPulse } from '../components/ParticleEffects';
import { theme } from '../styles/theme';

interface HeartRateReading {
  value: number;
  timestamp: number;
  source: 'manual' | 'bluetooth';
}

interface HeartRateStats {
  current: number;
  average: number;
  min: number;
  max: number;
  zone: 'resting' | 'fat_burn' | 'cardio' | 'peak';
}

// Heart rate zone calculations based on average male
const calculateHeartRateZone = (bpm: number, age: number = 30): HeartRateStats['zone'] => {
  const maxHR = 220 - age;
  const percentage = (bpm / maxHR) * 100;
  
  if (percentage < 60) return 'resting';
  if (percentage < 70) return 'fat_burn';
  if (percentage < 85) return 'cardio';
  return 'peak';
};

const getZoneColor = (zone: HeartRateStats['zone']): string => {
  const zoneColors = {
    resting: theme.colors.success,
    fat_burn: theme.colors.secondary,
    cardio: theme.colors.tertiary,
    peak: theme.colors.error,
  };
  return zoneColors[zone];
};

const getZoneLabel = (zone: HeartRateStats['zone']): string => {
  const zoneLabels = {
    resting: 'Resting',
    fat_burn: 'Fat Burn',
    cardio: 'Cardio',
    peak: 'Peak',
  };
  return zoneLabels[zone];
};

// Calculates stats from readings
const calculateStats = (readings: HeartRateReading[]): HeartRateStats => {
  if (readings.length === 0) {
    return { current: 0, average: 0, min: 0, max: 0, zone: 'resting' };
  }

  const values = readings.map(r => r.value);
  const current = readings[readings.length - 1]?.value || 0;
  
  // Filters out 0 bpm values for statistics calculation
  const validValues = values.filter(val => val > 0);
  
  if (validValues.length === 0) {
    return { current, average: 0, min: 0, max: 0, zone: 'resting' };
  }
  
  const average = Math.round(validValues.reduce((sum, val) => sum + val, 0) / validValues.length);
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const zone = calculateHeartRateZone(current);

  return { current, average, min, max, zone };
};

// Converts readings to chart data format
const convertToChartData = (readings: HeartRateReading[]) => {
  return readings.map((reading, index) => ({
    x: index,
    y: reading.value,
    timestamp: reading.timestamp,
  }));
};

const HeartRateScreen: React.FC<HeartRateScreenProps> = ({ navigation, route }) => {
  const [readings, setReadings] = useState<HeartRateReading[]>([]);
  const [stats, setStats] = useState<HeartRateStats>({
    current: 0,
    average: 0,
    min: 0,
    max: 0,
    zone: 'resting',
  });

  const { state, sensorData, isConnected } = useBluetooth();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hrValueAnim = useRef(new Animated.Value(0)).current;
  const previousHR = useRef(0);

  // Pulsing heart icon animation when connected
  useEffect(() => {
    if (isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnected]);

  // Animates heart rate value changes
  useEffect(() => {
    if (stats.current !== previousHR.current && stats.current > 0) {
      Animated.sequence([
        Animated.timing(hrValueAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(hrValueAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      previousHR.current = stats.current;
    }
  }, [stats.current]);

  // FIXED: Handle Nordic sensor data - Replaces previously made simulation
  useEffect(() => {
    if (sensorData.heartRate && isConnected) {

      const realReading: HeartRateReading = {
        value: sensorData.heartRate.heartRate,
        timestamp: sensorData.heartRate.timestamp.getTime(),
        source: 'bluetooth',
      };

      setReadings(prev => [...prev.slice(-19), realReading]);
    }
  }, [sensorData.heartRate, isConnected]);

  // Updates stats when readings change
  useEffect(() => {
    try {
      const newStats = calculateStats(readings);
      setStats(newStats);
    } catch (error) {
      console.error('Error calculating stats:', error);
      // Sets safe default stats on error
      setStats({ current: 0, average: 0, min: 0, max: 0, zone: 'resting' });
    }
  }, [readings]);

  // **Data source indicator**
  const getDataSourceText = () => {
    if (isConnected) {
      return 'Nordic Sensor Data';
    } else {
      return 'No Device Connected';
    }
  };

  // Converts and validates chart data
  const chartData = React.useMemo(() => {
    try {
      return convertToChartData(readings);
    } catch (error) {
      console.error('Error converting chart data:', error);
      return [];
    }
  }, [readings]);

  return (
    <ScrollView style={styles.container}>
      {/* Connection particles effect- Compent */}
      <ConnectionPulse isActive={isConnected} color={theme.colors.success} />

      <View style={styles.content}>
        {/* Current Heart Rate Display with Glass Morphism-Component */}
        <GlassContainer style={styles.glassContainer}>
          {/* 3D Animated Heart- Component */}
          <View style={styles.heartSection}>
            <Heart3D
              size={80}
              color={stats.current > 0 ? getZoneColor(stats.zone) : theme.colors.outline}
              gradientColors={
                stats.current > 0
                  ? [getZoneColor(stats.zone), theme.colors.primary]
                  : [theme.colors.outline]
              }
              animate={isConnected}
              heartRate={stats.current}
            />
          </View>

          {/* Heart Rate Value with Gradient Text- Component */}
          <Animated.View
            style={[
              styles.rateDisplay,
              {
                transform: [
                  {
                    scale: hrValueAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.1],
                    }),
                  },
                ],
              },
            ]}
          >
            <SimpleGradientText
              colors={
                stats.current > 0
                  ? [getZoneColor(stats.zone), theme.colors.primary]
                  : theme.colors.primaryGradient
              }
              style={styles.currentRate}
            >
              {stats.current}
            </SimpleGradientText>
            <Text style={styles.currentRateUnit}>BPM</Text>
          </Animated.View>

          {/* Enhanced Zone Indicator with Gradient */}
          <View
            style={[
              styles.zoneIndicatorGradient,
              {
                backgroundColor: getZoneColor(stats.zone),
                shadowColor: getZoneColor(stats.zone),
              },
            ]}
          >
            <Text style={styles.zoneText}>{getZoneLabel(stats.zone)}</Text>
          </View>

          {/* Sensor Status Indicator */}
          {isConnected && sensorData.miscData && (
            <>
              <Text style={styles.sensorStatusText}>
                {sensorData.miscData.status === 0 || sensorData.miscData.status === 1
                  ? '🔴 No Contact'
                  : sensorData.miscData.status === 2
                  ? '🟡 Object Detected'
                  : sensorData.miscData.status === 3
                  ? '🟢 Skin Detected'
                  : 'Unknown Status'}
              </Text>
              <Text style={styles.confidenceText}>
                Confidence: {sensorData.miscData.confidence}%
              </Text>
            </>
          )}
        </GlassContainer>

        {/* FIXED: Enhanced Connection Status */}
        <View style={styles.statusContainer}>
          <Icon
            name={isConnected ? 'bluetooth-connected' : 'bluetooth-disabled'}
            size={16}
            color={isConnected ? theme.colors.success : theme.colors.error}
          />
          <Text style={[styles.statusText, { color: isConnected ? theme.colors.success : theme.colors.error }]}>
            {isConnected ? 'Nordic Device Connected' : 'No Nordic Device'}
          </Text>
          
          {/* Data source indicator */}
          <View style={styles.dataSourceContainer}>
            <Icon 
              name={isConnected ? 'sensors' : 'sensors-off'} 
              size={12} 
              color={theme.colors.onSurfaceVariant} 
            />
            <Text style={styles.dataSourceText}>{getDataSourceText()}</Text>
          </View>
        </View>

        {/* Statistics Cards with Neumorphic Design-Components */}
        <View style={styles.statsContainer}>
          <NeumorphicCard style={styles.statCard}>
            <Text style={styles.statLabel}>Average</Text>
            <SimpleGradientText
              colors={theme.colors.secondaryGradient}
              style={styles.statValue}
            >
              {stats.average}
            </SimpleGradientText>
          </NeumorphicCard>
          <NeumorphicCard style={styles.statCard}>
            <Text style={styles.statLabel}>Min</Text>
            <SimpleGradientText
              colors={theme.colors.tertiaryGradient}
              style={styles.statValue}
            >
              {stats.min}
            </SimpleGradientText>
          </NeumorphicCard>
          <NeumorphicCard style={styles.statCard}>
            <Text style={styles.statLabel}>Max</Text>
            <SimpleGradientText
              colors={theme.colors.primaryGradient}
              style={styles.statValue}
            >
              {stats.max}
            </SimpleGradientText>
          </NeumorphicCard>
        </View>

        {/* SpO2 and Battery Display */}
        <View style={styles.vitalPanelsContainer}>
          {/* SpO2 Panel */}
          <NeumorphicCard style={styles.vitalPanel}>
            <View style={styles.vitalHeader}>
              <Icon name="opacity" size={20} color={theme.colors.secondary} />
              <Text style={styles.vitalTitle}>Blood Oxygen</Text>
            </View>
            {isConnected && sensorData.spO2 ? (
              <View style={styles.vitalValueContainer}>
                <SimpleGradientText
                  colors={theme.colors.secondaryGradient}
                  style={styles.vitalValue}
                >
                  {sensorData.spO2.spO2}
                </SimpleGradientText>
                <Text style={styles.vitalUnit}>%</Text>
              </View>
            ) : (
              <View style={styles.vitalNoData}>
                <Icon name="hourglass-empty" size={32} color={theme.colors.outline} />
                <Text style={styles.vitalNoDataText}>
                  {isConnected ? 'Waiting...' : 'No device'}
                </Text>
              </View>
            )}
          </NeumorphicCard>

          {/* Battery Panel */}
          <NeumorphicCard style={styles.vitalPanel}>
            <View style={styles.vitalHeader}>
              <Icon 
                name={
                  sensorData.miscData?.charging 
                    ? 'battery-charging-full' 
                    : sensorData.battery && sensorData.battery.level > 20 
                    ? 'battery-full' 
                    : 'battery-alert'
                } 
                size={20} 
                color={
                  sensorData.miscData?.charging
                    ? theme.colors.primary
                    : sensorData.battery && sensorData.battery.level > 20 
                    ? theme.colors.success 
                    : theme.colors.error
                } 
              />
              <Text style={styles.vitalTitle}>Battery</Text>
            </View>
            {isConnected && sensorData.battery ? (
              <>
                <View style={styles.vitalValueContainer}>
                  <SimpleGradientText
                    colors={
                      sensorData.battery.level > 50
                        ? theme.colors.zoneRestingGradient
                        : sensorData.battery.level > 20
                        ? theme.colors.tertiaryGradient
                        : theme.colors.zonePeakGradient
                    }
                    style={styles.vitalValue}
                  >
                    {sensorData.battery.level}
                  </SimpleGradientText>
                  <Text style={styles.vitalUnit}>%</Text>
                </View>
                <Text style={styles.vitalSubtext}>
                  {sensorData.battery.level > 50 ? 'Good' : sensorData.battery.level > 20 ? 'Low' : 'Critical'}
                  {sensorData.miscData?.charging && ' • Charging'}
                </Text>
              </>
            ) : (
              <View style={styles.vitalNoData}>
                <Icon name="hourglass-empty" size={32} color={theme.colors.outline} />
                <Text style={styles.vitalNoDataText}>
                  {isConnected ? 'Waiting...' : 'No device'}
                </Text>
              </View>
            )}
          </NeumorphicCard>
        </View>

        {/* Chart */}
        {readings.length > 0 ? (
          <HeartRateChart
            data={chartData}
            height={250}
            showArea={true}
            showPoints={false}
            animate={true}
          />
        ) : (
          <View style={styles.emptyState}>
            <Icon name="favorite-border" size={64} color={theme.colors.outline} />
            <Text style={styles.emptyStateTitle}>No Heart Rate Data</Text>
            <Text style={styles.emptyStateText}>
              {isConnected
                ? 'Waiting for heart rate data from your sensor...'
                : 'Connect your Nordic device to see heart rate data'}
            </Text>
          </View>
        )}

        {/* Connect Button */}
        {!isConnected && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('DataManagement')}
            >
              <Icon name="bluetooth" size={20} color={theme.colors.onPrimary} />
              <Text style={styles.primaryButtonText}>
                Connect Nordic Device
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// Generic UI to match App
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100, // Add extra padding for tab bar
  },
  glassContainer: {
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  heartSection: {
    marginBottom: 20,
  },
  rateDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  currentRate: {
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -2,
  },
  currentRateUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginLeft: 8,
  },
  zoneIndicatorGradient: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  zoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.onPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sensorStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dataSourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dataSourceText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  sensorQualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  sensorQualityLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  sensorQualityValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  dataRateText: {
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  vitalPanelsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  vitalPanel: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  vitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  vitalTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vitalValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  vitalValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  vitalUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginLeft: 4,
  },
  vitalSubtext: {
    fontSize: 11,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  vitalNoData: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  vitalNoDataText: {
    fontSize: 11,
    color: theme.colors.onSurfaceVariant,
    marginTop: 6,
  },
  spO2Container: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
  },
  spO2Header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  spO2Title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  spO2Display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  spO2Value: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.secondary,
  },
  spO2Unit: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginLeft: 4,
  },
  spO2Details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  spO2DetailText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
});


export default HeartRateScreen;
