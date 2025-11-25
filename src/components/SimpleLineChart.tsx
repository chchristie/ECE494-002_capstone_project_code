// SimpleLineChart.tsx - Lightweight SVG-based line chart
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText, Rect } from 'react-native-svg';
import { theme } from '../styles/theme';

interface ChartData {
  value: number;
  timestamp?: Date;
}

interface SimpleLineChartProps {
  data: ChartData[];
  width: number;
  height: number;
  color?: string;
  showDots?: boolean;
  title?: string;
  yAxisLabel?: string;
  yMin?: number;  // Fixed minimum Y value
  yMax?: number;  // Fixed maximum Y value
  showXAxisTime?: boolean;  // Show time labels on X-axis
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  width,
  height,
  color = theme.colors.primary,
  showDots = false,
  title,
  yAxisLabel,
  yMin,
  yMax,
  showXAxisTime = false,
}) => {
  if (data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Calculate min/max for scaling
  const values = data.map(d => d.value);
  const minValue = yMin !== undefined ? yMin : Math.min(...values);
  const maxValue = yMax !== undefined ? yMax : Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  // Scale functions
  const scaleX = (index: number) => (index / (data.length - 1 || 1)) * chartWidth + padding;
  const scaleY = (value: number) => {
    const normalized = (value - minValue) / valueRange;
    return chartHeight - (normalized * chartHeight) + padding;
  };

  // Generate polyline points
  const points = data
    .map((d, i) => `${scaleX(i)},${scaleY(d.value)}`)
    .join(' ');

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => {
    return minValue + (valueRange * i) / (yTicks - 1);
  });

  // X-axis time ticks (show 5 evenly spaced time labels)
  const xTicks = 5;
  const xTickIndices = Array.from({ length: xTicks }, (_, i) => {
    return Math.floor((data.length - 1) * i / (xTicks - 1));
  });

  // Format time label (show HH:MM:SS)
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={Math.max(width, data.length * 10)} height={height}>
          {/* Background */}
          <Rect x={0} y={0} width={width} height={height} fill={theme.colors.surface} />

          {/* Y-axis grid lines */}
          {yTickValues.map((value, i) => {
            const y = scaleY(value);
            return (
              <Line
                key={`grid-${i}`}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke={theme.colors.outline}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity={0.3}
              />
            );
          })}

          {/* Y-axis labels */}
          {yTickValues.map((value, i) => {
            const y = scaleY(value);
            // Format value: use decimals for small ranges (< 10), integers for larger
            const formattedValue = valueRange < 10 ? value.toFixed(1) : Math.round(value);
            return (
              <SvgText
                key={`y-label-${i}`}
                x={padding - 10}
                y={y + 5}
                fontSize="10"
                fill={theme.colors.onSurfaceVariant}
                textAnchor="end"
              >
                {formattedValue}
              </SvgText>
            );
          })}

          {/* Line chart */}
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />

          {/* Dots */}
          {showDots && data.map((d, i) => (
            <Circle
              key={`dot-${i}`}
              cx={scaleX(i)}
              cy={scaleY(d.value)}
              r="4"
              fill={color}
              stroke={theme.colors.surface}
              strokeWidth="2"
            />
          ))}

          {/* X-axis */}
          <Line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke={theme.colors.outline}
            strokeWidth="2"
          />

          {/* X-axis time labels */}
          {showXAxisTime && xTickIndices.map((index, i) => {
            const x = scaleX(index);
            const timestamp = data[index]?.timestamp;
            if (!timestamp) return null;

            return (
              <SvgText
                key={`x-label-${i}`}
                x={x}
                y={height - padding + 20}
                fontSize="9"
                fill={theme.colors.onSurfaceVariant}
                textAnchor="middle"
                transform={`rotate(-45 ${x} ${height - padding + 20})`}
              >
                {formatTime(timestamp)}
              </SvgText>
            );
          })}

          {/* Y-axis */}
          <Line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke={theme.colors.outline}
            strokeWidth="2"
          />
        </Svg>
      </ScrollView>

      {/* Stats footer */}
      <View style={styles.statsFooter}>
        <Text style={styles.statText}>
          Min: {valueRange < 10 ? minValue.toFixed(2) : Math.round(minValue)}
        </Text>
        <Text style={styles.statText}>
          Max: {valueRange < 10 ? maxValue.toFixed(2) : Math.round(maxValue)}
        </Text>
        <Text style={styles.statText}>
          Avg: {valueRange < 10 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : Math.round(values.reduce((a, b) => a + b, 0) / values.length)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  noDataText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
  },
});
