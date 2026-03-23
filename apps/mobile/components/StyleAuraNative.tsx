import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface StyleAuraNativeProps {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  complexity?: number;
  structure?: number;
  size?: number;
}

/**
 * Pure React Native aura blob — works in Expo Go without Skia.
 * Uses overlapping rounded Views with gradients to create an organic shape.
 */
export default function StyleAuraNative({
  primaryColor = '#C4956A',
  secondaryColor = '#B3845A',
  accentColor = '#E8D5C4',
  complexity = 0.3,
  structure = 0.5,
  size = 280,
}: StyleAuraNativeProps) {
  const layers = useMemo(() => {
    const half = size / 2;
    // Base border radius — higher structure = more square, lower = more round
    const baseRadius = half * (1 - structure * 0.35);
    // Complexity controls how many layers and how offset they are
    const offset = 8 + complexity * 16;

    return [
      // Outer glow layer
      {
        width: size * 1.1,
        height: size * 1.1,
        borderRadius: baseRadius * 1.1,
        colors: [accentColor + '30', primaryColor + '10', 'transparent'] as const,
        offset: { top: -size * 0.05, left: -size * 0.05 },
        rotate: '0deg',
      },
      // Main blob
      {
        width: size,
        height: size * (0.92 + complexity * 0.08),
        borderRadius: baseRadius,
        colors: [primaryColor, secondaryColor, accentColor] as const,
        offset: { top: 0, left: 0 },
        rotate: `${-5 + structure * 10}deg`,
      },
      // Accent overlay — offset based on complexity
      {
        width: size * 0.85,
        height: size * 0.85,
        borderRadius: baseRadius * 0.9,
        colors: [secondaryColor + '80', accentColor + '60', primaryColor + '40'] as const,
        offset: { top: offset * 0.5, left: offset },
        rotate: `${15 - complexity * 30}deg`,
      },
      // Inner highlight
      {
        width: size * 0.5,
        height: size * 0.5,
        borderRadius: baseRadius * 0.6,
        colors: ['#FFFFFF40', '#FFFFFF10', 'transparent'] as const,
        offset: { top: size * 0.15, left: size * 0.2 },
        rotate: `${25}deg`,
      },
    ];
  }, [size, primaryColor, secondaryColor, accentColor, complexity, structure]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {layers.map((layer, i) => (
        <LinearGradient
          key={i}
          colors={[...layer.colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.layer,
            {
              width: layer.width,
              height: layer.height,
              borderRadius: layer.borderRadius,
              top: layer.offset.top,
              left: layer.offset.left,
              transform: [{ rotate: layer.rotate }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
});
