import { describe, expect, test } from "bun:test";
import {
  fetchOverallXpGains,
  fetchOverallXpTimeline,
  fetchSkillXpGains,
  fetchSkillXpTimeline,
  fetchSkillXpTimelines,
} from "./history";

describe("Wise Old Man history", () => {
  test("sorts timeline points oldest first", async () => {
    const timeline = await fetchOverallXpTimeline("Fixture", "week", {
      fetch: async () =>
        Response.json([
          { value: 20, rank: 1, date: "2026-06-02T00:00:00.000Z" },
          { value: 10, rank: 2, date: "2026-06-01T00:00:00.000Z" },
        ]),
    });

    expect(timeline.map((point: { value: number }) => point.value)).toEqual([
      10, 20,
    ]);
  });

  test("requests a selected skill timeline", async () => {
    let requestedUrl = "";
    await fetchSkillXpTimeline("Fixture", "attack", "month", {
      fetch: async (input) => {
        requestedUrl = String(input);
        return Response.json([]);
      },
    });

    expect(new URL(requestedUrl).searchParams.get("metric")).toBe("attack");
  });

  test("requests selected skill timelines in one call", async () => {
    let requestedUrl = "";
    const timelines = await fetchSkillXpTimelines(
      "Fixture",
      ["attack", "strength"],
      "month",
      {
        fetch: async (input) => {
          requestedUrl = String(input);
          return Response.json({
            attack: [{ value: 20, rank: 1, date: "2026-06-02T00:00:00.000Z" }],
            strength: [
              { value: 30, rank: 1, date: "2026-06-02T00:00:00.000Z" },
            ],
          });
        },
      },
    );

    expect(new URL(requestedUrl).searchParams.get("metric")).toBe(
      "attack,strength",
    );
    expect(timelines).toMatchObject([
      { metric: "attack", timeline: [{ value: 20 }] },
      { metric: "strength", timeline: [{ value: 30 }] },
    ]);
  });

  test("requests a supported year timeline and filters it to 90 days", async () => {
    let requestedUrl = "";
    const now = Date.now();
    const timeline = await fetchOverallXpTimeline("Fixture", "quarter", {
      fetch: async (input) => {
        requestedUrl = String(input);
        return Response.json([
          {
            value: 20,
            rank: 1,
            date: new Date(now - 89 * 24 * 60 * 60 * 1_000).toISOString(),
          },
          {
            value: 10,
            rank: 2,
            date: new Date(now - 91 * 24 * 60 * 60 * 1_000).toISOString(),
          },
        ]);
      },
    });

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("period")).toBe("year");
    expect(url.searchParams.get("startDate")).toBeNull();
    expect(url.searchParams.get("endDate")).toBeNull();
    expect(timeline.map((point) => point.value)).toEqual([20]);
  });

  test("returns canonical overall XP gains", async () => {
    const gains = await fetchOverallXpGains("Fixture", "week", {
      fetch: async () =>
        Response.json({
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-06-08T00:00:00.000Z",
          data: {
            skills: {
              overall: {
                experience: { gained: 500, start: 1_000, end: 1_500 },
              },
            },
          },
        }),
    });

    expect(gains.gained).toBe(500);
  });

  test("returns all skill XP gains", async () => {
    const gains = await fetchSkillXpGains("Fixture", "week", {
      fetch: async () =>
        Response.json({
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-06-08T00:00:00.000Z",
          data: {
            skills: {
              overall: {
                experience: { gained: 500, start: 1_000, end: 1_500 },
              },
              attack: {
                experience: { gained: 200, start: 300, end: 500 },
              },
            },
          },
        }),
    });

    expect(gains.skills).toContainEqual({
      metric: "attack",
      gained: 200,
      start: 300,
      end: 500,
    });
  });

  test("treats gains without snapshot boundaries as unavailable", async () => {
    const gains = await fetchOverallXpGains("New Player", "week", {
      fetch: async () =>
        Response.json({
          startsAt: null,
          endsAt: null,
          data: {
            skills: {
              overall: {
                experience: { gained: 0, start: -1, end: -1 },
              },
            },
          },
        }),
    });

    expect(gains).toMatchObject({
      startsAt: null,
      endsAt: null,
      gained: null,
    });
  });
});
