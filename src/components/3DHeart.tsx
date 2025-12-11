// src/components/3DHeart.tsx - 3D gradient animated heart component
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../styles/theme';

interface HeartProps {
  size?: number;
  color?: string;
  gradientColors?: string[];
  animate?: boolean;
  heartRate?: number;
  style?: ViewStyle;
}

export const Heart3D: React.FC<HeartProps> = ({
  size = 100,
  color = theme.colors.primary,
  gradientColors = theme.colors.primaryGradient,
  animate = true,
  heartRate = 70,
  style,
}) => {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateXAnim = useRef(new Animated.Value(0)).current;
  const rotateYAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || heartRate === 0) {
      scaleAnim.setValue(1);
      rotateXAnim.setValue(0);
      rotateYAnim.setValue(0);
      glowAnim.setValue(0);
      return;
    }

    // Calculates animation speed based on heart rate
    const beatsPerSecond = heartRate / 60;
    const durationPerBeat = 1000 / beatsPerSecond;
    const pulseDuration = durationPerBeat * 0.4;
    const restDuration = durationPerBeat * 0.6;

    // Heartbeat pulse animation (simplified to avoid native/JS driver conflicts)
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        // First beat
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: pulseDuration * 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: pulseDuration * 0.5,
          useNativeDriver: true,
        }),
        // Second beat (smaller)
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: pulseDuration * 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: restDuration,
          useNativeDriver: true,
        }),
      ])
    );

    // 3D rotation animation - not working
    const rotationAnimation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(rotateYAnim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateYAnim, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(rotateXAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateXAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseAnimation.start();
    rotationAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotationAnimation.stop();
    };
  }, [animate, heartRate]);

  // Interpolate rotation values
  const rotateX = rotateXAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  const rotateY = rotateYAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  // Interpolate glow intensity
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const glowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 30],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Background glow layers */}
      <Animated.View
        style={[
          styles.glowLayer,
          {
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: size * 0.75,
            backgroundColor: gradientColors[0],
            opacity: glowOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.3],
            }),
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.glowLayer,
          {
            width: size * 1.2,
            height: size * 1.2,
            borderRadius: size * 0.6,
            backgroundColor: gradientColors[1] || gradientColors[0],
            opacity: glowOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 0.5],
            }),
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />

      {/* Main heart with 3D transform */}
      <Animated.View
        style={[
          styles.heartContainer,
          {
            transform: [
              { perspective: 1000 },
              { rotateX },
              { rotateY },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        {/* Shadow heart-depth */}
        <View
          style={[
            styles.shadowHeart,
            {
              shadowColor: color,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
            },
          ]}
        >
          <Icon name="favorite" size={size} color="rgba(0, 0, 0, 0.3)" />
        </View>

        {/* Main gradient heart */}
        <View style={styles.mainHeart}>
          <Icon name="favorite" size={size} color={color} />
        </View>

        {/* Highlight overlay */}
        <Animated.View
          style={[
            styles.highlight,
            {
              opacity: glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.6],
              }),
            },
          ]}
        >
          <Icon
            name="favorite"
            size={size * 0.7}
            color="rgba(255, 255, 255, 0.4)"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// Simplified 2D animated heart- current go to for heart rate screen
export const AnimatedHeart: React.FC<HeartProps> = ({
  size = 60,
  color = theme.colors.primary,
  animate = true,
  heartRate = 70,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || heartRate === 0) {
      scaleAnim.setValue(1);
      glowAnim.setValue(0);
      return;
    }

    const beatsPerSecond = heartRate / 60;
    const durationPerBeat = 1000 / beatsPerSecond;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: durationPerBeat * 0.3,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: durationPerBeat * 0.3,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: durationPerBeat * 0.7,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: durationPerBeat * 0.7,
            useNativeDriver: false,
          }),
        ]),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animate, heartRate]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.8],
  });

  return (
    <View style={[styles.simpleContainer, style]}>
      <Animated.View
        style={{
          opacity: glowOpacity,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Icon
          name="favorite"
          size={size}
          color={color}
          style={{
            textShadowColor: color,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 20,
          }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glowLayer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  shadowHeart: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainHeart: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: '10%',
    left: '10%',
  },
  simpleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Heart3D;
