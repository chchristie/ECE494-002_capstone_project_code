// src/components/GlassContainer.tsx - Glassmorphism effect container (no external deps)
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../styles/theme';

interface GlassContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({
  children,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Multi-layer glass effect */}
      <View style={styles.glassLayer1} />
      <View style={styles.glassHighlight} />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
    position: 'relative',
    // Enhanced shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  glassLayer1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: theme.borderRadius.xl,
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.glassHighlight,
  },
  content: {
    padding: theme.spacing.md,
  },
});
