import { describe, expect, test } from "bun:test";
import { compareNumbers, compareRanks, normalizeRsn, rsnLookupKey } from ".";

describe("normalizeRsn", () => {
  test("normalizes spacing and underscores while preserving casing", () => {
    expect(normalizeRsn("  Wise_Old   Man ")).toBe("Wise Old Man");
  });

  test("creates a case-insensitive lookup key", () => {
    expect(rsnLookupKey("  Wise_Old   Man ")).toBe("wise old man");
  });

  test("rejects invalid or overlong names", () => {
    expect(() => normalizeRsn("name.with.dot")).toThrow();
    expect(() => normalizeRsn("a very long rsn")).toThrow();
  });
});

describe("compareNumbers", () => {
  test("compares real zero as a value", () => {
    expect(compareNumbers(0, 4)).toEqual({
      left: 0,
      right: 4,
      delta: -4,
      leader: "right",
    });
  });

  test("does not rank missing values", () => {
    expect(compareNumbers(null, 0).leader).toBe("indeterminate");
  });

  test("treats lower rank as better", () => {
    expect(compareRanks(2, 10).leader).toBe("left");
  });
});
