import type { CanonicalActivity, CanonicalSkill } from "@rune-rating/domain";
import type { convexTest } from "convex-test";
import definitions from "../../../domain/src/achievements/definitions.json";
import type { Doc } from "../../convex/_generated/dataModel";
import { updateAchievementSources } from "../../convex/lib/achievementSources";
import {
  type CanonicalItemSyncInput,
  syncCanonicalItemsForCategory,
} from "../../convex/lib/canonicalItems";

const value = (n: number) => ({ value: n, availabilityReason: null });
const skillNames = [
  "attack",
  "defence",
  "strength",
  "hitpoints",
  "ranged",
  "prayer",
  "magic",
  "cooking",
  "woodcutting",
  "fletching",
  "fishing",
  "firemaking",
  "crafting",
  "smithing",
  "mining",
  "herblore",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "runecraft",
  "hunter",
  "construction",
  "sailing",
];
export function fixture() {
  const skills: CanonicalSkill[] = skillNames.map((name, i) => ({
    key: `skill.${name}`,
    name,
    level: value(80 + (i % 20)),
    xp: value(2_000_000 + i * 100_000),
    rank: value(100_000),
  }));
  const activities: CanonicalActivity[] = Array.from(
    { length: 110 },
    (_, i) => ({
      key: `activity.fixture_${i}`,
      name: `Fixture activity ${i}`,
      category: "bossing",
      score: value(i * 10),
      rank: value(50_000),
    }),
  );
  activities.push({
    key: "activity.collections_logged",
    name: "Collections logged",
    category: "activities",
    score: value(800),
    rank: value(50_000),
  });
  const itemNames = new Map(definitions.items.map((i) => [i.key, i.name]));
  const quests: CanonicalItemSyncInput[] = definitions.quests.map((q, i) => ({
    itemKey: q.key,
    label: q.name,
    group: q.group,
    state: i % 3 ? "finished" : "not_started",
    completed: !!(i % 3),
    current: null,
    total: null,
    points: 1,
  }));
  const diaries: CanonicalItemSyncInput[] = definitions.diaries.map((d, i) => ({
    itemKey: d.key,
    label: `${d.area} ${d.tier}`,
    group: d.area,
    state: i % 2 ? "finished" : "in_progress",
    completed: !!(i % 2),
    current: i % 2 ? 10 : 5,
    total: 10,
    points: null,
  }));
  const tasks: CanonicalItemSyncInput[] = definitions.tasks.map((task, i) => ({
    itemKey: task.key,
    label: task.name,
    group: task.boss,
    state: "kill_count",
    completed: !!(i % 2),
    current: null,
    total: null,
    points: task.tier,
  }));
  const items: CanonicalItemSyncInput[] = definitions.pages.flatMap((page) =>
    page.items.map((key, i) => ({
      itemKey: `collection.${page.group}.${page.name}.${key.split(".").at(-1)}`,
      label: itemNames.get(key) ?? key,
      group: page.group,
      state: page.name,
      completed: !!(i % 2),
      current: i % 2,
      total: null,
      points: Number(key.split(".").at(-1)),
    })),
  );
  return { skills, activities, quests, diaries, tasks, items };
}
export async function seed(t: ReturnType<typeof convexTest>, now = Date.now()) {
  const data = fixture();
  const playerId = await t.run(async (ctx) => {
    const playerId = await ctx.db.insert("players", {
      displayRsn: "Benchmark",
      normalizedRsn: "benchmark",
      createdAt: now,
      lastRequestedAt: now,
      lastSnapshotAt: now,
      refreshAllowedAt: now + 3_600_000,
    });
    await ctx.db.insert("achievementProgress", {
      playerId,
      version: "",
      states: "",
      sources: "",
      fetchedAt: null,
      calculatedAt: 0,
    });
    await ctx.db.insert("runtimeConfig", {
      key: "refreshCooldownMs",
      numberValue: 3_600_000,
    });
    const snapshots: Array<{
      category: Doc<"categorySnapshots">["category"];
      segment: string;
      data: Doc<"categorySnapshots">["data"];
    }> = [
      {
        category: "skills",
        segment: "all",
        data: { type: "skills", values: data.skills },
      },
      {
        category: "activities",
        segment: "all",
        data: { type: "activities", values: data.activities },
      },
      {
        category: "quests",
        segment: "all",
        data: {
          type: "quests",
          total: 203,
          completed: 135,
          started: 0,
          notStarted: 68,
          earnedPoints: 250,
          totalPoints: 350,
        },
      },
      {
        category: "diaries",
        segment: "all",
        data: { type: "diaries", completed: 24, total: 48 },
      },
      {
        category: "combatAchievements",
        segment: "all",
        data: {
          type: "combatAchievements",
          completed: 327,
          total: 655,
          points: 1000,
          tierReached: "hard",
          tiers: [{ id: 1, name: "Easy", completed: 327, total: 655 }],
        },
      },
      {
        category: "collection",
        segment: "summary",
        data: { type: "collection", obtained: 800, total: 1717 },
      },
      {
        category: "collection",
        segment: "detail",
        data: { type: "collection", obtained: 800, total: 1717 },
      },
    ];
    for (const snapshot of snapshots) {
      const source =
        snapshot.category === "skills" || snapshot.category === "activities"
          ? "hiscores"
          : "runeProfile";
      await ctx.db.insert("categorySnapshots", {
        key: `${playerId}:${snapshot.category}:${snapshot.segment}`,
        playerId,
        source,
        ...snapshot,
        fetchedAt: now,
        completeness: "complete",
      });
      if (snapshot.segment === "detail") continue;
      await ctx.db.insert("snapshotStates", {
        key: `${playerId}:${source}:${snapshot.category}`,
        playerId,
        source,
        category: snapshot.category,
        status: "fresh",
        requestId: "fixture",
        lastAttemptAt: now,
        lastSuccessAt: now,
        errorCode: null,
      });
    }
    await ctx.db.insert("snapshotStates", {
      key: `${playerId}:wiseOldMan:efficiency`,
      playerId,
      source: "wiseOldMan",
      category: "efficiency",
      status: "fresh",
      requestId: "fixture",
      lastAttemptAt: now,
      lastSuccessAt: now,
      errorCode: null,
    });
    for (const page of definitions.pages) {
      const segment = `page:${page.group}:${page.name}`;
      await ctx.db.insert("categorySnapshots", {
        key: `${playerId}:collection:${segment}`,
        playerId,
        category: "collection",
        segment,
        source: "runeProfile",
        fetchedAt: now,
        completeness: "complete",
        data: {
          type: "collection",
          obtained: Math.floor(page.items.length / 2),
          total: page.items.length,
        },
      });
    }
    for (const [category, items] of [
      ["quests", data.quests],
      ["diaries", data.diaries],
      ["combatAchievements", data.tasks],
      ["collection", data.items],
    ] as const) {
      await syncCanonicalItemsForCategory(ctx, {
        playerId,
        category,
        items,
        source: "runeProfile",
        revision: "fixture",
      });
    }
    await updateAchievementSources(
      ctx,
      playerId,
      snapshots.map((snapshot) => ({
        key:
          snapshot.category === "collection"
            ? snapshot.segment === "summary"
              ? ("collectionSummary" as const)
              : ("collectionDetail" as const)
            : (snapshot.category as
                | "skills"
                | "activities"
                | "quests"
                | "diaries"
                | "combatAchievements"),
        fetchedAt: now,
        content: snapshot.data,
      })),
    );
    return playerId;
  });
  return { playerId, data, now };
}
