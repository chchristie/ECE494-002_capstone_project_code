// src/components/HeartRateChart.tsx - Pure React Native implementation (no SVG)
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { theme } from '../styles/theme';

export interface HeartRateChartProps {
  data?: any[];
  readings?: any[];
  height?: number;
  showArea?: boolean;
  showPoints?: boolean;
  animate?: boolean;
  showGrid?: boolean;
}

// Simple bar chart using View elements
const SimpleBarChart: React.FC<{
  data: { value: number }[];
  width: number;
  height: number;
}> = ({ data, width, height }) => {
  const chartHeight = height - 50; // Leave space for labels
  const barWidth = Math.max(3, Math.floor((width - 60) / data.length) - 2);

  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  return (
    <View style={[styles.chartContainer, { width, height }]}>
      {/* Y-axis labels */}
      <View style={styles.yAxisLabels}>
        <Text style={styles.axisLabel}>{maxValue}</Text>
        <Text style={styles.axisLabel}>{Math.round((maxValue + minValue) / 2)}</Text>
        <Text style={styles.axisLabel}>{minValue}</Text>
      </View>

      {/* Bars container */}
      <View style={styles.barsWrapper}>
        <View style={[styles.barsContainer, { height: chartHeight }]}>
          {data.map((point, index) => {
            const barHeight = ((point.value - minValue) / valueRange) * chartHeight;
            const color = point.value > (minValue + maxValue) / 2
              ? theme.colors.primary
              : theme.colors.secondary;

            return (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: Math.max(2, barHeight),
                    backgroundColor: color,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          <Text style={styles.axisLabel}>Start</Text>
          <Text style={styles.axisLabel}>Latest</Text>
        </View>
      </View>
    </View>
  );
};

// Main chart component
export const HeartRateChart: React.FC<HeartRateChartProps> = ({
  data,
  readings,
  height = 200,
  showArea = true,
  showPoints = false,
  animate = true,
  showGrid = true,
}) => {
  const screenWidth = Dimensions.get('window').width - 32;

  // Use data prop if available, otherwise fall back to readings
  const chartData = useMemo(() => {
    const sourceData = data || readings || [];
    return sourceData.map((item) => ({
      value: item.y || item.value || item.bpm || 0,
    }));
  }, [data, readings]);

  const { minY, maxY, avgY } = useMemo(() => {
    const yValues = chartData.map(point => point.value);
    return {
      minY: yValues.length > 0 ? Math.min(...yValues) : 0,
      maxY: yValues.length > 0 ? Math.max(...yValues) : 100,
      avgY: yValues.length > 0 ? Math.round(yValues.reduce((sum, val) => sum + val, 0) / yValues.length) : 0,
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.title}>Heart Rate Chart</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No data to display</Text>
          <Text style={styles.emptyStateSubtext}>Start monitoring to see your heart rate trend</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Heart Rate Trend</Text>

      {/* Bar Chart */}
      <View style={styles.chartWrapper}>
        <SimpleBarChart
          data={chartData.slice(-30)} // Show last 30 readings
          width={screenWidth}
          height={height}
        />
      </View>

      {/* Chart info */}
      <View style={styles.chartInfo}>
        <View style={styles.chartInfoRow}>
          <Text style={styles.chartInfoText}>
            {chartData.length} readings
          </Text>
          <Text style={styles.chartInfoText}>
            Range: {minY}-{maxY} BPM
          </Text>
        </View>
        <View style={styles.chartInfoRow}>
          <Text style={styles.chartInfoText}>
            Average: {avgY} BPM
          </Text>
          <Text style={styles.chartInfoText}>
            Latest: {chartData[chartData.length - 1]?.value || 0} BPM
          </Text>
        </View>
      </View>
    </View>
  );
};

// Mini chart for smaller displays
export const MiniHeartRateChart: React.FC<{ readings: any[] }> = ({ readings }) => {
  const miniData = useMemo(() =>
    readings.slice(-10).map((reading) => ({
      value: reading.value || reading.bpm || 0,
    })),
    [readings]
  );

  if (miniData.length === 0) {
    return (
      <View style={styles.miniContainer}>
        <Text style={styles.miniText}>No data</Text>
      </View>
    );
  }

  const values = miniData.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  return (
    <View style={styles.miniContainer}>
      <View style={styles.miniChart}>
        {miniData.map((point, index) => {
          const barHeight = ((point.value - minValue) / valueRange) * 30;
          return (
            <View
              key={index}
              style={[
                styles.miniBar,
                {
                  height: Math.max(2, barHeight),
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.miniText}>{readings.length} readings</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  chartWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  chartContainer: {
    flexDirection: 'row',
    backgroundColor: `${theme.colors.outline}10`,
    borderRadius: 8,
    padding: 10,
  },
  yAxisLabels: {
    width: 35,
    justifyContent: 'space-between',
    paddingRight: 5,
  },
  barsWrapper: {
    flex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    borderRadius: 2,
    minHeight: 2,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 5,
  },
  axisLabel: {
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
  chartInfo: {
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: `${theme.colors.outline}30`,
  },
  chartInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chartInfoText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    opacity: 0.7,
  },
  miniContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 6,
    gap: 8,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 30,
    gap: 2,
  },
  miniBar: {
    width: 4,
    minHeight: 2,
    borderRadius: 1,
  },
  miniText: {
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
});

export default HeartRateChart;
