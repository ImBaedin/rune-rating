type RangeValue = readonly [number, number];

export type LeaderboardFeaturedRank = 1 | 2 | 3;

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
    particleOpacity: [0.12, 0.52],
    particleSpawnRate: 72,
    particleColors: ["var(--amber)", "var(--muted)", "var(--ink)"],
    particleTravelDistance: [0.12, 0.42],
    particleMoveSpeed: [0.16, 0.72],
    particleSize: [0.7, 2.6],
    particleWander: [0.02, 0.12],
    beamFalloffDistance: 0.36,
    beamColors: ["var(--amber)"],
    beamIntensity: 0.34,
    beamWaveWidth: 0.045,
    beamWaveFrequency: 3.2,
  };

export const secondPlaceLeaderboardEffectSettings: LeaderboardParticleSettings =
  {
    ...firstPlaceLeaderboardEffectSettings,
    beamIntensity: 0.26,
    beamColors: ["var(--chart-tier-medium)"],
  };

export const thirdPlaceLeaderboardEffectSettings: LeaderboardParticleSettings =
  {
    ...firstPlaceLeaderboardEffectSettings,
    beamIntensity: 0.22,
    beamColors: ["var(--chart-tier-easy)"],
  };

export const leaderboardRowEffectSettings = [
  firstPlaceLeaderboardEffectSettings,
  secondPlaceLeaderboardEffectSettings,
  thirdPlaceLeaderboardEffectSettings,
] as const;

export function leaderboardEffectSettingsForRank(
  rank: LeaderboardFeaturedRank,
) {
  return (
    leaderboardRowEffectSettings[rank - 1] ??
    firstPlaceLeaderboardEffectSettings
  );
}
