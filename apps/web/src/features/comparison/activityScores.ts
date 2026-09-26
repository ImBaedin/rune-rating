/** A total is known only when every contributing score is known. */
export function knownTotal(values: (number | null)[]): number | null {
  if (values.length === 0 || values.some((value) => value === null))
    return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function scoreDifference(left: number | null, right: number | null) {
  return left === null || right === null ? null : left - right;
}

export function scoreLeader(delta: number | null) {
  return delta === null
    ? "indeterminate"
    : delta === 0
      ? "tie"
      : delta > 0
        ? "left"
        : "right";
}

export function scoreLeadDetail(
  delta: number | null,
  names: [string, string],
  tieLabel = "Scores are tied",
) {
  if (delta === null)
    return "Complete scores unavailable for one or both players";
  if (delta === 0) return tieLabel;
  return `${delta > 0 ? names[0] : names[1]} ahead`;
}
