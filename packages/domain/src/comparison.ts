import type { NumericComparison } from "./models";

export function compareNumbers(
  left: number | null,
  right: number | null,
): NumericComparison {
  if (left === null || right === null) {
    return { left, right, delta: null, leader: "indeterminate" };
  }

  return {
    left,
    right,
    delta: left - right,
    leader: left === right ? "tie" : left > right ? "left" : "right",
  };
}

export function compareRanks(
  left: number | null,
  right: number | null,
): NumericComparison {
  const comparison = compareNumbers(left, right);
  if (comparison.leader === "left") return { ...comparison, leader: "right" };
  if (comparison.leader === "right") return { ...comparison, leader: "left" };
  return comparison;
}
