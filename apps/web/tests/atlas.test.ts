import { describe, expect, test } from "bun:test";
import {
  atlasDefinitions,
  atlasDemoCompleted,
  atlasFunnels,
  atlasGroups,
  atlasLocations,
  atlasPlacements,
  atlasRow,
  atlasSections,
  isAtlasGraphLink,
  validateAtlas,
} from "../src/features/achievements/atlasData";

const byId = new Map(atlasDefinitions.map((node) => [node.id, node]));

describe("authored achievement atlas", () => {
  test("the Myreque finale leads to Vampyrium and retains the boss access reference", () => {
    expect(atlasPlacements["blood-moon-rises"]?.section).toBe("quests");
    expect(byId.get("blood-moon-rises")?.links).toEqual([
      { id: "sins", kind: "required" },
      { id: "night-at-theatre", kind: "required" },
    ]);
    expect(byId.get("vampyrium")?.rule).toEqual({
      type: "quest",
      quest: "The Blood Moon Rises",
      state: "finished",
    });
    expect(byId.get("maggot-access")?.links).toContainEqual(
      expect.objectContaining({ id: "blood-moon-rises" }),
    );
    expect(byId.get("blood-moon-rises")?.requirements).toHaveLength(10);
  });

  test("the twinflame route funnels both logged crowns into the staff", () => {
    expect(byId.get("twinflame-staff")?.rule).toEqual({
      type: "all",
      milestones: ["fire-staff-crown", "ice-staff-crown"],
    });
    expect(atlasFunnels).toContainEqual({
      result: "twinflame-staff",
      inputs: ["fire-staff-crown", "ice-staff-crown"],
    });
  });

  test("all references resolve and the dependency graph is acyclic", () => {
    expect(validateAtlas()).toEqual([]);
    expect(atlasSections).toHaveLength(9);
    expect(atlasDefinitions.length).toBeGreaterThan(300);
  });

  test("placements stay apart and connections progress downward or across progression rows", () => {
    const entries = Object.entries(atlasPlacements);
    for (const [index, [id, placement]] of entries.entries()) {
      expect(Number.isFinite(placement.row) && placement.row >= 0).toBe(true);
      expect(Number.isFinite(placement.lane) && placement.lane >= 0).toBe(true);
      expect(
        atlasSections.some((section) => section.id === placement.section),
      ).toBe(true);
      for (const [otherId, other] of entries.slice(index + 1)) {
        const overlaps =
          placement.section === other.section &&
          Math.abs(placement.lane - other.lane) < 0.65 &&
          Math.abs(atlasRow(id) - atlasRow(otherId)) < 0.8;
        expect(overlaps, `${id} overlaps ${otherId}`).toBe(false);
      }
      for (const link of byId.get(id)?.links ?? []) {
        const parent = atlasPlacements[link.id];
        if (parent?.section === placement.section) {
          const order = expect(
            atlasRow(link.id),
            `${link.id} must precede ${id}`,
          );
          if (link.kind === "progression" && parent.group === placement.group)
            order.toBeLessThanOrEqual(atlasRow(id));
          else order.toBeLessThan(atlasRow(id));
        }
      }
    }
  });

  test("combined resources share a row and funnel into a centered result", () => {
    for (const group of atlasFunnels) {
      const inputs = group.inputs.map((id) => atlasPlacements[id]);
      const result = atlasPlacements[group.result];
      expect(result).toBeDefined();
      const first = inputs[0];
      if (!result || !first) throw new Error("Invalid funnel");
      for (const input of inputs) {
        expect(input?.section).toBe(result.section);
        expect(input?.group).toBe(result.group);
        expect(input?.row, group.result).toBe(first.row);
      }
      const lanes = inputs.map((input) => input?.lane ?? 0);
      expect(result.lane, group.result).toBeCloseTo(
        (Math.min(...lanes) + Math.max(...lanes)) / 2,
      );
      expect(result.row).toBeGreaterThan(first.row);
    }
    expect(atlasFunnels.some((group) => group.result === "swamp-trident")).toBe(
      true,
    );
  });

  test("expanded sections grow down within bounded, non-overlapping groups", () => {
    expect(atlasDefinitions.length).toBeGreaterThan(850);
    expect(atlasGroups.length).toBeGreaterThanOrEqual(50);
    expect(new Set(atlasGroups.map((group) => group.id)).size).toBe(
      atlasGroups.length,
    );
    for (const section of atlasSections.filter(
      (section) => section.groups.length,
    )) {
      expect(section.width).toBeLessThanOrEqual(1900);
      for (const [index, group] of section.groups.entries()) {
        const previous = section.groups[index - 1];
        if (previous)
          expect(group.row).toBeGreaterThan(previous.row + previous.rows);
        const placements = Object.values(atlasPlacements).filter(
          (p) => p.group === group.id,
        );
        expect(placements.length).toBeGreaterThan(0);
        for (const placement of placements) {
          expect(placement.section).toBe(section.id);
          expect(placement.row).toBeLessThan(group.rows);
        }
        for (const path of group.paths)
          expect(path.row).toBeLessThan(group.rows);
      }
      for (const placement of Object.values(atlasPlacements).filter(
        (p) => p.section === section.id,
      )) {
        expect(placement.group).toBeTruthy();
      }
    }
  });

  test("new gear uses logged drops and shared boss pages use their actual scope", () => {
    expect(byId.get("venator-shards")?.rule).toMatchObject({
      type: "items",
      items: [{ name: "Venator shard", quantity: 5 }],
    });
    expect(byId.get("blood-set")?.rule).toMatchObject({
      type: "all",
      milestones: ["blood-armour", "blood-weapon"],
    });
    expect(byId.get("parts-ultor-ring")?.rule).toMatchObject({
      type: "items",
      items: [
        { name: "Berserker ring", quantity: 1 },
        { name: "Ultor vestige", quantity: 1 },
        { name: "Chromium ingot", quantity: 3 },
      ],
    });
    for (const [id, scope] of [
      ["log-callisto", "collection.page.Callisto and Artio"],
      ["log-venenatis", "collection.page.Venenatis and Spindel"],
      ["log-vet-ion", "collection.page.Vet'ion and Calvar'ion"],
      ["ca-boss-gauntlet", "combatTasks.boss.Crystalline Hunllef"],
    ])
      expect(byId.get(id ?? "")?.rule).toMatchObject({
        type: "catalog",
        scope,
      });
    expect(byId.has("log-mimic")).toBe(false);
    expect(byId.has("log-the-corrupted-gauntlet")).toBe(false);
  });

  test("map anchors remain inside the map", () => {
    for (const location of Object.values(atlasLocations)) {
      expect(location.x).toBeGreaterThanOrEqual(0);
      expect(location.x).toBeLessThanOrEqual(1);
      expect(location.y).toBeGreaterThanOrEqual(0);
      expect(location.y).toBeLessThanOrEqual(1);
    }
  });

  test("agreed completion semantics survive catalog editing", () => {
    expect(byId.get("infernal-cape")?.links).toContainEqual({
      id: "fire-cape",
      kind: "required",
    });
    for (const [child, parent] of [
      ["food-sharks", "food-karambwan"],
      ["food-angler", "food-sharks"],
      ["soul-runes", "blood-runes"],
    ] as const) {
      expect(byId.get(child)?.links).toContainEqual({
        id: parent,
        kind: "progression",
      });
    }
    expect(byId.get("fairy-rings")?.rule).toEqual({
      type: "quest",
      quest: "Fairytale II - Cure a Queen",
      state: "started",
    });
    expect(byId.get("barrows-gloves")?.rule).toEqual({
      type: "quest",
      quest: "Recipe for Disaster",
      state: "finished",
    });
    expect(byId.get("lance")?.rule).toEqual({
      type: "all",
      milestones: ["zammy-spear", "hydra-claw"],
    });
    expect(byId.get("barrows-any")?.rule.type).toBe("any");
    expect(byId.get("collection-gilded")?.rule).toEqual({
      type: "collection-rank",
      rank: "Gilded",
      fraction: 0.9,
      roundDownTo: 25,
    });
    expect(byId.get("crafting-90")?.rule).toEqual({
      type: "threshold",
      metric: "skills.crafting.level",
      value: 90,
    });
    expect(byId.get("elven-skills")?.rule).toMatchObject({ type: "all" });
    expect(byId.get("elven-skills")?.links).toHaveLength(8);
  });

  test("one-kill nodes only use explicitly supported Hiscores bosses", () => {
    const firstKills = atlasDefinitions.filter(
      (node) =>
        node.rule.type === "threshold" &&
        node.rule.metric.startsWith("bossing.") &&
        node.rule.value === 1,
    );
    expect(firstKills.map((node) => node.id).sort()).toEqual([
      "infernal-cape",
      "mimic-first",
    ]);
  });

  test("RFD visibly branches into eight parallel rescues and converges on the finale", () => {
    const rescues = byId.get("rfd-rescues");
    expect(rescues?.rule).toMatchObject({ type: "all" });
    expect(rescues?.links).toHaveLength(8);
    if (!rescues) throw new Error("Missing RFD rescue aggregate");
    for (const link of rescues.links) {
      expect(isAtlasGraphLink(link.id, rescues.id, link)).toBe(true);
      const rescue = byId.get(link.id);
      const parent = rescue?.links.find(
        (link) => link.id === "cooks-assistant",
      );
      if (!parent || !rescue) throw new Error("Missing RFD prerequisite");
      expect(parent.kind).toBe("required");
      expect(isAtlasGraphLink(parent.id, rescue.id, parent)).toBe(true);
    }
    const finale = byId.get("rfd-final");
    const visible = finale?.links.filter((link) =>
      isAtlasGraphLink(link.id, finale.id, link),
    );
    expect(visible?.map((link) => link.id)).toEqual(["rfd-rescues", "rfd-qp"]);
    const external = finale?.links.find((link) => link.id === "desert-1");
    expect(external).toMatchObject({ kind: "required", display: "details" });
    if (!external || !finale) throw new Error("Missing finale prerequisite");
    expect(isAtlasGraphLink(external.id, finale.id, external)).toBe(false);
  });

  test("every diary tier has navigable, panel-only prerequisites", () => {
    const diaries = atlasDefinitions.filter(
      (node) => node.id.startsWith("diary-") && node.rule.type === "diary",
    );
    expect(diaries).toHaveLength(48);
    for (const node of diaries) {
      expect(
        node.requirements?.some((row) => row.group === "skills"),
        node.id,
      ).toBe(true);
      for (const row of node.requirements ?? []) {
        expect(row.label).not.toMatch(/\{\{|\[\[|<ref/);
        if (row.milestoneId) expect(byId.has(row.milestoneId)).toBe(true);
        if (row.group === "skills" && row.milestoneId) {
          expect(byId.get(row.milestoneId)?.rule).toMatchObject({
            type: "threshold",
            value: Number.parseInt(row.label, 10),
          });
        }
      }
    }
    expect(byId.get("diary-lumbridge-hard")?.requirements).toContainEqual(
      expect.objectContaining({
        label: "70 Crafting",
      }),
    );
    expect(byId.get("diary-lumbridge-hard")?.requirements).toContainEqual(
      expect.objectContaining({ milestoneId: "rfd-final" }),
    );
    expect(byId.get("diary-falador-elite")?.requirements).toContainEqual(
      expect.objectContaining({ label: "70 Prayer" }),
    );
  });

  test("boss gates and upgraded jewellery preserve completion semantics", () => {
    expect(byId.get("muspah-access")?.rule).toEqual({
      type: "quest",
      quest: "Secrets of the North",
      state: "finished",
    });
    expect(byId.get("maggot-access")?.links).toContainEqual({
      id: "blood-moon-rises",
      kind: "required",
      display: "details",
    });
    for (const [id, base, drop] of [
      ["rancour", "route-amulet-of-torture", "drop-araxyte-fang"],
      ["rupture", "route-necklace-of-anguish", "elder-venator-fang"],
      ["confliction", "route-tormented-bracelet", "drop-mokhaiotl-cloth"],
    ]) {
      expect(byId.get(id ?? "")?.rule).toMatchObject({
        type: "all",
        milestones: expect.arrayContaining([base, drop]),
      });
    }
  });

  test("skilling gear separates acquisitions from assembly and skill eligibility", () => {
    for (const id of [
      "outfit-angler",
      "outfit-prospector",
      "outfit-rogue",
      "outfit-pyromancer",
    ])
      expect(atlasPlacements[id]?.section).toBe("skilling-equipment");
    expect(atlasPlacements["set-ahrim"]?.section).toBe("equipment");
    expect(byId.get("fish-sack-barrel")?.rule).toEqual({
      type: "all",
      milestones: ["fish-barrel", "fish-sack"],
    });
    expect(byId.get("crystal-harpoon")?.rule).toEqual({
      type: "all",
      milestones: ["dragon-harpoon", "crystal-tool-seed"],
    });
    expect(
      isAtlasGraphLink("crystal-tool-seed", "crystal-harpoon", {
        id: "crystal-tool-seed",
        kind: "required",
      }),
    ).toBe(false);
    expect(byId.get("colossal-pouch-level")?.rule).toEqual({
      type: "threshold",
      metric: "skills.runecraft.level",
      value: 85,
    });
    expect(byId.get("outfit-spirit-angler")?.rule).toMatchObject({
      type: "items",
      match: "all",
    });
    expect(byId.get("dragon-pickaxe")?.rule).toMatchObject({
      type: "items",
      match: "any",
      items: expect.arrayContaining([
        { name: "Dragon pickaxe (broken)", quantity: 1 },
      ]),
    });
  });

  test("sample completions respect required parents and lower numeric thresholds", () => {
    for (const node of atlasDefinitions) {
      if (!atlasDemoCompleted.has(node.id)) continue;
      if (node.rule.type !== "any") {
        for (const link of node.links.filter(
          (link) => link.kind === "required",
        ))
          expect(
            atlasDemoCompleted.has(link.id),
            `${node.id} needs ${link.id}`,
          ).toBe(true);
      }
      const rule = node.rule;
      if (rule.type !== "threshold") continue;
      for (const lower of atlasDefinitions.filter(
        (other) =>
          other.rule.type === "threshold" &&
          other.rule.metric === rule.metric &&
          other.rule.value <= rule.value,
      ))
        expect(
          atlasDemoCompleted.has(lower.id),
          `${node.id} implies ${lower.id}`,
        ).toBe(true);
    }
  });
});
