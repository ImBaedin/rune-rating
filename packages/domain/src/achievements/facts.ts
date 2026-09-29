import type { CanonicalActivity, CanonicalSkill } from "../models";
import definitions from "./definitions.json";
import type { AchievementFact, AchievementFacts } from "./evaluator";

const pagesByName = new Map(definitions.pages.map((page) => [page.name, page]));
const taskKeysByBoss = new Map<string, string[]>();
for (const task of definitions.tasks) {
  const keys = taskKeysByBoss.get(task.boss) ?? [];
  keys.push(task.key);
  taskKeysByBoss.set(task.boss, keys);
}

export type AchievementItem = {
  itemKey: string;
  label?: string;
  group: string;
  state: string | null;
  completed: boolean | null;
  current: number | null;
  points: number | null;
};
export type AchievementSnapshot = {
  skills: CanonicalSkill[];
  activities: CanonicalActivity[];
  quests: AchievementItem[];
  diaries: AchievementItem[];
  tasks: AchievementItem[];
  items: AchievementItem[];
  collectionComplete: boolean;
  tasksComplete: boolean;
  questPoints: number | null;
  collectionTotal: number | null;
  combatTier: string | null;
  pages: { name: string; obtained: number; total: number }[];
};
export function achievementFacts(
  snapshot: AchievementSnapshot,
): AchievementFacts {
  const facts: AchievementFacts = {};
  const names = new Map([
    ...definitions.items.map((i) => [i.key, i.name] as const),
    ...snapshot.items.flatMap((i) =>
      i.points !== null && i.label
        ? [[`collection.item.${i.points}`, i.label] as const]
        : [],
    ),
    ...snapshot.skills.map((s) => [`${s.key}.level`, s.name] as const),
    ...snapshot.activities.map((a) => [a.key, a.name] as const),
  ]);
  const set = (key: string, value: number | null, upper?: number) => {
    const fact: AchievementFact =
      upper === undefined ? { value } : { value, upper };
    facts[key] = fact;
    return fact;
  };
  const count = (
    key: string,
    keys: string[],
    target = 1,
    contributorLabel?: string,
  ) => {
    keys = [...new Set(keys)];
    const values = keys.map((k) => facts[k]?.value ?? null);
    const current = values.filter((v) => v !== null && v >= target).length;
    const fact = set(
      `${key}.current`,
      current,
      current + values.filter((v) => v === null).length,
    );
    set(`${key}.total`, keys.length);
    if (contributorLabel && values.some((v) => v !== null)) {
      fact.contributors = {
        label: contributorLabel,
        items: keys
          .filter((k) => (facts[k]?.value ?? 0) >= target)
          .map((key) => ({ key, label: names.get(key) ?? key }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      };
    }
    return fact;
  };
  for (const s of snapshot.skills) {
    set(`${s.key}.level`, s.level.value);
    set(`${s.key}.xp`, s.xp.value);
  }
  for (const a of snapshot.activities) {
    // Hiscores can pair an unranked entry with a zero placeholder. It is not a confirmed zero.
    set(a.key, a.rank.value === null ? null : a.score.value);
  }
  const levels = snapshot.skills
    .filter((s) => s.key !== "skill.overall")
    .map((s) => `${s.key}.level`);
  // A partial skill set must never qualify as a maxed account.
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
  const skillKeys = skillNames.map((s) => `skill.${s}.level`);
  for (const key of levels) if (!skillKeys.includes(key)) skillKeys.push(key);
  const skillsAt99 = count("skills.at99", skillKeys, 99, "Skills at level 99");
  const recordedSkills = snapshot.skills.filter(
    (s) => s.key !== "skill.overall",
  );
  const xpCandidates = recordedSkills.flatMap((s) =>
    s.xp.value === null
      ? []
      : [
          {
            key: s.key,
            label: s.name,
            current: s.xp.value,
            target: 200_000_000,
          },
        ],
  );
  skillsAt99.candidates = {
    label: "Closest recorded skills to 99",
    unit: "XP",
    mode: "next",
    items: xpCandidates
      .filter((s) => {
        const level = facts[`${s.key}.level`]?.value;
        return level !== null && level !== undefined && level < 99;
      })
      .map((s) => ({ ...s, target: 13_034_431 })),
  };
  const knownLevels = skillKeys.map((k) => facts[k]?.value ?? null);
  const minimumLevel = set(
    "skills.minimumLevel.current",
    knownLevels.every((v) => v !== null)
      ? Math.min(...(knownLevels as number[]))
      : null,
  );
  minimumLevel.candidates = {
    label: "Skills below this base level",
    unit: "levels",
    mode: "blocking",
    items: recordedSkills.flatMap((s) =>
      s.level.value === null
        ? []
        : [
            {
              key: s.key,
              label: s.name,
              current: s.level.value,
              target: null,
            },
          ],
    ),
  };
  const xp = skillKeys.map(
    (k) => facts[k.replace(".level", ".xp")]?.value ?? null,
  );
  const maxXp = Math.max(0, ...xp.filter((n): n is number => n !== null));
  const maximumXp = set(
    "skills.maximumXp",
    xpCandidates.length ? maxXp : null,
    xp.some((n) => n === null) ? 200_000_000 : maxXp,
  );
  maximumXp.candidates = {
    label: "Closest recorded skills to 200m",
    completedLabel: "Skills at 200m XP",
    unit: "XP",
    mode: "leading",
    items: xpCandidates,
  };
  const combat = [
    "defence",
    "hitpoints",
    "prayer",
    "attack",
    "strength",
    "ranged",
    "magic",
  ].map((k) => facts[`skill.${k}.level`]?.value ?? null);
  if (combat.every((v) => v !== null)) {
    const [d, h, p, a, s, r, m] = combat as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    set(
      "account.combatLevel",
      Math.floor(
        0.25 * (d + h + Math.floor(p / 2)) +
          0.325 * Math.max(a + s, Math.floor(r * 1.5), Math.floor(m * 1.5)),
      ),
    );
  }
  set("quests.points", snapshot.questPoints);
  for (const q of snapshot.quests)
    set(
      q.itemKey,
      q.state === "finished" ? 2 : q.state === "in_progress" ? 1 : 0,
    );
  for (const d of snapshot.diaries)
    set(d.itemKey, d.completed === null ? null : d.completed ? 1 : 0);
  if (snapshot.tasksComplete)
    for (const t of snapshot.tasks)
      set(t.itemKey, t.completed === null ? null : t.completed ? 1 : 0);
  const questKeys = (free: boolean) => [
    ...new Set([
      ...definitions.quests
        .filter((q) => (free ? q.group === "free" : q.group !== "mini"))
        .map((q) => q.key),
      ...snapshot.quests
        .filter((q) => (free ? q.group === "free" : q.group !== "mini"))
        .map((q) => q.itemKey),
    ]),
  ];
  count("quests.free", questKeys(true), 2);
  count("quests.standard", questKeys(false), 2);
  count(
    "diaries",
    definitions.diaries.map((d) => d.key),
  );
  for (const tier of ["easy", "medium", "hard", "elite"])
    count(
      `diaries.${tier}`,
      definitions.diaries.filter((d) => d.tier === tier).map((d) => d.key),
    );
  const observedTaskKeysByBoss = new Map<string, string[]>();
  for (const task of snapshot.tasks) {
    const keys = observedTaskKeysByBoss.get(task.group) ?? [];
    keys.push(task.itemKey);
    observedTaskKeysByBoss.set(task.group, keys);
  }
  for (const [boss, keys] of taskKeysByBoss) {
    count(`combatTasks.boss.${boss}`, [
      ...keys,
      ...(observedTaskKeysByBoss.get(boss) ?? []),
    ]);
  }
  if (snapshot.combatTier !== null)
    set(
      "combat.tier",
      Math.max(
        0,
        ["easy", "medium", "hard", "elite", "master", "grandmaster"].indexOf(
          snapshot.combatTier.toLowerCase(),
        ) + 1,
      ),
    );
  const itemKeysByPage = new Map<string | null, Set<string>>();
  for (const item of snapshot.items) {
    if (item.points === null) continue;
    const keys = itemKeysByPage.get(item.state) ?? new Set<string>();
    keys.add(`collection.item.${item.points}`);
    itemKeysByPage.set(item.state, keys);
  }
  if (snapshot.collectionComplete) {
    for (const item of definitions.items) set(item.key, 0);
    // One item can occur on multiple pages. Those are duplicated observations, not extra drops.
    for (const item of snapshot.items)
      if (item.points !== null && item.current !== null) {
        const key = `collection.item.${item.points}`;
        set(key, Math.max(facts[key]?.value ?? 0, item.current));
      }
    for (const page of snapshot.pages) {
      const fact = set(`collection.page.${page.name}.current`, page.obtained);
      set(`collection.page.${page.name}.total`, page.total);
      const definition = pagesByName.get(page.name);
      const observedKeys = itemKeysByPage.get(page.name) ?? new Set<string>();
      // Prefer current page membership; the catalog can fill absent rows only
      // when the complete snapshot's page totals still agree with it.
      const keys =
        observedKeys.size === page.total
          ? observedKeys
          : new Set([...(definition?.items ?? []), ...observedKeys]);
      const items = [...keys]
        .map((key) => ({
          key,
          label: names.get(key) ?? key,
          itemId: Number(key.split(".").at(-1)),
          obtained: (facts[key]?.value ?? 0) > 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      if (
        page.total > 0 &&
        items.length === page.total &&
        items.filter((i) => i.obtained).length === page.obtained
      )
        fact.collectionLog = { items };
    }
  }
  const petPage = pagesByName.get("All Pets");
  if (!petPage) throw Error("Canonical pet catalog is missing");
  count(
    "collection.pets",
    [...new Set([...petPage.items, ...(itemKeysByPage.get("All Pets") ?? [])])],
    1,
    "Logged pets",
  );
  count(
    "collection.bossJars",
    definitions.items
      .filter((i) => i.name.startsWith("Jar of "))
      .map((i) => i.key),
    1,
    "Logged boss jars",
  );
  const completedPages = [
    ...new Map(
      snapshot.pages
        .filter((p) => p.total > 0 && p.obtained >= p.total)
        .map((p) => [
          p.name,
          { key: `collection.page.${p.name}`, label: p.name },
        ]),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));
  const completedPageCount = set(
    "collection.completedPages.current",
    snapshot.collectionComplete ? completedPages.length : null,
  );
  if (snapshot.collectionComplete) {
    completedPageCount.contributors = {
      label: "Completed collection logs",
      items: completedPages,
    };
    completedPageCount.candidates = {
      label: "Closest logs · fewest missing slots",
      unit: "slots",
      mode: "next",
      items: [
        ...new Map(
          snapshot.pages
            .filter((p) => p.total > 0)
            .map((p) => [
              p.name,
              {
                key: `collection.page.${p.name}`,
                label: p.name,
                current: p.obtained,
                target: p.total,
              },
            ]),
        ).values(),
      ],
    };
  }
  set("collection.total", snapshot.collectionTotal);
  // Hiscores owns this shared metric. Unranked is unknown, never replaced by a provider's value.
  set(
    "collection.obtained",
    facts["activity.collections_logged"]?.value ?? null,
  );
  const bosses = snapshot.activities.filter((a) => a.category === "bossing");
  if (bosses.length)
    count(
      "hiscores.distinctBosses",
      bosses.map((a) => a.key),
      1,
      "Bosses with recorded completions",
    );
  count(
    "hiscores.raidCircuit",
    [
      "activity.chambers_of_xeric",
      "activity.theatre_of_blood",
      "activity.tombs_of_amascut",
    ],
    1,
    "Raids with recorded completions",
  );
  return facts;
}
