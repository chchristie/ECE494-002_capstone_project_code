// src/components/GradientText.tsx - Text component with gradient color support for better ui- may not be utilized currently
import React from 'react';
import { Text, StyleSheet, TextStyle, View } from 'react-native';
import { theme } from '../styles/theme';

interface GradientTextProps {
  children: React.ReactNode;
  colors?: string[];
  style?: TextStyle;
  angle?: number;
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  colors = theme.colors.primaryGradient,
  style,
  angle = 90,
}) => {
  // Since React Native doesn't support text gradients natively,
  // it is done by layering multiple text elements with different colors
  // This creates a pseudo-gradient effect

  const renderGradientLayers = () => {
    const layers = colors.length;

    return colors.map((color, index) => {
      const opacity = 1 - (index / layers) * 0.3;

      return (
        <Text
          key={index}
          style={[
            styles.text,
            style,
            {
              color: color,
              opacity: opacity,
              position: index > 0 ? 'absolute' : 'relative',
              top: 0,
              left: 0,
            },
          ]}
        >
          {children}
        </Text>
      );
    });
  };

  return (
    <View style={styles.container}>
      {renderGradientLayers()}
    </View>
  );
};

// Alternative GradientText using a simpler approach with primary gradient color
export const SimpleGradientText: React.FC<GradientTextProps> = ({
  children,
  colors = theme.colors.primaryGradient,
  style,
}) => {
  // Uses the first color as the base with a bright accent for effect
  return (
    <Text
      style={[
        styles.text,
        style,
        {
          color: colors[0],
          textShadowColor: colors[1] || colors[0],
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        },
      ]}
    >
      {children}
    </Text>
  );
};

// Animated gradient text that cycles through colors
export const AnimatedGradientText: React.FC<GradientTextProps> = ({
  children,
  colors = theme.colors.primaryGradient,
  style,
}) => {
  // vibrant effect, 
  const primaryColor = colors[Math.floor(colors.length / 2)];
  const glowColor = colors[colors.length - 1];

  return (
    <Text
      style={[
        styles.text,
        style,
        {
          color: primaryColor,
          textShadowColor: glowColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 15,
        },
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  text: {
    fontWeight: '700',
  },
});

// Export all variants
export default GradientText;
