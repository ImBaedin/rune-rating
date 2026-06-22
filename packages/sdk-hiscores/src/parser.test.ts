import { describe, expect, test } from "bun:test";
import { makeHiscoresFixture } from "./fixtures";
import { HiscoresContractError, parseHiscoresResponse } from "./parser";

describe("parseHiscoresResponse", () => {
  test("normalizes official fields and preserves real zero", () => {
    const snapshot = parseHiscoresResponse(makeHiscoresFixture(), 123);

    expect(snapshot.displayRsn).toBe("Fixture Player");
    expect(snapshot.fetchedAt).toBe(123);
    expect(snapshot.skills[4]?.xp).toEqual({
      value: null,
      availabilityReason: "unranked",
    });
    expect(snapshot.activities[20]?.score).toEqual({
      value: 0,
      availabilityReason: null,
    });
    expect(snapshot.activities[20]?.category).toBe("bossing");
  });

  test("rejects newly inserted or reordered fields", () => {
    const fixture = makeHiscoresFixture();
    const activity = fixture.activities[2];
    if (!activity) throw new Error("Fixture activity is missing.");
    fixture.activities[2] = { ...activity, name: "Unexpected Metric" };

    expect(() => parseHiscoresResponse(fixture)).toThrow(HiscoresContractError);
  });
});
