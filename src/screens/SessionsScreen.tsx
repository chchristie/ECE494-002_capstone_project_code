// src/screens/SessionsScreen.tsx - View and manage past monitoring sessions
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DataManager, { MonitoringSession } from '../services/DataManager';
import type { SimpleNavigationProps } from '../types/simple-navigation';
import { theme } from '../styles/theme';

type SessionsScreenProps = SimpleNavigationProps & {
  route: { name: 'Sessions'; key: string; params: undefined };
};

const SessionsScreen: React.FC<SessionsScreenProps> = ({ navigation }) => {
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedSessionData, setSelectedSessionData] = useState<any[]>([]);
  const [selectedSessionInfo, setSelectedSessionInfo] = useState<MonitoringSession | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const RECORDS_PER_PAGE = 100;

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const allSessions = await DataManager.getAllSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      Alert.alert('Error', 'Failed to load monitoring sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSession = async (session: MonitoringSession) => {
    setLoadingData(true);
    setViewModalVisible(true);
    setSelectedSessionInfo(session);
    setCurrentOffset(0);
    setHasMoreData(true);
    
    try {
      const readings = await DataManager.getSessionReadings(session.id);
      // Load only first 100 records
      const initialData = readings.slice(0, RECORDS_PER_PAGE);
      setSelectedSessionData(initialData);
      setHasMoreData(readings.length > RECORDS_PER_PAGE);
      setCurrentOffset(RECORDS_PER_PAGE);
    } catch (error) {
      console.error('Failed to load session data:', error);
      Alert.alert('Error', 'Failed to load session data');
      setSelectedSessionData([]);
      setHasMoreData(false);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLoadMore = async () => {
    if (!selectedSessionInfo || loadingMore || !hasMoreData) return;
    
    setLoadingMore(true);
    try {
      const readings = await DataManager.getSessionReadings(selectedSessionInfo.id);
      const nextBatch = readings.slice(currentOffset, currentOffset + RECORDS_PER_PAGE);
      
      if (nextBatch.length > 0) {
        setSelectedSessionData(prev => [...prev, ...nextBatch]);
        setCurrentOffset(prev => prev + RECORDS_PER_PAGE);
        setHasMoreData(readings.length > currentOffset + RECORDS_PER_PAGE);
      } else {
        setHasMoreData(false);
      }
    } catch (error) {
      console.error('Failed to load more data:', error);
      Alert.alert('Error', 'Failed to load more data');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExportSession = async (sessionId: string) => {
    Alert.alert(
      'Export Format',
      'Choose export format:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CSV (Excel/Research)',
          onPress: async () => {
            try {
              const csvData = await DataManager.exportSessionCSV(sessionId);
              await Share.share({
                message: csvData,
                title: 'Session Data Export (CSV)',
              });
            } catch (error) {
              console.error('CSV export failed:', error);
              Alert.alert('Export Failed', 'Could not export CSV data');
            }
          },
        },
        {
          text: 'JSON (Developer)',
          onPress: async () => {
            try {
              const jsonData = await DataManager.exportSessionData(sessionId);
              await Share.share({
                message: jsonData,
                title: 'Session Data Export (JSON)',
              });
            } catch (error) {
              console.error('JSON export failed:', error);
              Alert.alert('Export Failed', 'Could not export JSON data');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DataManager.deleteSession(sessionId);
              // Refresh the sessions list
              loadSessions();
              Alert.alert('Success', 'Session deleted successfully');
            } catch (error) {
              console.error('Failed to delete session:', error);
              Alert.alert('Error', 'Failed to delete session. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    if (!endTime) return 'In Progress';

    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  const renderSessionItem = ({ item }: { item: MonitoringSession }) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionDevice}>
            {item.deviceName || 'Unknown Device'}
          </Text>
          <Text style={styles.sessionDate}>{formatDate(item.startTime)}</Text>
        </View>
        {item.isActive && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        )}
      </View>

      <View style={styles.sessionStats}>
        <View style={styles.statItem}>
          <Icon name="schedule" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.statText}>
            {formatDuration(item.startTime, item.endTime)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="show-chart" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.statText}>{item.dataCount} readings</Text>
        </View>
      </View>

      {item.notes && (
        <Text style={styles.sessionNotes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}

      <View style={styles.sessionActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleViewSession(item)}
        >
          <Icon name="visibility" size={20} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleExportSession(item.id)}
        >
          <Icon name="file-download" size={20} color={theme.colors.primary} />
          <Text style={styles.actionButtonText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteSession(item.id)}
        >
          <Icon name="delete-outline" size={20} color={theme.colors.error} />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  const formatTimestamp = (timestamp: Date): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Monitoring Sessions</Text>
        <TouchableOpacity onPress={loadSessions}>
          <Icon name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSessionItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="event-note" size={64} color={theme.colors.outline} />
            <Text style={styles.emptyStateTitle}>No Sessions Yet</Text>
            <Text style={styles.emptyStateText}>
              Connect to a device to start recording monitoring sessions
            </Text>
          </View>
        }
      />

      {/* View Data Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Session Data</Text>
              {selectedSessionInfo && (
                <Text style={styles.modalSubtitle}>
                  {selectedSessionInfo.deviceName} • {formatDate(selectedSessionInfo.startTime)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setViewModalVisible(false)}>
              <Icon name="close" size={28} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading data...</Text>
            </View>
          ) : (
            <ScrollView horizontal style={styles.tableScrollHorizontal}>
              <ScrollView style={styles.tableScrollVertical}>
                <View style={styles.table}>
                  {/* Table Header */}
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableHeader, styles.timeColumn]}>Time</Text>
                    <Text style={[styles.tableHeader, styles.dataColumn]}>HR (bpm)</Text>
                    <Text style={[styles.tableHeader, styles.dataColumn]}>SpO2 (%)</Text>
                    <Text style={[styles.tableHeader, styles.dataColumn]}>Battery (%)</Text>
                    <Text style={[styles.tableHeader, styles.dataColumn]}>Accel X (g)</Text>
                    <Text style={[styles.tableHeader, styles.dataColumn]}>Accel Y (g)</Text>
                    <Text style={[styles.tableHeader, styles.dataColumn]}>Accel Z (g)</Text>
                  </View>

                  {/* Table Rows */}
                  {selectedSessionData.length === 0 ? (
                    <View style={styles.emptyTableState}>
                      <Text style={styles.emptyTableText}>No data available</Text>
                    </View>
                  ) : (
                    selectedSessionData.map((reading, index) => {
                      // Extract numeric values from objects if needed
                      const heartRate = typeof reading.heartRate === 'object' 
                        ? reading.heartRate?.value 
                        : reading.heartRate;
                      const spO2 = typeof reading.spO2 === 'object'
                        ? reading.spO2?.value
                        : reading.spO2;
                      const batteryLevel = typeof reading.battery === 'object'
                        ? reading.battery?.level
                        : reading.batteryLevel;
                      
                      // Accelerometer is nested object
                      const accelX = reading.accelerometer?.x;
                      const accelY = reading.accelerometer?.y;
                      const accelZ = reading.accelerometer?.z;
                      
                      return (
                        <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                          <Text style={[styles.tableCell, styles.timeColumn]}>
                            {formatTimestamp(reading.timestamp)}
                          </Text>
                          <Text style={[styles.tableCell, styles.dataColumn]}>
                            {heartRate ?? '-'}
                          </Text>
                          <Text style={[styles.tableCell, styles.dataColumn]}>
                            {spO2 ?? '-'}
                          </Text>
                          <Text style={[styles.tableCell, styles.dataColumn]}>
                            {batteryLevel ?? '-'}
                          </Text>
                          <Text style={[styles.tableCell, styles.dataColumn]}>
                            {accelX !== null && accelX !== undefined ? accelX.toFixed(3) : '-'}
                          </Text>
                          <Text style={[styles.tableCell, styles.dataColumn]}>
                            {accelY !== null && accelY !== undefined ? accelY.toFixed(3) : '-'}
                          </Text>
                          <Text style={[styles.tableCell, styles.dataColumn]}>
                            {accelZ !== null && accelZ !== undefined ? accelZ.toFixed(3) : '-'}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </ScrollView>
          )}

          <View style={styles.modalFooter}>
            <View style={styles.footerInfo}>
              <Text style={styles.recordCount}>
                Showing {selectedSessionData.length} {selectedSessionData.length === 1 ? 'record' : 'records'}
                {selectedSessionInfo && ` of ${selectedSessionInfo.dataCount}`}
              </Text>
            </View>
            {hasMoreData && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Icon name="expand-more" size={20} color={theme.colors.primary} />
                    <Text style={styles.loadMoreText}>Load More ({RECORDS_PER_PAGE})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  listContainer: {
    padding: 16,
  },
  sessionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDevice: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  sessionNotes: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 20,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  deleteButton: {
    backgroundColor: theme.colors.errorContainer,
  },
  deleteButtonText: {
    color: theme.colors.error,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
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
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableScrollHorizontal: {
    flex: 1,
  },
  tableScrollVertical: {
    flex: 1,
  },
  table: {
    padding: 16,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingVertical: 12,
  },
  tableRowEven: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  tableHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.onSurface,
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 14,
    color: theme.colors.onSurface,
  },
  timeColumn: {
    width: 100,
    paddingRight: 12,
  },
  dataColumn: {
    width: 90,
    paddingRight: 12,
    textAlign: 'right',
  },
  emptyTableState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTableText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  modalFooter: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
    alignItems: 'center',
    gap: 12,
  },
  footerInfo: {
    alignItems: 'center',
  },
  recordCount: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '600',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primaryContainer,
    borderRadius: 8,
    gap: 8,
    minHeight: 44,
    minWidth: 200,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});

export default SessionsScreen;
