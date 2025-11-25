// src/components/ECGWave.tsx - Animated ECG-style heart rate visualization
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { theme } from '../styles/theme';

interface ECGWaveProps {
  heartRate: number;
  color?: string;
  height?: number;
  strokeWidth?: number;
  animate?: boolean;
}

export const ECGWave: React.FC<ECGWaveProps> = ({
  heartRate,
  color = theme.colors.primary,
  height = 80,
  strokeWidth = 2,
  animate = true,
}) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 32);

  useEffect(() => {
    if (!animate || heartRate === 0) {
      scrollX.stopAnimation();
      scrollX.setValue(0);
      return;
    }

    // Calculate animation speed based on heart rate (60 BPM = 1 beat per second)
    const beatsPerSecond = heartRate / 60;
    const durationPerBeat = 1000 / beatsPerSecond;
    const scrollDuration = durationPerBeat * 3; // Scroll 3 beats worth

    const runAnimation = () => {
      scrollX.setValue(0);
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: -containerWidth,
          duration: scrollDuration,
          useNativeDriver: true,
        })
      ).start();
    };

    runAnimation();

    return () => {
      scrollX.stopAnimation();
    };
  }, [heartRate, animate, containerWidth]);

  // Generate ECG wave segments with simplified rendering
  const generateWaveSegments = () => {
    const segments: JSX.Element[] = [];
    const beatWidth = containerWidth / 3; // Show 3 beats
    const centerY = height / 2;
    const numBeats = 4; // Render 4 beats for seamless scrolling

    for (let beat = 0; beat < numBeats; beat++) {
      const beatOffset = beat * beatWidth;
      const points = 100; // Points per beat

      for (let i = 0; i < points; i++) {
        const progress = i / points;
        const x = beatOffset + (progress * beatWidth);
        let y = centerY;

        // Simplified ECG pattern with better performance
        if (progress < 0.1) {
          // P wave
          y = centerY - Math.sin(progress / 0.1 * Math.PI) * 6;
        } else if (progress >= 0.2 && progress < 0.25) {
          // Q dip
          y = centerY + Math.sin((progress - 0.2) / 0.05 * Math.PI) * 4;
        } else if (progress >= 0.25 && progress < 0.3) {
          // R spike
          y = centerY - Math.sin((progress - 0.25) / 0.05 * Math.PI) * (height * 0.35);
        } else if (progress >= 0.3 && progress < 0.35) {
          // S dip
          y = centerY + Math.sin((progress - 0.3) / 0.05 * Math.PI) * 6;
        } else if (progress >= 0.45 && progress < 0.65) {
          // T wave
          y = centerY - Math.sin((progress - 0.45) / 0.2 * Math.PI) * 10;
        }

        segments.push(
          <View
            key={`${beat}-${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: beatWidth / points + 1, // Slight overlap to prevent gaps
              height: strokeWidth,
              backgroundColor: color,
            }}
          />
        );
      }
    }

    return segments;
  };

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Grid background */}
      <View style={styles.gridContainer}>
        {[...Array(5)].map((_, i) => (
          <View
            key={`grid-${i}`}
            style={[styles.gridLine, { top: (height / 4) * i }]}
          />
        ))}
      </View>

      {/* Animated ECG wave */}
      <Animated.View
        style={[
          styles.waveContainer,
          {
            transform: [{ translateX: scrollX }],
          },
        ]}
      >
        {heartRate > 0 && generateWaveSegments()}
      </Animated.View>

      {/* Fade edges for visual polish */}
      <View style={[styles.fadeEdge, styles.fadeLeft]} />
      <View style={[styles.fadeEdge, styles.fadeRight]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    position: 'relative',
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  waveContainer: {
    position: 'absolute',
    height: '100%',
    width: '400%', // Wide container for scrolling
  },
  fadeEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 16,
  },
  fadeLeft: {
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  fadeRight: {
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
});
