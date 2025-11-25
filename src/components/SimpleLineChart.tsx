// SimpleLineChart.tsx - Lightweight SVG-based line chart
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText, Rect } from 'react-native-svg';
import { theme } from '../styles/theme';

interface ChartData {
  value: number | null;  // null values create breaks in the line
  timestamp?: Date;
}

interface SimpleLineChartProps {
  data: ChartData[];
  width: number;
  height: number;
  color?: string;
  title?: string;
  yAxisLabel?: string;
  yMin?: number;  // Fixed minimum Y value
  yMax?: number;  // Fixed maximum Y value
  showXAxisTime?: boolean;  // Show time labels on X-axis
  forceIntegerTicks?: boolean;  // Force y-axis ticks to be integers
  yAxisDecimalPlaces?: number;  // Number of decimal places for y-axis labels
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  width,
  height,
  color = theme.colors.primary,
  title,
  yAxisLabel,
  yMin,
  yMax,
  showXAxisTime = false,
  forceIntegerTicks = false,
  yAxisDecimalPlaces,
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

  // Calculate min/max for scaling (filter out null values)
  const values = data.map(d => d.value).filter((v): v is number => v !== null);
  const minValue = yMin !== undefined ? yMin : Math.min(...values);
  const maxValue = yMax !== undefined ? yMax : Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  // Scale functions
  const scaleX = (index: number) => (index / (data.length - 1 || 1)) * chartWidth + padding;
  const scaleY = (value: number) => {
    const normalized = (value - minValue) / valueRange;
    return chartHeight - (normalized * chartHeight) + padding;
  };

  // Split data into continuous segments (breaks at null values) and track connectors
  const segments: Array<{ startIndex: number; points: string; lastPoint: { x: number; y: number }; isIsolated: boolean }> = [];
  const connectors: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const isolatedPoints: Array<{ x: number; y: number; index: number }> = [];
  let currentSegment: Array<{ x: number; y: number; index: number }> = [];
  let segmentStartIndex = 0;
  let lastSegmentEnd: { x: number; y: number; index: number } | null = null;

  data.forEach((d, i) => {
    if (d.value !== null) {
      if (currentSegment.length === 0) {
        segmentStartIndex = i;
        // If there was a previous segment, create a dashed connector
        if (lastSegmentEnd !== null) {
          connectors.push({
            x1: lastSegmentEnd.x,
            y1: lastSegmentEnd.y,
            x2: scaleX(i),
            y2: scaleY(d.value),
          });
        }
      }
      currentSegment.push({ x: scaleX(i), y: scaleY(d.value), index: i });
    } else {
      if (currentSegment.length > 0) {
        // End current segment
        const points = currentSegment.map(p => `${p.x},${p.y}`).join(' ');
        const lastPoint = currentSegment[currentSegment.length - 1];
        const isIsolated = currentSegment.length === 1;
        
        if (isIsolated) {
          // Add to isolated points instead of segments
          isolatedPoints.push(currentSegment[0]);
        } else {
          segments.push({ startIndex: segmentStartIndex, points, lastPoint: { x: lastPoint.x, y: lastPoint.y }, isIsolated: false });
        }
        
        lastSegmentEnd = lastPoint;
        currentSegment = [];
      }
    }
  });

  // Add final segment if exists
  if (currentSegment.length > 0) {
    const points = currentSegment.map(p => `${p.x},${p.y}`).join(' ');
    const lastPoint = currentSegment[currentSegment.length - 1];
    const isIsolated = currentSegment.length === 1;
    
    if (isIsolated) {
      // Add to isolated points instead of segments
      isolatedPoints.push(currentSegment[0]);
    } else {
      segments.push({ startIndex: segmentStartIndex, points, lastPoint: { x: lastPoint.x, y: lastPoint.y }, isIsolated: false });
    }
  }

  // Handle missing data at start/end with horizontal dashed lines
  const edgeLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  
  const hasData = segments.length > 0 || isolatedPoints.length > 0;
  
  if (hasData) {
    // Find first and last valid indices
    const firstValidIndex = data.findIndex(d => d.value !== null);
    const lastValidIndex = data.length - 1 - [...data].reverse().findIndex(d => d.value !== null);
    
    // Missing data at start
    if (firstValidIndex > 0) {
      const y = scaleY(data[firstValidIndex].value!);
      edgeLines.push({
        x1: scaleX(0),
        y1: y,
        x2: scaleX(firstValidIndex),
        y2: y,
      });
    }
    
    // Missing data at end
    if (lastValidIndex < data.length - 1) {
      const y = scaleY(data[lastValidIndex].value!);
      edgeLines.push({
        x1: scaleX(lastValidIndex),
        y1: y,
        x2: scaleX(data.length - 1),
        y2: y,
      });
    }
  }
  
  // Add connectors for isolated points
  isolatedPoints.forEach((point) => {
    // Find previous non-null point
    let prevIndex = -1;
    for (let i = point.index - 1; i >= 0; i--) {
      if (data[i].value !== null) {
        prevIndex = i;
        break;
      }
    }
    
    // Find next non-null point
    let nextIndex = -1;
    for (let i = point.index + 1; i < data.length; i++) {
      if (data[i].value !== null) {
        nextIndex = i;
        break;
      }
    }
    
    // Add connectors if adjacent points exist
    if (prevIndex >= 0) {
      connectors.push({
        x1: scaleX(prevIndex),
        y1: scaleY(data[prevIndex].value!),
        x2: point.x,
        y2: point.y,
      });
    }
    
    if (nextIndex >= 0) {
      connectors.push({
        x1: point.x,
        y1: point.y,
        x2: scaleX(nextIndex),
        y2: scaleY(data[nextIndex].value!),
      });
    }
  });

  // Y-axis ticks
  let yTickValues: number[];
  
  if (forceIntegerTicks) {
    // Calculate nice integer tick interval
    const targetTicks = 5;
    const rawInterval = valueRange / (targetTicks - 1);
    
    // Round to a nice number (1, 2, 5, 10, 20, 50, etc.)
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    const normalized = rawInterval / magnitude;
    let niceInterval: number;
    
    if (normalized <= 1) {
      niceInterval = 1 * magnitude;
    } else if (normalized <= 2) {
      niceInterval = 2 * magnitude;
    } else if (normalized <= 5) {
      niceInterval = 5 * magnitude;
    } else {
      niceInterval = 10 * magnitude;
    }
    
    // Generate ticks starting from a nice round number
    const tickStart = Math.ceil(minValue / niceInterval) * niceInterval;
    yTickValues = [];
    
    for (let tick = tickStart; tick <= maxValue; tick += niceInterval) {
      yTickValues.push(tick);
    }
    
    // Ensure we have at least 2 ticks
    if (yTickValues.length < 2) {
      yTickValues = [Math.ceil(minValue), Math.floor(maxValue)];
    }
  } else {
    // Default: evenly spaced ticks
    const yTicks = 5;
    yTickValues = Array.from({ length: yTicks }, (_, i) => {
      return minValue + (valueRange * i) / (yTicks - 1);
    });
  }

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
            // Format value based on props
            let formattedValue: string;
            if (yAxisDecimalPlaces !== undefined) {
              formattedValue = value.toFixed(yAxisDecimalPlaces);
            } else if (forceIntegerTicks || valueRange >= 10) {
              formattedValue = Math.round(value).toString();
            } else {
              formattedValue = value.toFixed(1);
            }
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

          {/* Dashed lines for missing data at edges */}
          {edgeLines.map((line, i) => (
            <Line
              key={`edge-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={color}
              strokeWidth="2"
              strokeDasharray="4,4"
              opacity={0.5}
            />
          ))}

          {/* Dashed connector lines for gaps */}
          {connectors.map((conn, i) => (
            <Line
              key={`connector-${i}`}
              x1={conn.x1}
              y1={conn.y1}
              x2={conn.x2}
              y2={conn.y2}
              stroke={color}
              strokeWidth="2"
              strokeDasharray="4,4"
              opacity={0.5}
            />
          ))}

          {/* Solid line segments for continuous data */}
          {segments.map((segment, segIndex) => (
            <Polyline
              key={`segment-${segIndex}`}
              points={segment.points}
              fill="none"
              stroke={color}
              strokeWidth="2"
            />
          ))}

          {/* Dots - only for isolated points (single data points surrounded by gaps) */}
          {isolatedPoints.map((point, i) => (
            <Circle
              key={`isolated-${i}`}
              cx={point.x}
              cy={point.y}
              r="5"
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
          Min: {yAxisDecimalPlaces !== undefined ? minValue.toFixed(yAxisDecimalPlaces) : (forceIntegerTicks || valueRange >= 10 ? Math.round(minValue) : minValue.toFixed(2))}
        </Text>
        <Text style={styles.statText}>
          Max: {yAxisDecimalPlaces !== undefined ? maxValue.toFixed(yAxisDecimalPlaces) : (forceIntegerTicks || valueRange >= 10 ? Math.round(maxValue) : maxValue.toFixed(2))}
        </Text>
        <Text style={styles.statText}>
          Avg: {yAxisDecimalPlaces !== undefined ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(yAxisDecimalPlaces) : (forceIntegerTicks || valueRange >= 10 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))}
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
