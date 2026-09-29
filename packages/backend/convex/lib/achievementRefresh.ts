import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { enqueueProviderJob } from "../providerQueueScheduling";
import { achievementCache, queueAchievementUpdate } from "./achievements";
import { getRefreshCooldownMs } from "./config";
import { categorySnapshotKey, snapshotStateKey } from "./keys";

export async function finishAchievementRefresh(
  ctx: MutationCtx,
  playerId: Id<"players">,
) {
  if (!(await achievementCache(ctx, playerId))) return;
  const lease = await ctx.db
    .query("refreshLeases")
    .withIndex("by_player", (q) => q.eq("playerId", playerId))
    .unique();
  // Lease expiry permits a new request; it does not mean in-flight commits are done.
  if (lease) return;
  const profile = await ctx.db
    .query("snapshotStates")
    .withIndex("by_key", (q) =>
      q.eq("key", snapshotStateKey(playerId, "runeProfile", "quests")),
    )
    .unique();
  if (profile?.status === "fresh") {
    const detail = await ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (q) =>
        q.eq("key", categorySnapshotKey(playerId, "collection", "detail")),
      )
      .unique();
    const cooldownMs = await getRefreshCooldownMs(ctx);
    if (!detail || Date.now() - detail.fetchedAt >= cooldownMs) {
      const player = await ctx.db.get(playerId);
      if (player)
        await enqueueProviderJob(ctx, {
          operation: "runeProfileCollectionDetail",
          jobArgs: {
            type: "runeProfileCollectionDetail",
            rsn: player.displayRsn,
          },
        });
    }
  }
  await queueAchievementUpdate(ctx, playerId);
}
