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
    particleOpacity: [0.2, 0.8],
    particleSpawnRate: 150,
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

export function leaderboardEffectSettingsForRank(
  rank: LeaderboardFeaturedRank,
) {
  return (
    leaderboardRowEffectSettings[rank - 1] ??
    firstPlaceLeaderboardEffectSettings
  );
}
