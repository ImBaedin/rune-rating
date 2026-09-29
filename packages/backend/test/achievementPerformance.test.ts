import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import type { MutationCtx } from "../convex/_generated/server";
import * as endpoints from "../convex/achievements";
import { updateAchievementSources } from "../convex/lib/achievementSources";
import { rebuildAchievementProgress } from "../convex/lib/achievements";
import { syncCanonicalItemsForCategory } from "../convex/lib/canonicalItems";
import { contentHash } from "../convex/lib/contentHash";
import { getOrCreatePlayer } from "../convex/lib/players";
import schema from "../convex/schema";
import * as beforeEndpoints from "./performance/baseline/endpoints";
import { getOrCreatePlayer as beforeGetPlayer } from "./performance/baseline/players";
import { getProfile as beforeProfile } from "./performance/baseline/profile";
import { rebuildAchievementProgress as beforeRebuild } from "./performance/baseline/rebuild";
import { seed } from "./performance/fixture";
import { handler, measuredContext, newMetrics } from "./performance/measure";

const modules = {
  "./_generated/api.js": () => import("../convex/_generated/api"),
  "./_generated/server.js": () => import("../convex/_generated/server"),
  "./achievements.ts": () => import("../convex/achievements"),
  "./players.ts": () => import("../convex/players"),
  "./refresh.ts": () => import("../convex/refresh"),
};
const createTest = () => convexTest({ schema, modules });
type Test = ReturnType<typeof createTest>;
async function measure<T>(t: Test, fn: (ctx: MutationCtx) => Promise<T>) {
  const metrics = newMetrics();
  const result = await t.run((ctx) => fn(measuredContext(ctx, metrics)));
  return { metrics, result };
}
async function output(t: Test) {
  return await t.run(async (ctx) => ({
    states: (await ctx.db.query("achievementProgress").first())?.states,
    evidence: (await ctx.db.query("achievementEvidence").collect())
      .sort((a, b) => a.chunk - b.chunk)
      .map((row) => row.rows),
  }));
}

test("achievement workload measures reduced reads with identical states and evidence", async () => {
  const old = createTest();
  const current = createTest();
  const fixtureTime = Date.now();
  const oldFixture = await seed(old, fixtureTime);
  const newFixture = await seed(current, fixtureTime);
  await old.run((ctx) => beforeRebuild(ctx, oldFixture.playerId));
  await current.run((ctx) =>
    rebuildAchievementProgress(ctx, newFixture.playerId),
  );
  expect(await output(current)).toEqual(await output(old));
  const results: Record<string, unknown> = {};

  for (const scenario of ["unchanged_refresh", "one_skill_changed"] as const) {
    for (const t of [old, current]) {
      await t.run(async (ctx) => {
        const snapshots = await ctx.db.query("categorySnapshots").collect();
        const metadata = await ctx.db.query("achievementSources").first();
        if (!metadata) throw Error("Missing metadata");
        const sources = { ...metadata.sources };
        for (const snapshot of snapshots) {
          let data = snapshot.data;
          if (scenario === "one_skill_changed" && data.type === "skills") {
            data = {
              ...data,
              values: data.values.map((skill, i) =>
                i
                  ? skill
                  : {
                      ...skill,
                      level: { value: 99, availabilityReason: null },
                      xp: { value: 14_000_000, availabilityReason: null },
                    },
              ),
            };
            if (sources.skills)
              sources.skills.contentHash = await contentHash(data);
          }
          await ctx.db.patch(snapshot._id, {
            fetchedAt: snapshot.fetchedAt + 1000,
            data,
          });
        }
        for (const source of Object.values(sources))
          if (source) source.fetchedAt += 1000;
        await ctx.db.patch(metadata._id, { sources });
      });
    }
    const before = await measure(old, (ctx) =>
      beforeRebuild(ctx, oldFixture.playerId),
    );
    const after = await measure(current, (ctx) =>
      rebuildAchievementProgress(ctx, newFixture.playerId),
    );
    expect(await output(current)).toEqual(await output(old));
    expect(after.metrics.readBytes).toBeLessThan(before.metrics.readBytes);
    expect(after.metrics.tables.achievementEvidence).toBeUndefined();
    if (scenario === "unchanged_refresh") {
      expect(after.metrics.tables.canonicalItems).toBeUndefined();
      expect(after.metrics.tables.categorySnapshots).toBeUndefined();
      expect(after.metrics.readBytes / before.metrics.readBytes).toBeLessThan(
        0.02,
      );
    }
    results[scenario] = { before: before.metrics, after: after.metrics };
  }
  const beforeAtlas = await measure(old, async (ctx) => ({
    progress: await handler<{ rsn: string }, unknown>(beforeEndpoints.progress)(
      ctx,
      { rsn: "Benchmark" },
    ),
    profile: await handler<{ rsn: string }, unknown>(beforeProfile)(ctx, {
      rsn: "Benchmark",
    }),
  }));
  const afterAtlas = await measure(current, (ctx) =>
    handler<{ rsn: string }, unknown>(endpoints.atlas)(ctx, {
      rsn: "Benchmark",
    }),
  );
  expect(
    afterAtlas.metrics.readBytes / beforeAtlas.metrics.readBytes,
  ).toBeLessThan(0.5);
  expect(afterAtlas.metrics.tables.categorySnapshots).toBeUndefined();
  results.atlas_read = {
    before: beforeAtlas.metrics,
    after: afterAtlas.metrics,
  };

  for (const nodeId of ["cooks-assistant", "first-200m"]) {
    const before = await measure(old, (ctx) =>
      handler<{ rsn: string; nodeId: string }, unknown>(beforeEndpoints.detail)(
        ctx,
        { rsn: "Benchmark", nodeId },
      ),
    );
    const after = await measure(current, (ctx) =>
      handler<{ rsn: string; nodeId: string }, unknown>(endpoints.detail)(ctx, {
        rsn: "Benchmark",
        nodeId,
      }),
    );
    expect(after.result).toEqual(before.result);
    results[`detail_${nodeId}`] = {
      before: before.metrics,
      after: after.metrics,
    };
  }
  const beforePlayer = await measure(old, async (ctx) => {
    await beforeGetPlayer(ctx, "Benchmark", Date.now());
    await beforeGetPlayer(ctx, "Benchmark", Date.now());
  });
  const afterPlayer = await measure(current, async (ctx) => {
    await getOrCreatePlayer(ctx, "Benchmark", Date.now());
    await getOrCreatePlayer(ctx, "Benchmark", Date.now());
  });
  expect(beforePlayer.metrics.writes).toBe(2);
  expect(afterPlayer.metrics.writes).toBe(0);
  results.enrollment_and_cooldown_player_lookups = {
    before: beforePlayer.metrics,
    after: afterPlayer.metrics,
  };
  const canonicalSync = await measure(current, async (ctx) => {
    for (const [category, items] of [
      ["quests", newFixture.data.quests],
      ["diaries", newFixture.data.diaries],
      ["combatAchievements", newFixture.data.tasks],
      ["collection", newFixture.data.items],
    ] as const) {
      await syncCanonicalItemsForCategory(ctx, {
        playerId: newFixture.playerId,
        source: "runeProfile",
        category,
        items,
        revision: "unchanged-refresh",
      });
    }
  });
  expect(canonicalSync.metrics.writes).toBe(0);
  results.common_canonical_item_persistence = canonicalSync.metrics;
  const metadataMaintenance = await measure(current, async (ctx) => {
    await updateAchievementSources(ctx, newFixture.playerId, [
      {
        key: "skills",
        fetchedAt: newFixture.now + 3000,
        content: newFixture.data.skills,
      },
      {
        key: "activities",
        fetchedAt: newFixture.now + 3000,
        content: newFixture.data.activities,
      },
    ]);
    await updateAchievementSources(ctx, newFixture.playerId, [
      {
        key: "quests",
        fetchedAt: newFixture.now + 3000,
        content: newFixture.data.quests,
      },
      {
        key: "diaries",
        fetchedAt: newFixture.now + 3000,
        content: newFixture.data.diaries,
      },
      {
        key: "combatAchievements",
        fetchedAt: newFixture.now + 3000,
        content: newFixture.data.tasks,
      },
      {
        key: "collectionSummary",
        fetchedAt: newFixture.now + 3000,
        content: { obtained: 800, total: 1717 },
      },
    ]);
    await updateAchievementSources(ctx, newFixture.playerId, [
      {
        key: "collectionDetail",
        fetchedAt: newFixture.now + 3000,
        content: newFixture.data.items,
      },
    ]);
  });
  results.added_source_metadata_maintenance = metadataMaintenance.metrics;
  expect(metadataMaintenance.metrics.readBytes).toBeLessThan(5_000);
  expect(metadataMaintenance.metrics.writeBytes).toBeLessThan(5_000);
  for (const [name, result] of Object.entries(results))
    console.log(name, JSON.stringify(result));
  if (process.env.ACHIEVEMENT_BENCHMARK_OUTPUT) {
    await Bun.write(
      process.env.ACHIEVEMENT_BENCHMARK_OUTPUT,
      JSON.stringify(
        {
          fixture: {
            quests: newFixture.data.quests.length,
            diaries: newFixture.data.diaries.length,
            tasks: newFixture.data.tasks.length,
            collectionRows: newFixture.data.items.length,
            skills: newFixture.data.skills.length,
            activities: newFixture.data.activities.length,
          },
          measurement:
            "UTF-8 JSON bytes of documents returned through instrumented database reads; writes count application calls/payloads. Not Convex billed bytes.",
          results,
        },
        null,
        2,
      ) + "\n",
    );
  }
});

test("legacy players and evidence migrate lazily, and the combined response matches separate queries", async () => {
  const t = createTest();
  const { playerId } = await seed(t);
  await t.run((ctx) => beforeRebuild(ctx, playerId));
  const before = await output(t);
  await t.run(async (ctx) => {
    const metadata = await ctx.db.query("achievementSources").first();
    if (metadata) await ctx.db.delete(metadata._id);
  });
  await t.run((ctx) => rebuildAchievementProgress(ctx, playerId));
  expect(await output(t)).toEqual(before);
  const combined = await t.query(api.achievements.atlas, { rsn: "Benchmark" });
  expect(combined).toEqual({
    progress: await t.query(api.achievements.progress, { rsn: "Benchmark" }),
    profile: await t.query(api.players.getProfile, { rsn: "Benchmark" }),
  });
  expect(
    await t.query(api.achievements.atlas, { rsn: "Missing" }),
  ).toMatchObject({ profile: null, progress: { needsRebuild: true } });
});

test("enrollment and rejected refreshes do not touch the player; accepted refreshes record demand", async () => {
  const t = createTest();
  const { playerId } = await seed(t);
  const original = await t.run((ctx) => ctx.db.get(playerId));
  const enroll = await measure(t, (ctx) =>
    handler<{ rsn: string }, unknown>(endpoints.enroll)(ctx, {
      rsn: "BENCHMARK",
    }),
  );
  expect(enroll.metrics.writes).toBe(0);
  expect(
    await t.mutation(api.refresh.request, { rsns: ["Benchmark"] }),
  ).toMatchObject([{ status: "cooldown" }]);
  expect(await t.run((ctx) => ctx.db.get(playerId))).toEqual(original);
  await t.run(async (ctx) => {
    await ctx.db.patch(playerId, { refreshAllowedAt: 0, lastRequestedAt: 1 });
    for (const job of await ctx.db.system
      .query("_scheduled_functions")
      .collect())
      if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
  });
  expect(
    await t.mutation(api.refresh.request, { rsns: ["Benchmark"] }),
  ).toMatchObject([{ status: "scheduled" }]);
  const requested = await t.run((ctx) => ctx.db.get(playerId));
  expect(requested?.lastRequestedAt).toBeGreaterThan(1);
  expect(
    await t.mutation(api.refresh.request, { rsns: ["Benchmark"] }),
  ).toMatchObject([{ status: "alreadyScheduled" }]);
  expect(await t.run((ctx) => ctx.db.get(playerId))).toEqual(requested);
  await t.run(async (ctx) => {
    for (const job of await ctx.db.system
      .query("_scheduled_functions")
      .collect())
      if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
  });
});

test("content fingerprints ignore irrelevant rank movement but retain achievement availability", async () => {
  const { achievementHiscoresContent } = await import(
    "../convex/lib/achievementSources"
  );
  const { fixture } = await import("./performance/fixture");
  const input = fixture();
  const skills = { type: "skills" as const, values: input.skills };
  const activities = { type: "activities" as const, values: input.activities };
  expect(await contentHash(achievementHiscoresContent(skills))).toBe(
    await contentHash(
      achievementHiscoresContent({
        ...skills,
        values: skills.values.map((skill) => ({
          ...skill,
          rank: { value: 999, availabilityReason: null },
        })),
      }),
    ),
  );
  expect(await contentHash(achievementHiscoresContent(activities))).toBe(
    await contentHash(
      achievementHiscoresContent({
        ...activities,
        values: activities.values.map((activity) => ({
          ...activity,
          rank: { value: 999, availabilityReason: null },
        })),
      }),
    ),
  );
  expect(await contentHash(achievementHiscoresContent(activities))).not.toBe(
    await contentHash(
      achievementHiscoresContent({
        ...activities,
        values: activities.values.map((activity) => ({
          ...activity,
          rank: { value: null, availabilityReason: "unranked" },
        })),
      }),
    ),
  );
  expect(await contentHash({ b: 2, a: 1 })).toBe(
    await contentHash({ a: 1, b: 2 }),
  );
});
