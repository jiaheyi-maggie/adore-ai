// ═══════════════════════════════════════════════════════════
// StyleAura — Generative organic blob visualization
// Maps style dimensions to a unique visual identity
// Uses @shopify/react-native-skia declarative API
// ═══════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import {
  Canvas,
  Path as SkiaPath,
  Skia,
  RadialGradient,
  vec,
  Group,
  Blur,
  Paint,
  Circle,
  SweepGradient,
} from '@shopify/react-native-skia';

// ── Props ───────────────────────────────────────────────────

export interface StyleAuraProps {
  /** 0 cool to 1 warm */
  colorTemp?: number;
  /** 0 muted to 1 vivid */
  saturation?: number;
  /** 0 organic to 1 geometric */
  structure?: number;
  /** 0 simple to 1 complex */
  complexity?: number;
  /** 0 casual to 1 formal */
  formality?: number;
  /** 0 safe to 1 experimental */
  riskTolerance?: number;
  /** Primary gradient color (hex) */
  primaryColor?: string;
  /** Secondary gradient color (hex) */
  secondaryColor?: string;
  /** Accent gradient color (hex) */
  accentColor?: string;
  /** Canvas size in px */
  size?: number;
  /** Seed for deterministic shape (e.g. user ID hash) */
  seed?: string;
}

// ── Seeded PRNG ─────────────────────────────────────────────
// Simple seeded random for deterministic shape generation.
// Uses a 32-bit xorshift so the same seed always produces the same blob.

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function createSeededRandom(seed: string) {
  let state = hashString(seed);
  return (): number => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xFFFFFFFF);
  };
}

// ── Blob path generation ────────────────────────────────────

interface BlobConfig {
  cx: number;
  cy: number;
  radius: number;
  complexity: number;
  structure: number;
  riskTolerance: number;
  random: () => number;
}

/**
 * Generate an organic blob path using cubic bezier curves.
 * - complexity controls the number and amplitude of deformations
 * - structure controls angular faceting vs smooth curves
 * - riskTolerance adds asymmetry and irregularity
 */
function generateBlobPath(config: BlobConfig): ReturnType<typeof Skia.Path.Make> {
  const { cx, cy, radius, complexity, structure, riskTolerance, random } = config;

  // Number of control points: 6 (simple) to 12 (complex)
  const pointCount = Math.round(6 + complexity * 6);

  // Generate base points on a circle with deformations
  const points: { x: number; y: number }[] = [];
  const angleStep = (Math.PI * 2) / pointCount;

  for (let i = 0; i < pointCount; i++) {
    const angle = angleStep * i;

    // Radial deformation: more complexity = more variation
    const deformAmplitude = 0.08 + complexity * 0.22;
    const deform = 1 + (random() * 2 - 1) * deformAmplitude;

    // Risk tolerance adds asymmetric stretching
    const asymmetry = riskTolerance * 0.15 * (random() * 2 - 1);
    const xStretch = 1 + asymmetry;
    const yStretch = 1 - asymmetry;

    // Structure: high = snap to polygon angles, low = smooth
    let r = radius * deform;
    if (structure > 0.5) {
      // Add subtle angular faceting for structured styles
      const facetAngle = (Math.PI * 2) / Math.max(3, Math.round(3 + structure * 5));
      const facetPhase = Math.cos((angle % facetAngle) - facetAngle / 2);
      r *= 1 + (structure - 0.5) * 0.12 * facetPhase;
    }

    points.push({
      x: cx + Math.cos(angle) * r * xStretch,
      y: cy + Math.sin(angle) * r * yStretch,
    });
  }

  // Build smooth closed path with cubic beziers
  const path = Skia.Path.Make();

  // Calculate control points for smooth curves using Catmull-Rom to Bezier conversion
  const tension = 0.3 + structure * 0.4; // higher structure = tighter curves

  for (let i = 0; i < pointCount; i++) {
    const p0 = points[(i - 1 + pointCount) % pointCount];
    const p1 = points[i];
    const p2 = points[(i + 1) % pointCount];
    const p3 = points[(i + 2) % pointCount];

    if (i === 0) {
      path.moveTo(p1.x, p1.y);
    }

    // Catmull-Rom tangents
    const t = tension;
    const cp1x = p1.x + (p2.x - p0.x) / (6 / t);
    const cp1y = p1.y + (p2.y - p0.y) / (6 / t);
    const cp2x = p2.x - (p3.x - p1.x) / (6 / t);
    const cp2y = p2.y - (p3.y - p1.y) / (6 / t);

    path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  path.close();
  return path;
}

// ── Hex to RGBA helper ──────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  // Ensure hex is valid
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Component ───────────────────────────────────────────────

export default function StyleAura({
  colorTemp = 0.5,
  saturation = 0.5,
  structure = 0.5,
  complexity = 0.35,
  formality = 0.35,
  riskTolerance = 0.3,
  primaryColor = '#C4956A',
  secondaryColor = '#B3845A',
  accentColor = '#E8D5C4',
  size = 280,
  seed = 'default-aura',
}: StyleAuraProps) {
  const cx = size / 2;
  const cy = size / 2;
  const baseRadius = size * 0.35;

  // Generate all paths and colors deterministically
  const layers = useMemo(() => {
    const random = createSeededRandom(seed);

    // Layer 1: Large soft background blob (most blurred)
    const bgBlob = generateBlobPath({
      cx,
      cy,
      radius: baseRadius * 1.1,
      complexity: complexity * 0.6,
      structure: structure * 0.4,
      riskTolerance: riskTolerance * 0.5,
      random,
    });

    // Layer 2: Main shape
    const mainBlob = generateBlobPath({
      cx,
      cy,
      radius: baseRadius,
      complexity,
      structure,
      riskTolerance,
      random,
    });

    // Layer 3: Inner accent blob (smaller, offset)
    const innerOffsetX = (random() - 0.5) * size * 0.08;
    const innerOffsetY = (random() - 0.5) * size * 0.08;
    const innerBlob = generateBlobPath({
      cx: cx + innerOffsetX,
      cy: cy + innerOffsetY,
      radius: baseRadius * 0.65,
      complexity: complexity * 1.2,
      structure: structure * 0.8,
      riskTolerance: riskTolerance * 1.3,
      random,
    });

    // Layer 4: Small highlight blob
    const highlightOffsetX = (random() - 0.5) * size * 0.12;
    const highlightOffsetY = (random() - 0.5) * size * 0.12 - size * 0.04;
    const highlightBlob = generateBlobPath({
      cx: cx + highlightOffsetX,
      cy: cy + highlightOffsetY,
      radius: baseRadius * 0.35,
      complexity: complexity * 0.8,
      structure: structure * 1.2,
      riskTolerance: riskTolerance * 0.6,
      random,
    });

    return { bgBlob, mainBlob, innerBlob, highlightBlob };
  }, [cx, cy, baseRadius, complexity, structure, riskTolerance, seed, size]);

  // Blur amounts: formality increases sharpness (less blur), casualness = softer
  const bgBlur = 20 - formality * 8;
  const mainBlur = 6 - formality * 3;
  const innerBlur = 3 - formality * 1.5;

  // Opacity: saturation affects vibrancy
  const bgOpacity = 0.25 + saturation * 0.2;
  const mainOpacity = 0.6 + saturation * 0.3;
  const innerOpacity = 0.4 + saturation * 0.25;
  const highlightOpacity = 0.15 + saturation * 0.2;

  // Gradient radius
  const gradientRadius = baseRadius * 1.3;

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Layer 1: Soft outer glow */}
      <Group>
        <Paint>
          <Blur blur={bgBlur} />
        </Paint>
        <SkiaPath path={layers.bgBlob} opacity={bgOpacity}>
          <RadialGradient
            c={vec(cx, cy)}
            r={gradientRadius * 1.2}
            colors={[
              hexWithAlpha(secondaryColor, 0.8),
              hexWithAlpha(primaryColor, 0.5),
              hexWithAlpha(accentColor, 0.0),
            ]}
          />
        </SkiaPath>
      </Group>

      {/* Layer 2: Main blob body */}
      <Group>
        <Paint>
          <Blur blur={mainBlur} />
        </Paint>
        <SkiaPath path={layers.mainBlob} opacity={mainOpacity}>
          <RadialGradient
            c={vec(cx * 0.9, cy * 0.9)}
            r={gradientRadius}
            colors={[
              primaryColor,
              secondaryColor,
              hexWithAlpha(accentColor, 0.4),
            ]}
          />
        </SkiaPath>
      </Group>

      {/* Layer 3: Inner accent with sweep gradient */}
      <Group>
        <Paint>
          <Blur blur={innerBlur} />
        </Paint>
        <SkiaPath path={layers.innerBlob} opacity={innerOpacity}>
          <SweepGradient
            c={vec(cx, cy)}
            colors={[
              accentColor,
              primaryColor,
              secondaryColor,
              accentColor,
            ]}
          />
        </SkiaPath>
      </Group>

      {/* Layer 4: Bright highlight for depth */}
      <Group blendMode="screen">
        <Paint>
          <Blur blur={8} />
        </Paint>
        <SkiaPath path={layers.highlightBlob} opacity={highlightOpacity}>
          <RadialGradient
            c={vec(cx, cy * 0.85)}
            r={gradientRadius * 0.45}
            colors={[
              hexWithAlpha('#FFFFFF', 0.6),
              hexWithAlpha(accentColor, 0.2),
              hexWithAlpha(primaryColor, 0.0),
            ]}
          />
        </SkiaPath>
      </Group>

      {/* Subtle center luminosity */}
      <Group blendMode="softLight">
        <Circle cx={cx} cy={cy * 0.92} r={baseRadius * 0.4} opacity={0.15}>
          <RadialGradient
            c={vec(cx, cy * 0.92)}
            r={baseRadius * 0.4}
            colors={['#FFFFFF', hexWithAlpha('#FFFFFF', 0)]}
          />
        </Circle>
      </Group>
    </Canvas>
  );
}
