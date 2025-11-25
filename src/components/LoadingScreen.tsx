import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { theme } from '../styles/theme';

// Type definitions
interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  showProgress?: boolean;
  progress?: number; // 0-100
  type?: 'default' | 'bluetooth' | 'data' | 'network';
  onTimeout?: () => void;
  timeout?: number; // milliseconds
}

// Type guard for progress validation
const isValidProgress = (progress: number): boolean => {
  return progress >= 0 && progress <= 100 && !isNaN(progress);
};

// Icon mapping for different loading types
const getLoadingIcon = (type: LoadingScreenProps['type']): string => {
  const iconMap = {
    default: 'hourglass-empty',
    bluetooth: 'bluetooth-searching',
    data: 'sync',
    network: 'cloud-sync',
  };
  return iconMap[type || 'default'];
};

// Get loading message based on type
const getDefaultMessage = (type: LoadingScreenProps['type']): string => {
  const messageMap = {
    default: 'Loading...',
    bluetooth: 'Connecting to device...',
    data: 'Processing data...',
    network: 'Syncing...',
  };
  return messageMap[type || 'default'];
};

// Memoized progress bar component
const ProgressBar = React.memo<{
  progress: number;
  showProgress: boolean;
}>(({ progress, showProgress }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showProgress && isValidProgress(progress)) {
      Animated.timing(progressAnim, {
        toValue: progress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, showProgress, progressAnim]);

  if (!showProgress) return null;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBackground}>
        <Animated.View
          style={[
            styles.progressForeground,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {Math.round(progress)}%
      </Text>
    </View>
  );
});

ProgressBar.displayName = 'ProgressBar';

// Animated icon component
const AnimatedIcon = React.memo<{
  name: string;
  size: number;
  color: string;
}>(({ name, size, color }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    rotateAnimation.start();
    pulseAnimation.start();

    return () => {
      rotateAnimation.stop();
      pulseAnimation.stop();
    };
  }, [rotateAnim, scaleAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        transform: [{ rotate }, { scale: scaleAnim }],
      }}
    >
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  );
});

AnimatedIcon.displayName = 'AnimatedIcon';

/**
 * Loading screen component with animations and progress tracking
 * Implements user preferences for controlled components and performance optimization
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message,
  submessage,
  showProgress = false,
  progress = 0,
  type = 'default',
  onTimeout,
  timeout = 30000, // 30 second default timeout
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validate props with type guards
  const validatedProgress = isValidProgress(progress) ? progress : 0;
  const displayMessage = message || getDefaultMessage(type);
  const iconName = getLoadingIcon(type);

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Setup timeout if provided
    if (onTimeout && timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        console.warn(`LoadingScreen timeout after ${timeout}ms`);
        onTimeout();
      }, timeout);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fadeAnim, onTimeout, timeout]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <AnimatedIcon
            name={iconName}
            size={48}
            color={theme.colors.primary}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={styles.spinner}
        />

        <Text style={styles.message}>{displayMessage}</Text>

        {submessage && (
          <Text style={styles.submessage}>{submessage}</Text>
        )}

        <ProgressBar
          progress={validatedProgress}
          showProgress={showProgress}
        />
      </View>

      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Type: {type} | Progress: {validatedProgress}%
          </Text>
          <Text style={styles.debugText}>
            Timeout: {timeout}ms
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: screenWidth * 0.8,
  },
  iconContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 50,
    backgroundColor: `${theme.colors.primaryContainer}40`,
  },
  spinner: {
    marginBottom: 24,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  submessage: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  progressBackground: {
    width: '100%',
    height: 4,
    backgroundColor: `${theme.colors.outline}30`,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressForeground: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '500',
  },
  debugInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 12,
    backgroundColor: `${theme.colors.outline}20`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  debugText: {
    fontSize: 11,
    color: theme.colors.onSurfaceVariant,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});

export default React.memo(LoadingScreen);