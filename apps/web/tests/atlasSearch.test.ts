import { expect, test } from "bun:test";
import {
  atlasDefinitions,
  atlasLocations,
} from "../src/features/achievements/atlasData";
import { findAtlasMilestones } from "../src/features/achievements/atlasMilestoneSearch";
import { atlasSearch } from "../src/features/achievements/atlasSearch";

const searchableMilestones = atlasDefinitions.map((definition) => ({
  ...definition,
  location: atlasLocations[definition.location] ?? { name: "", x: 0, y: 0 },
}));

test("milestone search accepts keyboard punctuation and repeated spaces", () => {
  const ids = (query: string) =>
    findAtlasMilestones(searchableMilestones, query).map((node) => node.id);
  const mourning = ids("Mourning’s");
  expect(mourning.length).toBeGreaterThan(0);
  expect(ids("Mourning's")).toEqual(mourning);
  expect(ids("Mournings")).toEqual(mourning);
  expect(ids("  DRAGON   SLAYER  ")).toEqual(ids("Dragon Slayer"));
  expect(ids("Anti–dragon")).toEqual(ids("Anti-dragon"));
});

test("exact milestone names rank ahead of descriptive mentions", () => {
  const matches = findAtlasMilestones(searchableMilestones, "Dragon Slayer II");
  expect(matches[0]?.name).toBe("Dragon Slayer II");
});

test("achievement links preserve and normalize valid RuneScape names", () => {
  expect(atlasSearch({ rsn: "IronBaedin" })).toEqual({ rsn: "IronBaedin" });
  expect(atlasSearch({ rsn: " GIM_Wamuu " })).toEqual({ rsn: "GIM Wamuu" });
  const params = new URLSearchParams({ rsn: "GIM Wamuu" });
  expect(atlasSearch(Object.fromEntries(params))).toEqual({ rsn: "GIM Wamuu" });
});

test("invalid achievement search input is never sent to the backend", () => {
  for (const rsn of [
    undefined,
    null,
    123,
    ["IronBaedin"],
    {},
    "",
    "???",
    "a name longer than twelve",
  ])
    expect(atlasSearch({ rsn })).toEqual({});
  expect(atlasSearch({ other: "ignored" })).toEqual({});
});
