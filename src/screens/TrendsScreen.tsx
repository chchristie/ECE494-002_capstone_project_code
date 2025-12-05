// TrendsScreen.tsx - CSV-based data visualization (Jupyter-notebook style)
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import type { TrendsScreenProps } from '../types/simple-navigation';
import DataManager from '../services/DataManager';
import { parseCSV, sampleData, type ParsedCSVData, type ParsedSensorReading } from '../utils/csvParser';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { theme } from '../styles/theme';

const { width: screenWidth } = Dimensions.get('window');

// Helper: Convert EnhancedSensorReading[] to CSV string matching NEW csvParser format
// NEW FORMAT (17 columns for session CSV):
// Timestamp_Unix_ms,Timestamp_ISO,Time_Since_Start_Seconds,Time_Since_Start_Minutes,
// HR_BPM,HR_Contact_Detected,HR_Signal_Quality,HR_RR_Interval_ms,
// SpO2_Percent,SpO2_Pulse_Rate_BPM,SpO2_Signal_Quality,
// Battery_Percent,Accel_X_g,Accel_Y_g,Accel_Z_g,Accel_Magnitude_g,Device_ID
function convertReadingsToCSV(readings: any[]): string {
  if (readings.length === 0) return '';

  // CSV header matching NEW csvParser.ts format (17 columns)
  let csv = 'Timestamp_Unix_ms,Timestamp_ISO,Time_Since_Start_Seconds,Time_Since_Start_Minutes,';
  csv += 'HR_BPM,HR_Contact_Detected,HR_Signal_Quality,HR_RR_Interval_ms,';
  csv += 'SpO2_Percent,SpO2_Pulse_Rate_BPM,SpO2_Signal_Quality,';
  csv += 'Battery_Percent,';
  csv += 'Accel_X_g,Accel_Y_g,Accel_Z_g,Accel_Magnitude_g,';
  csv += 'Device_ID\n';

  // Convert each reading to CSV row
  for (const reading of readings) {
    const timestampMs = reading.timestamp.getTime();
    const row = [
      timestampMs,
      reading.timestamp.toISOString(),
      0,  // Time since start (seconds) - would need session start time
      0,  // Time since start (minutes)
      reading.heartRate?.value ?? '',
      reading.heartRate?.contactDetected ? 'YES' : (reading.heartRate ? 'NO' : ''),
      reading.heartRate?.signalQuality ?? '',
      reading.heartRate?.rrIntervals?.[0] ?? '',
      reading.spO2?.value ?? '',
      reading.spO2?.pulseRate ?? '',
      reading.spO2?.signalQuality ?? '',
      reading.battery?.level ?? '',
      reading.accelerometer?.x?.toFixed(0) ?? '',
      reading.accelerometer?.y?.toFixed(0) ?? '',
      reading.accelerometer?.z?.toFixed(0) ?? '',
      reading.accelerometer?.magnitude?.toFixed(0) ?? '',
      reading.deviceId || '',
    ];
    csv += row.join(',') + '\n';
  }

  return csv;
}

type TimeRange = '5m' | '1h' | '6h' | '24h' | '7d' | 'all';

const TIME_RANGES: { label: string; value: TimeRange; hours: number }[] = [
  { label: 'All', value: 'all', hours: Infinity },
  { label: '5M', value: '5m', hours: 5 / 60 },  // 5 minutes
  { label: '1H', value: '1h', hours: 1 },
  { label: '6H', value: '6h', hours: 6 },
  { label: '24H', value: '24h', hours: 24 },
  { label: '7D', value: '7d', hours: 168 },
];

const TrendsScreen: React.FC<TrendsScreenProps> = ({ navigation }) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [csvData, setCsvData] = useState<ParsedCSVData | null>(null);
  const [accelData, setAccelData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSessionPicker, setShowSessionPicker] = useState(false);

  // Load all sessions
  const loadSessions = useCallback(async () => {
    try {
      const allSessions = await DataManager.getAllSessions();
      setSessions(allSessions);

      // Auto-select most recent session
      if (allSessions.length > 0 && !selectedSessionId) {
        setSelectedSessionId(allSessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, [selectedSessionId]);

  // Load session data
  const loadData = useCallback(async (sessionId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const targetSessionId = sessionId || selectedSessionId;

      if (!targetSessionId) {
        // No session selected - load all recent data
        const readings = await DataManager.getRecentReadings(168);

        if (!readings || readings.length === 0) {
          setCsvData(null);
          setAccelData([]);
          return;
        }

        const csvString = convertReadingsToCSV(readings);
        const parsed = parseCSV(csvString);
        setCsvData(parsed);
        console.log(`✅ Loaded ${parsed.readings.length} readings (all sessions)`);
        
        // For "all sessions" mode, we don't load accelerometer data to keep it simple
        setAccelData([]);
      } else {
        // Load specific session - get vitals and accelerometer data
        const readings = await DataManager.getSessionReadings(targetSessionId);

        if (!readings || readings.length === 0) {
          setCsvData(null);
          setAccelData([]);
          return;
        }

        const csvString = convertReadingsToCSV(readings);
        const parsed = parseCSV(csvString);
        setCsvData(parsed);
        console.log(`✅ Loaded ${parsed.readings.length} vitals readings from session`);

        // Load downsampled accelerometer data (first sample from every 10th secondCounter = ~20 second intervals)
        const accelReadings = await DataManager.getAccelerometerReadingsDownsampled(targetSessionId, 10);
        setAccelData(accelReadings);
        console.log(`✅ Loaded ${accelReadings.length} accelerometer readings (every 10th secondCounter)`);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Try refreshing.');
      setCsvData(null);
      setAccelData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSessionId]);

  // Initial load
  useEffect(() => {
    loadSessions();
  }, []);

  // Load data when session changes
  useEffect(() => {
    if (selectedSessionId) {
      loadData(selectedSessionId);
    }
  }, [selectedSessionId]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSessions();
    await loadData();
    setIsRefreshing(false);
  }, [loadData, loadSessions]);

  // Filter data by time range
  const filteredData = useMemo(() => {
    if (!csvData || csvData.readings.length === 0) return null;

    const currentRange = TIME_RANGES.find(r => r.value === selectedRange);
    if (!currentRange || currentRange.value === 'all') {
      return csvData.readings;
    }

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - currentRange.hours);

    return csvData.readings.filter(r => r.timestamp >= cutoffTime);
  }, [csvData, selectedRange]);

  // Filter accelerometer data by time range
  const filteredAccelData = useMemo(() => {
    if (!accelData || accelData.length === 0) return [];

    const currentRange = TIME_RANGES.find(r => r.value === selectedRange);
    if (!currentRange || currentRange.value === 'all') {
      return accelData;
    }

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - currentRange.hours);

    return accelData.filter(r => r.timestamp >= cutoffTime);
  }, [accelData, selectedRange]);

  // Prepare chart data (sampled for performance)
  const chartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null;

    const sampled = sampleData(filteredData, 100); // Max 100 points for smooth rendering

    // Heart Rate data - NEW FORMAT uses nested objects
    // Map zero or missing values to null to create gaps in the plot
    const hrData = sampled.map(r => ({
      value: (r.heartRate !== undefined && r.heartRate.bpm > 0) ? r.heartRate.bpm : null,
      timestamp: r.timestamp
    }));

    // SpO2 data - NEW FORMAT uses nested objects
    // Map zero or missing values to null to create gaps in the plot
    const spO2Data = sampled.map(r => ({
      value: (r.spO2 !== undefined && r.spO2.percent > 0) ? r.spO2.percent : null,
      timestamp: r.timestamp
    }));

    // Accelerometer magnitude data - from separate accelerometer table (already downsampled)
    const accelChartData = filteredAccelData.map(r => ({
      value: r.magnitude,
      timestamp: r.timestamp
    }));

    return { hrData, spO2Data, accelData: accelChartData };
  }, [filteredData, filteredAccelData]);

  // Calculate statistics for filtered data
  const stats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null;

    // Filter out zero values for HR and SpO2 (0 is not a valid physiological reading)
    const hrValues = filteredData.filter(r => r.heartRate !== undefined && r.heartRate.bpm > 0).map(r => r.heartRate!.bpm);
    const spO2Values = filteredData.filter(r => r.spO2 !== undefined && r.spO2.percent > 0).map(r => r.spO2!.percent);
    
    // Use accelerometer data from separate table
    const accelValues = filteredAccelData.map(r => r.magnitude);

    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;
    const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;

    return {
      totalReadings: filteredData.length,
      heartRate: {
        avg: avg(hrValues),
        max: max(hrValues),
        min: min(hrValues),
        count: hrValues.length,
      },
      spO2: {
        avg: avg(spO2Values),
        max: max(spO2Values),
        min: min(spO2Values),
        count: spO2Values.length,
      },
      accel: {
        avg: avg(accelValues),
        max: max(accelValues),
        count: accelValues.length,
      },
    };
  }, [filteredData, filteredAccelData]);

  // Render session selector
  const renderSessionSelector = () => {
    if (sessions.length === 0) return null;

    const selectedSession = sessions.find(s => s.id === selectedSessionId);

    return (
      <View style={styles.sessionSelector}>
        <Text style={styles.sessionLabel}>Session:</Text>
        <TouchableOpacity
          style={styles.sessionPickerButton}
          onPress={() => setShowSessionPicker(!showSessionPicker)}
        >
          <Text style={styles.sessionPickerText}>
            {selectedSession?.deviceName || 'All Data'} - {selectedSession?.startTime?.toLocaleDateString()}
          </Text>
          <MaterialIcon name="arrow-drop-down" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        {showSessionPicker && (
          <View style={styles.sessionPickerDropdown}>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionOption}
                onPress={() => {
                  setSelectedSessionId(session.id);
                  setShowSessionPicker(false);
                }}
              >
                <Text style={styles.sessionOptionText}>
                  {session.deviceName || 'Unknown'} - {session.startTime.toLocaleDateString()} - {session.dataCount} readings
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Render time range selector
  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {TIME_RANGES.map((range) => (
        <TouchableOpacity
          key={range.value}
          style={[
            styles.timeRangeButton,
            selectedRange === range.value && styles.timeRangeButtonActive,
          ]}
          onPress={() => setSelectedRange(range.value)}
        >
          <Text
            style={[
              styles.timeRangeText,
              selectedRange === range.value && styles.timeRangeTextActive,
            ]}
          >
            {range.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render stats overview
  const renderStatsOverview = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <MaterialIcon name="storage" size={20} color={theme.colors.primary} />
          <Text style={styles.statValue}>{stats.totalReadings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Readings</Text>
        </View>

        <View style={styles.statCard}>
          <MaterialIcon name="favorite" size={20} color="#e74c3c" />
          <Text style={styles.statValue}>{stats.heartRate.avg}</Text>
          <Text style={styles.statLabel}>Avg HR (BPM)</Text>
        </View>

        <View style={styles.statCard}>
          <MaterialIcon name="opacity" size={20} color="#3498db" />
          <Text style={styles.statValue}>{stats.spO2.avg}%</Text>
          <Text style={styles.statLabel}>Avg SpO2</Text>
        </View>

        <View style={styles.statCard}>
          <MaterialIcon name="vibration" size={20} color="#2ecc71" />
          <Text style={styles.statValue}>{stats.accel.avg.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Avg Accel (milli-g)</Text>
        </View>
      </View>
    );
  };

  // Render charts
  const renderCharts = () => {
    if (!chartData) return null;

    // Calculate y-axis ranges with ±2 padding for HR and SpO2 (filter out null values)
    const hrValues = chartData.hrData.map(d => d.value).filter((v): v is number => v !== null);
    const hrMin = hrValues.length > 0 ? Math.max(0, Math.min(...hrValues) - 2) : 0;
    const hrMax = hrValues.length > 0 ? Math.max(...hrValues) + 2 : 100;

    const spO2Values = chartData.spO2Data.map(d => d.value).filter((v): v is number => v !== null);
    const spO2Min = spO2Values.length > 0 ? Math.max(0, Math.min(...spO2Values) - 2) : 0;
    const spO2Max = spO2Values.length > 0 ? Math.min(100, Math.max(...spO2Values) + 2) : 100;

    // Calculate y-axis range for accelerometer with proportional buffer
    // Buffer is 25% of data range on each side, so data takes up ~67% of plot
    const accelValues = chartData.accelData.map(d => d.value).filter((v): v is number => v !== null);
    const accelDataMin = accelValues.length > 0 ? Math.min(...accelValues) : 0;
    const accelDataMax = accelValues.length > 0 ? Math.max(...accelValues) : 2;
    const accelRange = accelDataMax - accelDataMin || 0.5; // Minimum range of 0.5 if data is flat
    const accelBuffer = accelRange * 0.25;
    const accelMin = Math.max(0, accelDataMin - accelBuffer);
    const accelMax = accelDataMax + accelBuffer;

    return (
      <View style={styles.chartsContainer}>
        {/* Heart Rate Chart */}
        {hrValues.length > 0 && (
          <SimpleLineChart
            data={chartData.hrData}
            width={screenWidth - 32}
            height={250}
            color="#e74c3c"
            title="💓 Heart Rate (BPM)"
            showXAxisTime={true}
            yMin={hrMin}
            yMax={hrMax}
            forceIntegerTicks={true}
          />
        )}

        {/* SpO2 Chart */}
        {spO2Values.length > 0 && (
          <SimpleLineChart
            data={chartData.spO2Data}
            width={screenWidth - 32}
            height={250}
            color="#3498db"
            title="🫁 Blood Oxygen (SpO2 %)"
            showXAxisTime={true}
            yMin={spO2Min}
            yMax={spO2Max}
            forceIntegerTicks={true}
          />
        )}

        {/* Accelerometer Chart - Dynamic Y-axis range based on data */}
        {chartData.accelData.length > 0 && (
          <SimpleLineChart
            data={chartData.accelData}
            width={screenWidth - 32}
            height={250}
            color="#2ecc71"
            title="📈 Accelerometer Magnitude (milli-g)"
            yMin={accelMin}
            yMax={accelMax}
            showXAxisTime={true}
            yAxisDecimalPlaces={0}
          />
        )}
      </View>
    );
  };

  // Render session info
  const renderSessionInfo = () => {
    if (!csvData) return null;

    const { sessionStats } = csvData;

    return (
      <View style={styles.sessionInfo}>
        <Text style={styles.sectionTitle}>Session Information</Text>
        <View style={styles.infoRow}>
          <MaterialIcon name="event" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.infoText}>
            {sessionStats.startTime.toLocaleString()} - {sessionStats.endTime.toLocaleString()}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcon name="timer" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.infoText}>
            Duration: {Math.floor(sessionStats.duration / 3600)}h {Math.floor((sessionStats.duration % 3600) / 60)}m
          </Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcon name="speed" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.infoText}>
            Data Rate: {(sessionStats.totalReadings / sessionStats.duration).toFixed(2)} readings/sec
          </Text>
        </View>
      </View>
    );
  };

  // Main render
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialIcon name="analytics" size={28} color={theme.colors.primary} />
          <Text style={styles.headerTitle}>Data Analytics</Text>
        </View>

        {renderSessionSelector()}
        {renderTimeRangeSelector()}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialIcon name="error-outline" size={48} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !csvData || csvData.readings.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcon name="insert-chart" size={64} color={theme.colors.onSurfaceVariant} />
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              Start collecting sensor data to see analytics and visualizations
            </Text>
          </View>
        ) : (
          <>
            {renderStatsOverview()}
            {renderCharts()}
            {renderSessionInfo()}
          </>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
  },
  timeRangeTextActive: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (screenWidth - 44) / 2,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  chartsContainer: {
    marginBottom: 24,
  },
  chartSection: {
    marginBottom: 24,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  chartStat: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
  },
  sessionInfo: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.onPrimary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  sessionSelector: {
    marginBottom: 16,
  },
  sessionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  sessionPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  sessionPickerText: {
    fontSize: 14,
    color: theme.colors.onSurface,
    flex: 1,
  },
  sessionPickerDropdown: {
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    maxHeight: 300,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sessionOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  sessionOptionText: {
    fontSize: 14,
    color: theme.colors.onSurface,
  },
});

export default React.memo(TrendsScreen);
