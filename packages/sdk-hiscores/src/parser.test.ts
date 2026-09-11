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

  test("accepts newly inserted activities without shifting known fields", () => {
    const fixture = makeHiscoresFixture();
    fixture.activities.splice(54, 0, {
      id: 54,
      name: "Future Boss",
      rank: 1,
      score: 5,
    });
    fixture.activities = fixture.activities.map((activity, id) => ({
      ...activity,
      id,
    }));

    const snapshot = parseHiscoresResponse(fixture);

    expect(
      snapshot.activities.find((activity) => activity.name === "Future Boss"),
    ).toMatchObject({
      key: "activity.future_boss",
      category: "bossing",
      score: { value: 5, availabilityReason: null },
    });
    expect(
      snapshot.activities.find((activity) => activity.name === "Mimic"),
    ).toMatchObject({ key: "activity.mimic", category: "bossing" });
  });

  test("rejects missing known activities", () => {
    const fixture = makeHiscoresFixture();
    fixture.activities = fixture.activities
      .filter((activity) => activity.name !== "Mimic")
      .map((activity, id) => ({ ...activity, id }));

    expect(() => parseHiscoresResponse(fixture)).toThrow(HiscoresContractError);
  });

  test("rejects reordered skills", () => {
    const fixture = makeHiscoresFixture();
    const attack = fixture.skills[1];
    const defence = fixture.skills[2];
    if (!attack || !defence) throw new Error("Fixture skills are missing.");
    fixture.skills[1] = { ...defence, id: 1 };
    fixture.skills[2] = { ...attack, id: 2 };

    expect(() => parseHiscoresResponse(fixture)).toThrow(HiscoresContractError);
  });
});
