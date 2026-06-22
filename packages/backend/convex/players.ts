import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { snapshotStateKey } from "./lib/keys";
import { findPlayerByRsn } from "./lib/players";
import { snapshotStateViewValidator } from "./validators";

const profileValidator = v.object({
  normalizedRsn: v.string(),
  displayRsn: v.string(),
  lastSnapshotAt: v.union(v.number(), v.null()),
  snapshotStaleAt: v.union(v.number(), v.null()),
  refreshAllowedAt: v.number(),
  skillsState: v.union(snapshotStateViewValidator, v.null()),
  activitiesState: v.union(snapshotStateViewValidator, v.null()),
  efficiencyState: v.union(snapshotStateViewValidator, v.null()),
  questsState: v.union(snapshotStateViewValidator, v.null()),
  diariesState: v.union(snapshotStateViewValidator, v.null()),
  combatAchievementsState: v.union(snapshotStateViewValidator, v.null()),
  collectionState: v.union(snapshotStateViewValidator, v.null()),
});

const SNAPSHOT_STALE_MS = 60 * 60 * 1_000;

export const getProfile = query({
  args: { rsn: v.string() },
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx, args) => {
    const player = await findPlayerByRsn(ctx, args.rsn);
    if (!player) return null;

    const [
      skillsState,
      activitiesState,
      efficiencyState,
      questsState,
      diariesState,
      combatAchievementsState,
      collectionState,
    ] = await Promise.all([
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq("key", snapshotStateKey(player._id, "hiscores", "skills")),
        )
        .unique(),
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(player._id, "hiscores", "activities"),
          ),
        )
        .unique(),
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(player._id, "wiseOldMan", "efficiency"),
          ),
        )
        .unique(),
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(player._id, "runeProfile", "quests"),
          ),
        )
        .unique(),
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(player._id, "runeProfile", "diaries"),
          ),
        )
        .unique(),
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(player._id, "runeProfile", "combatAchievements"),
          ),
        )
        .unique(),
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(player._id, "runeProfile", "collection"),
          ),
        )
        .unique(),
    ]);

    const toView = (state: typeof skillsState) =>
      state
        ? {
            status: state.status,
            lastAttemptAt: state.lastAttemptAt,
            lastSuccessAt: state.lastSuccessAt,
            errorCode: state.errorCode,
          }
        : null;

    return {
      normalizedRsn: player.normalizedRsn,
      displayRsn: player.displayRsn,
      lastSnapshotAt: player.lastSnapshotAt,
      snapshotStaleAt:
        player.lastSnapshotAt === null
          ? null
          : player.lastSnapshotAt + SNAPSHOT_STALE_MS,
      refreshAllowedAt: player.refreshAllowedAt,
      skillsState: toView(skillsState),
      activitiesState: toView(activitiesState),
      efficiencyState: toView(efficiencyState),
      questsState: toView(questsState),
      diariesState: toView(diariesState),
      combatAchievementsState: toView(combatAchievementsState),
      collectionState: toView(collectionState),
    };
  },
});
