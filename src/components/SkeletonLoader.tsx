// src/components/SkeletonLoader.tsx - Animated skeleton loading states
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { theme } from '../styles/theme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = theme.borderRadius.md,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Preset skeleton components
export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <View>
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonLoader
        key={index}
        height={16}
        width={index === lines - 1 ? '60%' : '100%'}
        style={{ marginBottom: theme.spacing.sm }}
      />
    ))}
  </View>
);

export const SkeletonCard: React.FC = () => (
  <View style={styles.card}>
    <SkeletonLoader height={120} style={{ marginBottom: theme.spacing.md }} />
    <SkeletonLoader height={24} width="70%" style={{ marginBottom: theme.spacing.sm }} />
    <SkeletonLoader height={16} width="50%" />
  </View>
);

export const SkeletonCircle: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <SkeletonLoader width={size} height={size} borderRadius={size / 2} />
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
});
