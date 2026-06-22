import type { Id } from "../_generated/dataModel.js";

export function snapshotStateKey(
  playerId: Id<"players">,
  source: string,
  category: string,
): string {
  return `${playerId}:${source}:${category}`;
}

export function categorySnapshotKey(
  playerId: Id<"players">,
  category: string,
  segment: string,
): string {
  return `${playerId}:${category}:${segment}`;
}
