import { describe, expect, test } from "bun:test";
import type { CanonicalActivity, CanonicalSkill } from "@rune-rating/domain";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { calculateAdjustedEfficiency } from "../convex/lib/wiseOldManEfficiency";
import schema from "../convex/schema";
import { buildXpTimelineDashboard } from "../convex/xpTimeline";

const modules = {
  "./_generated/api.js": () => import("../convex/_generated/api.js"),
  "./_generated/server.js": () => import("../convex/_generated/server.js"),
  "./analytics.ts": () => import("../convex/analytics"),
  "./comparisons.ts": () => import("../convex/comparisons"),
  "./players.ts": () => import("../convex/players"),
  "./providerQueue.ts": () => import("../convex/providerQueue"),
  "./refresh.ts": () => import("../convex/refresh"),
  "./runeRating.ts": () => import("../convex/runeRating"),
  "./runeProfile.ts": () => import("../convex/runeProfile"),
  "./runtimeConfig.ts": () => import("../convex/runtimeConfig"),
  "./sources/hiscores.ts": () => import("../convex/sources/hiscores"),
  "./sources/runeProfile.ts": () => import("../convex/sources/runeProfile"),
  "./sources/wiseOldMan.ts": () => import("../convex/sources/wiseOldMan"),
  "./wiseOldMan.ts": () => import("../convex/wiseOldMan"),
  "./xpTimeline.ts": () => import("../convex/xpTimeline"),
};

const requestRefresh = makeFunctionReference<
  "mutation",
  { rsns: string[] },
  Array<{
    normalizedRsn: string;
    status: "scheduled" | "cooldown" | "alreadyScheduled";
    refreshAllowedAt: number;
  }>
>("refresh:request");

const completeFailure = makeFunctionReference<
  "mutation",
  { playerId: string; requestId: string; status: "failed"; errorCode: string },
  boolean
>("refresh:completeFailure");

const completeHiscores = makeFunctionReference<
  "mutation",
  {
    playerId: string;
    requestId: string;
    displayRsn: string;
    fetchedAt: number;
    skills: CanonicalSkill[];
    activities: CanonicalActivity[];
  },
  boolean
>("refresh:completeHiscores");

const completeWiseOldMan = makeFunctionReference<
  "mutation",
  {
    playerId: string;
    requestId: string;
    fetchedAt: number;
    accountType: string;
    accountBuild: string;
    combatLevel: number;
    ehp: number;
    ehb: number;
    timeToMax: number;
    timeTo200m: number;
  },
  boolean
>("refresh:completeWiseOldMan");

const completeWiseOldManFailure = makeFunctionReference<
  "mutation",
  {
    playerId: string;
    requestId: string;
    status: "notConnected" | "rateLimited" | "failed";
    errorCode: string;
  },
  boolean
>("refresh:completeWiseOldManFailure");

const upsertIronmanEfficiencyRates = makeFunctionReference<
  "mutation",
  {
    fetchedAt: number;
    ehpSkills: Array<{
      skill: string;
      methods: Array<{ startExp: number; rate: number }>;
      bonuses: Array<{
        originSkill: string;
        bonusSkill: string;
        startExp: number;
        endExp: number;
        end: boolean;
        ratio: number;
      }>;
    }>;
    ehbBosses: Array<{ boss: string; rate: number }>;
  },
  boolean
>("refresh:upsertWiseOldManIronmanEfficiencyRates");

const completeRuneProfile = makeFunctionReference<
  "mutation",
  {
    playerId: string;
    requestId: string;
    fetchedAt: number;
    accountType: { id: number; key: string; name: string };
    groupName: string | null;
    quests: Array<{
      id: number;
      name: string;
      points: number;
      type: "free" | "members" | "mini";
      state: "not_started" | "in_progress" | "finished";
    }>;
    questSummary: {
      completed: number;
      started: number;
      notStarted: number;
      total: number;
      totalPoints: number;
      earnedPoints: number;
    };
    diaries: Array<{
      areaId: number;
      area: string;
      tiers: Array<{ tier: string; completed: number; total: number }>;
    }>;
    diarySummary: Array<{
      areaId: number;
      area: string;
      completed: number;
      total: number;
    }>;
    combatAchievementTasks: Array<{
      index: number;
      tierId: number;
      tierName: string;
      name: string;
      description: string;
      type: string;
      monster: string;
      completed: boolean;
    }>;
    combatAchievementTiers: Array<{
      id: number;
      name: string;
      completed: number;
      total: number;
    }>;
    combatAchievementPoints: number;
    combatAchievementTierReached: string | null;
    combatAchievementsValid: boolean;
    collectionSummary: { obtained: number; total: number };
  },
  boolean
>("refresh:completeRuneProfile");

const completeRuneProfileFailure = makeFunctionReference<
  "mutation",
  {
    playerId: string;
    requestId: string;
    status: "notConnected" | "rateLimited" | "failed";
    errorCode: string;
  },
  boolean
>("refresh:completeRuneProfileFailure");

const getSkills = makeFunctionReference<
  "query",
  { leftRsn: string; rightRsn: string },
  unknown
>("comparisons:getSkills");

const getEfficiency = makeFunctionReference<
  "query",
  { leftRsn: string; rightRsn: string },
  { accountTypes: { left: string; right: string } } | null
>("comparisons:getEfficiency");

const getProfile = makeFunctionReference<
  "query",
  { rsn: string },
  { lastSnapshotAt: number | null; snapshotStaleAt: number | null } | null
>("players:getProfile");

const getRuneProfileCategory = makeFunctionReference<
  "query",
  { rsn: string; category: "combatAchievements" },
  {
    summary: { type: string; completed?: number; points?: number };
    items: Array<{ completed: boolean | null }>;
  } | null
>("runeProfile:getCategory");

const getRuneRating = makeFunctionReference<
  "query",
  { rsn: string },
  | { status: "notRequested"; message: string }
  | { status: "refreshing"; displayRsn: string }
  | {
      status: "unavailable";
      displayRsn: string;
      missingSources: string[];
      message: string;
    }
  | {
      status: "ready";
      card: {
        displayRsn: string;
        accountType: string;
        score: number;
        tier: string;
        ehp: number;
        ehb: number;
        adjustedEhp: number | null;
        adjustedEhb: number | null;
        efficiencyRateType: "ironman" | null;
        prestigeStats: Array<{ label: string; value: string; detail: string }>;
      };
    }
>("runeRating:get");

const getRuneProfileDashboard = makeFunctionReference<
  "query",
  { leftRsn: string; rightRsn: string },
  {
    left: { quests: { earnedPoints: number } } | null;
    right: { quests: { earnedPoints: number } } | null;
  }
>("runeProfile:getDashboard");

const replaceCollectionLog = makeFunctionReference<
  "mutation",
  {
    rsn: string;
    fetchedAt: number;
    collectionLog: {
      obtained: number;
      total: number;
      tabs: Array<{
        name: string;
        obtained: number;
        total: number;
        pages: Array<{
          name: string;
          obtained: number;
          total: number;
          items: Array<{ id: number; name: string; quantity: number }>;
        }>;
      }>;
    };
  },
  boolean
>("runeProfile:replaceCollectionLog");

const getCollectionRefreshPlan = makeFunctionReference<
  "query",
  { rsns: string[] },
  Array<{
    rsn: string;
    shouldRefresh: boolean;
    status: "fresh" | "notConnected";
    errorCode: string | null;
  }>
>("runeProfile:getCollectionRefreshPlan");

const refreshCollectionLog = makeFunctionReference<
  "action",
  { rsns: string[] },
  Array<{
    rsn: string;
    status:
      | "fresh"
      | "queued"
      | "running"
      | "retrying"
      | "notConnected"
      | "rateLimited"
      | "failed";
    errorCode: string | null;
    estimatedRunAt: number | null;
    retryAt: number | null;
    position: number | null;
  }>
>("runeProfile:refreshCollectionLog");

const enqueueCollectionDetail = makeFunctionReference<
  "mutation",
  { rsn: string; priority?: number },
  {
    status: "idle" | "queued" | "running" | "retrying" | "succeeded" | "failed";
    position: number | null;
    estimatedRunAt: number | null;
  }
>("providerQueue:enqueueCollectionDetail");

const enqueueWiseOldManPlayer = makeFunctionReference<
  "mutation",
  { playerId: string; rsn: string; requestId: string; priority?: number },
  string
>("providerQueue:enqueueWiseOldManPlayer");

const enqueueRuneProfilePlayer = makeFunctionReference<
  "mutation",
  { playerId: string; rsn: string; requestId: string; priority?: number },
  string
>("providerQueue:enqueueRuneProfilePlayer");

const getProviderStatuses = makeFunctionReference<
  "query",
  { rsns: string[] },
  Array<{
    provider: "wiseOldMan" | "runeProfile";
    operation: string | null;
    status: "idle" | "queued" | "running" | "retrying" | "succeeded" | "failed";
    position: number | null;
    estimatedRunAt: number | null;
    retryAt: number | null;
    lastErrorCode: string | null;
  }>
>("providerQueue:getProviderStatuses");

const pumpProviderQueue = makeFunctionReference<
  "mutation",
  Record<string, never>,
  number
>("providerQueue:pump");

const markRunningProviderJob = makeFunctionReference<
  "mutation",
  { jobId: string },
  {
    _id: string;
    startedAt: number;
  } | null
>("providerQueue:markRunning");

const completeProviderJob = makeFunctionReference<
  "mutation",
  { jobId: string; startedAt: number },
  null
>("providerQueue:completeJob");

const getCollectionDetailStatuses = makeFunctionReference<
  "query",
  { rsns: string[] },
  Array<{
    rsn: string;
    status: "idle" | "queued" | "running" | "retrying" | "succeeded" | "failed";
    position: number | null;
    estimatedRunAt: number | null;
    retryAt: number | null;
    lastErrorCode: string | null;
  }>
>("providerQueue:getCollectionDetailStatuses");

const getCollectionComparison = makeFunctionReference<
  "query",
  { leftRsn: string; rightRsn: string },
  {
    leftDetailAvailable: boolean;
    rightDetailAvailable: boolean;
    tabs: Array<{
      name: string;
      delta: number | null;
      pages: Array<{ delta: number | null }>;
    }>;
  }
>("runeProfile:getCollectionComparison");

const getCollectionItemsComparison = makeFunctionReference<
  "query",
  {
    leftRsn: string;
    rightRsn: string;
    tab: string;
    status: "all" | "different" | "one-sided" | "left" | "right";
    search: string;
    limit: number;
  },
  {
    matchCount: number;
    isLimited: boolean;
    items: Array<{
      label: string;
      page: string;
      pages: string[];
      leftOwned: boolean | null;
      rightOwned: boolean | null;
      quantityDelta: number | null;
    }>;
  }
>("runeProfile:getCollectionItemsComparison");

const claimOverviewCacheRefresh = makeFunctionReference<
  "mutation",
  { rsn: string; now: number },
  {
    shouldFetch: boolean;
    requestId: string | null;
    cache: { fetchedAt: number | null };
  }
>("wiseOldMan:claimOverviewCacheRefresh");

const completeOverviewCacheRefresh = makeFunctionReference<
  "mutation",
  {
    rsn: string;
    requestId: string;
    fetchedAt: number;
    timeline: Array<{ date: number; value: number }>;
    sevenDayGained: number | null;
  },
  boolean
>("wiseOldMan:completeOverviewCacheRefresh");

const claimSkillGainsCacheRefresh = makeFunctionReference<
  "mutation",
  { rsn: string; period: "week"; now: number },
  { shouldFetch: boolean; requestId: string | null }
>("wiseOldMan:claimSkillGainsCacheRefresh");

const releaseSkillGainsCacheRefresh = makeFunctionReference<
  "mutation",
  {
    rsn: string;
    period: "week";
    requestId: string;
    refreshAllowedAt: number;
  },
  null
>("wiseOldMan:releaseSkillGainsCacheRefresh");

const claimSkillTimelineCacheRefresh = makeFunctionReference<
  "mutation",
  { rsn: string; skillKey: string; now: number },
  { shouldFetch: boolean; requestId: string | null }
>("wiseOldMan:claimSkillTimelineCacheRefresh");

const value = (number: number | null) => ({
  value: number,
  availabilityReason: number === null ? ("unranked" as const) : null,
});

function skill(
  name: string,
  level: number | null,
  xp: number | null,
  rank: number | null,
): CanonicalSkill {
  return {
    key: `skill.${name.toLowerCase()}`,
    name,
    level: value(level),
    xp: value(xp),
    rank: value(rank),
  };
}

async function currentLease(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const lease = await ctx.db.query("refreshLeases").first();
    if (!lease) throw new Error("Expected lease.");
    const player = await ctx.db.get(lease.playerId);
    if (!player) throw new Error("Expected lease player.");
    return { player, lease };
  });
}

async function seedIronmanEfficiencyRates(t: ReturnType<typeof convexTest>) {
  await t.mutation(upsertIronmanEfficiencyRates, {
    fetchedAt: Date.now(),
    ehpSkills: [
      {
        skill: "attack",
        methods: [{ startExp: 0, rate: 100_000 }],
        bonuses: [],
      },
      {
        skill: "strength",
        methods: [{ startExp: 0, rate: 200_000 }],
        bonuses: [],
      },
      {
        skill: "defence",
        methods: [{ startExp: 0, rate: 90_000 }],
        bonuses: [],
      },
      {
        skill: "magic",
        methods: [{ startExp: 0, rate: 50_000 }],
        bonuses: [
          {
            originSkill: "defence",
            bonusSkill: "magic",
            startExp: 0,
            endExp: 200_000_000,
            end: false,
            ratio: 0.5,
          },
        ],
      },
    ],
    ehbBosses: [
      { boss: "zulrah", rate: 50 },
      { boss: "vorkath", rate: 100 },
    ],
  });
}

async function completeRatingFixtures(
  t: ReturnType<typeof convexTest>,
  rsn: string,
) {
  await seedIronmanEfficiencyRates(t);
  await t.mutation(requestRefresh, { rsns: [rsn] });
  const { player, lease } = await currentLease(t);
  const fetchedAt = Date.now();

  await t.mutation(completeHiscores, {
    playerId: player._id,
    requestId: lease.requestId,
    displayRsn: rsn,
    fetchedAt,
    skills: [
      skill("Overall", 2_100, 800_000_000, 4_000),
      skill("Attack", 99, 25_000_000, 4_100),
      skill("Strength", 99, 40_000_000, 3_900),
      skill("Defence", 99, 18_000_000, 5_200),
      skill("Magic", 99, 20_000_000, 4_800),
    ],
    activities: [
      {
        key: "activity.clue-scrolls-all",
        name: "Clue Scrolls (all)",
        category: "clues",
        rank: value(5_000),
        score: value(1_200),
      },
      {
        key: "activity.zulrah",
        name: "Zulrah",
        category: "bossing",
        rank: value(2_000),
        score: value(2_500),
      },
      {
        key: "activity.vorkath",
        name: "Vorkath",
        category: "bossing",
        rank: value(1_500),
        score: value(3_000),
      },
      {
        key: "activity.lms-rank",
        name: "LMS - Rank",
        category: "minigames",
        rank: value(7_500),
        score: value(25),
      },
    ],
  });
  await t.mutation(completeWiseOldMan, {
    playerId: player._id,
    requestId: lease.requestId,
    fetchedAt,
    accountType: "regular",
    accountBuild: "main",
    combatLevel: 126,
    ehp: 4_200,
    ehb: 1_100,
    timeToMax: 320,
    timeTo200m: 12_000,
  });
  await t.mutation(completeRuneProfile, {
    playerId: player._id,
    requestId: lease.requestId,
    fetchedAt,
    accountType: { id: 4, key: "group_ironman", name: "Group Ironman" },
    groupName: "Fixture Group",
    quests: [
      {
        id: 1,
        name: "Fixture Quest",
        points: 3,
        type: "members",
        state: "finished",
      },
    ],
    questSummary: {
      completed: 160,
      started: 4,
      notStarted: 8,
      total: 172,
      totalPoints: 330,
      earnedPoints: 300,
    },
    diaries: [
      {
        areaId: 1,
        area: "Ardougne",
        tiers: [{ tier: "Elite", completed: 4, total: 4 }],
      },
    ],
    diarySummary: [{ areaId: 1, area: "Ardougne", completed: 4, total: 4 }],
    combatAchievementTasks: [
      {
        index: 1,
        tierId: 5,
        tierName: "Elite",
        name: "Fixture Task",
        description: "Complete the fixture.",
        type: "Mechanical",
        monster: "Fixture Boss",
        completed: true,
      },
    ],
    combatAchievementTiers: [{ id: 1, name: "Elite", completed: 1, total: 1 }],
    combatAchievementPoints: 5,
    combatAchievementTierReached: "Elite",
    combatAchievementsValid: true,
    collectionSummary: { obtained: 900, total: 1_600 },
  });
}

describe("Wise Old Man efficiency calculations", () => {
  test("maps Hiscores ToA expert mode to the WOM EHB rate key", () => {
    const result = calculateAdjustedEfficiency(
      [],
      [
        {
          key: "activity.tombs_of_amascut_expert_mode",
          name: "Tombs of Amascut: Expert Mode",
          category: "bossing",
          rank: value(1_000),
          score: value(276),
        },
      ],
      [],
      [{ boss: "tombs_of_amascut_expert", rate: 3 }],
    );

    expect(result.ehb).toBe(92);
  });
});

describe("refresh orchestration", () => {
  test("schedules a first refresh and blocks duplicate active leases", async () => {
    const t = convexTest({ schema, modules });

    expect(
      await t.mutation(requestRefresh, { rsns: ["  Test_Player "] }),
    ).toMatchObject([{ normalizedRsn: "test player", status: "scheduled" }]);
    expect(
      await t.mutation(requestRefresh, { rsns: ["test player"] }),
    ).toMatchObject([
      { normalizedRsn: "test player", status: "alreadyScheduled" },
    ]);
  });

  test("backfills WOM for players still on a Hiscores-only cooldown", async () => {
    const t = convexTest({ schema, modules });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("players", {
        normalizedRsn: "legacy",
        displayRsn: "Legacy",
        createdAt: now,
        lastRequestedAt: now,
        lastSnapshotAt: now,
        refreshAllowedAt: now + 60 * 60 * 1_000,
      });
    });

    expect(
      await t.mutation(requestRefresh, { rsns: ["Legacy"] }),
    ).toMatchObject([{ status: "scheduled" }]);
  });

  test("failed refreshes release the lease without consuming cooldown", async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(requestRefresh, { rsns: ["Failure"] });
    const { player, lease } = await currentLease(t);

    expect(
      await t.mutation(completeFailure, {
        playerId: player._id,
        requestId: lease.requestId,
        status: "failed",
        errorCode: "timeout",
      }),
    ).toBe(true);

    expect(
      await t.mutation(requestRefresh, { rsns: ["Failure"] }),
    ).toMatchObject([{ status: "scheduled" }]);
  });

  test("successful refreshes replace snapshots and consume cooldown", async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(requestRefresh, { rsns: ["Success"] });
    const { player, lease } = await currentLease(t);

    const fetchedAt = Date.now();
    expect(
      await t.mutation(completeHiscores, {
        playerId: player._id,
        requestId: lease.requestId,
        displayRsn: "Success",
        fetchedAt,
        skills: [skill("Overall", 100, 1_000_000, 50)],
        activities: [],
      }),
    ).toBe(true);
    expect(
      await t.mutation(completeWiseOldMan, {
        playerId: player._id,
        requestId: lease.requestId,
        fetchedAt,
        accountType: "regular",
        accountBuild: "main",
        combatLevel: 100,
        ehp: 50,
        ehb: 10,
        timeToMax: 500,
        timeTo200m: 10_000,
      }),
    ).toBe(true);
    expect(
      await t.mutation(completeRuneProfile, {
        playerId: player._id,
        requestId: lease.requestId,
        fetchedAt,
        accountType: { id: 0, key: "regular", name: "Regular" },
        groupName: null,
        quests: [
          {
            id: 1,
            name: "Fixture Quest",
            points: 1,
            type: "members",
            state: "finished",
          },
        ],
        questSummary: {
          completed: 1,
          started: 0,
          notStarted: 0,
          total: 1,
          totalPoints: 1,
          earnedPoints: 1,
        },
        diaries: [
          {
            areaId: 1,
            area: "Ardougne",
            tiers: [{ tier: "Easy", completed: 1, total: 1 }],
          },
        ],
        diarySummary: [{ areaId: 1, area: "Ardougne", completed: 1, total: 1 }],
        combatAchievementTasks: [
          {
            index: 1,
            tierId: 1,
            tierName: "Easy",
            name: "Fixture Task",
            description: "Complete the fixture.",
            type: "Mechanical",
            monster: "Fixture Boss",
            completed: true,
          },
        ],
        combatAchievementTiers: [
          { id: 1, name: "Easy", completed: 1, total: 1 },
        ],
        combatAchievementPoints: 1,
        combatAchievementTierReached: "Easy",
        combatAchievementsValid: true,
        collectionSummary: { obtained: 1, total: 10 },
      }),
    ).toBe(true);

    expect(
      await t.mutation(requestRefresh, { rsns: ["Success"] }),
    ).toMatchObject([{ status: "cooldown" }]);
    expect(
      await t.run(
        async (ctx) => await ctx.db.query("categorySnapshots").collect(),
      ),
    ).toHaveLength(7);
    expect(
      await t.run(
        async (ctx) => await ctx.db.query("canonicalItems").collect(),
      ),
    ).toHaveLength(3);
    expect(
      await t.query(getRuneProfileDashboard, {
        leftRsn: "Success",
        rightRsn: "Missing",
      }),
    ).toMatchObject({
      left: { quests: { earnedPoints: 1 } },
      right: null,
    });
    expect(await t.query(getProfile, { rsn: "Success" })).toMatchObject({
      lastSnapshotAt: fetchedAt,
      snapshotStaleAt: fetchedAt + 60 * 60 * 1_000,
    });
  });

  test("rejects inconsistent RuneProfile combat achievements", async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(requestRefresh, { rsns: ["Bad Combat"] });
    const { player, lease } = await currentLease(t);
    const fetchedAt = Date.now();

    await t.mutation(completeHiscores, {
      playerId: player._id,
      requestId: lease.requestId,
      displayRsn: "Bad Combat",
      fetchedAt,
      skills: [skill("Overall", 100, 1_000_000, 50)],
      activities: [],
    });
    await t.mutation(completeWiseOldMan, {
      playerId: player._id,
      requestId: lease.requestId,
      fetchedAt,
      accountType: "regular",
      accountBuild: "main",
      combatLevel: 100,
      ehp: 50,
      ehb: 10,
      timeToMax: 500,
      timeTo200m: 10_000,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("canonicalItems", {
        key: `${player._id}:combatAchievements:combatAchievement.stale`,
        playerId: player._id,
        source: "runeProfile",
        category: "combatAchievements",
        revision: "previous-valid-refresh",
        itemKey: "combatAchievement.stale",
        label: "Stale Fixture Task",
        group: "Easy",
        state: "Mechanical",
        completed: false,
        current: null,
        total: null,
        points: 1,
      });
    });

    expect(
      await t.mutation(completeRuneProfile, {
        playerId: player._id,
        requestId: lease.requestId,
        fetchedAt,
        accountType: { id: 0, key: "regular", name: "Regular" },
        groupName: null,
        quests: [
          {
            id: 1,
            name: "Fixture Quest",
            points: 1,
            type: "members",
            state: "finished",
          },
        ],
        questSummary: {
          completed: 1,
          started: 0,
          notStarted: 0,
          total: 1,
          totalPoints: 1,
          earnedPoints: 1,
        },
        diaries: [
          {
            areaId: 1,
            area: "Ardougne",
            tiers: [{ tier: "Easy", completed: 1, total: 1 }],
          },
        ],
        diarySummary: [{ areaId: 1, area: "Ardougne", completed: 1, total: 1 }],
        combatAchievementTasks: [
          {
            index: 1,
            tierId: 1,
            tierName: "Easy",
            name: "Fixture Task",
            description: "Complete the fixture.",
            type: "Mechanical",
            monster: "Fixture Boss",
            completed: false,
          },
        ],
        combatAchievementTiers: [
          { id: 1, name: "Easy", completed: 1, total: 1 },
        ],
        combatAchievementPoints: 1,
        combatAchievementTierReached: null,
        combatAchievementsValid: false,
        collectionSummary: { obtained: 1, total: 10 },
      }),
    ).toBe(true);

    expect(
      await t.run(async (ctx) => {
        const [snapshot] = await ctx.db
          .query("categorySnapshots")
          .withIndex("by_player_and_category", (index) =>
            index
              .eq("playerId", player._id)
              .eq("category", "combatAchievements"),
          )
          .take(1);
        return snapshot?.data;
      }),
    ).toMatchObject({
      completed: 1,
      points: 1,
      total: 1,
      type: "combatAchievements",
    });
    expect(
      await t.run(
        async (ctx) =>
          await ctx.db
            .query("canonicalItems")
            .withIndex("by_player_and_category", (index) =>
              index
                .eq("playerId", player._id)
                .eq("category", "combatAchievements"),
            )
            .take(1),
      ),
    ).toHaveLength(1);
    expect(
      await t.query(getRuneProfileCategory, {
        rsn: "Bad Combat",
        category: "combatAchievements",
      }),
    ).toMatchObject({
      summary: { completed: 1, points: 1, type: "combatAchievements" },
      items: [],
    });
    expect(await t.query(getProfile, { rsn: "Bad Combat" })).toMatchObject({
      questsState: { status: "fresh" },
      diariesState: { status: "fresh" },
      combatAchievementsState: {
        status: "failed",
        errorCode: "granularInvalid",
      },
      collectionState: { status: "fresh" },
    });
    expect(
      await t.mutation(requestRefresh, { rsns: ["Bad Combat"] }),
    ).toMatchObject([{ status: "scheduled" }]);
  });
});

describe("rune rating", () => {
  test("generates a share card from complete current snapshots", async () => {
    const t = convexTest({ schema, modules });
    await completeRatingFixtures(t, "Rated Player");

    const rating = await t.query(getRuneRating, { rsn: "Rated Player" });

    expect(rating.status).toBe("ready");
    if (rating.status !== "ready") throw new Error("Expected ready rating.");
    expect(rating.card.displayRsn).toBe("Rated Player");
    expect(rating.card.accountType).toBe("Group Ironman");
    expect(rating.card.ehp).toBe(4_200);
    expect(rating.card.ehb).toBe(1_100);
    expect(rating.card.adjustedEhp).toBeCloseTo(870);
    expect(rating.card.adjustedEhb).toBeCloseTo(80);
    expect(rating.card.efficiencyRateType).toBe("ironman");
    expect(rating.card.score).toBeGreaterThan(0);
    expect(rating.card.tier).toBeTruthy();
    expect(rating.card.prestigeStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Total level" }),
        expect.objectContaining({
          label: "EHP / EHB",
          detail: "GIM adjusted with WOM ironman rates",
        }),
        expect.objectContaining({ label: "Collection" }),
      ]),
    );
  });

  test("uses RuneProfile account type before Wise Old Man account type", async () => {
    const t = convexTest({ schema, modules });
    await completeRatingFixtures(t, "Left GIM");
    await completeRatingFixtures(t, "Right GIM");

    expect(
      await t.query(getEfficiency, {
        leftRsn: "Left GIM",
        rightRsn: "Right GIM",
      }),
    ).toMatchObject({
      accountTypes: {
        left: "Group Ironman",
        right: "Group Ironman",
      },
    });
  });

  test("refuses to generate without Wise Old Man and RuneProfile data", async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(requestRefresh, { rsns: ["Disconnected"] });
    const { player, lease } = await currentLease(t);
    const fetchedAt = Date.now();

    await t.mutation(completeHiscores, {
      playerId: player._id,
      requestId: lease.requestId,
      displayRsn: "Disconnected",
      fetchedAt,
      skills: [skill("Overall", 1_500, 100_000_000, 50_000)],
      activities: [],
    });
    await t.mutation(completeWiseOldManFailure, {
      playerId: player._id,
      requestId: lease.requestId,
      status: "notConnected",
      errorCode: "notConnected",
    });
    await t.mutation(completeRuneProfileFailure, {
      playerId: player._id,
      requestId: lease.requestId,
      status: "notConnected",
      errorCode: "notConnected",
    });

    const rating = await t.query(getRuneRating, { rsn: "Disconnected" });

    expect(rating).toMatchObject({
      status: "unavailable",
      missingSources: ["Wise Old Man", "RuneProfile"],
    });
  });
});

describe("skills comparison", () => {
  test("compares current snapshots and keeps missing values indeterminate", async () => {
    const t = convexTest({ schema, modules });
    for (const [rsn, skills] of [
      [
        "Left",
        [skill("Attack", 99, 20_000_000, 10), skill("Defence", 90, null, null)],
      ],
      [
        "Right",
        [
          skill("Attack", 98, 18_000_000, 20),
          skill("Defence", 91, 6_000_000, 30),
        ],
      ],
    ] as const) {
      await t.mutation(requestRefresh, { rsns: [rsn] });
      const leaseData = await t.run(async (ctx) => {
        const player = await ctx.db
          .query("players")
          .withIndex("by_normalized_rsn", (index) =>
            index.eq("normalizedRsn", rsn.toLowerCase()),
          )
          .unique();
        if (!player) throw new Error("Expected player.");
        const lease = await ctx.db
          .query("refreshLeases")
          .withIndex("by_player", (index) => index.eq("playerId", player._id))
          .unique();
        if (!lease) throw new Error("Expected lease.");
        return { player, lease };
      });
      await t.mutation(completeHiscores, {
        playerId: leaseData.player._id,
        requestId: leaseData.lease.requestId,
        displayRsn: rsn,
        fetchedAt: Date.now(),
        skills: [...skills],
        activities: [],
      });
    }

    const comparison = (await t.query(getSkills, {
      leftRsn: "Left",
      rightRsn: "Right",
    })) as {
      skills: Array<{
        key: string;
        level: { leader: string };
        xp: { leader: string };
        rank: { leader: string };
      }>;
    };

    expect(comparison.skills[0]).toMatchObject({
      key: "skill.attack",
      level: { leader: "left" },
      xp: { leader: "left" },
      rank: { leader: "left" },
    });
    expect(comparison.skills[1]?.xp.leader).toBe("indeterminate");
  });
});

describe("collection log comparison", () => {
  test("queues snapshot provider refreshes with provider-specific costs", async () => {
    const t = convexTest({ schema, modules });
    const playerId = await t.run(async (ctx) =>
      ctx.db.insert("players", {
        normalizedRsn: "queue snap",
        displayRsn: "Queue Snap",
        createdAt: Date.now(),
        lastRequestedAt: Date.now(),
        lastSnapshotAt: null,
        refreshAllowedAt: Date.now(),
      }),
    );

    await t.mutation(enqueueWiseOldManPlayer, {
      playerId,
      rsn: "Queue Snap",
      requestId: "request-wom",
    });
    await t.mutation(enqueueRuneProfilePlayer, {
      playerId,
      rsn: "Queue Snap",
      requestId: "request-rp",
    });

    expect(await t.mutation(pumpProviderQueue, {})).toBe(2);

    const { jobs, rates } = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("providerJobs").collect(),
      rates: await ctx.db.query("providerRateLimits").collect(),
    }));
    const womJob = jobs.find((job) => job.provider === "wiseOldMan");
    const runeProfileJob = jobs.find((job) => job.provider === "runeProfile");
    const womRate = rates.find((rate) => rate.provider === "wiseOldMan");
    const runeProfileRate = rates.find(
      (rate) => rate.provider === "runeProfile",
    );

    expect(womJob?.status).toBe("scheduled");
    expect(runeProfileJob?.status).toBe("scheduled");
    expect(womRate?.spacingMs).toBe(700);
    expect(runeProfileRate?.spacingMs).toBe(600);
    expect(womRate?.nextAvailableAt).toBe((womJob?.estimatedRunAt ?? 0) + 700);
    expect(runeProfileRate?.nextAvailableAt).toBe(
      (runeProfileJob?.estimatedRunAt ?? 0) + 2_400,
    );

    expect(
      await t.query(getProviderStatuses, { rsns: ["Queue Snap"] }),
    ).toMatchObject([
      {
        provider: "wiseOldMan",
        operation: "wiseOldManPlayer",
        status: "queued",
        estimatedRunAt: womJob?.estimatedRunAt,
      },
      {
        provider: "runeProfile",
        operation: "runeProfilePlayer",
        status: "queued",
        estimatedRunAt: runeProfileJob?.estimatedRunAt,
      },
    ]);
  });

  test("dedupes queued collection detail jobs and reserves provider slots", async () => {
    const t = convexTest({ schema, modules });

    expect(
      await t.mutation(enqueueCollectionDetail, { rsn: "Queue Player" }),
    ).toMatchObject({ status: "queued" });
    expect(
      await t.mutation(enqueueCollectionDetail, { rsn: "queue player" }),
    ).toMatchObject({ status: "queued" });

    expect(
      await t.run(async (ctx) => await ctx.db.query("providerJobs").collect()),
    ).toHaveLength(1);

    expect(await t.mutation(pumpProviderQueue, {})).toBe(1);

    const { job, rate } = await t.run(async (ctx) => {
      const job = await ctx.db.query("providerJobs").first();
      const rate = await ctx.db.query("providerRateLimits").first();
      if (!job || !rate) throw new Error("Expected queued provider state.");
      return { job, rate };
    });
    expect(job.status).toBe("scheduled");
    expect(job.estimatedRunAt).not.toBeNull();
    expect(rate.spacingMs).toBe(600);
    expect(rate.nextAvailableAt).toBe((job.estimatedRunAt ?? 0) + 600);

    expect(
      await t.query(getCollectionDetailStatuses, { rsns: ["Queue Player"] }),
    ).toMatchObject([
      {
        status: "queued",
        position: 1,
        estimatedRunAt: job.estimatedRunAt,
      },
    ]);
  });

  test("collection detail refresh enqueues work when only the summary is fresh", async () => {
    const t = convexTest({ schema, modules });
    const fetchedAt = Date.now();
    await t.run(async (ctx) => {
      const playerId = await ctx.db.insert("players", {
        normalizedRsn: "queue detail",
        displayRsn: "Queue Detail",
        createdAt: fetchedAt,
        lastRequestedAt: fetchedAt,
        lastSnapshotAt: fetchedAt,
        refreshAllowedAt: fetchedAt + 60 * 60 * 1_000,
      });
      await ctx.db.insert("categorySnapshots", {
        key: `${playerId}:collection:summary`,
        playerId,
        source: "runeProfile",
        category: "collection",
        segment: "summary",
        fetchedAt,
        completeness: "complete",
        data: { type: "collection", obtained: 1, total: 10 },
      });
    });

    expect(
      await t.action(refreshCollectionLog, { rsns: ["Queue Detail"] }),
    ).toMatchObject([
      {
        status: "queued",
        errorCode: null,
        position: 1,
      },
    ]);
    expect(
      await t.run(async (ctx) => await ctx.db.query("providerJobs").collect()),
    ).toHaveLength(1);
  });

  test("reclaims expired running jobs and ignores stale completions", async () => {
    const t = convexTest({ schema, modules });

    await t.mutation(enqueueCollectionDetail, { rsn: "Lease Player" });
    await t.mutation(pumpProviderQueue, {});
    const scheduledJob = await t.run(async (ctx) => {
      const job = await ctx.db.query("providerJobs").first();
      if (!job) throw new Error("Expected provider job.");
      return job;
    });
    const runningJob = await t.mutation(markRunningProviderJob, {
      jobId: scheduledJob._id,
    });
    if (!runningJob) throw new Error("Expected running provider job.");

    await t.run(async (ctx) => {
      await ctx.db.patch(scheduledJob._id, { leaseUntil: Date.now() - 1 });
    });
    await t.mutation(pumpProviderQueue, {});

    const reclaimedJob = await t.run(async (ctx) => {
      const job = await ctx.db.get(scheduledJob._id);
      if (!job) throw new Error("Expected reclaimed provider job.");
      return job;
    });
    expect(reclaimedJob).toMatchObject({
      status: "queued",
      attempts: 1,
      lastErrorCode: "timeout",
    });

    await t.mutation(completeProviderJob, {
      jobId: scheduledJob._id,
      startedAt: runningJob.startedAt,
    });
    expect(
      await t.run(async (ctx) => (await ctx.db.get(scheduledJob._id))?.status),
    ).toBe("queued");
  });

  test("refreshes collection detail when only the summary is fresh", async () => {
    const t = convexTest({ schema, modules });
    const fetchedAt = Date.now();
    const playerId = await t.run(async (ctx) => {
      const playerId = await ctx.db.insert("players", {
        normalizedRsn: "summary only",
        displayRsn: "Summary Only",
        createdAt: fetchedAt,
        lastRequestedAt: fetchedAt,
        lastSnapshotAt: fetchedAt,
        refreshAllowedAt: fetchedAt + 60 * 60 * 1_000,
      });
      await ctx.db.insert("categorySnapshots", {
        key: `${playerId}:collection:summary`,
        playerId,
        source: "runeProfile",
        category: "collection",
        segment: "summary",
        fetchedAt,
        completeness: "complete",
        data: { type: "collection", obtained: 1, total: 10 },
      });
      return playerId;
    });

    expect(
      await t.query(getCollectionRefreshPlan, { rsns: ["Summary Only"] }),
    ).toMatchObject([{ shouldRefresh: true }]);

    await t.run(async (ctx) => {
      await ctx.db.insert("canonicalItems", {
        key: `${playerId}:collection:collection.Bosses.Abyssal Sire.13262`,
        playerId,
        source: "runeProfile",
        category: "collection",
        revision: String(fetchedAt),
        itemKey: "collection.Bosses.Abyssal Sire.13262",
        label: "Abyssal orphan",
        group: "Bosses",
        state: "Abyssal Sire",
        completed: true,
        current: 1,
        total: null,
        points: 13262,
      });
    });

    expect(
      await t.query(getCollectionRefreshPlan, { rsns: ["Summary Only"] }),
    ).toMatchObject([{ shouldRefresh: false }]);
  });

  test("stores detailed collection rows and compares page and item gaps", async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(requestRefresh, { rsns: ["Left", "Right"] });
    const collectionLog = (quantities: [number, number]) => ({
      obtained: quantities.filter((quantity) => quantity > 0).length,
      total: 2,
      tabs: [
        {
          name: "Bosses",
          obtained: quantities.filter((quantity) => quantity > 0).length,
          total: 2,
          pages: [
            {
              name: "Abyssal Sire",
              obtained: quantities.filter((quantity) => quantity > 0).length,
              total: 2,
              items: [
                { id: 13262, name: "Abyssal orphan", quantity: quantities[0] },
                { id: 13273, name: "Unsired", quantity: quantities[1] },
              ],
            },
            {
              name: "Shared Drops",
              obtained: quantities[1] > 0 ? 1 : 0,
              total: 1,
              items: [{ id: 13273, name: "Unsired", quantity: quantities[1] }],
            },
          ],
        },
      ],
    });

    expect(
      await t.mutation(replaceCollectionLog, {
        rsn: "Left",
        fetchedAt: 100,
        collectionLog: collectionLog([1, 0]),
      }),
    ).toBe(true);
    expect(
      await t.mutation(replaceCollectionLog, {
        rsn: "Right",
        fetchedAt: 101,
        collectionLog: collectionLog([0, 2]),
      }),
    ).toBe(true);

    const comparison = await t.query(getCollectionComparison, {
      leftRsn: "Left",
      rightRsn: "Right",
    });

    expect(comparison.leftDetailAvailable).toBe(true);
    expect(comparison.rightDetailAvailable).toBe(true);
    expect(comparison.tabs[0]).toMatchObject({
      name: "Bosses",
      delta: 0,
    });
    expect(comparison.tabs[0]?.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Abyssal Sire", delta: 0 }),
        expect.objectContaining({ name: "Shared Drops", delta: -1 }),
      ]),
    );
    const items = await t.query(getCollectionItemsComparison, {
      leftRsn: "Left",
      rightRsn: "Right",
      tab: "all",
      status: "all",
      search: "sire",
      limit: 10,
    });
    expect(items.matchCount).toBe(2);
    expect(items.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Abyssal orphan",
          leftOwned: true,
          rightOwned: false,
          quantityDelta: 1,
        }),
        expect.objectContaining({
          label: "Unsired",
          leftOwned: false,
          rightOwned: true,
          quantityDelta: -2,
          pages: ["Abyssal Sire", "Shared Drops"],
          page: "Abyssal Sire, Shared Drops",
        }),
      ]),
    );
    expect(items.items.filter((item) => item.label === "Unsired")).toHaveLength(
      1,
    );
  });

  test("keeps unchanged collection detail item rows on repeated refreshes", async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(requestRefresh, { rsns: ["Stable"] });
    const collectionLog = {
      obtained: 1,
      total: 1,
      tabs: [
        {
          name: "Bosses",
          obtained: 1,
          total: 1,
          pages: [
            {
              name: "Abyssal Sire",
              obtained: 1,
              total: 1,
              items: [{ id: 13262, name: "Abyssal orphan", quantity: 1 }],
            },
          ],
        },
      ],
    };

    expect(
      await t.mutation(replaceCollectionLog, {
        rsn: "Stable",
        fetchedAt: 100,
        collectionLog,
      }),
    ).toBe(true);
    const firstRows = await t.run(
      async (ctx) => await ctx.db.query("canonicalItems").collect(),
    );

    expect(
      await t.mutation(replaceCollectionLog, {
        rsn: "Stable",
        fetchedAt: 200,
        collectionLog,
      }),
    ).toBe(true);
    const secondRows = await t.run(
      async (ctx) => await ctx.db.query("canonicalItems").collect(),
    );

    expect(secondRows).toHaveLength(1);
    expect(secondRows[0]?._id).toBe(firstRows[0]?._id);
    expect(secondRows[0]?.revision).toBe("100");
  });
});

describe("Wise Old Man overview cache", () => {
  test("claims at most one provider refresh per player per hour", async () => {
    const t = convexTest({ schema, modules });
    const now = Date.now();

    const first = await t.mutation(claimOverviewCacheRefresh, {
      rsn: "Cache_Player",
      now,
    });
    const duplicate = await t.mutation(claimOverviewCacheRefresh, {
      rsn: "cache player",
      now: now + 1,
    });

    expect(first.shouldFetch).toBe(true);
    expect(duplicate.shouldFetch).toBe(false);
    if (!first.requestId) throw new Error("Expected cache request ID.");

    await t.mutation(completeOverviewCacheRefresh, {
      rsn: "Cache Player",
      requestId: first.requestId,
      fetchedAt: now + 2,
      timeline: [{ date: now, value: 123 }],
      sevenDayGained: 50,
    });

    const cached = await t.mutation(claimOverviewCacheRefresh, {
      rsn: "Cache Player",
      now: now + 59 * 60 * 1_000,
    });
    expect(cached).toMatchObject({
      shouldFetch: false,
      cache: { fetchedAt: now + 2 },
    });

    const expired = await t.mutation(claimOverviewCacheRefresh, {
      rsn: "Cache Player",
      now: now + 60 * 60 * 1_000,
    });
    expect(expired.shouldFetch).toBe(true);
  });

  test("scopes skill caches by period and canonical skill key", async () => {
    const t = convexTest({ schema, modules });
    const now = Date.now();
    const gains = await t.mutation(claimSkillGainsCacheRefresh, {
      rsn: "Cache Player",
      period: "week",
      now,
    });
    const attack = await t.mutation(claimSkillTimelineCacheRefresh, {
      rsn: "Cache Player",
      skillKey: "skill.attack",
      now,
    });
    const defence = await t.mutation(claimSkillTimelineCacheRefresh, {
      rsn: "Cache Player",
      skillKey: "skill.defence",
      now,
    });

    expect(gains.shouldFetch).toBe(true);
    expect(attack.shouldFetch).toBe(true);
    expect(defence.shouldFetch).toBe(true);
  });

  test("backs off a failed skill gains cache claim before retry", async () => {
    const t = convexTest({ schema, modules });
    const now = Date.now();
    const refreshAllowedAt = now + 15 * 60 * 1_000;
    const first = await t.mutation(claimSkillGainsCacheRefresh, {
      rsn: "Retry Player",
      period: "week",
      now,
    });
    if (!first.requestId) throw new Error("Expected cache request ID.");

    await t.mutation(releaseSkillGainsCacheRefresh, {
      rsn: "Retry Player",
      period: "week",
      requestId: first.requestId,
      refreshAllowedAt,
    });
    const blockedRetry = await t.mutation(claimSkillGainsCacheRefresh, {
      rsn: "Retry Player",
      period: "week",
      now: now + 1,
    });
    const retry = await t.mutation(claimSkillGainsCacheRefresh, {
      rsn: "Retry Player",
      period: "week",
      now: refreshAllowedAt + 1,
    });
    expect(blockedRetry.shouldFetch).toBe(false);
    expect(retry.shouldFetch).toBe(true);
  });

  test("builds the XP timeline dashboard from overview history", () => {
    const day = 24 * 60 * 60 * 1_000;
    const now = Math.floor(Date.now() / day) * day;
    const timeline = (values: number[]) =>
      values.map((value, index) => ({
        date: now - (7 - index) * day,
        value,
      }));
    const dashboard = buildXpTimelineDashboard(
      timeline([100, 120, 150, 180, 220, 260, 300, 350]),
      timeline([110, 125, 145, 175, 205, 240, 275, 310]),
      "week",
      now,
    );

    expect(dashboard.points).toHaveLength(8);
    expect(dashboard.summaries).toMatchObject({
      currentGap: 40,
      leftGained: 250,
      rightGained: 200,
      biggestSingleDayGain: { side: "left", value: 50 },
      longestLeadStreak: { side: "left", days: 6 },
    });
  });
});
