// src/components/ParticleEffects.tsx - Particle system for connection animations- occasionally worked may not be in current version
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { theme } from '../styles/theme';

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
}

interface ParticleEffectsProps {
  isActive: boolean;
  particleCount?: number;
  colors?: string[];
  duration?: number;
  size?: number;
  style?: any;
}

export const ParticleEffects: React.FC<ParticleEffectsProps> = ({
  isActive,
  particleCount = 20,
  colors = [theme.colors.primary, theme.colors.secondary, theme.colors.tertiary],
  duration = 2000,
  size = 8,
  style,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const { width, height } = Dimensions.get('window');
  const animationRefs = useRef<any[]>([]);

  useEffect(() => {
    if (isActive) {
      // Creates initial particles
      const newParticles: Particle[] = [];
      for (let i = 0; i < particleCount; i++) {
        newParticles.push(createParticle(i));
      }
      setParticles(newParticles);

      // Starts animations
      newParticles.forEach((particle, index) => {
        setTimeout(() => {
          animateParticle(particle, index);
        }, Math.random() * 500);
      });
    } else {
      // Clears the  particles when inactive
      animationRefs.current.forEach(anim => anim?.stop());
      animationRefs.current = [];
      setParticles([]);
    }

    return () => {
      animationRefs.current.forEach(anim => anim?.stop());
      animationRefs.current = [];
    };
  }, [isActive, particleCount]);

  const createParticle = (id: number): Particle => {
    const centerX = width / 2;
    const centerY = height / 2;

    return {
      id,
      x: new Animated.Value(centerX),
      y: new Animated.Value(centerY),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  };

  const animateParticle = (particle: Particle, index: number) => {
    if (!isActive) return;

    const centerX = width / 2;
    const centerY = height / 2;

    // Random direction for particle splatter
    const angle = (Math.PI * 2 * index) / particleCount + (Math.random() - 0.5) * 0.5;
    const distance = 100 + Math.random() * 100;
    const targetX = centerX + Math.cos(angle) * distance;
    const targetY = centerY + Math.sin(angle) * distance;

    // Resets particle to center
    particle.x.setValue(centerX);
    particle.y.setValue(centerY);
    particle.opacity.setValue(0);
    particle.scale.setValue(0);

    const animation = Animated.parallel([
      // Moves outward
      Animated.timing(particle.x, {
        toValue: targetX,
        duration: duration,
        useNativeDriver: true,
      }),
      Animated.timing(particle.y, {
        toValue: targetY,
        duration: duration,
        useNativeDriver: true,
      }),
      // Fades in then out for effect
      Animated.sequence([
        Animated.timing(particle.opacity, {
          toValue: 0.8,
          duration: duration * 0.3,
          useNativeDriver: true,
        }),
        Animated.timing(particle.opacity, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
      ]),
      // Scales the  animation
      Animated.sequence([
        Animated.timing(particle.scale, {
          toValue: 1,
          duration: duration * 0.4,
          useNativeDriver: true,
        }),
        Animated.timing(particle.scale, {
          toValue: 0.5,
          duration: duration * 0.6,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animationRefs.current[index] = animation;

    animation.start(({ finished }) => {
      if (finished && isActive) {
        // Loops the animation
        setTimeout(() => animateParticle(particle, index), Math.random() * 500);
      }
    });
  };

  if (!isActive || particles.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.particle,
            {
              width: size,
              height: size,
              backgroundColor: particle.color,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                { scale: particle.scale },
              ],
              opacity: particle.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
};

// Connection pulse effect - expands from center supposed to be for the beating heart effect 
export const ConnectionPulse: React.FC<{
  isActive: boolean;
  color?: string;
  size?: number;
}> = ({ isActive, color = theme.colors.success, size = 100 }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      const animate = () => {
        scaleAnim.setValue(0);
        opacityAnim.setValue(0.8);

        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 2,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && isActive) {
            setTimeout(animate, 100);
          }
        });
      };

      animate();
    }

    return () => {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <View style={styles.pulseContainer} pointerEvents="none">
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
    </View>
  );
};

// Floatings particles for a background effect
export const FloatingParticles: React.FC<{
  particleCount?: number;
  color?: string;
}> = ({ particleCount = 15, color = theme.colors.primary }) => {
  const [particles] = useState(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: new Animated.Value(Math.random() * Dimensions.get('window').width),
      y: new Animated.Value(Math.random() * Dimensions.get('window').height),
      opacity: Math.random() * 0.3 + 0.1,
      size: Math.random() * 4 + 2,
    }));
  });

  useEffect(() => {
    const animations = particles.map((particle) => {
      const animateParticle = () => {
        const { width, height } = Dimensions.get('window');

        Animated.parallel([
          Animated.timing(particle.x, {
            toValue: Math.random() * width,
            duration: 10000 + Math.random() * 10000,
            useNativeDriver: true,
          }),
          Animated.timing(particle.y, {
            toValue: Math.random() * height,
            duration: 10000 + Math.random() * 10000,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            animateParticle();
          }
        });
      };

      animateParticle();
    });

    return () => {
      animations.forEach(anim => anim?.stop?.());
    };
  }, []);

  return (
    <View style={styles.floatingContainer} pointerEvents="none">
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.floatingParticle,
            {
              width: particle.size,
              height: particle.size,
              backgroundColor: color,
              opacity: particle.opacity,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
    borderRadius: 100,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  pulseContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    borderWidth: 2,
  },
  floatingContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingParticle: {
    position: 'absolute',
    borderRadius: 100,
  },
});

export default ParticleEffects;
