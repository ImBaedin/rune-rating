import { expect, test } from "bun:test";
import {
  achievementBindings,
  achievementVersion,
} from "@rune-rating/domain/achievements";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = {
  "./_generated/api.js": () => import("../convex/_generated/api"),
  "./_generated/server.js": () => import("../convex/_generated/server"),
  "./achievements.ts": () => import("../convex/achievements"),
  "./runeProfile.ts": () => import("../convex/runeProfile"),
};
test("current derived progress is compact, normalized, versioned, and hidden when RuneProfile is unavailable", async () => {
  const t = convexTest({ schema, modules });
  expect(
    await t.query(api.achievements.progress, { rsn: "Atlas User" }),
  ).toMatchObject({ needsRebuild: true, availability: "pending" });
  await t.mutation(internal.achievements.enroll, { rsn: "Atlas User" });
  expect(
    (await t.query(api.achievements.progress, { rsn: "atlas_user" }))
      .availability,
  ).toBe("pending");
  const { playerId, stateId } = await t.run(async (ctx) => {
    const player = (await ctx.db.query("players").first())!;
    const stateId = await ctx.db.insert("snapshotStates", {
      key: `${player._id}:runeProfile:quests`,
      playerId: player._id,
      source: "runeProfile",
      category: "quests",
      status: "fresh",
      requestId: "test",
      lastAttemptAt: 1,
      lastSuccessAt: 1,
      errorCode: null,
    });
    await ctx.db.insert("categorySnapshots", {
      key: `${player._id}:quests:all`,
      playerId: player._id,
      source: "runeProfile",
      category: "quests",
      segment: "all",
      fetchedAt: 1,
      completeness: "complete",
      data: {
        type: "quests",
        completed: 1,
        started: 0,
        notStarted: 0,
        total: 1,
        earnedPoints: 1,
        totalPoints: 1,
      },
    });
    await ctx.db.insert("canonicalItems", {
      key: `${player._id}:quests:quest.17`,
      playerId: player._id,
      source: "runeProfile",
      category: "quests",
      revision: "1",
      itemKey: "quest.17",
      label: "Cook's Assistant",
      group: "free",
      state: "finished",
      completed: true,
      current: null,
      total: null,
      points: 1,
    });
    await ctx.db.insert("categorySnapshots", {
      key: `${player._id}:skills:all`,
      playerId: player._id,
      source: "hiscores",
      category: "skills",
      segment: "all",
      fetchedAt: 1,
      completeness: "complete",
      data: {
        type: "skills",
        values: [
          {
            key: "skill.farming",
            name: "Farming",
            level: { value: 99, availabilityReason: null },
            xp: { value: 50_000_000, availabilityReason: null },
            rank: { value: 1, availabilityReason: null },
          },
        ],
      },
    });
    return { playerId: player._id, stateId };
  });
  await t.mutation(internal.achievements.rebuild, { playerId });
  const response = await t.query(api.achievements.progress, {
    rsn: "ATLAS USER",
  });
  expect(response.availability).toBe("ready");
  expect(response.version).toBe(achievementVersion);
  expect(response.needsRebuild).toBe(false);
  expect(response.states).toHaveLength(achievementBindings.length);
  expect(JSON.stringify(response).length).toBeLessThan(1500);
  expect(
    await t.query(api.achievements.detail, {
      rsn: "Atlas User",
      nodeId: "first-200m",
    }),
  ).toMatchObject({
    current: 50_000_000,
    breakdown: {
      unit: "XP",
      items: [
        {
          key: "skill.farming",
          label: "Farming",
          current: 50_000_000,
          target: 200_000_000,
        },
      ],
    },
  });
  const cooks = achievementBindings.find(
    (n) => n.rule.kind === "threshold" && n.rule.key === "quest.17",
  )!;
  expect(
    (
      await t.query(api.achievements.detail, {
        rsn: "Atlas User",
        nodeId: cooks.id,
      })
    )?.met,
  ).toBe(true);
  const calculatedAt = await t.run(
    async (ctx) =>
      (await ctx.db.query("achievementProgress").first())!.calculatedAt,
  );
  await t.mutation(internal.achievements.rebuild, { playerId });
  expect(
    await t.run(
      async (ctx) =>
        (await ctx.db.query("achievementProgress").first())!.calculatedAt,
    ),
  ).toBe(calculatedAt);
  const collectionDetailId = await t.run(async (ctx) => {
    const detailId = await ctx.db.insert("categorySnapshots", {
      key: `${playerId}:collection:detail`,
      playerId,
      source: "runeProfile",
      category: "collection",
      segment: "detail",
      fetchedAt: 2,
      completeness: "complete",
      data: { type: "collection", obtained: 12, total: 12 },
    });
    for (let i = 0; i < 12; i++) {
      const segment = `page:Bosses:Example ${i}`;
      await ctx.db.insert("categorySnapshots", {
        key: `${playerId}:collection:${segment}`,
        playerId,
        source: "runeProfile",
        category: "collection",
        segment,
        fetchedAt: 2,
        completeness: "complete",
        data: { type: "collection", obtained: 1, total: 1 },
      });
    }
    await ctx.db.insert("categorySnapshots", {
      key: `${playerId}:collection:page:Bosses:Hespori`,
      playerId,
      source: "runeProfile",
      category: "collection",
      segment: "page:Bosses:Hespori",
      fetchedAt: 2,
      completeness: "complete",
      data: { type: "collection", obtained: 0, total: 4 },
    });
    return detailId;
  });
  await t.mutation(internal.achievements.rebuild, { playerId });
  const greenlogs = await t.query(api.achievements.detail, {
    rsn: "Atlas User",
    nodeId: "greenlogs-10",
  });
  expect(greenlogs?.met).toBe(true);
  expect(greenlogs?.current).toBe(12);
  expect(greenlogs?.contributors?.items).toHaveLength(12);
  expect(greenlogs?.contributors?.items[0]).toEqual({
    key: "collection.page.Example 0",
    label: "Example 0",
  });
  expect(greenlogs?.breakdown?.items[0]?.milestoneId).toBe("log-hespori");
  const bossLog = await t.query(api.achievements.detail, {
    rsn: "Atlas User",
    nodeId: "log-hespori",
  });
  expect(bossLog?.collectionLog?.items).toHaveLength(4);
  expect(bossLog?.collectionLog?.items.every((i) => !i.obtained)).toBe(true);
  // Evidence follows the replaced current snapshot, never a historical completion list.
  await t.run(async (ctx) => {
    const pages = await ctx.db
      .query("categorySnapshots")
      .withIndex("by_player_and_category", (q) =>
        q.eq("playerId", playerId).eq("category", "collection"),
      )
      .take(20);
    for (const page of pages)
      if (page.segment.startsWith("page:")) await ctx.db.delete(page._id);
    await ctx.db.patch(collectionDetailId, {
      fetchedAt: 3,
      data: { type: "collection", obtained: 0, total: 12 },
    });
  });
  await t.mutation(internal.achievements.rebuild, { playerId });
  expect(
    await t.query(api.achievements.detail, {
      rsn: "Atlas User",
      nodeId: "greenlogs-10",
    }),
  ).toMatchObject({ met: false, current: 0, contributors: { items: [] } });
  const currentStates = (
    await t.query(api.achievements.progress, { rsn: "Atlas User" })
  ).states;
  // A new catalog and a malformed vector both invalidate the derived cache,
  // even when its source revisions have not changed and providers are cooling down.
  const refreshAllowedAt = Date.now() + 3_600_000;
  for (const version of ["previous-catalog", achievementVersion]) {
    await t.run(async (ctx) => {
      const cache = await ctx.db.query("achievementProgress").first();
      if (!cache) throw new Error("Expected enrolled achievement progress");
      await ctx.db.patch(cache._id, { version, states: "" });
      await ctx.db.patch(playerId, { refreshAllowedAt });
    });
    expect(
      await t.query(api.achievements.progress, { rsn: "Atlas User" }),
    ).toMatchObject({ needsRebuild: true, states: "", refreshAllowedAt });
    await t.mutation(internal.achievements.rebuild, { playerId });
    expect(
      await t.query(api.achievements.progress, { rsn: "Atlas User" }),
    ).toMatchObject({
      needsRebuild: false,
      availability: "ready",
      states: currentStates,
      refreshAllowedAt,
    });
  }
  await t.run(async (ctx) => {
    await ctx.db.patch(stateId, { status: "notConnected" });
  });
  expect(
    (await t.query(api.achievements.progress, { rsn: "Atlas User" })).states,
  ).toBe("");
  expect(
    await t.query(api.achievements.detail, {
      rsn: "Atlas User",
      nodeId: cooks.id,
    }),
  ).toBeNull();
});
test("empty complete collection details are cached; stale commits cannot overwrite newer details", async () => {
  const t = convexTest({ schema, modules });
  const now = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.insert("players", {
      normalizedRsn: "empty log",
      displayRsn: "Empty Log",
      createdAt: now,
      lastRequestedAt: now,
      lastSnapshotAt: null,
      refreshAllowedAt: 0,
    });
  });
  const collectionLog = { obtained: 0, total: 1717, tabs: [] };
  expect(
    await t.mutation(internal.runeProfile.replaceCollectionLog, {
      rsn: "Empty Log",
      fetchedAt: now,
      collectionLog,
    }),
  ).toBe(true);
  expect(
    await t.query(internal.runeProfile.getCollectionRefreshPlan, {
      rsns: ["Empty Log"],
    }),
  ).toMatchObject([{ shouldRefresh: false }]);
  expect(
    await t.mutation(internal.runeProfile.replaceCollectionLog, {
      rsn: "Empty Log",
      fetchedAt: now - 1,
      collectionLog: { ...collectionLog, obtained: 1 },
    }),
  ).toBe(false);
  expect(
    await t.run(async (ctx) => {
      const player = (await ctx.db.query("players").first())!;
      return (
        await ctx.db
          .query("categorySnapshots")
          .withIndex("by_key", (q) =>
            q.eq("key", `${player._id}:collection:detail`),
          )
          .unique()
      )?.fetchedAt;
    }),
  ).toBe(now);
});

test("fresh quests cannot hide failed Hiscores and details report only relevant sources", async () => {
  const t = convexTest({ schema, modules });
  await t.mutation(internal.achievements.enroll, { rsn: "Fresh Test" });
  const now = Date.now();
  await t.run(async (ctx) => {
    const player = await ctx.db.query("players").first();
    if (!player) throw Error("Test player was not enrolled");
    for (const [source, category, status] of [
      ["runeProfile", "quests", "fresh"],
      ["hiscores", "skills", "failed"],
      ["hiscores", "activities", "failed"],
      ["runeProfile", "combatAchievements", "failed"],
    ] as const) {
      await ctx.db.insert("snapshotStates", {
        key: `${player._id}:${source}:${category}`,
        playerId: player._id,
        source,
        category,
        status,
        requestId: "test",
        lastAttemptAt: now,
        lastSuccessAt: now - 1000,
        errorCode: status === "failed" ? "upstream" : null,
      });
    }
    await ctx.db.insert("categorySnapshots", {
      key: `${player._id}:quests:all`,
      playerId: player._id,
      source: "runeProfile",
      category: "quests",
      segment: "all",
      fetchedAt: now,
      completeness: "complete",
      data: {
        type: "quests",
        completed: 0,
        started: 0,
        notStarted: 1,
        total: 1,
        earnedPoints: 0,
        totalPoints: 1,
      },
    });
  });
  expect(
    await t.query(api.achievements.progress, { rsn: "Fresh Test" }),
  ).toMatchObject({ availability: "ready", stale: true, refreshing: false });
  const quest = await t.query(api.achievements.detail, {
    rsn: "Fresh Test",
    nodeId: "dragon-2",
  });
  expect(
    quest?.sourceFreshness.map((source) => [source.key, source.status]),
  ).toEqual([
    ["quests", "fresh"],
    ["skills", "failed"],
  ]);
  const cook = await t.query(api.achievements.detail, {
    rsn: "Fresh Test",
    nodeId: "cooks-assistant",
  });
  expect(cook?.sourceFreshness.map((source) => source.key)).toEqual(["quests"]);
});

test("collection details use their own timestamp and queue status, not a fresh summary", async () => {
  const t = convexTest({ schema, modules });
  await t.mutation(internal.achievements.enroll, { rsn: "Log Test" });
  const now = Date.now();
  const jobId = await t.run(async (ctx) => {
    const player = await ctx.db.query("players").first();
    if (!player) throw Error("Test player was not enrolled");
    await ctx.db.insert("snapshotStates", {
      key: `${player._id}:runeProfile:quests`,
      playerId: player._id,
      source: "runeProfile",
      category: "quests",
      status: "fresh",
      requestId: "test",
      lastAttemptAt: now,
      lastSuccessAt: now,
      errorCode: null,
    });
    for (const [segment, fetchedAt] of [
      ["summary", now],
      ["detail", now - 7_200_000],
    ] as const) {
      await ctx.db.insert("categorySnapshots", {
        key: `${player._id}:collection:${segment}`,
        playerId: player._id,
        source: "runeProfile",
        category: "collection",
        segment,
        fetchedAt,
        completeness: "complete",
        data: { type: "collection", obtained: 0, total: 1 },
      });
    }
    return await ctx.db.insert("providerJobs", {
      provider: "runeProfile",
      operation: "runeProfileCollectionDetail",
      dedupeKey: "runeProfile:collectionDetail:log test",
      rsnKey: "log test",
      args: { type: "runeProfileCollectionDetail", rsn: "Log Test" },
      status: "queued",
      priority: 0,
      nextAttemptAt: now,
      attempts: 0,
      leaseUntil: null,
      estimatedRunAt: now,
      startedAt: null,
      completedAt: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
    });
  });
  const detail = () =>
    t.query(api.achievements.detail, {
      rsn: "Log Test",
      nodeId: "base-berserker-ring",
    });
  expect(
    (await detail())?.sourceFreshness.find(
      (source) => source.key === "collectionDetail",
    ),
  ).toMatchObject({ status: "refreshing", fetchedAt: now - 7_200_000 });
  expect(
    await t.query(api.achievements.progress, { rsn: "Log Test" }),
  ).toMatchObject({ refreshing: true, stale: true });
  await t.run(async (ctx) => {
    await ctx.db.patch(jobId, { status: "dead", lastErrorCode: "upstream" });
  });
  expect(
    (await detail())?.sourceFreshness.find(
      (source) => source.key === "collectionDetail",
    ),
  ).toMatchObject({ status: "failed", fetchedAt: now - 7_200_000 });
  await t.run(async (ctx) => {
    await ctx.db.patch(jobId, { status: "succeeded" });
  });
  expect(
    (await detail())?.sourceFreshness.find(
      (source) => source.key === "collectionDetail",
    ),
  ).toMatchObject({ status: "stale", fetchedAt: now - 7_200_000 });
});
