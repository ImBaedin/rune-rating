import { describe, expect, test } from "bun:test";
import {
  fetchRuneProfileCollectionLog,
  fetchRuneProfilePlayer,
  type RuneProfileRequestError,
} from "./player";

const responses: Record<string, unknown> = {
  "/accounts/Fixture": {
    username: "Fixture",
    quests: {
      completed: 1,
      started: 0,
      notStarted: 1,
      total: 2,
      totalPoints: 2,
      earnedPoints: 1,
    },
    collectionLog: { obtained: 10, total: 100 },
    combatAchievements: [{ id: 1, name: "Easy", completed: 1, total: 2 }],
    achievementDiaries: [
      { areaId: 1, area: "Ardougne", completed: 1, total: 2 },
    ],
    updatedAt: "2026-06-13 11:38:43.68928",
  },
  "/accounts/Fixture/quests": {
    data: [
      { id: 1, name: "Quest", points: 1, type: "members", state: "finished" },
    ],
  },
  "/accounts/Fixture/achievement-diaries": {
    data: [
      {
        areaId: 1,
        area: "Ardougne",
        tiers: [{ tier: "Easy", completed: 1, total: 2 }],
      },
    ],
  },
  "/accounts/Fixture/combat-achievements/tasks": {
    totalPoints: 1,
    tierReached: null,
    data: [
      {
        index: 1,
        tierId: 1,
        tierName: "Easy",
        name: "Task",
        description: "Do the task",
        type: "Mechanical",
        monster: "Boss",
        completed: true,
      },
    ],
  },
  "/accounts/Fixture/collection-log": {
    obtained: 2,
    total: 4,
    tabs: [
      {
        name: "Bosses",
        obtained: 1,
        total: 2,
        pages: [
          {
            name: "Abyssal Sire",
            obtained: 1,
            total: 2,
            items: [
              { id: 13262, name: "Abyssal orphan", quantity: 1 },
              { id: 13273, name: "Unsired", quantity: 0 },
            ],
          },
        ],
      },
      {
        name: "Clues",
        obtained: 1,
        total: 2,
        pages: [
          {
            name: "Beginner Treasure Trails",
            obtained: 1,
            total: 2,
            items: [
              { id: 23285, name: "Bear feet", quantity: 3 },
              { id: 23288, name: "Demon feet", quantity: 0 },
            ],
          },
        ],
      },
    ],
  },
};

describe("fetchRuneProfilePlayer", () => {
  test("fetches and validates canonical source slices", async () => {
    const snapshot = await fetchRuneProfilePlayer("Fixture", {
      fetch: async (input) => {
        const path = new URL(input.toString()).pathname.replace("/v1", "");
        return Response.json(responses[path]);
      },
    });

    expect(snapshot).toMatchObject({
      displayRsn: "Fixture",
      questSummary: { completed: 1 },
      collectionSummary: { obtained: 10 },
      combatAchievementPoints: 1,
    });
    expect(snapshot.quests).toHaveLength(1);
    expect(snapshot.providerUpdatedAt).toBeFinite();
  });

  test("treats a missing account as not connected", async () => {
    expect(
      fetchRuneProfilePlayer("Missing", {
        fetch: async () => new Response(null, { status: 404 }),
      }),
    ).rejects.toMatchObject({
      code: "notConnected",
    } satisfies Partial<RuneProfileRequestError>);
  });

  test("identifies unexpected provider response shapes", async () => {
    expect(
      fetchRuneProfilePlayer("Fixture", {
        fetch: async (input) => {
          const path = new URL(input.toString()).pathname.replace("/v1", "");
          return Response.json(
            path === "/accounts/Fixture"
              ? { ...(responses[path] as object), updatedAt: "not-a-date" }
              : responses[path],
          );
        },
      }),
    ).rejects.toMatchObject({
      code: "invalidResponse",
    } satisfies Partial<RuneProfileRequestError>);
  });
});

describe("fetchRuneProfileCollectionLog", () => {
  test("fetches and validates full collection log detail", async () => {
    const collectionLog = await fetchRuneProfileCollectionLog("Fixture", {
      fetch: async (input) => {
        const path = new URL(input.toString()).pathname.replace("/v1", "");
        return Response.json(responses[path]);
      },
    });

    expect(collectionLog.obtained).toBe(2);
    expect(collectionLog.total).toBe(4);
    expect(collectionLog.tabs[0]?.name).toBe("Bosses");
    expect(collectionLog.tabs[0]?.pages[0]?.name).toBe("Abyssal Sire");
    expect(collectionLog.tabs[0]?.pages[0]?.items[0]?.quantity).toBe(1);
    expect(collectionLog.fetchedAt).toBeFinite();
  });

  test("rejects malformed collection log detail", async () => {
    expect(
      fetchRuneProfileCollectionLog("Fixture", {
        fetch: async () =>
          Response.json({ obtained: 1, total: 1, tabs: [{ name: "Bosses" }] }),
      }),
    ).rejects.toMatchObject({
      code: "invalidResponse",
    } satisfies Partial<RuneProfileRequestError>);
  });
});
