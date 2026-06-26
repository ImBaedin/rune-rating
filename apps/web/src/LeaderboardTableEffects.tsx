import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

const maxFps = 45;
const maxParticleColors = 6;
const maxBeamColors = 6;
const emptyRow = new Float32Array([0, 0, 0, 0]);
const gold = new Float32Array([0.92, 0.66, 0.24]);
const silver = new Float32Array([0.78, 0.84, 0.84]);
const bronze = new Float32Array([0.76, 0.42, 0.2]);
const fallbackTier = new Float32Array([0.62, 0.94, 0.92]);
const defaultParticleColor = new Float32Array([0.96, 0.83, 0.54]);
const defaultBeamColor = new Float32Array([0.35, 0.9, 0.9]);

type RangeValue = readonly [number, number];

export type LeaderboardParticleSettings = {
  particleOpacity: RangeValue;
  particleSpawnRate: number;
  particleColors: readonly string[];
  particleTravelDistance: RangeValue;
  particleMoveSpeed: RangeValue;
  particleSize: RangeValue;
  particleWander: RangeValue;
  beamFalloffDistance: number;
  beamColors: readonly string[];
  beamIntensity: number;
  beamWaveWidth: number;
  beamWaveFrequency: number;
};

export const firstPlaceLeaderboardEffectSettings: LeaderboardParticleSettings =
  {
    particleOpacity: [0.2, 0.8],
    particleSpawnRate: 144,
    particleColors: ["#f4d48a", "#9df4f1", "#eef2f3"],
    particleTravelDistance: [0.1, 0.5],
    particleMoveSpeed: [0.2, 1.2],
    particleSize: [1, 4],
    particleWander: [0.05, 0.25],
    beamFalloffDistance: 0.5,
    beamColors: ["#d8aa43"],
    beamIntensity: 0.8,
    beamWaveWidth: 0.1,
    beamWaveFrequency: 4,
  };

export const secondPlaceLeaderboardEffectSettings: LeaderboardParticleSettings =
  {
    ...firstPlaceLeaderboardEffectSettings,
    beamIntensity: 0.7,
    beamColors: ["#9df4f1"],
  };

export const thirdPlaceLeaderboardEffectSettings: LeaderboardParticleSettings =
  {
    ...firstPlaceLeaderboardEffectSettings,
    beamIntensity: 0.6,
    beamColors: ["#eef2f3"],
  };

export const leaderboardRowEffectSettings = [
  firstPlaceLeaderboardEffectSettings,
  secondPlaceLeaderboardEffectSettings,
  thirdPlaceLeaderboardEffectSettings,
] as const;

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform vec4 uRow0;
uniform vec4 uRow1;
uniform vec4 uRow2;
uniform vec3 uRankColor0;
uniform vec3 uRankColor1;
uniform vec3 uRankColor2;
uniform vec3 uTierColor0;
uniform vec3 uTierColor1;
uniform vec3 uTierColor2;
uniform vec2 uParticleOpacity0;
uniform vec2 uParticleOpacity1;
uniform vec2 uParticleOpacity2;
uniform float uParticleCount0;
uniform float uParticleCount1;
uniform float uParticleCount2;
uniform vec2 uTravelDistance0;
uniform vec2 uTravelDistance1;
uniform vec2 uTravelDistance2;
uniform vec2 uMoveSpeed0;
uniform vec2 uMoveSpeed1;
uniform vec2 uMoveSpeed2;
uniform vec2 uParticleSize0;
uniform vec2 uParticleSize1;
uniform vec2 uParticleSize2;
uniform vec2 uParticleWander0;
uniform vec2 uParticleWander1;
uniform vec2 uParticleWander2;
uniform float uParticleColorCount0;
uniform float uParticleColorCount1;
uniform float uParticleColorCount2;
uniform vec3 uParticleColor0_0;
uniform vec3 uParticleColor0_1;
uniform vec3 uParticleColor0_2;
uniform vec3 uParticleColor0_3;
uniform vec3 uParticleColor0_4;
uniform vec3 uParticleColor0_5;
uniform vec3 uParticleColor1_0;
uniform vec3 uParticleColor1_1;
uniform vec3 uParticleColor1_2;
uniform vec3 uParticleColor1_3;
uniform vec3 uParticleColor1_4;
uniform vec3 uParticleColor1_5;
uniform vec3 uParticleColor2_0;
uniform vec3 uParticleColor2_1;
uniform vec3 uParticleColor2_2;
uniform vec3 uParticleColor2_3;
uniform vec3 uParticleColor2_4;
uniform vec3 uParticleColor2_5;
uniform float uBeamFalloffDistance0;
uniform float uBeamFalloffDistance1;
uniform float uBeamFalloffDistance2;
uniform float uBeamIntensity0;
uniform float uBeamIntensity1;
uniform float uBeamIntensity2;
uniform float uBeamWaveWidth0;
uniform float uBeamWaveWidth1;
uniform float uBeamWaveWidth2;
uniform float uBeamWaveFrequency0;
uniform float uBeamWaveFrequency1;
uniform float uBeamWaveFrequency2;
uniform float uBeamColorCount0;
uniform float uBeamColorCount1;
uniform float uBeamColorCount2;
uniform vec3 uBeamColor0_0;
uniform vec3 uBeamColor0_1;
uniform vec3 uBeamColor0_2;
uniform vec3 uBeamColor0_3;
uniform vec3 uBeamColor0_4;
uniform vec3 uBeamColor0_5;
uniform vec3 uBeamColor1_0;
uniform vec3 uBeamColor1_1;
uniform vec3 uBeamColor1_2;
uniform vec3 uBeamColor1_3;
uniform vec3 uBeamColor1_4;
uniform vec3 uBeamColor1_5;
uniform vec3 uBeamColor2_0;
uniform vec3 uBeamColor2_1;
uniform vec3 uBeamColor2_2;
uniform vec3 uBeamColor2_3;
uniform vec3 uBeamColor2_4;
uniform vec3 uBeamColor2_5;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float particleShape(vec2 point, float size, float kind) {
  vec2 q = abs(point);
  float circle = 1.0 - smoothstep(size, size + 1.4, length(point));
  float square = 1.0 - smoothstep(size, size + 1.2, max(q.x, q.y));
  float diamond = 1.0 - smoothstep(size, size + 1.2, q.x + q.y);
  float horizontal = (1.0 - smoothstep(size, size + 1.1, q.x)) *
    (1.0 - smoothstep(size * 0.18, size * 0.18 + 0.8, q.y));
  float vertical = (1.0 - smoothstep(size, size + 1.1, q.y)) *
    (1.0 - smoothstep(size * 0.18, size * 0.18 + 0.8, q.x));
  float cross = max(horizontal, vertical);

  if (kind < 0.28) return circle;
  if (kind < 0.56) return square;
  if (kind < 0.82) return diamond;
  return cross * 0.75;
}

vec2 rowVec2(float rowIndex, vec2 row0, vec2 row1, vec2 row2) {
  if (rowIndex < 0.5) return row0;
  if (rowIndex < 1.5) return row1;
  return row2;
}

float rowFloat(float rowIndex, float row0, float row1, float row2) {
  if (rowIndex < 0.5) return row0;
  if (rowIndex < 1.5) return row1;
  return row2;
}

vec3 colorSlot(float slot, vec3 color0, vec3 color1, vec3 color2, vec3 color3, vec3 color4, vec3 color5) {
  if (slot < 0.5) return color0;
  if (slot < 1.5) return color1;
  if (slot < 2.5) return color2;
  if (slot < 3.5) return color3;
  if (slot < 4.5) return color4;
  return color5;
}

vec3 particlePalette(float seed, float rowIndex) {
  float count = max(
    rowFloat(rowIndex, uParticleColorCount0, uParticleColorCount1, uParticleColorCount2),
    1.0
  );
  float slot = floor(hash11(seed) * count);

  if (rowIndex < 0.5) {
    return colorSlot(slot, uParticleColor0_0, uParticleColor0_1, uParticleColor0_2, uParticleColor0_3, uParticleColor0_4, uParticleColor0_5);
  }

  if (rowIndex < 1.5) {
    return colorSlot(slot, uParticleColor1_0, uParticleColor1_1, uParticleColor1_2, uParticleColor1_3, uParticleColor1_4, uParticleColor1_5);
  }

  return colorSlot(slot, uParticleColor2_0, uParticleColor2_1, uParticleColor2_2, uParticleColor2_3, uParticleColor2_4, uParticleColor2_5);
}

vec3 beamPalette(float seed, float rowIndex) {
  float count = max(
    rowFloat(rowIndex, uBeamColorCount0, uBeamColorCount1, uBeamColorCount2),
    1.0
  );
  float slot = floor(hash11(seed) * count);

  if (rowIndex < 0.5) {
    return colorSlot(slot, uBeamColor0_0, uBeamColor0_1, uBeamColor0_2, uBeamColor0_3, uBeamColor0_4, uBeamColor0_5);
  }

  if (rowIndex < 1.5) {
    return colorSlot(slot, uBeamColor1_0, uBeamColor1_1, uBeamColor1_2, uBeamColor1_3, uBeamColor1_4, uBeamColor1_5);
  }

  return colorSlot(slot, uBeamColor2_0, uBeamColor2_1, uBeamColor2_2, uBeamColor2_3, uBeamColor2_4, uBeamColor2_5);
}

vec4 renderFeaturedRow(vec2 p, vec4 row, vec3 rankColor, vec3 tierColor, float rowIndex) {
  if (row.w < 0.5 || p.y < row.x || p.y > row.x + row.y) {
    return vec4(0.0);
  }

  float localY = clamp((p.y - row.x) / max(row.y, 1.0), 0.0, 1.0);
  float localX = clamp(p.x / max(uResolution.x, 1.0), 0.0, 1.0);
  float verticalSoft = smoothstep(0.0, 0.1, localY) * (1.0 - smoothstep(0.9, 1.0, localY));
  vec2 particleOpacity = rowVec2(rowIndex, uParticleOpacity0, uParticleOpacity1, uParticleOpacity2);
  float particleCount = rowFloat(rowIndex, uParticleCount0, uParticleCount1, uParticleCount2);
  vec2 travelDistance = rowVec2(rowIndex, uTravelDistance0, uTravelDistance1, uTravelDistance2);
  vec2 moveSpeed = rowVec2(rowIndex, uMoveSpeed0, uMoveSpeed1, uMoveSpeed2);
  vec2 particleSize = rowVec2(rowIndex, uParticleSize0, uParticleSize1, uParticleSize2);
  vec2 particleWander = rowVec2(rowIndex, uParticleWander0, uParticleWander1, uParticleWander2);
  float beamFalloffDistance = rowFloat(rowIndex, uBeamFalloffDistance0, uBeamFalloffDistance1, uBeamFalloffDistance2);
  float beamIntensity = rowFloat(rowIndex, uBeamIntensity0, uBeamIntensity1, uBeamIntensity2);
  float beamWaveWidth = rowFloat(rowIndex, uBeamWaveWidth0, uBeamWaveWidth1, uBeamWaveWidth2);
  float beamWaveFrequency = rowFloat(rowIndex, uBeamWaveFrequency0, uBeamWaveFrequency1, uBeamWaveFrequency2);

  float beamWaveLeft =
    sin(localY * beamWaveFrequency + uTime * (0.42 + rowIndex * 0.06) + row.z * 1.7) * beamWaveWidth +
    sin(localY * beamWaveFrequency * 1.83 - uTime * (0.27 + rowIndex * 0.05) + row.z * 2.9) * beamWaveWidth * 0.42;
  float beamWaveRight =
    sin(localY * beamWaveFrequency * 1.16 - uTime * (0.38 + rowIndex * 0.07) + row.z * 2.2) * beamWaveWidth +
    sin(localY * beamWaveFrequency * 2.07 + uTime * (0.22 + rowIndex * 0.04) + row.z * 3.4) * beamWaveWidth * 0.36;
  float leftFalloff = clamp(beamFalloffDistance + beamWaveLeft, 0.02, 0.72);
  float rightFalloff = clamp(beamFalloffDistance + beamWaveRight, 0.02, 0.72);
  float leftBeam = pow(1.0 - smoothstep(0.0, leftFalloff, localX), 1.08);
  float rightBeam = pow(smoothstep(1.0 - rightFalloff, 1.0, localX), 1.08);
  vec3 leftBeamColor = beamPalette(row.z * 11.0 + 0.3, rowIndex);
  vec3 rightBeamColor = beamPalette(row.z * 11.0 + 2.7, rowIndex);
  float beamAlpha = clamp(leftBeam + rightBeam, 0.0, 1.0) * beamIntensity * verticalSoft;

  vec3 color = (leftBeamColor * leftBeam + rightBeamColor * rightBeam) * beamAlpha * 1.35;
  float alpha = beamAlpha;

  for (int i = 0; i < 144; i++) {
    float fi = float(i);
    float enabled = 1.0 - step(particleCount, fi);
    float seed = row.z * 71.0 + rowIndex * 19.0 + fi * 5.37;
    float side = step(0.47, hash11(seed + 1.0));
    float speed = max(0.05, mix(moveSpeed.x, moveSpeed.y, hash11(seed + 2.0)));
    float duration = 7.2 / speed;
    float offset = hash11(seed + 3.0);
    float t = fract(uTime / duration + offset);
    float rowWander = sin(t * 6.28318 + seed) * row.y * mix(particleWander.x, particleWander.y, hash11(seed + 4.0));
    float travel = mix(travelDistance.x, travelDistance.y, hash11(seed + 7.0));

    float startX = mix(
      mix(-10.0, 24.0, hash11(seed + 5.0)),
      mix(uResolution.x + 10.0, uResolution.x - 24.0, hash11(seed + 6.0)),
      side
    );
    float targetX = mix(
      startX + uResolution.x * travel,
      startX - uResolution.x * travel,
      side
    );
    float y = row.x + row.y * mix(0.18, 0.82, hash11(seed + 8.0)) + rowWander;
    float x = mix(startX, targetX, t);
    float size = mix(particleSize.x, particleSize.y, pow(hash11(seed + 9.0), 1.55));
    float kind = hash11(seed + 10.0);
    float spark = particleShape(p - vec2(x, y), size, kind);
    float life = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.32, 0.64, t));
    float twinkle = 0.9 + 0.1 * sin(uTime * mix(1.4, 4.0, hash11(seed + 11.0)) + seed);
    vec3 particleColor = particlePalette(seed + 12.0, rowIndex);
    float opacity = mix(particleOpacity.x, particleOpacity.y, hash11(seed + 13.0));
    float particleAlpha = spark * life * twinkle * opacity * enabled;

    color += particleColor * particleAlpha;
    alpha += particleAlpha;
  }

  return vec4(color, clamp(alpha, 0.0, 0.9));
}

void main() {
  vec2 p = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);
  vec4 row0 = renderFeaturedRow(p, uRow0, uRankColor0, uTierColor0, 0.0);
  vec4 row1 = renderFeaturedRow(p, uRow1, uRankColor1, uTierColor1, 1.0);
  vec4 row2 = renderFeaturedRow(p, uRow2, uRankColor2, uTierColor2, 2.0);
  vec4 color = row0 + row1 + row2;
  color.a = clamp(color.a, 0.0, 0.95);
  gl_FragColor = color;
}
`;

function hexToRgb(hex: string): Float32Array {
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallbackTier;
  const value = Number.parseInt(normalized, 16);
  return new Float32Array([
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizedRange(
  range: RangeValue,
  min: number,
  max: number,
): Float32Array {
  const low = clamp(range[0], min, max);
  const high = clamp(range[1], min, max);
  return low <= high
    ? new Float32Array([low, high])
    : new Float32Array([high, low]);
}

function normalizedParticleColors(colors: readonly string[]) {
  const parsed = colors
    .map((color) => hexToRgb(color))
    .filter((color) => color !== fallbackTier)
    .slice(0, maxParticleColors);

  return parsed.length > 0 ? parsed : [defaultParticleColor];
}

function normalizedBeamColors(colors: readonly string[]) {
  const parsed = colors
    .map((color) => hexToRgb(color))
    .filter((color) => color !== fallbackTier)
    .slice(0, maxBeamColors);

  return parsed.length > 0 ? parsed : [defaultBeamColor];
}

function rankColor(rank: number) {
  if (rank === 1) return gold;
  if (rank === 2) return silver;
  return bronze;
}

function setColorUniform(
  program: Program | null,
  uniformName: string,
  rgb: Float32Array,
) {
  const uniform = program?.uniforms[uniformName]?.value;
  if (uniform instanceof Color) {
    uniform.r = rgb[0] ?? 0;
    uniform.g = rgb[1] ?? 0;
    uniform.b = rgb[2] ?? 0;
  }
}

function setVec2Uniform(
  program: Program | null,
  uniformName: string,
  value: Float32Array,
) {
  const uniform = program?.uniforms[uniformName]?.value as
    | Float32Array
    | undefined;
  if (!uniform) return;
  uniform[0] = value[0] ?? 0;
  uniform[1] = value[1] ?? 0;
}

function settingForRow(
  settings: readonly LeaderboardParticleSettings[],
  index: number,
) {
  return settings[index] ?? settings[0] ?? firstPlaceLeaderboardEffectSettings;
}

function particleUniformName(index: number, colorIndex: number) {
  return `uParticleColor${index}_${colorIndex}`;
}

function beamUniformName(index: number, colorIndex: number) {
  return `uBeamColor${index}_${colorIndex}`;
}

function applyRowSettings(
  program: Program | null,
  settingsByRow: readonly LeaderboardParticleSettings[],
) {
  if (!program) return;

  for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
    const settings = settingForRow(settingsByRow, rowIndex);

    setVec2Uniform(
      program,
      `uParticleOpacity${rowIndex}`,
      normalizedRange(settings.particleOpacity, 0, 1),
    );
    setVec2Uniform(
      program,
      `uTravelDistance${rowIndex}`,
      normalizedRange(settings.particleTravelDistance, 0, 0.5),
    );
    setVec2Uniform(
      program,
      `uMoveSpeed${rowIndex}`,
      normalizedRange(settings.particleMoveSpeed, 0.05, 4),
    );
    setVec2Uniform(
      program,
      `uParticleSize${rowIndex}`,
      normalizedRange(settings.particleSize, 0.1, 16),
    );
    setVec2Uniform(
      program,
      `uParticleWander${rowIndex}`,
      normalizedRange(settings.particleWander, 0, 0.5),
    );

    program.uniforms[`uParticleCount${rowIndex}`].value = clamp(
      Math.round(settings.particleSpawnRate),
      0,
      144,
    );

    const colors = normalizedParticleColors(settings.particleColors);
    program.uniforms[`uParticleColorCount${rowIndex}`].value = colors.length;
    const fallbackColor = colors[0] ?? defaultParticleColor;
    for (let colorIndex = 0; colorIndex < maxParticleColors; colorIndex += 1) {
      setColorUniform(
        program,
        particleUniformName(rowIndex, colorIndex),
        colors[colorIndex] ?? fallbackColor,
      );
    }

    program.uniforms[`uBeamFalloffDistance${rowIndex}`].value = clamp(
      settings.beamFalloffDistance,
      0.02,
      0.72,
    );
    program.uniforms[`uBeamIntensity${rowIndex}`].value = clamp(
      settings.beamIntensity,
      0,
      4,
    );
    program.uniforms[`uBeamWaveWidth${rowIndex}`].value = clamp(
      settings.beamWaveWidth,
      0,
      0.3,
    );
    program.uniforms[`uBeamWaveFrequency${rowIndex}`].value = clamp(
      settings.beamWaveFrequency,
      0.1,
      40,
    );
    const beamColors = normalizedBeamColors(settings.beamColors);
    program.uniforms[`uBeamColorCount${rowIndex}`].value = beamColors.length;
    const fallbackBeamColor = beamColors[0] ?? defaultBeamColor;
    for (let colorIndex = 0; colorIndex < maxBeamColors; colorIndex += 1) {
      setColorUniform(
        program,
        beamUniformName(rowIndex, colorIndex),
        beamColors[colorIndex] ?? fallbackBeamColor,
      );
    }
  }
}

function createRowSettingsUniforms(
  settingsByRow: readonly LeaderboardParticleSettings[],
) {
  const uniforms: Record<string, { value: unknown }> = {};

  for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
    const settings = settingForRow(settingsByRow, rowIndex);
    uniforms[`uParticleOpacity${rowIndex}`] = {
      value: normalizedRange(settings.particleOpacity, 0, 1),
    };
    uniforms[`uParticleCount${rowIndex}`] = {
      value: clamp(Math.round(settings.particleSpawnRate), 0, 144),
    };
    uniforms[`uTravelDistance${rowIndex}`] = {
      value: normalizedRange(settings.particleTravelDistance, 0, 0.5),
    };
    uniforms[`uMoveSpeed${rowIndex}`] = {
      value: normalizedRange(settings.particleMoveSpeed, 0.05, 4),
    };
    uniforms[`uParticleSize${rowIndex}`] = {
      value: normalizedRange(settings.particleSize, 0.1, 16),
    };
    uniforms[`uParticleWander${rowIndex}`] = {
      value: normalizedRange(settings.particleWander, 0, 0.5),
    };
    uniforms[`uParticleColorCount${rowIndex}`] = {
      value: normalizedParticleColors(settings.particleColors).length,
    };

    for (let colorIndex = 0; colorIndex < maxParticleColors; colorIndex += 1) {
      uniforms[particleUniformName(rowIndex, colorIndex)] = {
        value: new Color(
          defaultParticleColor[0],
          defaultParticleColor[1],
          defaultParticleColor[2],
        ),
      };
    }

    uniforms[`uBeamFalloffDistance${rowIndex}`] = {
      value: clamp(settings.beamFalloffDistance, 0.02, 0.72),
    };
    uniforms[`uBeamIntensity${rowIndex}`] = {
      value: clamp(settings.beamIntensity, 0, 4),
    };
    uniforms[`uBeamWaveWidth${rowIndex}`] = {
      value: clamp(settings.beamWaveWidth, 0, 0.3),
    };
    uniforms[`uBeamWaveFrequency${rowIndex}`] = {
      value: clamp(settings.beamWaveFrequency, 0.1, 40),
    };
    uniforms[`uBeamColorCount${rowIndex}`] = {
      value: normalizedBeamColors(settings.beamColors).length,
    };

    for (let colorIndex = 0; colorIndex < maxBeamColors; colorIndex += 1) {
      uniforms[beamUniformName(rowIndex, colorIndex)] = {
        value: new Color(
          defaultBeamColor[0],
          defaultBeamColor[1],
          defaultBeamColor[2],
        ),
      };
    }
  }

  return uniforms;
}

type LeaderboardTableEffectsProps = {
  settings?: readonly LeaderboardParticleSettings[];
};

export function LeaderboardTableEffects({
  settings = leaderboardRowEffectSettings,
}: LeaderboardTableEffectsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<Program>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
    applyRowSettings(programRef.current, settings);
  }, [settings]);

  useEffect(() => {
    const container = containerRef.current;
    const parent = container?.parentElement;
    if (!container || !parent) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const renderer = new Renderer({
      alpha: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      transparent: true,
      uniforms: {
        uResolution: { value: new Float32Array([1, 1]) },
        uTime: { value: 0 },
        uRow0: { value: new Float32Array(emptyRow) },
        uRow1: { value: new Float32Array(emptyRow) },
        uRow2: { value: new Float32Array(emptyRow) },
        uRankColor0: { value: new Color(gold[0], gold[1], gold[2]) },
        uRankColor1: { value: new Color(silver[0], silver[1], silver[2]) },
        uRankColor2: { value: new Color(bronze[0], bronze[1], bronze[2]) },
        uTierColor0: {
          value: new Color(fallbackTier[0], fallbackTier[1], fallbackTier[2]),
        },
        uTierColor1: {
          value: new Color(fallbackTier[0], fallbackTier[1], fallbackTier[2]),
        },
        uTierColor2: {
          value: new Color(fallbackTier[0], fallbackTier[1], fallbackTier[2]),
        },
        ...createRowSettingsUniforms(settingsRef.current),
      },
    });
    programRef.current = program;
    applyRowSettings(program, settingsRef.current);

    const mesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program,
    });

    container.appendChild(gl.canvas);

    let rafId = 0;
    let timeoutId = 0;
    let layoutFrameId = 0;
    let lastFrameAt = 0;

    const setColor = (
      key: "uRankColor" | "uTierColor",
      index: number,
      rgb: Float32Array,
    ) => {
      const uniform = program.uniforms[`${key}${index}`]?.value;
      if (uniform instanceof Color) {
        uniform.r = rgb[0] ?? 0;
        uniform.g = rgb[1] ?? 0;
        uniform.b = rgb[2] ?? 0;
      }
    };

    const setRow = (index: number, row: Float32Array) => {
      const uniform = program.uniforms[`uRow${index}`]?.value as
        | Float32Array
        | undefined;
      if (!uniform) return;
      uniform[0] = row[0] ?? 0;
      uniform[1] = row[1] ?? 0;
      uniform[2] = row[2] ?? 0;
      uniform[3] = row[3] ?? 0;
    };

    const updateLayout = () => {
      layoutFrameId = 0;
      const table =
        parent.querySelector<HTMLTableElement>(".leaderboard-table");
      const tbody = table?.querySelector("tbody");
      if (!table || !tbody) return;

      const parentRect = parent.getBoundingClientRect();
      const bodyRect = tbody.getBoundingClientRect();
      const tableWidth = table.offsetWidth;
      const bodyHeight = tbody.offsetHeight;
      const top = bodyRect.top - parentRect.top + parent.scrollTop;

      container.style.top = `${top}px`;
      container.style.width = `${tableWidth}px`;
      container.style.height = `${bodyHeight}px`;
      if (tableWidth <= 0 || bodyHeight <= 0) {
        renderer.setSize(Math.max(1, tableWidth), 1);
        setRow(0, emptyRow);
        setRow(1, emptyRow);
        setRow(2, emptyRow);
        return;
      }

      renderer.setSize(tableWidth, bodyHeight);

      const resolution = program.uniforms.uResolution.value as Float32Array;
      resolution[0] = gl.canvas.width;
      resolution[1] = gl.canvas.height;

      const rows = Array.from(
        tbody.querySelectorAll<HTMLTableRowElement>("tr[data-featured-rank]"),
      ).slice(0, 3);

      for (let i = 0; i < 3; i += 1) {
        const row = rows[i];
        if (!row) {
          setRow(i, emptyRow);
          continue;
        }

        const rowRect = row.getBoundingClientRect();
        const rank = Number(row.dataset.featuredRank ?? "0");
        const style = window.getComputedStyle(row);
        const tierColor = hexToRgb(style.getPropertyValue("--tier-light"));
        setRow(
          i,
          new Float32Array([
            (rowRect.top - bodyRect.top) * (gl.canvas.height / bodyHeight),
            rowRect.height * (gl.canvas.height / bodyHeight),
            rank,
            1,
          ]),
        );
        setColor("uRankColor", i, rankColor(rank));
        setColor("uTierColor", i, tierColor);
      }
    };

    const scheduleLayout = () => {
      if (layoutFrameId) return;
      layoutFrameId = requestAnimationFrame(updateLayout);
    };

    const render = (time: number) => {
      const minFrameMs = 1000 / maxFps;
      if (time - lastFrameAt >= minFrameMs) {
        program.uniforms.uTime.value = time * 0.001;
        renderer.render({ scene: mesh });
        lastFrameAt = time;
      }
      rafId = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(scheduleLayout);
    resizeObserver.observe(parent);

    const mutationObserver = new MutationObserver(scheduleLayout);
    mutationObserver.observe(parent, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-featured-rank", "style", "class"],
    });

    window.addEventListener("resize", scheduleLayout);
    timeoutId = window.setTimeout(scheduleLayout, 0);
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(layoutFrameId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", scheduleLayout);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (gl.canvas.parentElement === container)
        container.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      programRef.current = null;
    };
  }, []);

  return <div className="leaderboard-table-effects" ref={containerRef} />;
}
