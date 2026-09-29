import { describe, expect, test } from "bun:test";
import definitions from "./definitions.json";
import {
  type AchievementBinding,
  type AchievementFacts,
  achievementBindings,
  achievementSourceKeys,
  evaluateAchievements,
} from "./evaluator";
import { type AchievementSnapshot, achievementFacts } from "./facts";

const blank = (): AchievementSnapshot => ({
  skills: [],
  activities: [],
  quests: [],
  diaries: [],
  tasks: [],
  items: [],
  collectionComplete: false,
  tasksComplete: false,
  questPoints: null,
  collectionTotal: null,
  combatTier: null,
  pages: [],
});
const node = (
  id: string,
  key: string,
  required: string[] = [],
): AchievementBinding => ({
  id,
  rule: { kind: "threshold", key, target: 1, label: key },
  required,
  anyRequired: false,
});
const item = (id: number, quantity: number) => ({
  itemKey: `collection.Bosses.Example.${id}`,
  group: "Bosses",
  state: "Example",
  completed: quantity > 0,
  current: quantity,
  points: id,
});
const skill = (
  key: string,
  name: string,
  level: number | null,
  xp: number | null,
) => ({
  key: `skill.${key}`,
  name,
  level: { value: level, availabilityReason: null },
  xp: { value: xp, availabilityReason: null },
  rank: { value: 1, availabilityReason: null },
});
function result(id: string, facts: AchievementFacts) {
  const r = evaluateAchievements(facts);
  const index = achievementBindings.findIndex((n) => n.id === id);
  const progress = r.progress[index];
  if (!progress) throw Error(id);
  return { status: r.states[index], ...progress };
}
describe("achievement evaluation", () => {
  test("boss logs explain missing and collected slots without counting duplicate quantities", () => {
    const snapshot = blank();
    snapshot.collectionComplete = true;
    snapshot.pages = [{ name: "Hespori", obtained: 1, total: 4 }];
    snapshot.items = [
      { ...item(22994, 5), state: "Hespori" },
      { ...item(22994, 3), state: "Shared page" },
    ];
    const detail = result("log-hespori", achievementFacts(snapshot));
    expect(detail.current).toBe(1);
    expect(detail.collectionLog?.items).toHaveLength(4);
    expect(detail.collectionLog?.items.filter((i) => i.obtained)).toEqual([
      {
        key: "collection.item.22994",
        itemId: 22994,
        label: "Bottomless compost bucket",
        obtained: true,
      },
    ]);
    expect(
      detail.collectionLog?.items
        .filter((i) => !i.obtained)
        .map((i) => i.label),
    ).toEqual(["Attas seed", "Iasor seed", "Kronos seed"]);
    snapshot.collectionComplete = false;
    expect(
      result("log-hespori", achievementFacts(snapshot)).collectionLog,
    ).toBeUndefined();
    snapshot.collectionComplete = true;
    snapshot.pages = [{ name: "Hespori", obtained: 2, total: 4 }];
    expect(
      result("log-hespori", achievementFacts(snapshot)).collectionLog,
    ).toBeUndefined();
  });

  test("current page membership wins over an older catalog and full logs stay collapsed-ready", () => {
    const snapshot = blank();
    snapshot.collectionComplete = true;
    snapshot.pages = [{ name: "Bryophyta", obtained: 1, total: 1 }];
    snapshot.items = [
      { ...item(99999, 1), state: "Bryophyta", label: "New reward" },
    ];
    expect(
      result("log-bryophyta", achievementFacts(snapshot)).collectionLog?.items,
    ).toEqual([
      {
        key: "collection.item.99999",
        itemId: 99999,
        label: "New reward",
        obtained: true,
      },
    ]);
    const aggregate = result("greenlogs-10", achievementFacts(snapshot));
    expect(aggregate.collectionLog).toBeUndefined();
    expect(aggregate.contributors?.items).toEqual([
      {
        key: "collection.page.Bryophyta",
        label: "Bryophyta",
        milestoneId: "log-bryophyta",
      },
    ]);
    snapshot.pages = [
      { name: "Hespori", obtained: 0, total: 4 },
      { name: "Unmapped page", obtained: 0, total: 1 },
    ];
    snapshot.items = [];
    const closest = result("greenlogs-10", achievementFacts(snapshot)).breakdown
      ?.items;
    expect(closest?.find((i) => i.label === "Hespori")?.milestoneId).toBe(
      "log-hespori",
    );
    expect(
      closest?.find((i) => i.label === "Unmapped page")?.milestoneId,
    ).toBeUndefined();
  });

  test("200m names the leading skill, excludes overall and missing XP, and names completed skills", () => {
    const snapshot = blank();
    snapshot.skills = [
      skill("overall", "Overall", 2000, 400_000_000),
      skill("farming", "Farming", 99, 100_000_000),
      skill("cooking", "Cooking", 99, 150_000_000),
      skill("mining", "Mining", 99, null),
      skill("fishing", "Fishing", 99, 100_000_000),
      skill("attack", "Attack", 99, 90_000_000),
    ];
    const detail = result("first-200m", achievementFacts(snapshot));
    expect(detail.current).toBe(150_000_000);
    expect(detail.breakdown?.items.map((i) => i.label)).toEqual([
      "Cooking",
      "Farming",
      "Fishing",
    ]);
    expect(detail.breakdown?.items[0]).toMatchObject({
      current: 150_000_000,
      target: 200_000_000,
    });
    snapshot.skills = [
      skill("cooking", "Cooking", 99, 200_000_000),
      skill("farming", "Farming", 99, 199_000_000),
    ];
    const complete = result("first-200m", achievementFacts(snapshot));
    expect(complete.met).toBe(true);
    expect(complete.breakdown?.label).toBe("Skills at 200m XP");
    expect(complete.breakdown?.items.map((i) => i.label)).toEqual(["Cooking"]);
    const unavailable = result("first-200m", achievementFacts(blank()));
    expect(unavailable.current).toBeNull();
    expect(unavailable.breakdown).toBeUndefined();
  });

  test("next 99s sort by XP remaining and base levels identify every lagging known skill", () => {
    const snapshot = blank();
    snapshot.skills = [
      skill("attack", "Attack", 99, 20_000_000),
      skill("farming", "Farming", 98, 12_000_000),
      skill("cooking", "Cooking", 98, 13_000_000),
      skill("fishing", "Fishing", 75, 1_210_421),
      skill("mining", "Mining", 70, null),
      skill("prayer", "Prayer", 90, 5_346_332),
      skill("sailing", "Sailing", null, null),
    ];
    const facts = achievementFacts(snapshot);
    expect(
      result("five-99", facts).breakdown?.items.map((i) => i.label),
    ).toEqual(["Cooking", "Farming", "Prayer"]);
    expect(result("five-99", facts).breakdown?.items[0]?.target).toBe(
      13_034_431,
    );
    expect(result("base-90", facts).breakdown?.items).toEqual([
      { key: "skill.mining", label: "Mining", current: 70, target: 90 },
      { key: "skill.fishing", label: "Fishing", current: 75, target: 90 },
    ]);
    expect(result("base-70", facts).breakdown).toBeUndefined();
    expect(result("base-90", facts).met).toBeNull();
  });

  test("closest greenlogs use missing slots, exclude finished and empty pages, and require complete data", () => {
    const snapshot = blank();
    snapshot.collectionComplete = true;
    snapshot.pages = [
      { name: "Many slots", obtained: 95, total: 100 },
      { name: "One missing", obtained: 1, total: 2 },
      { name: "Two missing", obtained: 1, total: 3 },
      { name: "Completed", obtained: 10, total: 10 },
      { name: "Empty", obtained: 0, total: 0 },
      { name: "One missing", obtained: 1, total: 2 },
    ];
    const detail = result("greenlogs-10", achievementFacts(snapshot));
    expect(detail.breakdown?.items.map((i) => i.label)).toEqual([
      "One missing",
      "Two missing",
      "Many slots",
    ]);
    expect(detail.current).toBe(1);
    snapshot.collectionComplete = false;
    expect(
      result("greenlogs-10", achievementFacts(snapshot)).breakdown,
    ).toBeUndefined();
  });

  test("greenlogs explain every completed page, without duplicates or the evidence row cap", () => {
    const snapshot = blank();
    snapshot.collectionComplete = true;
    snapshot.pages = Array.from({ length: 45 }, (_, i) => ({
      name: `Log ${String(i).padStart(2, "0")}`,
      obtained: 3,
      total: 3,
    }));
    snapshot.pages.push(
      { ...snapshot.pages[0]! },
      { name: "Incomplete", obtained: 2, total: 3 },
      { name: "Empty", obtained: 0, total: 0 },
    );
    const detail = result("greenlogs-10", achievementFacts(snapshot));
    expect(detail.met).toBe(true);
    expect(detail.current).toBe(45);
    expect(detail.contributors?.items).toHaveLength(45);
    expect(detail.contributors?.items.at(-1)?.label).toBe("Log 44");
    snapshot.collectionComplete = false;
    const unavailable = result("greenlogs-10", achievementFacts(snapshot));
    expect(unavailable.met).toBeNull();
    expect(unavailable.contributors).toBeUndefined();
    snapshot.collectionComplete = true;
    snapshot.pages = [];
    expect(
      result("greenlogs-10", achievementFacts(snapshot)).contributors?.items,
    ).toEqual([]);
  });

  test("pet and jar contributors match unique logged items, not quantities or page duplicates", () => {
    const snapshot = blank();
    const petKey = definitions.pages.find((p) => p.name === "All Pets")!
      .items[0]!;
    const pet = definitions.items.find((i) => i.key === petKey)!;
    const jar = definitions.items.find((i) => i.name.startsWith("Jar of "))!;
    const petItem = item(Number(pet.key.split(".").at(-1)), 5);
    snapshot.items = [
      petItem,
      { ...petItem, state: "All Pets" },
      item(Number(jar.key.split(".").at(-1)), 3),
    ];
    expect(
      result("pets-1", achievementFacts(snapshot)).contributors,
    ).toBeUndefined();
    snapshot.collectionComplete = true;
    for (const [id, definition] of [
      ["pets-1", pet],
      ["jar-first", jar],
    ] as const) {
      const detail = result(id, achievementFacts(snapshot));
      expect(detail.current).toBe(1);
      expect(detail.contributors?.items).toEqual([
        { key: definition.key, label: definition.name },
      ]);
    }
  });

  test("skill, boss, and raid contributors include only confirmed qualifying metrics", () => {
    const snapshot = blank();
    const value = (value: number | null) => ({
      value,
      availabilityReason: null,
    });
    snapshot.skills = [99, 98].map((level, index) => ({
      key: index ? "skill.attack" : "skill.farming",
      name: index ? "Attack" : "Farming",
      level: value(level),
      xp: value(0),
      rank: value(1),
    }));
    snapshot.activities = [
      {
        key: "activity.chambers_of_xeric",
        name: "Chambers of Xeric",
        category: "bossing",
        score: value(12),
        rank: value(1),
      },
      {
        key: "activity.theatre_of_blood",
        name: "Theatre of Blood",
        category: "bossing",
        score: value(12),
        rank: value(null),
      },
      {
        key: "activity.tombs_of_amascut",
        name: "Tombs of Amascut",
        category: "bossing",
        score: value(0),
        rank: value(1),
      },
    ];
    const facts = achievementFacts(snapshot);
    expect(
      result("first-99", facts).contributors?.items.map((i) => i.label),
    ).toEqual(["Farming"]);
    for (const id of ["boss-variety-10", "raid-tour"]) {
      expect(result(id, facts).current).toBe(1);
      expect(result(id, facts).contributors?.items.map((i) => i.label)).toEqual(
        ["Chambers of Xeric"],
      );
    }
  });

  test("clue unlocks use exact tier thresholds and keep missing counts unknown", () => {
    const tiers = [
      ["beginner", 50, 100, 600],
      ["easy", 100, 200, 500],
      ["medium", 100, 250, 400],
      ["hard", 50, 150, 300],
      ["elite", 50, 150, 200],
      ["master", 25, 75, 100],
    ] as const;
    for (const [tier, minor, major, reward] of tiers) {
      for (const [suffix, target] of [
        ["", minor],
        ["-major", major],
        ["-reward", reward],
      ] as const) {
        const id = `clues-${tier}${suffix}`;
        const key = `activity.clue_scrolls_${tier}`;
        expect(result(id, { [key]: { value: target - 1 } }).met).toBe(false);
        expect(result(id, { [key]: { value: target } }).met).toBe(true);
        expect(result(id, { [key]: { value: target + 1 } }).met).toBe(true);
        expect(result(id, {}).met).toBeNull();
        expect(
          result(id, { "activity.clue_scrolls_all": { value: 10_000 } }).met,
        ).toBeNull();
      }
    }
  });

  test("base clue stacking needs the finished quest and the Mimic case needs its own evidence", () => {
    expect(result("clues-stackable", { "quest.162": { value: 1 } }).met).toBe(
      false,
    );
    expect(result("clues-stackable", { "quest.162": { value: 2 } }).met).toBe(
      true,
    );
    expect(result("clues-stackable", {}).met).toBeNull();
    expect(
      result("clues-mimic-case", { "activity.mimic": { value: 1 } }).met,
    ).toBeNull();
    expect(result("clues-mimic-case", collected()).met).toBe(false);
    expect(result("clues-mimic-case", collected("Mimic scroll case")).met).toBe(
      true,
    );
  });

  function collected(...names: string[]): AchievementFacts {
    const snapshot = blank();
    snapshot.collectionComplete = true;
    snapshot.items = names.map((name) => {
      const definition = definitions.items.find((i) => i.name === name);
      if (!definition) throw Error(`Missing item fixture: ${name}`);
      return item(Number(definition.key.split(".").at(-1)), 1);
    });
    return achievementFacts(snapshot);
  }

  test("storage upgrades require both drops and the gem sack's Crafting level", () => {
    expect(result("silklined-herb-sack", collected("Herb sack")).met).toBe(
      false,
    );
    expect(
      result("silklined-herb-sack", collected("Pristine spider silk")).met,
    ).toBe(false);
    expect(
      result(
        "silklined-herb-sack",
        collected("Herb sack", "Pristine spider silk"),
      ).met,
    ).toBe(true);
    expect(result("silklined-herb-sack", {}).met).toBeNull();
    const gems = collected("Gem bag", "Immaculate mole skin");
    expect(
      result("gem-sack", { ...gems, "skill.crafting.level": { value: 80 } })
        .met,
    ).toBe(false);
    expect(
      result("gem-sack", { ...gems, "skill.crafting.level": { value: 81 } })
        .met,
    ).toBe(true);
    expect(
      result("gem-sack", {
        ...collected("Gem bag"),
        "skill.crafting.level": { value: 99 },
      }).met,
    ).toBe(false);
  });

  test("the elemental amulet needs four distinct jewels and 30 Runecraft", () => {
    const jewels = [
      "Air diamond",
      "Water sapphire",
      "Earth emerald",
      "Fire ruby",
    ];
    const level = { "skill.runecraft.level": { value: 30 } };
    for (const missing of jewels)
      expect(
        result("elemental-amulet", {
          ...collected(...jewels.filter((j) => j !== missing)),
          ...level,
        }).met,
      ).toBe(false);
    expect(
      result("elemental-amulet", {
        ...collected(...jewels),
        "skill.runecraft.level": { value: 29 },
      }).met,
    ).toBe(false);
    expect(
      result("elemental-amulet", { ...collected(...jewels), ...level }).met,
    ).toBe(true);
  });

  test("duplicate medallion fragments cannot substitute for distinct pieces", () => {
    const snapshot = blank();
    snapshot.collectionComplete = true;
    const fragments = definitions.items.filter(
      (i) => i.name === "Medallion fragment",
    );
    expect(fragments).toHaveLength(8);
    const ids = fragments.map((i) => Number(i.key.split(".").at(-1)));
    const first = ids[0];
    if (first === undefined) throw Error("Missing fragments");
    snapshot.items = [item(first, 8), item(first, 8)];
    const sailing = { "skill.sailing.level": { value: 63 } };
    expect(
      result("medallion-of-the-deep", {
        ...achievementFacts(snapshot),
        ...sailing,
      }).met,
    ).toBe(false);
    snapshot.items = ids.map((id) => item(id, 1));
    expect(
      result("medallion-of-the-deep", {
        ...achievementFacts(snapshot),
        "skill.sailing.level": { value: 62 },
      }).met,
    ).toBe(false);
    expect(
      result("medallion-of-the-deep", {
        ...achievementFacts(snapshot),
        ...sailing,
      }).met,
    ).toBe(true);
    snapshot.collectionComplete = false;
    expect(
      result("medallion-of-the-deep", {
        ...achievementFacts(snapshot),
        ...sailing,
      }).met,
    ).toBeNull();
  });

  test("quest unlocks require completion and workshop routes require their skills", () => {
    const reef = definitions.quests.find((q) => q.name === "The Red Reef");
    const giants = definitions.quests.find((q) => q.name === "Sleeping Giants");
    if (!reef || !giants) throw Error("Missing quest fixtures");
    const bench = {
      [reef.key]: { value: 1 },
      "skill.sailing.level": { value: 63 },
      "skill.construction.level": { value: 54 },
    };
    expect(result("bosuns-bench", bench).met).toBe(false);
    bench[reef.key] = { value: 2 };
    expect(result("bosuns-bench", bench).met).toBe(true);
    expect(
      result("bosuns-bench", {
        ...bench,
        "skill.construction.level": { value: 53 },
      }).met,
    ).toBe(false);
    const folly = {
      ...collected("Belle's folly (tarnished)"),
      "skill.smithing.level": { value: 70 },
    };
    expect(result("belles-folly", folly).met).toBeNull();
    expect(
      result("belles-folly", { ...folly, [giants.key]: { value: 2 } }).met,
    ).toBe(true);
    expect(
      result("aquanite-hopper", {
        ...collected("Aquanite tendon"),
        "skill.smithing.level": { value: 59 },
      }).met,
    ).toBe(false);
    expect(
      result("aquanite-hopper", {
        ...collected("Aquanite tendon"),
        "skill.smithing.level": { value: 60 },
      }).met,
    ).toBe(true);
  });

  test("prayer scrolls and trial rewards use their own evidence", () => {
    const scroll = collected("Deadeye prayer scroll");
    expect(
      result("deadeye", { ...scroll, "skill.prayer.level": { value: 61 } }).met,
    ).toBe(false);
    expect(
      result("deadeye", { ...scroll, "skill.prayer.level": { value: 62 } }).met,
    ).toBe(true);
    expect(
      result("mystic-vigour", {
        ...scroll,
        "skill.prayer.level": { value: 99 },
      }).met,
    ).toBe(false);
    expect(result("tempor-tantrum-shark", collected("Stormy key")).met).toBe(
      false,
    );
    expect(result("tempor-tantrum-shark", collected("Barrel stand")).met).toBe(
      true,
    );
  });

  test("twinflame completion requires both crowns but no assembly evidence", () => {
    const s = blank();
    s.collectionComplete = true;
    s.items = [item(30631, 1)];
    expect(result("twinflame-staff", achievementFacts(s)).met).toBe(false);
    s.items.push(item(30628, 1));
    expect(result("twinflame-staff", achievementFacts(s)).met).toBe(true);
    s.collectionComplete = false;
    s.items = [];
    expect(result("twinflame-staff", achievementFacts(s)).met).toBeNull();
  });

  test("Vampyrium access requires the finale to be finished, not merely started", () => {
    const quest = definitions.quests.find(
      (q) => q.name === "The Blood Moon Rises",
    );
    if (!quest) throw Error("Missing Myreque finale definition");
    expect(result("vampyrium", { [quest.key]: { value: 1 } }).met).toBe(false);
    expect(result("vampyrium", { [quest.key]: { value: 2 } }).met).toBe(true);
    expect(result("vampyrium", {}).met).toBeNull();
  });

  test("distinguishes complete, available, locked and missing evidence", () => {
    const bindings = [node("parent", "p"), node("child", "c", ["parent"])];
    expect(
      evaluateAchievements({ p: { value: 0 }, c: { value: 0 } }, bindings)
        .states,
    ).toBe("12");
    expect(
      evaluateAchievements({ p: { value: 1 }, c: { value: 0 } }, bindings)
        .states,
    ).toBe("01");
    expect(evaluateAchievements({ c: { value: 1 } }, bindings).states).toBe(
      "30",
    );
    expect(evaluateAchievements({ c: { value: 0 } }, bindings).states).toBe(
      "33",
    );
  });
  test("an any-of requirement can be proven with one known completion", () => {
    const b: AchievementBinding[] = [
      node("a", "a"),
      node("b", "b"),
      {
        id: "either",
        rule: { kind: "milestones", match: "any", ids: ["a", "b"] },
        required: ["a", "b"],
        anyRequired: true,
      },
    ];
    expect(evaluateAchievements({ a: { value: 1 } }, b).states).toBe("030");
  });
  test("collection absence is false only after a complete detail snapshot; duplicate pages never add quantities", () => {
    const s = blank();
    s.items = [item(12932, 1), item(12932, 1)];
    expect(achievementFacts(s)["collection.item.12932"]).toBeUndefined();
    s.collectionComplete = true;
    const f = achievementFacts(s);
    expect(f["collection.item.12932"]?.value).toBe(1);
    expect(f["collection.item.11905"]?.value).toBe(0);
    const b = [
      {
        ...node("pieces", "unused"),
        rule: {
          kind: "threshold" as const,
          key: "collection.item.12932",
          target: 2,
          label: "Fangs",
        },
      },
    ];
    expect(evaluateAchievements(f, b).states).toBe("1");
  });
  test("unranked hiscores stay unknown and cannot be replaced by collection evidence", () => {
    const s = blank();
    s.collectionComplete = true;
    s.items = [item(12932, 1)];
    s.activities = [
      {
        key: "activity.zulrah",
        name: "Zulrah",
        category: "bossing",
        rank: { value: null, availabilityReason: "unranked" },
        score: { value: 0, availabilityReason: null },
      },
    ];
    expect(
      evaluateAchievements(achievementFacts(s), [node("kc", "activity.zulrah")])
        .states,
    ).toBe("3");
  });
  test("RFD subquests are only confirmed by overall quest completion", () => {
    expect(result("rfd-dwarf", { "quest.117": { value: 1 } }).met).toBeNull();
    expect(result("rfd-dwarf", { "quest.117": { value: 2 } }).met).toBe(true);
  });
  test("incomplete combat task membership cannot award a boss greenlog", () => {
    const s = blank();
    s.tasksComplete = true;
    const tasks = definitions.tasks.filter((t) => t.boss === "Zulrah");
    s.tasks = tasks.slice(1).map((t) => ({
      itemKey: t.key,
      group: t.boss,
      state: null,
      completed: true,
      current: null,
      points: t.tier,
    }));
    const facts = achievementFacts(s);
    const b = [
      {
        ...node("green", "unused"),
        rule: {
          kind: "threshold" as const,
          key: "combatTasks.boss.Zulrah.current",
          target: "combatTasks.boss.Zulrah.total",
          label: "Zulrah",
        },
      },
    ];
    expect(evaluateAchievements(facts, b).states).toBe("3");
    const firstTask = tasks[0];
    if (!firstTask) throw Error("Missing task fixture");
    s.tasks.push({
      itemKey: firstTask.key,
      group: "Zulrah",
      state: null,
      completed: false,
      current: null,
      points: 1,
    });
    expect(evaluateAchievements(achievementFacts(s), b).states).toBe("1");
  });
  test("partial skill rows cannot award max cape; complete evidence does", () => {
    const s = blank();
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
    const val = { value: 99, availabilityReason: null };
    s.skills = skillNames.map((name) => ({
      key: `skill.${name}`,
      name,
      level: val,
      rank: val,
      xp: { ...val, value: 13_034_431 },
    }));
    expect(result("max-cape", achievementFacts(s)).met).toBe(true);
    s.skills.pop();
    expect(result("max-cape", achievementFacts(s)).met).toBeNull();
  });
  test("count lower bounds can establish success without inventing negative evidence", () => {
    const b = [node("count", "count")];
    expect(
      evaluateAchievements({ count: { value: 1, upper: 10 } }, b).states,
    ).toBe("0");
    expect(
      evaluateAchievements({ count: { value: 0, upper: 10 } }, b).states,
    ).toBe("3");
  });
  test("the entire authored catalog evaluates with bounded output and unique identifiers", () => {
    const r = evaluateAchievements(achievementFacts(blank()));
    expect(r.states).toHaveLength(achievementBindings.length);
    expect(new Set(achievementBindings.map((n) => n.id)).size).toBe(
      achievementBindings.length,
    );
    expect(JSON.stringify(r.progress).length).toBeLessThan(600_000);
    expect(r.states).not.toContain("0");
  });
  test("cycles and missing prerequisite IDs fail rather than silently completing", () => {
    expect(() =>
      evaluateAchievements({}, [
        {
          ...node("a", "a"),
          rule: { kind: "milestones", match: "all", ids: ["a"] },
        },
      ]),
    ).toThrow("Invalid achievement dependency");
  });
});

function eligibleQuestFacts(): AchievementFacts {
  return {
    ...Object.fromEntries(
      definitions.quests.map((quest) => [quest.key, { value: 2 }]),
    ),
    ...Object.fromEntries(
      [
        "attack",
        "strength",
        "defence",
        "ranged",
        "prayer",
        "magic",
        "runecraft",
        "construction",
        "hitpoints",
        "agility",
        "herblore",
        "thieving",
        "crafting",
        "fletching",
        "slayer",
        "hunter",
        "mining",
        "smithing",
        "fishing",
        "cooking",
        "firemaking",
        "woodcutting",
        "farming",
        "sailing",
      ].map((skill) => [`skill.${skill}.level`, { value: 99 }]),
    ),
    "quests.points": { value: 300 },
    "account.combatLevel": { value: 126 },
  };
}
test("every milestone has bounded source dependencies and collection counts respect Hiscores authority", () => {
  for (const node of achievementBindings)
    expect(achievementSourceKeys(node.id).length).toBeLessThanOrEqual(7);
  const rank = achievementBindings.find((node) => node.rule.kind === "rank");
  if (!rank) throw Error("Missing collection rank");
  expect(achievementSourceKeys(rank.id)).toEqual([
    "activities",
    "collectionSummary",
  ]);
  expect(achievementSourceKeys("dragon-2")).toEqual(["quests", "skills"]);
});
function setQuest(facts: AchievementFacts, name: string, value: number) {
  const quest = definitions.quests.find((quest) => quest.name === name);
  if (!quest) throw Error(name);
  facts[quest.key] = { value };
}

test("quest readiness checks skills and off-graph quests without changing completion", () => {
  const facts = eligibleQuestFacts();
  setQuest(facts, "Song of the Elves", 0);
  expect(result("song", facts).status).toBe("1");
  facts["skill.herblore.level"] = { value: 69 };
  expect(result("song", facts).status).toBe("2");
  facts["skill.herblore.level"] = { value: null };
  expect(result("song", facts).status).toBe("3");
  facts["skill.herblore.level"] = { value: 70 };
  setQuest(facts, "Druidic Ritual", 0);
  expect(result("song", facts).status).toBe("2");
  setQuest(facts, "Song of the Elves", 2);
  expect(result("song", facts).status).toBe("0");
});

test("Dragon Slayer II requires quest points and all quest gates; unreported unlocks stay unknown", () => {
  const facts = eligibleQuestFacts();
  setQuest(facts, "Dragon Slayer II", 0);
  facts["quests.points"] = { value: 199 };
  expect(result("dragon-2", facts).status).toBe("2");
  facts["quests.points"] = { value: 200 };
  setQuest(facts, "Dream Mentor", 0);
  expect(result("dragon-2", facts).status).toBe("2");
  setQuest(facts, "Dream Mentor", 2);
  const pending = result("dragon-2", facts);
  expect(pending.status).toBe("3");
  expect(
    pending.readiness?.evidence.some((item) =>
      item.reason?.includes("Ancient Cavern"),
    ),
  ).toBe(true);
});

test("Monkey Madness II requires Hunter and its balloon route even after Monkey Madness I", () => {
  const facts = eligibleQuestFacts();
  setQuest(facts, "Monkey Madness II", 0);
  facts["skill.hunter.level"] = { value: 59 };
  expect(result("monkey-2", facts).status).toBe("2");
  facts["skill.hunter.level"] = { value: 60 };
  expect(result("monkey-2", facts).status).toBe("3");
  setQuest(facts, "Monkey Madness II", 1);
  expect(result("monkey-2", facts).status).toBe("1");
});

test("boostable skill requirements and partial quest checkpoints preserve uncertainty", () => {
  const facts = eligibleQuestFacts();
  setQuest(facts, "Lost City", 0);
  facts["skill.crafting.level"] = { value: 30 };
  expect(result("lost-city", facts).status).toBe("3");
  facts["skill.crafting.level"] = { value: 31 };
  expect(result("lost-city", facts).status).toBe("1");
  setQuest(facts, "Fairytale II - Cure a Queen", 0);
  facts["skill.herblore.level"] = { value: 1 };
  facts["skill.farming.level"] = { value: 1 };
  expect(result("fairy-rings", facts).status).toBe("1");
});

test("quest-derived access milestones keep their required completion gate", () => {
  const facts = eligibleQuestFacts();
  setQuest(facts, "Song of the Elves", 0);
  expect(result("song", facts).status).toBe("1");
  expect(result("prif", facts).status).toBe("2");
  setQuest(facts, "Song of the Elves", 2);
  expect(result("prif", facts).status).toBe("0");
  setQuest(facts, "Crab Quest", 0);
  setQuest(facts, "Pandemonium", 0);
  expect(result("crab-quest", facts).status).toBe("2");
});

test("source details do not include a prerequisite's own unevaluated readiness sources", () => {
  const parent: AchievementBinding = {
    ...node("parent", "activity.example"),
    prerequisites: {
      kind: "threshold",
      key: "quest.17",
      target: 2,
      label: "Cook's Assistant",
    },
  };
  const child = node("child", "collection.item.1", ["parent"]);
  expect(achievementSourceKeys("child", [parent, child])).toEqual([
    "activities",
    "collectionDetail",
  ]);
});
