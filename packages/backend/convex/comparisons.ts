import {
  type CanonicalActivity,
  type CanonicalSkill,
  compareNumbers,
  compareRanks,
} from "@rune-rating/domain";
import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { categorySnapshotKey } from "./lib/keys";
import { findPlayerByRsn } from "./lib/players";
import {
  activityComparisonValidator,
  efficiencyComparisonValidator,
  skillComparisonValidator,
} from "./validators";

const playerHeaderValidator = v.object({
  normalizedRsn: v.string(),
  displayRsn: v.string(),
  fetchedAt: v.number(),
});

function accountTypeLabel(
  player: { accountTypeName?: string; accountTypeKey?: string },
  fallback: string,
) {
  return player.accountTypeName ?? player.accountTypeKey ?? fallback;
}

export const getSkills = query({
  args: { leftRsn: v.string(), rightRsn: v.string() },
  returns: v.union(
    v.object({
      left: playerHeaderValidator,
      right: playerHeaderValidator,
      skills: v.array(skillComparisonValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [leftPlayer, rightPlayer] = await Promise.all([
      findPlayerByRsn(ctx, args.leftRsn),
      findPlayerByRsn(ctx, args.rightRsn),
    ]);
    if (!leftPlayer || !rightPlayer) return null;

    const [leftSnapshot, rightSnapshot] = await Promise.all(
      [leftPlayer, rightPlayer].map((player) =>
        ctx.db
          .query("categorySnapshots")
          .withIndex("by_key", (index) =>
            index.eq("key", categorySnapshotKey(player._id, "skills", "all")),
          )
          .unique(),
      ),
    );
    if (
      leftSnapshot?.data.type !== "skills" ||
      rightSnapshot?.data.type !== "skills"
    ) {
      return null;
    }

    const rightByKey = new Map<string, CanonicalSkill>(
      rightSnapshot.data.values.map((skill: CanonicalSkill) => [
        skill.key,
        skill,
      ]),
    );
    const skills = leftSnapshot.data.values.map((leftSkill: CanonicalSkill) => {
      const rightSkill = rightByKey.get(leftSkill.key);
      return {
        key: leftSkill.key,
        name: leftSkill.name,
        level: compareNumbers(
          leftSkill.level.value,
          rightSkill?.level.value ?? null,
        ),
        xp: compareNumbers(leftSkill.xp.value, rightSkill?.xp.value ?? null),
        rank: compareRanks(
          leftSkill.rank.value,
          rightSkill?.rank.value ?? null,
        ),
      };
    });

    return {
      left: {
        normalizedRsn: leftPlayer.normalizedRsn,
        displayRsn: leftPlayer.displayRsn,
        fetchedAt: leftSnapshot.fetchedAt,
      },
      right: {
        normalizedRsn: rightPlayer.normalizedRsn,
        displayRsn: rightPlayer.displayRsn,
        fetchedAt: rightSnapshot.fetchedAt,
      },
      skills,
    };
  },
});

export const getActivities = query({
  args: { leftRsn: v.string(), rightRsn: v.string() },
  returns: v.union(
    v.object({
      left: playerHeaderValidator,
      right: playerHeaderValidator,
      activities: v.array(activityComparisonValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [leftPlayer, rightPlayer] = await Promise.all([
      findPlayerByRsn(ctx, args.leftRsn),
      findPlayerByRsn(ctx, args.rightRsn),
    ]);
    if (!leftPlayer || !rightPlayer) return null;

    const [leftSnapshot, rightSnapshot] = await Promise.all(
      [leftPlayer, rightPlayer].map((player) =>
        ctx.db
          .query("categorySnapshots")
          .withIndex("by_key", (index) =>
            index.eq(
              "key",
              categorySnapshotKey(player._id, "activities", "all"),
            ),
          )
          .unique(),
      ),
    );
    if (
      leftSnapshot?.data.type !== "activities" ||
      rightSnapshot?.data.type !== "activities"
    ) {
      return null;
    }

    const rightByKey = new Map<string, CanonicalActivity>(
      rightSnapshot.data.values.map((activity: CanonicalActivity) => [
        activity.key,
        activity,
      ]),
    );
    const activities = leftSnapshot.data.values.map(
      (leftActivity: CanonicalActivity) => {
        const rightActivity = rightByKey.get(leftActivity.key);
        return {
          key: leftActivity.key,
          name: leftActivity.name,
          category: leftActivity.category,
          score: compareNumbers(
            leftActivity.score.value,
            rightActivity?.score.value ?? null,
          ),
          rank: compareRanks(
            leftActivity.rank.value,
            rightActivity?.rank.value ?? null,
          ),
        };
      },
    );

    return {
      left: {
        normalizedRsn: leftPlayer.normalizedRsn,
        displayRsn: leftPlayer.displayRsn,
        fetchedAt: leftSnapshot.fetchedAt,
      },
      right: {
        normalizedRsn: rightPlayer.normalizedRsn,
        displayRsn: rightPlayer.displayRsn,
        fetchedAt: rightSnapshot.fetchedAt,
      },
      activities,
    };
  },
});

export const getEfficiency = query({
  args: { leftRsn: v.string(), rightRsn: v.string() },
  returns: v.union(
    v.object({
      left: playerHeaderValidator,
      right: playerHeaderValidator,
      accountTypes: v.object({ left: v.string(), right: v.string() }),
      efficiency: efficiencyComparisonValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [leftPlayer, rightPlayer] = await Promise.all([
      findPlayerByRsn(ctx, args.leftRsn),
      findPlayerByRsn(ctx, args.rightRsn),
    ]);
    if (!leftPlayer || !rightPlayer) return null;

    const [leftSnapshot, rightSnapshot] = await Promise.all(
      [leftPlayer, rightPlayer].map((player) =>
        ctx.db
          .query("categorySnapshots")
          .withIndex("by_key", (index) =>
            index.eq(
              "key",
              categorySnapshotKey(player._id, "efficiency", "all"),
            ),
          )
          .unique(),
      ),
    );
    if (
      leftSnapshot?.data.type !== "efficiency" ||
      rightSnapshot?.data.type !== "efficiency"
    ) {
      return null;
    }

    return {
      left: {
        normalizedRsn: leftPlayer.normalizedRsn,
        displayRsn: leftPlayer.displayRsn,
        fetchedAt: leftSnapshot.fetchedAt,
      },
      right: {
        normalizedRsn: rightPlayer.normalizedRsn,
        displayRsn: rightPlayer.displayRsn,
        fetchedAt: rightSnapshot.fetchedAt,
      },
      accountTypes: {
        left: accountTypeLabel(leftPlayer, leftSnapshot.data.accountType),
        right: accountTypeLabel(rightPlayer, rightSnapshot.data.accountType),
      },
      efficiency: {
        combatLevel: compareNumbers(
          leftSnapshot.data.combatLevel,
          rightSnapshot.data.combatLevel,
        ),
        ehp: compareNumbers(leftSnapshot.data.ehp, rightSnapshot.data.ehp),
        ehb: compareNumbers(leftSnapshot.data.ehb, rightSnapshot.data.ehb),
        timeToMax: compareRanks(
          leftSnapshot.data.timeToMax,
          rightSnapshot.data.timeToMax,
        ),
        timeTo200m: compareRanks(
          leftSnapshot.data.timeTo200m,
          rightSnapshot.data.timeTo200m,
        ),
      },
    };
  },
});
