import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors, fonts, spacing } from '../lib/theme';
import type { StyleDimensions } from '../lib/style-dimensions';

// ── Axis Definitions ────────────────────────────────────────

const AXES = [
  { key: 'structure', label: 'Structure', low: 'Flowing', high: 'Tailored' },
  { key: 'complexity', label: 'Complexity', low: 'Minimal', high: 'Maximal' },
  { key: 'riskTolerance', label: 'Risk', low: 'Safe', high: 'Bold' },
  { key: 'formality', label: 'Formality', low: 'Casual', high: 'Formal' },
  { key: 'colorTemp', label: 'Warmth', low: 'Cool', high: 'Warm' },
  { key: 'saturation', label: 'Energy', low: 'Muted', high: 'Vivid' },
] as const;

const AXIS_COUNT = AXES.length;

// ── Geometry Helpers ────────────────────────────────────────

function getPoint(cx: number, cy: number, radius: number, index: number, value: number = 1) {
  const angle = (Math.PI * 2 * index) / AXIS_COUNT - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * radius * value,
    y: cy + Math.sin(angle) * radius * value,
  };
}

function polygonPoints(cx: number, cy: number, radius: number, values: number[]): string {
  return values
    .map((v, i) => {
      const p = getPoint(cx, cy, radius, i, Math.max(0.05, v));
      return `${p.x},${p.y}`;
    })
    .join(' ');
}

function hexagonPoints(cx: number, cy: number, radius: number): string {
  return Array.from({ length: AXIS_COUNT }, (_, i) => {
    const p = getPoint(cx, cy, radius, i);
    return `${p.x},${p.y}`;
  }).join(' ');
}

// ── Props ───────────────────────────────────────────────────

interface StyleRadarProps {
  dimensions: StyleDimensions;
  size?: number;
  showLabels?: boolean;
}

// ── Component ───────────────────────────────────────────────

export default function StyleRadar({
  dimensions,
  size = 280,
  showLabels = true,
}: StyleRadarProps) {
  const padding = showLabels ? 52 : 16;
  const svgSize = size + padding * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxRadius = size / 2;

  const values = useMemo(
    () => AXES.map((axis) => (dimensions as Record<string, number>)[axis.key] ?? 0.5),
    [dimensions]
  );

  const gridRings = [0.33, 0.66, 1.0];

  return (
    <View style={[styles.container, { width: svgSize, height: svgSize + (showLabels ? 24 : 0) }]}>
      <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <Defs>
          <SvgGradient id="dataFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={dimensions.primaryColor || colors.accent} stopOpacity="0.35" />
            <Stop offset="1" stopColor={dimensions.secondaryColor || colors.accentSoft} stopOpacity="0.12" />
          </SvgGradient>
        </Defs>

        {/* Background grid rings */}
        {gridRings.map((ring) => (
          <Polygon
            key={ring}
            points={hexagonPoints(cx, cy, maxRadius * ring)}
            fill="none"
            stroke={colors.border}
            strokeWidth={1}
            opacity={0.4 + ring * 0.3}
          />
        ))}

        {/* Axis lines from center to each vertex */}
        {AXES.map((_, i) => {
          const p = getPoint(cx, cy, maxRadius, i);
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke={colors.border}
              strokeWidth={1}
              opacity={0.5}
            />
          );
        })}

        {/* Data polygon — filled */}
        <Polygon
          points={polygonPoints(cx, cy, maxRadius, values)}
          fill="url(#dataFill)"
          stroke={dimensions.primaryColor || colors.accent}
          strokeWidth={2.5}
          strokeLinejoin="round"
          opacity={0.9}
        />

        {/* Data point dots */}
        {values.map((v, i) => {
          const p = getPoint(cx, cy, maxRadius, i, Math.max(0.05, v));
          return (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={dimensions.primaryColor || colors.accent}
            />
          );
        })}
      </Svg>

      {/* Labels positioned outside the chart */}
      {showLabels && AXES.map((axis, i) => {
        const labelRadius = maxRadius + 28;
        const p = getPoint(cx, cy, labelRadius, i);
        const val = values[i];
        const poleLabel = val >= 0.5 ? axis.high : axis.low;

        // Determine text alignment based on position
        let textAlign: 'left' | 'center' | 'right' = 'center';
        let offsetX = 0;
        if (p.x < cx - 20) { textAlign = 'right'; offsetX = -4; }
        else if (p.x > cx + 20) { textAlign = 'left'; offsetX = 4; }

        return (
          <View
            key={axis.key}
            style={[
              styles.labelContainer,
              {
                position: 'absolute',
                left: p.x - 40 + offsetX,
                top: p.y - 16,
                width: 80,
              },
            ]}
          >
            <Text style={[styles.labelName, { textAlign }]}>{axis.label}</Text>
            <Text style={[styles.labelPole, { textAlign }]}>{poleLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  labelContainer: {
    alignItems: 'center',
  },
  labelName: {
    fontFamily: fonts.inter.medium,
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  labelPole: {
    fontFamily: fonts.inter.regular,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
});
