// src/components/NeumorphicCard.tsx - Neumorphic design card- may not be utilized currently made for earliy itterations to test out ui features
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../styles/theme';

interface NeumorphicCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  pressed?: boolean;
}

export const NeumorphicCard: React.FC<NeumorphicCardProps> = ({
  children,
  style,
  pressed = false,
}) => {
  return (
    <View style={[styles.container, pressed && styles.pressed, style]}>
      <View style={[styles.shadowLight, pressed && styles.shadowLightPressed]} />
      <View style={[styles.shadowDark, pressed && styles.shadowDarkPressed]} />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: theme.colors.neumorphLight,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
  },
  shadowLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.xl,
    ...theme.neumorphism.light,
  },
  shadowDark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.xl,
    ...theme.neumorphism.dark,
  },
  pressed: {
    backgroundColor: theme.colors.neumorphDark,
  },
  shadowLightPressed: {
    shadowOffset: { width: -2, height: -2 },
    shadowRadius: 4,
  },
  shadowDarkPressed: {
    shadowOffset: { width: 2, height: 2 },
    shadowRadius: 4,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
