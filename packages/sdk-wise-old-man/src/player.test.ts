import { describe, expect, test } from "bun:test";
import { fetchWiseOldManPlayer, type WiseOldManRequestError } from "./player";

const player = {
  displayName: "Fixture Player",
  type: "ironman",
  build: "main",
  combatLevel: 126,
  ehp: 123.45,
  ehb: 67.89,
  ttm: 500,
  tt200m: 10_000,
};

describe("fetchWiseOldManPlayer", () => {
  test("maps player details to a canonical efficiency snapshot", async () => {
    const snapshot = await fetchWiseOldManPlayer("Fixture Player", {
      fetch: async () => Response.json(player),
    });

    expect(snapshot).toMatchObject({
      source: "wiseOldMan",
      displayRsn: "Fixture Player",
      accountType: "ironman",
      ehp: 123.45,
      timeToMax: 500,
    });
  });

  test("treats a missing WOM profile as not connected", async () => {
    expect(
      fetchWiseOldManPlayer("Missing", {
        fetch: async () => new Response(null, { status: 404 }),
      }),
    ).rejects.toMatchObject({
      code: "notConnected",
    } satisfies Partial<WiseOldManRequestError>);
  });
});
