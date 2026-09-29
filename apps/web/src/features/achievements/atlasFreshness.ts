import { rsnLookupKey } from "@rune-rating/domain";
import type { PlayerProfile } from "../comparison/context";
import { automaticRefreshKey } from "../comparison/sourceState";

// Consume both reasons together: rebuilding an atlas also requests any eligible
// provider refresh, so its completion must not immediately request another one.
export function atlasRefreshKeys(
  rsn: string,
  profile: PlayerProfile | undefined,
  progress: { version: string; needsRebuild: boolean } | undefined,
  now: number,
  usedKeys: ReadonlySet<string>,
): string[] {
  if (profile === undefined || progress === undefined) return [];
  const keys: string[] = [];
  if (progress.needsRebuild) {
    const key = `${rsnLookupKey(rsn)}:atlas:${progress.version}`;
    if (!usedKeys.has(key)) keys.push(key);
  }
  const refreshKey = automaticRefreshKey(rsn, profile, now, usedKeys);
  if (refreshKey !== null) keys.push(refreshKey);
  return keys;
}
