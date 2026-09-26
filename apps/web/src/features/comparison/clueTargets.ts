export function clueRankTarget(currentRank: number | null, threshold: number) {
  if (currentRank === null || currentRank <= threshold) return null;
  return { currentRank, threshold, toPass: currentRank - threshold };
}
