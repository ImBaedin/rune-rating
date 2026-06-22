import { normalizeRsn, rsnLookupKey } from "@rune-rating/domain";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";

type ReadCtx = QueryCtx | MutationCtx;

export async function findPlayerByRsn(ctx: ReadCtx, rsn: string) {
  const normalizedRsn = rsnLookupKey(rsn);
  return await ctx.db
    .query("players")
    .withIndex("by_normalized_rsn", (query) =>
      query.eq("normalizedRsn", normalizedRsn),
    )
    .unique();
}

export async function getOrCreatePlayer(
  ctx: MutationCtx,
  rsn: string,
  now: number,
) {
  const displayRsn = normalizeRsn(rsn);
  const normalizedRsn = rsnLookupKey(displayRsn);
  const existing = await ctx.db
    .query("players")
    .withIndex("by_normalized_rsn", (query) =>
      query.eq("normalizedRsn", normalizedRsn),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, { displayRsn, lastRequestedAt: now });
    return { ...existing, displayRsn, lastRequestedAt: now };
  }

  const playerId = await ctx.db.insert("players", {
    normalizedRsn,
    displayRsn,
    createdAt: now,
    lastRequestedAt: now,
    lastSnapshotAt: null,
    refreshAllowedAt: 0,
  });

  const player = await ctx.db.get(playerId);
  if (!player) throw new Error("Failed to create player.");
  return player;
}
