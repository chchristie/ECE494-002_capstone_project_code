// src/screens/DashboardScreen.tsx - Dashboard home screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useBluetooth } from '../context/BluetoothContext';
import DataManager, { MonitoringSession } from '../services/DataManager';
import type { SimpleNavigationProps } from '../types/simple-navigation';
import { theme } from '../styles/theme';

type DashboardScreenProps = SimpleNavigationProps & {
  route: { name: 'Dashboard'; key: string; params: undefined };
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { state, sensorData, isConnected, activeSessionId } = useBluetooth();
  const [recentSessions, setRecentSessions] = useState<MonitoringSession[]>([]);
  const [todayStats, setTodayStats] = useState({
    avgHR: 0,
    minHR: 0,
    maxHR: 0,
    recordingTime: 0,
    dataPoints: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    loadDashboardData();
  }, []);

  // A pulsing animation for active monitoring indicator
  useEffect(() => {
    if (isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnected]);

  const loadDashboardData = async () => {
    try {
      // Loads recent sessions
      const sessions = await DataManager.getAllSessions();
      setRecentSessions(sessions.slice(0, 5));

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaySessions = sessions.filter(
        (s) => s.startTime.getTime() >= today.getTime()
      );

      if (todaySessions.length > 0) {
        let totalHR = 0;
        let minHR = Infinity;
        let maxHR = 0;
        let totalTime = 0;
        let totalPoints = 0;

        for (const session of todaySessions) {
          const readings = await DataManager.getSessionReadings(session.id);

          readings.forEach(r => {
            if (r.heartRate?.value && r.heartRate.value > 0) {
              const hr = r.heartRate.value;
              totalHR += hr;
              totalPoints++;
              if (hr < minHR) minHR = hr;
              if (hr > maxHR) maxHR = hr;
            }
          });

          if (session.endTime && session.startTime) {
            totalTime += session.endTime.getTime() - session.startTime.getTime();
          }
        }

        setTodayStats({
          avgHR: totalPoints > 0 ? Math.round(totalHR / totalPoints) : 0,
          minHR: minHR === Infinity ? 0 : minHR,
          maxHR,
          recordingTime: Math.round(totalTime / 60000), // Converts to minutes
          dataPoints: totalPoints,
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    if (!endTime) return 'Active';
    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

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
        {/* Active Monitoring Status */}
        {isConnected && (
          <View style={styles.activeCard}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Icon name="favorite" size={32} color={theme.colors.error} />
            </Animated.View>
            <View style={styles.activeInfo}>
              <Text style={styles.activeTitle}>Monitoring Active</Text>
              <Text style={styles.activeSubtitle}>
                {state.connectedDevice?.name || 'Connected Device'}
              </Text>
              {sensorData.heartRate && sensorData.heartRate.heartRate > 0 && (
                <Text style={styles.activeBPM}>
                  {sensorData.heartRate.heartRate} BPM
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigation.navigate('HeartRate')}
            >
              <Text style={styles.viewButtonText}>View</Text>
              <Icon name="chevron-right" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        {!isConnected && (
          <TouchableOpacity
            style={styles.connectCard}
            onPress={() => navigation.navigate('DataManagement')}
          >
            <Icon name="bluetooth" size={40} color={theme.colors.primary} />
            <View style={styles.connectInfo}>
              <Text style={styles.connectTitle}>Connect Device</Text>
              <Text style={styles.connectSubtitle}>
                Go to Settings to connect your sensor
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        {/* Gives Today's Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Activity</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="favorite" size={24} color={theme.colors.primary} />
              <Text style={styles.statValue}>{todayStats.avgHR}</Text>
              <Text style={styles.statLabel}>Avg BPM</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="keyboard-arrow-up" size={24} color={theme.colors.error} />
              <Text style={styles.statValue}>{todayStats.maxHR}</Text>
              <Text style={styles.statLabel}>Max BPM</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="keyboard-arrow-down" size={24} color={theme.colors.tertiary} />
              <Text style={styles.statValue}>{todayStats.minHR}</Text>
              <Text style={styles.statLabel}>Min BPM</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="schedule" size={24} color={theme.colors.secondary} />
              <Text style={styles.statValue}>{todayStats.recordingTime}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
          </View>
        </View>

        {/* The Recent Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Sessions')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="event-note" size={48} color={theme.colors.outline} />
              <Text style={styles.emptyStateTitle}>No Sessions Yet</Text>
              <Text style={styles.emptyStateText}>
                Connect a device to start recording
              </Text>
            </View>
          ) : (
            recentSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => navigation.navigate('Sessions')}
              >
                <View style={styles.sessionIcon}>
                  <Icon
                    name={session.isActive ? 'fiber-manual-record' : 'check-circle'}
                    size={24}
                    color={session.isActive ? theme.colors.error : theme.colors.success}
                  />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionDevice}>
                    {session.deviceName || 'Unknown Device'}
                  </Text>
                  <Text style={styles.sessionTime}>
                    {formatRelativeTime(session.startTime)} • {formatDuration(session.startTime, session.endTime)}
                  </Text>
                </View>
                <View style={styles.sessionStats}>
                  <Text style={styles.sessionDataCount}>
                    {session.dataCount} readings
                  </Text>
                  <Icon name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity
            style={styles.quickLinkButton}
            onPress={() => navigation.navigate('Trends')}
          >
            <Icon name="insights" size={24} color={theme.colors.primary} />
            <Text style={styles.quickLinkText}>View Trends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLinkButton}
            onPress={() => navigation.navigate('DataManagement')}
          >
            <Icon name="file-download" size={24} color={theme.colors.secondary} />
            <Text style={styles.quickLinkText}>Export Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};
// Generic UI to match app
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  activeInfo: {
    flex: 1,
    marginLeft: 16,
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  activeSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  activeBPM: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.error,
    marginTop: 4,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    marginRight: 4,
  },
  connectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  connectInfo: {
    flex: 1,
    marginLeft: 16,
  },
  connectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  connectSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sessionDevice: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  sessionTime: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDataCount: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  quickLinkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
});

export default DashboardScreen;

