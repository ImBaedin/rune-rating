import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import { queueAchievementUpdate } from "../convex/lib/achievements";
import { reclaimExpiredLeases } from "../convex/providerQueueScheduling";
import schema from "../convex/schema";

const modules = {
  "./_generated/api.js": () => import("../convex/_generated/api"),
  "./_generated/server.js": () => import("../convex/_generated/server"),
  "./achievements.ts": () => import("../convex/achievements"),
  "./refresh.ts": () => import("../convex/refresh"),
  "./runeProfile.ts": () => import("../convex/runeProfile"),
  "./providerQueue.ts": () => import("../convex/providerQueue"),
};
const createTest = () => convexTest({ schema, modules });
type Test = ReturnType<typeof createTest>;

// Drive provider commits explicitly, without making external API requests.
async function cancelBackground(t: Test) {
  await t.run(async (ctx) => {
    for (const job of await ctx.db.system
      .query("_scheduled_functions")
      .collect()) {
      if (
        job.state.kind === "pending" &&
        !job.name.includes("achievements:rebuild")
      )
        await ctx.scheduler.cancel(job._id);
    }
  });
}
async function rebuilds(t: Test) {
  return await t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).filter(
      (job) => job.name.includes("achievements:rebuild"),
    ),
  );
}
async function flush(t: Test) {
  await cancelBackground(t);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await t.finishInProgressScheduledFunctions();
}
async function start(t: Test) {
  const playerId = await t.mutation(internal.achievements.enroll, {
    rsn: "Atlas User",
  });
  expect(
    await t.run((ctx) => ctx.db.query("achievementEvidence").first()),
  ).toBeNull();
  await t.mutation(api.refresh.request, { rsns: ["Atlas User"] });
  await cancelBackground(t);
  const lease = await t.run((ctx) => ctx.db.query("refreshLeases").first());
  if (!lease) throw Error("Missing lease");
  return { playerId, requestId: lease.requestId };
}
async function hiscores(t: Test, args: Awaited<ReturnType<typeof start>>) {
  await t.mutation(internal.refresh.completeHiscores, {
    ...args,
    displayRsn: "Atlas User",
    fetchedAt: Date.now(),
    skills: [],
    activities: [],
  });
  await cancelBackground(t);
}
async function profile(t: Test, args: Awaited<ReturnType<typeof start>>) {
  await t.mutation(internal.refresh.completeRuneProfile, {
    ...args,
    fetchedAt: Date.now(),
    accountType: { id: 0, key: "regular", name: "Regular" },
    groupName: null,
    quests: [],
    questSummary: {
      completed: 0,
      started: 0,
      notStarted: 0,
      total: 0,
      totalPoints: 0,
      earnedPoints: 0,
    },
    diaries: [],
    diarySummary: [],
    combatAchievementTasks: [
      {
        index: 1,
        tierId: 1,
        tierName: "Easy",
        name: "Test",
        description: "Test",
        type: "kill_count",
        monster: "Test",
        completed: true,
      },
    ],
    combatAchievementTiers: [{ id: 1, name: "Easy", completed: 1, total: 1 }],
    combatAchievementPoints: 1,
    combatAchievementTierReached: "Easy",
    combatAchievementsValid: true,
    collectionSummary: { obtained: 0, total: 1717 },
  });
  await cancelBackground(t);
}
async function wom(t: Test, args: Awaited<ReturnType<typeof start>>) {
  await t.mutation(internal.refresh.completeWiseOldManFailure, {
    ...args,
    status: "failed",
    errorCode: "upstream",
  });
  await cancelBackground(t);
}
async function runningCollection(t: Test) {
  return await t.run(async (ctx) => {
    const job = await ctx.db.query("providerJobs").first();
    if (job?.operation !== "runeProfileCollectionDetail")
      throw Error("Missing collection job");
    const startedAt = Date.now();
    await ctx.db.patch(job._id, {
      status: "running",
      startedAt,
      leaseUntil: startedAt + 60_000,
    });
    return { jobId: job._id, startedAt };
  });
}

for (const order of ["profile-first", "wom-first"] as const) {
  test(`one rebuild after the entire update and collection commit (${order})`, async () => {
    const t = createTest();
    const args = await start(t);
    await hiscores(t, args);
    expect(await rebuilds(t)).toHaveLength(0);
    await (order === "profile-first" ? profile(t, args) : wom(t, args));
    expect(await rebuilds(t)).toHaveLength(0);
    await (order === "profile-first" ? wom(t, args) : profile(t, args));
    expect(await rebuilds(t)).toHaveLength(0);
    const job = await runningCollection(t);
    await t.mutation(internal.runeProfile.replaceCollectionLog, {
      rsn: "Atlas User",
      fetchedAt: Date.now(),
      collectionLog: { obtained: 0, total: 1717, tabs: [] },
    });
    expect(await rebuilds(t)).toHaveLength(0);
    await t.mutation(internal.providerQueue.completeJob, job);
    // Duplicate completion callbacks and queue requests share the pending rebuild.
    await t.mutation(internal.providerQueue.completeJob, job);
    await t.run((ctx) => queueAchievementUpdate(ctx, args.playerId));
    expect(await rebuilds(t)).toHaveLength(1);
    await flush(t);
    const cache = await t.run((ctx) =>
      ctx.db.query("achievementProgress").first(),
    );
    expect(cache?.states.length).toBeGreaterThan(900);
    expect(cache?.pendingRebuildId).toBeUndefined();
  });
}

test("collection retries defer rebuilding, terminal failure releases it", async () => {
  const t = createTest();
  const args = await start(t);
  await hiscores(t, args);
  await profile(t, args);
  await wom(t, args);
  let job = await runningCollection(t);
  await t.mutation(internal.providerQueue.failJob, {
    ...job,
    errorCode: "rateLimited",
    retryAfterMs: 60_000,
    retryable: true,
  });
  await cancelBackground(t);
  expect(await rebuilds(t)).toHaveLength(0);
  job = await runningCollection(t);
  await t.mutation(internal.providerQueue.failJob, {
    ...job,
    errorCode: "notConnected",
    retryAfterMs: null,
    retryable: false,
  });
  expect(await rebuilds(t)).toHaveLength(1);
  await flush(t);
  expect(
    (await t.query(api.achievements.progress, { rsn: "Atlas User" }))
      .needsRebuild,
  ).toBe(false);
});

test("exhausted collection leases also release the rebuild", async () => {
  const t = createTest();
  const args = await start(t);
  await hiscores(t, args);
  await profile(t, args);
  await wom(t, args);
  const job = await runningCollection(t);
  await t.run(async (ctx) => {
    await ctx.db.patch(job.jobId, {
      attempts: 100,
      leaseUntil: Date.now() - 1,
    });
    await reclaimExpiredLeases(ctx, Date.now());
  });
  expect(await rebuilds(t)).toHaveLength(1);
  await flush(t);
});

test("fresh collection data avoids fetching; repeated finish calls coalesce", async () => {
  const t = createTest();
  const args = await start(t);
  await t.mutation(internal.runeProfile.replaceCollectionLog, {
    rsn: "Atlas User",
    fetchedAt: Date.now(),
    collectionLog: { obtained: 0, total: 1717, tabs: [] },
  });
  expect(await rebuilds(t)).toHaveLength(0);
  await hiscores(t, args);
  await profile(t, args);
  await wom(t, args);
  await t.mutation(internal.achievements.finishRefresh, {
    playerId: args.playerId,
  });
  expect(await t.run((ctx) => ctx.db.query("providerJobs").first())).toBeNull();
  expect(await rebuilds(t)).toHaveLength(1);
  await flush(t);
});

test("failed Hiscores and RuneProfile refreshes do not leave achievement enrollment pending", async () => {
  for (const provider of ["hiscores", "runeProfile"] as const) {
    const t = createTest();
    const args = await start(t);
    if (provider === "hiscores") {
      await t.mutation(internal.refresh.completeFailure, {
        ...args,
        status: "failed",
        errorCode: "upstream",
      });
    } else {
      await hiscores(t, args);
      await t.mutation(internal.refresh.completeRuneProfileFailure, {
        ...args,
        status: "failed",
        errorCode: "upstream",
      });
      await wom(t, args);
    }
    expect(await rebuilds(t)).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.query("providerJobs").first()),
    ).toBeNull();
    await flush(t);
  }
});

test("repeated loads share an active refresh; cooldown loads repair catalog changes without fetching", async () => {
  const t = createTest();
  const args = await start(t);
  await t.action(api.achievements.load, { rsn: "atlas_user" });
  await cancelBackground(t);
  expect(await rebuilds(t)).toHaveLength(0);
  expect(
    (await t.run((ctx) => ctx.db.query("refreshLeases").first()))?.requestId,
  ).toBe(args.requestId);
  await t.mutation(internal.runeProfile.replaceCollectionLog, {
    rsn: "Atlas User",
    fetchedAt: Date.now(),
    collectionLog: { obtained: 0, total: 1717, tabs: [] },
  });
  await hiscores(t, args);
  await profile(t, args);
  await wom(t, args);
  await flush(t);
  await t.run(async (ctx) => {
    const cache = await ctx.db.query("achievementProgress").first();
    if (!cache) throw Error("Missing cache");
    await ctx.db.patch(cache._id, { version: "outdated" });
  });
  await t.action(api.achievements.load, { rsn: "Atlas User" });
  await cancelBackground(t);
  await t.action(api.achievements.load, { rsn: "Atlas User" });
  await cancelBackground(t);
  expect(await t.run((ctx) => ctx.db.query("providerJobs").first())).toBeNull();
  expect(
    await t.run((ctx) => ctx.db.query("refreshLeases").first()),
  ).toBeNull();
  expect(await rebuilds(t)).toHaveLength(2); // Original refresh + one catalog repair.
  await flush(t);
  expect(
    (await t.query(api.achievements.progress, { rsn: "Atlas User" }))
      .needsRebuild,
  ).toBe(false);
});

test("a rebuild queued before a new refresh cannot calculate a partial snapshot", async () => {
  const t = createTest();
  const playerId = await t.mutation(internal.achievements.enroll, {
    rsn: "Atlas User",
  });
  await t.run((ctx) => queueAchievementUpdate(ctx, playerId));
  await t.mutation(api.refresh.request, { rsns: ["Atlas User"] });
  await flush(t);
  expect(
    (await t.run((ctx) => ctx.db.query("achievementProgress").first()))
      ?.calculatedAt,
  ).toBe(0);
  const lease = await t.run((ctx) => ctx.db.query("refreshLeases").first());
  if (!lease) throw Error("Missing lease");
  await t.mutation(internal.refresh.completeFailure, {
    playerId,
    requestId: lease.requestId,
    status: "failed",
    errorCode: "upstream",
  });
  await flush(t);
  expect(
    (await t.run((ctx) => ctx.db.query("achievementProgress").first()))
      ?.calculatedAt,
  ).toBeGreaterThan(0);
});

test("lease expiry cannot release a rebuild ahead of in-flight source commits", async () => {
  const t = createTest();
  const args = await start(t);
  await hiscores(t, args);
  await t.run(async (ctx) => {
    const lease = await ctx.db.query("refreshLeases").first();
    if (!lease) throw Error("Missing lease");
    await ctx.db.patch(lease._id, { leaseUntil: Date.now() - 1 });
  });
  await t.mutation(internal.runeProfile.replaceCollectionLog, {
    rsn: "Atlas User",
    fetchedAt: Date.now(),
    collectionLog: { obtained: 0, total: 1717, tabs: [] },
  });
  await t.mutation(internal.achievements.finishRefresh, {
    playerId: args.playerId,
  });
  expect(await rebuilds(t)).toHaveLength(0);
  await profile(t, args);
  await wom(t, args);
  expect(await rebuilds(t)).toHaveLength(1);
  await flush(t);
});

test("provider metadata tracks granular changes, unchanged content, and validation changes", async () => {
  const t = createTest();
  const args = await start(t);
  await hiscores(t, args);
  await profile(t, args);
  await wom(t, args);
  const job = await runningCollection(t);
  const fetchedAt = Date.now();
  const log = {
    obtained: 1,
    total: 2,
    tabs: [
      {
        name: "Bosses",
        obtained: 1,
        total: 2,
        pages: [
          {
            name: "Test",
            obtained: 1,
            total: 2,
            items: [
              { id: 1, name: "First", quantity: 1 },
              { id: 2, name: "Second", quantity: 0 },
            ],
          },
        ],
      },
    ],
  };
  await t.mutation(internal.runeProfile.replaceCollectionLog, {
    rsn: "Atlas User",
    fetchedAt,
    collectionLog: log,
  });
  await t.mutation(internal.providerQueue.completeJob, job);
  await flush(t);
  const read = () =>
    t.run(async (ctx) => ({
      sources: await ctx.db.query("achievementSources").first(),
      cache: await ctx.db.query("achievementProgress").first(),
    }));
  const original = await read();
  await t.mutation(internal.runeProfile.replaceCollectionLog, {
    rsn: "Atlas User",
    fetchedAt: fetchedAt + 1,
    collectionLog: log,
  });
  await flush(t);
  const unchanged = await read();
  expect(unchanged.sources?.sources.collectionDetail?.contentHash).toBe(
    original.sources?.sources.collectionDetail?.contentHash,
  );
  expect(unchanged.cache?.calculatedAt).toBe(original.cache?.calculatedAt);
  const changed = structuredClone(log);
  const items = changed.tabs[0]?.pages[0]?.items;
  if (!items?.[0] || !items[1]) throw Error("Missing fixture items");
  items[0].quantity = 0;
  items[1].quantity = 1; // Same total, different item membership.
  await t.mutation(internal.runeProfile.replaceCollectionLog, {
    rsn: "Atlas User",
    fetchedAt: fetchedAt + 2,
    collectionLog: changed,
  });
  await flush(t);
  const updated = await read();
  expect(updated.sources?.sources.collectionDetail?.contentHash).not.toBe(
    original.sources?.sources.collectionDetail?.contentHash,
  );
  expect(updated.cache?.sources).not.toBe(original.cache?.sources);
  const cacheSources = updated.cache?.sources;
  await t.run(async (ctx) => {
    const state = await ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (q) =>
        q.eq("key", `${args.playerId}:runeProfile:combatAchievements`),
      )
      .unique();
    if (!state) throw Error("Missing combat state");
    await ctx.db.patch(state._id, {
      status: "failed",
      errorCode: "granularInvalid",
    });
  });
  await t.mutation(internal.achievements.rebuild, { playerId: args.playerId });
  expect((await read()).cache?.sources).not.toBe(cacheSources);
  // An older detail commit must not roll back either data or its metadata.
  expect(
    await t.mutation(internal.runeProfile.replaceCollectionLog, {
      rsn: "Atlas User",
      fetchedAt,
      collectionLog: log,
    }),
  ).toBe(false);
  expect((await read()).sources).toEqual(updated.sources);
});

test("an older collection response preserves newer RuneProfile summary metadata", async () => {
  const t = createTest();
  const args = await start(t);
  await hiscores(t, args);
  await profile(t, args);
  const previous = await t.run((ctx) =>
    ctx.db.query("achievementSources").first(),
  );
  const summaryAt = previous?.sources.collectionSummary?.fetchedAt;
  if (!summaryAt) throw Error("Missing summary");
  await t.mutation(internal.runeProfile.replaceCollectionLog, {
    rsn: "Atlas User",
    fetchedAt: summaryAt - 1,
    collectionLog: { obtained: 99, total: 999, tabs: [] },
  });
  const current = await t.run((ctx) =>
    ctx.db.query("achievementSources").first(),
  );
  expect(current?.sources.collectionSummary).toEqual(
    previous?.sources.collectionSummary,
  );
  expect(current?.sources.collectionDetail?.fetchedAt).toBe(summaryAt - 1);
  await wom(t, args);
  await flush(t);
});
