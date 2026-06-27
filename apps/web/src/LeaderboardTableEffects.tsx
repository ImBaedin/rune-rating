import {
  Geometry,
  Mesh,
  type OGLRenderingContext,
  Program,
  Renderer,
  Triangle,
} from "ogl";
import { useEffect, useRef } from "react";
import type {
  LeaderboardFeaturedRank,
  LeaderboardParticleSettings,
} from "./LeaderboardRowEffectSettings";

const maxFps = 45;
const maxParticles = 1440;
const maxParticleColors = 6;
const maxBeamColors = 6;
const gold: Rgb = [235, 168, 61];
const silver: Rgb = [199, 214, 214];
const bronze: Rgb = [194, 107, 51];
const fallbackTier: Rgb = [158, 240, 235];
const defaultParticleColor: Rgb = [245, 212, 138];
const defaultBeamColor: Rgb = [89, 230, 230];

type RangeValue = readonly [number, number];
type Rgb = readonly [number, number, number];

type Particle = {
  seed: number;
  side: number;
  speed: number;
  offset: number;
  wander: number;
  travel: number;
  startNear: number;
  startFar: number;
  yRatio: number;
  size: number;
  kind: number;
  color: Rgb;
  opacity: number;
  twinkleSpeed: number;
};

type NormalizedSettings = {
  particleOpacity: RangeValue;
  particleCount: number;
  particleColors: Rgb[];
  particleTravelDistance: RangeValue;
  particleMoveSpeed: RangeValue;
  particleSize: RangeValue;
  particleWander: RangeValue;
  beamFalloffDistance: number;
  beamColors: Rgb[];
  beamIntensity: number;
  beamWaveWidth: number;
  beamWaveFrequency: number;
};

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const beamFragmentShader = `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uSeed;
uniform vec3 uRankColor;
uniform vec3 uTierColor;
uniform float uBeamFalloffDistance;
uniform float uBeamIntensity;
uniform float uBeamWaveWidth;
uniform float uBeamWaveFrequency;
uniform float uBeamColorCount;
uniform vec3 uBeamColor0;
uniform vec3 uBeamColor1;
uniform vec3 uBeamColor2;
uniform vec3 uBeamColor3;
uniform vec3 uBeamColor4;
uniform vec3 uBeamColor5;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec3 colorSlot(float slot, vec3 color0, vec3 color1, vec3 color2, vec3 color3, vec3 color4, vec3 color5) {
  if (slot < 0.5) return color0;
  if (slot < 1.5) return color1;
  if (slot < 2.5) return color2;
  if (slot < 3.5) return color3;
  if (slot < 4.5) return color4;
  return color5;
}

vec3 beamPalette(float seed) {
  float count = max(uBeamColorCount, 1.0);
  float slot = floor(hash11(seed) * count);
  return colorSlot(slot, uBeamColor0, uBeamColor1, uBeamColor2, uBeamColor3, uBeamColor4, uBeamColor5);
}

void main() {
  vec2 p = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);
  float localX = clamp(p.x / max(uResolution.x, 1.0), 0.0, 1.0);
  float localY = clamp(p.y / max(uResolution.y, 1.0), 0.0, 1.0);
  float verticalSoft = smoothstep(0.0, 0.1, localY) *
    (1.0 - smoothstep(0.9, 1.0, localY));

  float beamWaveLeft =
    sin(localY * uBeamWaveFrequency + uTime * 0.42 + uSeed * 1.7) * uBeamWaveWidth +
    sin(localY * uBeamWaveFrequency * 1.83 - uTime * 0.27 + uSeed * 2.9) * uBeamWaveWidth * 0.42;
  float beamWaveRight =
    sin(localY * uBeamWaveFrequency * 1.16 - uTime * 0.38 + uSeed * 2.2) * uBeamWaveWidth +
    sin(localY * uBeamWaveFrequency * 2.07 + uTime * 0.22 + uSeed * 3.4) * uBeamWaveWidth * 0.36;
  float leftFalloff = clamp(uBeamFalloffDistance + beamWaveLeft, 0.02, 0.72);
  float rightFalloff = clamp(uBeamFalloffDistance + beamWaveRight, 0.02, 0.72);
  float leftBeam = pow(1.0 - smoothstep(0.0, leftFalloff, localX), 1.08);
  float rightBeam = pow(smoothstep(1.0 - rightFalloff, 1.0, localX), 1.08);
  vec3 leftBeamColor = mix(beamPalette(uSeed * 11.0 + 0.3), uRankColor, 0.28);
  vec3 rightBeamColor = mix(beamPalette(uSeed * 11.0 + 2.7), uTierColor, 0.22);
  float beamAlpha = clamp(leftBeam + rightBeam, 0.0, 1.0) *
    uBeamIntensity * verticalSoft;

  vec3 color = (leftBeamColor * leftBeam + rightBeamColor * rightBeam) *
    beamAlpha * 1.35;
  gl_FragColor = vec4(color, clamp(beamAlpha, 0.0, 0.95));
}
`;

const particleVertexShader = `
attribute vec2 position;
attribute float aSeed;
attribute float aSide;
attribute float aSpeed;
attribute float aOffset;
attribute float aWander;
attribute float aTravel;
attribute float aStartNear;
attribute float aStartFar;
attribute float aYRatio;
attribute float aSize;
attribute float aKind;
attribute vec3 aColor;
attribute float aOpacity;
attribute float aTwinkleSpeed;

uniform vec2 uResolution;
uniform float uTime;

varying vec2 vLocal;
varying float vKind;
varying vec3 vColor;
varying float vAlpha;

float smoothLife(float edge0, float edge1, float value) {
  float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  float duration = 7.2 / max(0.05, aSpeed);
  float t = fract(uTime / duration + aOffset);
  float startX = mix(
    mix(-10.0, 24.0, aStartNear),
    mix(uResolution.x + 10.0, uResolution.x - 24.0, aStartFar),
    aSide
  );
  float targetX = mix(
    startX + uResolution.x * aTravel,
    startX - uResolution.x * aTravel,
    aSide
  );
  float x = mix(startX, targetX, t);
  float y = uResolution.y * aYRatio +
    sin(t * 6.28318 + aSeed) * uResolution.y * aWander;
  float life = smoothLife(0.0, 0.08, t) * (1.0 - smoothLife(0.32, 0.64, t));
  float twinkle = 0.9 + 0.1 * sin(uTime * aTwinkleSpeed + aSeed);
  vec2 pixelPosition = vec2(x, y) + position * aSize * 2.4;
  vec2 clipPosition = vec2(
    pixelPosition.x / max(uResolution.x, 1.0) * 2.0 - 1.0,
    1.0 - pixelPosition.y / max(uResolution.y, 1.0) * 2.0
  );

  vLocal = position;
  vKind = aKind;
  vColor = aColor;
  vAlpha = aOpacity * life * twinkle;
  gl_Position = vec4(clipPosition, 0.0, 1.0);
}
`;

const particleFragmentShader = `
precision highp float;

varying vec2 vLocal;
varying float vKind;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 q = abs(vLocal);
  float shape = 0.0;
  if (vKind < 0.28) {
    shape = 1.0 - smoothstep(0.5, 0.68, length(vLocal));
  } else if (vKind < 0.56) {
    shape = 1.0 - smoothstep(0.56, 0.72, max(q.x, q.y));
  } else if (vKind < 0.82) {
    shape = 1.0 - smoothstep(0.68, 0.92, q.x + q.y);
  } else {
    float horizontal = (1.0 - smoothstep(0.58, 0.72, q.x)) *
      (1.0 - smoothstep(0.08, 0.18, q.y));
    float vertical = (1.0 - smoothstep(0.58, 0.72, q.y)) *
      (1.0 - smoothstep(0.08, 0.18, q.x));
    shape = max(horizontal, vertical) * 0.75;
  }

  float alpha = shape * vAlpha;
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hash(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pick<T>(values: readonly T[], seed: number, fallback: T) {
  return values[Math.floor(hash(seed) * values.length)] ?? fallback;
}

function mix(low: number, high: number, amount: number) {
  return low + (high - low) * amount;
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallbackTier;
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toUnitRgb(color: Rgb) {
  return new Float32Array([color[0] / 255, color[1] / 255, color[2] / 255]);
}

function rankColor(rank: LeaderboardFeaturedRank) {
  if (rank === 1) return gold;
  if (rank === 2) return silver;
  return bronze;
}

function normalizedRange(
  range: RangeValue,
  min: number,
  max: number,
): RangeValue {
  const low = clamp(range[0], min, max);
  const high = clamp(range[1], min, max);
  return low <= high ? [low, high] : [high, low];
}

function normalizedColors(
  colors: readonly string[],
  maxColors: number,
  fallback: Rgb,
) {
  const parsed: Rgb[] = [];
  for (const color of colors) {
    const rgb = hexToRgb(color);
    if (rgb === fallbackTier) continue;
    parsed.push(rgb);
    if (parsed.length === maxColors) break;
  }

  return parsed.length > 0 ? parsed : [fallback];
}

function normalizeSettings(
  settings: LeaderboardParticleSettings,
): NormalizedSettings {
  return {
    particleOpacity: normalizedRange(settings.particleOpacity, 0, 1),
    particleCount: clamp(
      Math.round(settings.particleSpawnRate),
      0,
      maxParticles,
    ),
    particleColors: normalizedColors(
      settings.particleColors,
      maxParticleColors,
      defaultParticleColor,
    ),
    particleTravelDistance: normalizedRange(
      settings.particleTravelDistance,
      0,
      0.5,
    ),
    particleMoveSpeed: normalizedRange(settings.particleMoveSpeed, 0.05, 4),
    particleSize: normalizedRange(settings.particleSize, 0.1, 16),
    particleWander: normalizedRange(settings.particleWander, 0, 0.5),
    beamFalloffDistance: clamp(settings.beamFalloffDistance, 0.02, 0.72),
    beamColors: normalizedColors(
      settings.beamColors,
      maxBeamColors,
      defaultBeamColor,
    ),
    beamIntensity: clamp(settings.beamIntensity, 0, 4),
    beamWaveWidth: clamp(settings.beamWaveWidth, 0, 0.3),
    beamWaveFrequency: clamp(settings.beamWaveFrequency, 0.1, 40),
  };
}

function beamUniformName(colorIndex: number) {
  return `uBeamColor${colorIndex}`;
}

function createBeamUniforms(
  rank: LeaderboardFeaturedRank,
  settings: NormalizedSettings,
  tierColor: Rgb,
) {
  const uniforms: Record<string, { value: unknown }> = {
    uResolution: { value: new Float32Array([1, 1]) },
    uTime: { value: 0 },
    uSeed: { value: rank },
    uRankColor: { value: toUnitRgb(rankColor(rank)) },
    uTierColor: { value: toUnitRgb(tierColor) },
    uBeamFalloffDistance: { value: settings.beamFalloffDistance },
    uBeamIntensity: { value: settings.beamIntensity },
    uBeamWaveWidth: { value: settings.beamWaveWidth },
    uBeamWaveFrequency: { value: settings.beamWaveFrequency },
    uBeamColorCount: { value: settings.beamColors.length },
  };

  const fallbackColor = settings.beamColors[0] ?? defaultBeamColor;
  for (let colorIndex = 0; colorIndex < maxBeamColors; colorIndex += 1) {
    uniforms[beamUniformName(colorIndex)] = {
      value: toUnitRgb(settings.beamColors[colorIndex] ?? fallbackColor),
    };
  }

  return uniforms;
}

function createParticles(
  rank: LeaderboardFeaturedRank,
  settings: NormalizedSettings,
) {
  const particles: Particle[] = [];
  for (let index = 0; index < settings.particleCount; index += 1) {
    const seed = rank * 71 + index * 5.37;
    particles.push({
      seed,
      side: hash(seed + 1) >= 0.47 ? 1 : 0,
      speed: mix(
        settings.particleMoveSpeed[0],
        settings.particleMoveSpeed[1],
        hash(seed + 2),
      ),
      offset: hash(seed + 3),
      wander: mix(
        settings.particleWander[0],
        settings.particleWander[1],
        hash(seed + 4),
      ),
      travel: mix(
        settings.particleTravelDistance[0],
        settings.particleTravelDistance[1],
        hash(seed + 7),
      ),
      startNear: hash(seed + 5),
      startFar: hash(seed + 6),
      yRatio: mix(0.18, 0.82, hash(seed + 8)),
      size: mix(
        settings.particleSize[0],
        settings.particleSize[1],
        hash(seed + 9) ** 1.55,
      ),
      kind: hash(seed + 10),
      color: pick(settings.particleColors, seed + 12, defaultParticleColor),
      opacity: mix(
        settings.particleOpacity[0],
        settings.particleOpacity[1],
        hash(seed + 13),
      ),
      twinkleSpeed: mix(1.4, 4, hash(seed + 11)),
    });
  }

  return particles;
}

function instancedParticleAttribute(values: readonly number[]) {
  return {
    data: new Float32Array(values),
    size: 1,
    instanced: 1,
  };
}

function createParticleGeometry(
  gl: OGLRenderingContext,
  particles: readonly Particle[],
) {
  const colors = new Float32Array(particles.length * 3);
  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    if (!particle) continue;
    colors[index * 3] = particle.color[0] / 255;
    colors[index * 3 + 1] = particle.color[1] / 255;
    colors[index * 3 + 2] = particle.color[2] / 255;
  }

  return new Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    },
    aSeed: instancedParticleAttribute(
      particles.map((particle) => particle.seed),
    ),
    aSide: instancedParticleAttribute(
      particles.map((particle) => particle.side),
    ),
    aSpeed: instancedParticleAttribute(
      particles.map((particle) => particle.speed),
    ),
    aOffset: instancedParticleAttribute(
      particles.map((particle) => particle.offset),
    ),
    aWander: instancedParticleAttribute(
      particles.map((particle) => particle.wander),
    ),
    aTravel: instancedParticleAttribute(
      particles.map((particle) => particle.travel),
    ),
    aStartNear: instancedParticleAttribute(
      particles.map((particle) => particle.startNear),
    ),
    aStartFar: instancedParticleAttribute(
      particles.map((particle) => particle.startFar),
    ),
    aYRatio: instancedParticleAttribute(
      particles.map((particle) => particle.yRatio),
    ),
    aSize: instancedParticleAttribute(
      particles.map((particle) => particle.size),
    ),
    aKind: instancedParticleAttribute(
      particles.map((particle) => particle.kind),
    ),
    aColor: {
      data: colors,
      size: 3,
      instanced: 1,
    },
    aOpacity: instancedParticleAttribute(
      particles.map((particle) => particle.opacity),
    ),
    aTwinkleSpeed: instancedParticleAttribute(
      particles.map((particle) => particle.twinkleSpeed),
    ),
  });
}

type LeaderboardRowEffectProps = {
  rank: LeaderboardFeaturedRank;
  settings: LeaderboardParticleSettings;
  tierColor: string;
};

export function LeaderboardRowEffect({
  rank,
  settings,
  tierColor,
}: LeaderboardRowEffectProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const row = anchor?.closest("tr");
    const table = row?.closest("table");
    const wrapper = anchor?.closest<HTMLElement>(".leaderboard-table-wrap");
    if (!anchor || !row || !table || !wrapper) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const normalizedSettings = normalizeSettings(settings);
    const parsedTierColor = hexToRgb(tierColor);
    const particles = createParticles(rank, normalizedSettings);
    const container = document.createElement("div");

    container.className = "leaderboard-row-effect";
    wrapper.appendChild(container);

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
      fragment: beamFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
      uniforms: createBeamUniforms(rank, normalizedSettings, parsedTierColor),
    });
    const mesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program,
    });
    const particleProgram = new Program(gl, {
      vertex: particleVertexShader,
      fragment: particleFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
      uniforms: {
        uResolution: { value: new Float32Array([1, 1]) },
        uTime: { value: 0 },
      },
    });
    const particleMesh = new Mesh(gl, {
      geometry: createParticleGeometry(gl, particles),
      program: particleProgram,
    });

    gl.canvas.className = "leaderboard-row-effect-canvas";
    container.appendChild(gl.canvas);

    let cssWidth = 1;
    let cssHeight = 1;
    let rafId = 0;
    let resizeFrameId = 0;
    let lastFrameAt = 0;
    let isVisible = true;

    const updateSize = () => {
      resizeFrameId = 0;
      const rowRect = row.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      cssWidth = Math.max(1, Math.round(table.offsetWidth));
      cssHeight = Math.max(1, Math.round(rowRect.height));

      container.style.left = "0px";
      container.style.top = `${Math.round(
        rowRect.top - wrapperRect.top + wrapper.scrollTop,
      )}px`;
      container.style.width = `${cssWidth}px`;
      container.style.height = `${cssHeight}px`;

      renderer.setSize(cssWidth, cssHeight);
      const resolution = program.uniforms.uResolution.value as Float32Array;
      resolution[0] = gl.canvas.width;
      resolution[1] = gl.canvas.height;
      const particleResolution = particleProgram.uniforms.uResolution
        .value as Float32Array;
      particleResolution[0] = gl.canvas.width;
      particleResolution[1] = gl.canvas.height;
    };

    const scheduleSize = () => {
      if (resizeFrameId) return;
      resizeFrameId = requestAnimationFrame(updateSize);
    };

    const render = (time: number) => {
      if (!isVisible) {
        rafId = 0;
        return;
      }

      const minFrameMs = 1000 / maxFps;
      if (time - lastFrameAt >= minFrameMs) {
        const seconds = time * 0.001;
        program.uniforms.uTime.value = seconds;
        particleProgram.uniforms.uTime.value = seconds;
        renderer.render({ scene: mesh });
        renderer.render({ scene: particleMesh, clear: false });
        lastFrameAt = time;
      }
      rafId = requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (rafId || !isVisible) return;
      rafId = requestAnimationFrame(render);
    };

    const stopRendering = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const resizeObserver = new ResizeObserver(scheduleSize);
    resizeObserver.observe(row);
    resizeObserver.observe(table);

    const intersectionObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            isVisible = entries.some((entry) => entry.isIntersecting);
            if (isVisible) {
              scheduleSize();
              startRendering();
            } else {
              stopRendering();
            }
          })
        : null;
    intersectionObserver?.observe(row);

    wrapper.addEventListener("scroll", scheduleSize, { passive: true });
    window.addEventListener("resize", scheduleSize);
    updateSize();
    renderer.render({ scene: mesh });
    renderer.render({ scene: particleMesh, clear: false });
    startRendering();

    return () => {
      stopRendering();
      cancelAnimationFrame(resizeFrameId);
      wrapper.removeEventListener("scroll", scheduleSize);
      window.removeEventListener("resize", scheduleSize);
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      if (container.parentElement === wrapper) {
        wrapper.removeChild(container);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [rank, settings, tierColor]);

  return <span className="leaderboard-row-effect-anchor" ref={anchorRef} />;
}
