import { rsnLookupKey } from "@rune-rating/domain";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import {
  internalMutation,
  type MutationCtx,
  mutation,
} from "./_generated/server.js";
import { analyticsDistinctIdForRsn } from "./lib/analytics";
import { getRefreshCooldownMs } from "./lib/config";
import { categorySnapshotKey, snapshotStateKey } from "./lib/keys";
import { getOrCreatePlayer } from "./lib/players";
import { REFRESH_LEASE_MS } from "./policies/refresh";
import {
  canonicalActivityValidator,
  canonicalSkillValidator,
  snapshotStatusValidator,
} from "./validators";

const requestResultValidator = v.object({
  normalizedRsn: v.string(),
  status: v.union(
    v.literal("scheduled"),
    v.literal("cooldown"),
    v.literal("alreadyScheduled"),
  ),
  refreshAllowedAt: v.number(),
});

const hiscoresCategories = ["skills", "activities"] as const;
const refreshCategories = [
  { source: "hiscores" as const, category: "skills" as const },
  { source: "hiscores" as const, category: "activities" as const },
  { source: "wiseOldMan" as const, category: "efficiency" as const },
  { source: "runeProfile" as const, category: "quests" as const },
  { source: "runeProfile" as const, category: "diaries" as const },
  {
    source: "runeProfile" as const,
    category: "combatAchievements" as const,
  },
  { source: "runeProfile" as const, category: "collection" as const },
];

const runeProfileCategories = [
  "quests",
  "diaries",
  "combatAchievements",
  "collection",
] as const;

function hasInvalidResponseFailure(
  states: Array<{ status: string; errorCode: string | null } | null>,
) {
  return states.some(
    (state) =>
      state?.status === "failed" &&
      (state.errorCode === "invalidResponse" ||
        state.errorCode === "granularInvalid"),
  );
}

async function finalizeRefreshIfTerminal(
  ctx: MutationCtx,
  playerId: Parameters<typeof snapshotStateKey>[0],
  requestId: string,
  now: number,
) {
  const states = await Promise.all(
    refreshCategories.slice(2).map(({ source, category }) =>
      ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq("key", snapshotStateKey(playerId, source, category)),
        )
        .unique(),
    ),
  );
  const isTerminal = states.every(
    (state) =>
      state?.requestId === requestId &&
      state.status !== "scheduled" &&
      state.status !== "refreshing",
  );
  if (!isTerminal) return false;

  const lease = await ctx.db
    .query("refreshLeases")
    .withIndex("by_player", (index) => index.eq("playerId", playerId))
    .unique();
  if (!lease || lease.requestId !== requestId) return false;

  const cooldownMs = await getRefreshCooldownMs(ctx);
  await ctx.db.patch(playerId, { refreshAllowedAt: now + cooldownMs });
  await ctx.db.delete(lease._id);
  return true;
}

export const request = mutation({
  args: { rsns: v.array(v.string()) },
  returns: v.array(requestResultValidator),
  handler: async (ctx, args) => {
    if (args.rsns.length === 0 || args.rsns.length > 2) {
      throw new Error("Refresh requests require one or two RSNs.");
    }

    const now = Date.now();
    const results = [];

    for (const rsn of args.rsns) {
      const player = await getOrCreatePlayer(ctx, rsn, now);
      const sourceStates = await Promise.all(
        refreshCategories.slice(2).map(({ source, category }) =>
          ctx.db
            .query("snapshotStates")
            .withIndex("by_key", (index) =>
              index.eq("key", snapshotStateKey(player._id, source, category)),
            )
            .unique(),
        ),
      );
      if (
        player.refreshAllowedAt > now &&
        sourceStates.every(Boolean) &&
        !hasInvalidResponseFailure(sourceStates)
      ) {
        await ctx.scheduler.runAfter(0, internal.analytics.capture, {
          event: "refresh_request_result",
          distinctId: await analyticsDistinctIdForRsn(rsn),
          properties: {
            status: "cooldown",
            rsn_count: args.rsns.length,
            cooldown_ms: player.refreshAllowedAt - now,
          },
        });
        results.push({
          normalizedRsn: player.normalizedRsn,
          status: "cooldown" as const,
          refreshAllowedAt: player.refreshAllowedAt,
        });
        continue;
      }
      const lease = await ctx.db
        .query("refreshLeases")
        .withIndex("by_player", (index) => index.eq("playerId", player._id))
        .unique();

      if (lease && lease.leaseUntil > now) {
        await ctx.scheduler.runAfter(0, internal.analytics.capture, {
          event: "refresh_request_result",
          distinctId: await analyticsDistinctIdForRsn(rsn),
          properties: {
            status: "alreadyScheduled",
            rsn_count: args.rsns.length,
            cooldown_ms: Math.max(0, player.refreshAllowedAt - now),
          },
        });
        results.push({
          normalizedRsn: player.normalizedRsn,
          status: "alreadyScheduled" as const,
          refreshAllowedAt: player.refreshAllowedAt,
        });
        continue;
      }

      if (lease) await ctx.db.delete(lease._id);

      const requestId = crypto.randomUUID();
      await ctx.db.insert("refreshLeases", {
        playerId: player._id,
        requestId,
        leaseUntil: now + REFRESH_LEASE_MS,
      });

      for (const { source, category } of refreshCategories) {
        const state = await ctx.db
          .query("snapshotStates")
          .withIndex("by_key", (index) =>
            index.eq("key", snapshotStateKey(player._id, source, category)),
          )
          .unique();
        const value = {
          status: "scheduled" as const,
          requestId,
          lastAttemptAt: now,
          errorCode: null,
        };
        if (state) {
          await ctx.db.patch(state._id, value);
        } else {
          await ctx.db.insert("snapshotStates", {
            key: snapshotStateKey(player._id, source, category),
            playerId: player._id,
            source,
            category,
            lastSuccessAt: null,
            ...value,
          });
        }
      }

      await ctx.scheduler.runAfter(0, internal.sources.hiscores.refreshPlayer, {
        playerId: player._id,
        rsn: player.displayRsn,
        requestId,
      });
      await ctx.scheduler.runAfter(0, internal.analytics.capture, {
        event: "refresh_request_result",
        distinctId: await analyticsDistinctIdForRsn(rsn),
        properties: {
          status: "scheduled",
          rsn_count: args.rsns.length,
          cooldown_ms: Math.max(0, player.refreshAllowedAt - now),
        },
      });

      results.push({
        normalizedRsn: player.normalizedRsn,
        status: "scheduled" as const,
        refreshAllowedAt: player.refreshAllowedAt,
      });
    }

    return results;
  },
});

export const markRefreshing = internalMutation({
  args: { playerId: v.id("players"), requestId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (
      !lease ||
      lease.requestId !== args.requestId ||
      lease.leaseUntil <= Date.now()
    )
      return false;

    for (const category of hiscoresCategories) {
      const state = await ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(args.playerId, "hiscores", category),
          ),
        )
        .unique();
      if (state?.requestId === args.requestId) {
        await ctx.db.patch(state._id, { status: "refreshing" });
      }
    }
    return true;
  },
});

export const completeHiscores = internalMutation({
  args: {
    playerId: v.id("players"),
    requestId: v.string(),
    displayRsn: v.string(),
    fetchedAt: v.number(),
    skills: v.array(canonicalSkillValidator),
    activities: v.array(canonicalActivityValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (!lease || lease.requestId !== args.requestId) return false;

    const replacements = [
      {
        category: "skills" as const,
        data: { type: "skills" as const, values: args.skills },
      },
      {
        category: "activities" as const,
        data: { type: "activities" as const, values: args.activities },
      },
    ];

    for (const replacement of replacements) {
      const snapshot = await ctx.db
        .query("categorySnapshots")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            categorySnapshotKey(args.playerId, replacement.category, "all"),
          ),
        )
        .unique();
      const value = {
        source: "hiscores" as const,
        fetchedAt: args.fetchedAt,
        completeness: "complete" as const,
        data: replacement.data,
      };
      if (snapshot) {
        await ctx.db.patch(snapshot._id, value);
      } else {
        await ctx.db.insert("categorySnapshots", {
          key: categorySnapshotKey(args.playerId, replacement.category, "all"),
          playerId: args.playerId,
          category: replacement.category,
          segment: "all",
          ...value,
        });
      }

      const state = await ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(args.playerId, "hiscores", replacement.category),
          ),
        )
        .unique();
      if (state?.requestId === args.requestId) {
        await ctx.db.patch(state._id, {
          status: "fresh",
          lastSuccessAt: args.fetchedAt,
          errorCode: null,
        });
      }
    }

    await ctx.db.patch(args.playerId, {
      normalizedRsn: rsnLookupKey(args.displayRsn),
      displayRsn: args.displayRsn,
      lastSnapshotAt: args.fetchedAt,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.providerQueue.enqueueWiseOldManPlayer,
      {
        playerId: args.playerId,
        rsn: args.displayRsn,
        requestId: args.requestId,
      },
    );
    await ctx.scheduler.runAfter(
      0,
      internal.providerQueue.enqueueRuneProfilePlayer,
      {
        playerId: args.playerId,
        rsn: args.displayRsn,
        requestId: args.requestId,
      },
    );
    return true;
  },
});

export const markWiseOldManRefreshing = internalMutation({
  args: { playerId: v.id("players"), requestId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (
      !lease ||
      lease.requestId !== args.requestId ||
      lease.leaseUntil <= Date.now()
    ) {
      return false;
    }

    const state = await ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          snapshotStateKey(args.playerId, "wiseOldMan", "efficiency"),
        ),
      )
      .unique();
    if (state?.requestId === args.requestId) {
      await ctx.db.patch(state._id, { status: "refreshing" });
    }
    return true;
  },
});

export const completeWiseOldMan = internalMutation({
  args: {
    playerId: v.id("players"),
    requestId: v.string(),
    fetchedAt: v.number(),
    accountType: v.string(),
    accountBuild: v.string(),
    combatLevel: v.number(),
    ehp: v.number(),
    ehb: v.number(),
    timeToMax: v.number(),
    timeTo200m: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (!lease || lease.requestId !== args.requestId) return false;

    const key = categorySnapshotKey(args.playerId, "efficiency", "all");
    const snapshot = await ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) => index.eq("key", key))
      .unique();
    const value = {
      source: "wiseOldMan" as const,
      fetchedAt: args.fetchedAt,
      completeness: "complete" as const,
      data: {
        type: "efficiency" as const,
        accountType: args.accountType,
        accountBuild: args.accountBuild,
        combatLevel: args.combatLevel,
        ehp: args.ehp,
        ehb: args.ehb,
        timeToMax: args.timeToMax,
        timeTo200m: args.timeTo200m,
      },
    };
    if (snapshot) {
      await ctx.db.patch(snapshot._id, value);
    } else {
      await ctx.db.insert("categorySnapshots", {
        key,
        playerId: args.playerId,
        category: "efficiency",
        segment: "all",
        ...value,
      });
    }

    const state = await ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          snapshotStateKey(args.playerId, "wiseOldMan", "efficiency"),
        ),
      )
      .unique();
    if (state?.requestId === args.requestId) {
      await ctx.db.patch(state._id, {
        status: "fresh",
        lastSuccessAt: args.fetchedAt,
        errorCode: null,
      });
    }

    await finalizeRefreshIfTerminal(
      ctx,
      args.playerId,
      args.requestId,
      args.fetchedAt,
    );
    return true;
  },
});

export const completeWiseOldManFailure = internalMutation({
  args: {
    playerId: v.id("players"),
    requestId: v.string(),
    status: snapshotStatusValidator,
    errorCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (!lease || lease.requestId !== args.requestId) return false;

    const state = await ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          snapshotStateKey(args.playerId, "wiseOldMan", "efficiency"),
        ),
      )
      .unique();
    if (state?.requestId === args.requestId) {
      await ctx.db.patch(state._id, {
        status: args.status,
        errorCode: args.errorCode,
      });
    }

    await finalizeRefreshIfTerminal(
      ctx,
      args.playerId,
      args.requestId,
      Date.now(),
    );
    return true;
  },
});

export const markRuneProfileRefreshing = internalMutation({
  args: { playerId: v.id("players"), requestId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (
      !lease ||
      lease.requestId !== args.requestId ||
      lease.leaseUntil <= Date.now()
    ) {
      return false;
    }

    for (const category of runeProfileCategories) {
      const state = await ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(args.playerId, "runeProfile", category),
          ),
        )
        .unique();
      if (state?.requestId === args.requestId) {
        await ctx.db.patch(state._id, { status: "refreshing" });
      }
    }
    return true;
  },
});

const questValidator = v.object({
  id: v.number(),
  name: v.string(),
  points: v.number(),
  type: v.union(v.literal("free"), v.literal("members"), v.literal("mini")),
  state: v.union(
    v.literal("not_started"),
    v.literal("in_progress"),
    v.literal("finished"),
  ),
});

const diaryAreaValidator = v.object({
  areaId: v.number(),
  area: v.string(),
  tiers: v.array(
    v.object({
      tier: v.string(),
      completed: v.number(),
      total: v.number(),
    }),
  ),
});

const combatTierValidator = v.object({
  id: v.number(),
  name: v.string(),
  completed: v.number(),
  total: v.number(),
});

const combatTaskValidator = v.object({
  index: v.number(),
  tierId: v.number(),
  tierName: v.string(),
  name: v.string(),
  description: v.string(),
  type: v.string(),
  monster: v.string(),
  completed: v.boolean(),
});

function combatAchievementSummary({
  tiers,
  tasks,
  points,
}: {
  tiers: Array<{ id: number; name: string; completed: number; total: number }>;
  tasks: Array<{ completed: boolean; tierId: number }>;
  points: number;
}) {
  const completed = tiers.reduce((total, tier) => total + tier.completed, 0);
  const total = tiers.reduce((sum, tier) => sum + tier.total, 0);
  if (total === 0 || tasks.length === 0 || points === 0) {
    return null;
  }
  return {
    completed,
    total,
    points,
    tiers,
  };
}

export const completeRuneProfile = internalMutation({
  args: {
    playerId: v.id("players"),
    requestId: v.string(),
    fetchedAt: v.number(),
    quests: v.array(questValidator),
    questSummary: v.object({
      completed: v.number(),
      started: v.number(),
      notStarted: v.number(),
      total: v.number(),
      totalPoints: v.number(),
      earnedPoints: v.number(),
    }),
    diaries: v.array(diaryAreaValidator),
    diarySummary: v.array(
      v.object({
        areaId: v.number(),
        area: v.string(),
        completed: v.number(),
        total: v.number(),
      }),
    ),
    combatAchievementTasks: v.array(combatTaskValidator),
    combatAchievementTiers: v.array(combatTierValidator),
    combatAchievementPoints: v.number(),
    combatAchievementTierReached: v.union(v.string(), v.null()),
    combatAchievementsValid: v.boolean(),
    collectionSummary: v.object({
      obtained: v.number(),
      total: v.number(),
    }),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (!lease || lease.requestId !== args.requestId) return false;

    const diaryCompleted = args.diarySummary.reduce(
      (total, area) => total + area.completed,
      0,
    );
    const diaryTotal = args.diarySummary.reduce(
      (total, area) => total + area.total,
      0,
    );
    const combatSummary = combatAchievementSummary({
      tiers: args.combatAchievementTiers,
      tasks: args.combatAchievementTasks,
      points: args.combatAchievementPoints,
    });
    const hasCombatAchievementSummary = combatSummary !== null;
    const hasValidCombatAchievementDetail =
      args.combatAchievementsValid && combatSummary !== null;

    const snapshots = [
      {
        category: "quests" as const,
        segment: "all",
        data: { type: "quests" as const, ...args.questSummary },
      },
      {
        category: "diaries" as const,
        segment: "all",
        data: {
          type: "diaries" as const,
          completed: diaryCompleted,
          total: diaryTotal,
        },
      },
      ...(combatSummary === null
        ? []
        : [
            {
              category: "combatAchievements" as const,
              segment: "all",
              data: {
                type: "combatAchievements" as const,
                completed: combatSummary.completed,
                total: combatSummary.total,
                points: combatSummary.points,
                tierReached: args.combatAchievementTierReached,
                tiers: combatSummary.tiers,
              },
            },
          ]),
      {
        category: "collection" as const,
        segment: "summary",
        data: { type: "collection" as const, ...args.collectionSummary },
      },
    ];

    for (const replacement of snapshots) {
      const key = categorySnapshotKey(
        args.playerId,
        replacement.category,
        replacement.segment,
      );
      const snapshot = await ctx.db
        .query("categorySnapshots")
        .withIndex("by_key", (index) => index.eq("key", key))
        .unique();
      const value = {
        source: "runeProfile" as const,
        fetchedAt: args.fetchedAt,
        completeness: "complete" as const,
        data: replacement.data,
      };
      if (snapshot) {
        await ctx.db.patch(snapshot._id, value);
      } else {
        await ctx.db.insert("categorySnapshots", {
          key,
          playerId: args.playerId,
          category: replacement.category,
          segment: replacement.segment,
          ...value,
        });
      }
    }

    const items = [
      ...args.quests.map((quest) => ({
        category: "quests" as const,
        itemKey: `quest.${quest.id}`,
        label: quest.name,
        group: quest.type,
        state: quest.state,
        completed: quest.state === "finished",
        current: null,
        total: null,
        points: quest.points,
      })),
      ...args.diaries.flatMap((area) =>
        area.tiers.map((tier) => ({
          category: "diaries" as const,
          itemKey: `diary.${area.areaId}.${tier.tier.toLowerCase()}`,
          label: `${area.area} ${tier.tier}`,
          group: area.area,
          state: tier.completed === tier.total ? "finished" : "in_progress",
          completed: tier.completed === tier.total,
          current: tier.completed,
          total: tier.total,
          points: null,
        })),
      ),
      ...(hasValidCombatAchievementDetail
        ? args.combatAchievementTasks.map((task) => ({
            category: "combatAchievements" as const,
            itemKey: `combatAchievement.${task.index}`,
            label: task.name,
            group: task.monster || task.tierName,
            state: task.type,
            completed: task.completed,
            current: null,
            total: null,
            points: task.tierId,
          }))
        : []),
    ];

    const itemCategories = hasValidCombatAchievementDetail
      ? (["quests", "diaries", "combatAchievements"] as const)
      : (["quests", "diaries"] as const);
    for (const category of itemCategories) {
      const previous = await ctx.db
        .query("canonicalItems")
        .withIndex("by_player_and_category", (index) =>
          index.eq("playerId", args.playerId).eq("category", category),
        )
        .collect();
      for (const item of previous) await ctx.db.delete(item._id);
    }
    for (const item of items) {
      await ctx.db.insert("canonicalItems", {
        key: `${args.playerId}:${item.category}:${item.itemKey}`,
        playerId: args.playerId,
        source: "runeProfile",
        revision: args.requestId,
        ...item,
      });
    }

    for (const category of runeProfileCategories) {
      const state = await ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(args.playerId, "runeProfile", category),
          ),
        )
        .unique();
      if (state?.requestId === args.requestId) {
        await ctx.db.patch(state._id, {
          status:
            category === "combatAchievements" &&
            !hasValidCombatAchievementDetail
              ? "failed"
              : "fresh",
          lastSuccessAt:
            category === "combatAchievements" &&
            !hasValidCombatAchievementDetail
              ? state.lastSuccessAt
              : args.fetchedAt,
          errorCode:
            category === "combatAchievements" && !hasCombatAchievementSummary
              ? "invalidResponse"
              : category === "combatAchievements" &&
                  !hasValidCombatAchievementDetail
                ? "granularInvalid"
                : null,
        });
      }
    }

    await ctx.db.patch(args.playerId, {
      lastSnapshotAt: args.fetchedAt,
    });
    await finalizeRefreshIfTerminal(
      ctx,
      args.playerId,
      args.requestId,
      args.fetchedAt,
    );
    return true;
  },
});

export const completeRuneProfileFailure = internalMutation({
  args: {
    playerId: v.id("players"),
    requestId: v.string(),
    status: snapshotStatusValidator,
    errorCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (!lease || lease.requestId !== args.requestId) return false;

    for (const category of runeProfileCategories) {
      const state = await ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            snapshotStateKey(args.playerId, "runeProfile", category),
          ),
        )
        .unique();
      if (state?.requestId === args.requestId) {
        await ctx.db.patch(state._id, {
          status: args.status,
          errorCode: args.errorCode,
        });
      }
    }

    await finalizeRefreshIfTerminal(
      ctx,
      args.playerId,
      args.requestId,
      Date.now(),
    );
    return true;
  },
});

export const completeFailure = internalMutation({
  args: {
    playerId: v.id("players"),
    requestId: v.string(),
    status: snapshotStatusValidator,
    errorCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("refreshLeases")
      .withIndex("by_player", (index) => index.eq("playerId", args.playerId))
      .unique();
    if (!lease || lease.requestId !== args.requestId) return false;

    for (const { source, category } of refreshCategories) {
      const state = await ctx.db
        .query("snapshotStates")
        .withIndex("by_key", (index) =>
          index.eq("key", snapshotStateKey(args.playerId, source, category)),
        )
        .unique();
      if (state?.requestId === args.requestId) {
        await ctx.db.patch(state._id, {
          status: args.status,
          errorCode:
            source === "hiscores" ? args.errorCode : "hiscoresUnavailable",
        });
      }
    }
    await ctx.db.delete(lease._id);
    return true;
  },
});
