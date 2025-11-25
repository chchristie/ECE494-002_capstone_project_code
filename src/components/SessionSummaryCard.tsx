// SessionSummaryCard.tsx - Lightweight session info (NO data loading)
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../styles/theme';

interface SessionSummaryProps {
  sessionId: string;
  deviceName?: string;
  startTime: Date;
  endTime?: Date;
  readingCount: number;
  duration: number; // seconds
  isActive: boolean;
}

export const SessionSummaryCard: React.FC<SessionSummaryProps> = ({
  deviceName,
  startTime,
  endTime,
  readingCount,
  duration,
  isActive,
}) => {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon
            name={isActive ? 'radio-button-checked' : 'check-circle'}
            size={20}
            color={isActive ? theme.colors.success : theme.colors.onSurfaceVariant}
          />
          <Text style={styles.deviceName}>{deviceName || 'Unknown Device'}</Text>
        </View>
        {isActive && (
          <View style={styles.activeBadge}>
            <ActivityIndicator size="small" color={theme.colors.success} />
            <Text style={styles.activeText}>ACTIVE</Text>
          </View>
        )}
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Reading Count */}
        <View style={styles.statItem}>
          <Icon name="storage" size={16} color={theme.colors.primary} />
          <Text style={styles.statValue}>{readingCount.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Readings</Text>
        </View>

        {/* Duration */}
        <View style={styles.statItem}>
          <Icon name="timer" size={16} color={theme.colors.secondary} />
          <Text style={styles.statValue}>{formatDuration(duration)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>

        {/* Data Rate */}
        <View style={styles.statItem}>
          <Icon name="speed" size={16} color={theme.colors.tertiary} />
          <Text style={styles.statValue}>
            {duration > 0 ? (readingCount / duration).toFixed(1) : '0'}
          </Text>
          <Text style={styles.statLabel}>per sec</Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        <View style={styles.timelineItem}>
          <Icon name="play-arrow" size={14} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.timelineText}>{formatTimestamp(startTime)}</Text>
        </View>
        {endTime && (
          <>
            <Icon name="arrow-forward" size={12} color={theme.colors.outline} />
            <View style={styles.timelineItem}>
              <Icon name="stop" size={14} color={theme.colors.onSurfaceVariant} />
              <Text style={styles.timelineText}>{formatTimestamp(endTime)}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    flex: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.successContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.success,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timelineText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
});
