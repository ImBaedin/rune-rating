/** A missing side is unknown, never a zero or a tie. */
export function compareTimelineValues(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  if (left == null || right == null) return null;
  return {
    delta: left - right,
    maximum: Math.max(left, right),
    leader:
      left === right
        ? null
        : left > right
          ? ("left" as const)
          : ("right" as const),
  };
}
