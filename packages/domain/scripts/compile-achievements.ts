/** Compile authoring names to canonical identifiers. No network access. */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import type {
  AtlasDefinition,
  AtlasRule,
} from "../../../apps/web/src/features/achievements/atlasData";
import { HISCORES_ACTIVITY_NAMES } from "../../sdk-hiscores/src/manifest";
import definitions from "../src/achievements/definitions.json";
import type { AchievementRule } from "../src/achievements/evaluator";
import questPrerequisites from "../src/achievements/questPrerequisites.json";

const root = new URL("../../../", import.meta.url);
const catalog = (await Bun.file(
  new URL("apps/web/src/features/achievements/atlasCatalog.json", root),
).json()) as AtlasDefinition[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
const bossAliases: Record<string, string> = {
  "Mad Angel": "The Mad Angel",
  "The Mimic": "Mimic",
  Leviathan: "The Leviathan",
  Whisperer: "The Whisperer",
  "Chambers of Xeric: Challenge Mode": "Chambers of Xeric: CM",
};
const metricAliases: Record<string, string> = {
  the_nightmare: "nightmare",
  hydra: "alchemical_hydra",
  barrows: "barrows_chests",
  cox: "chambers_of_xeric",
  tob: "theatre_of_blood",
  toa: "tombs_of_amascut",
  gauntlet: "the_gauntlet",
  gotr: "rifts_closed",
};
const activityKeys = new Map(
  HISCORES_ACTIVITY_NAMES.map((name) => [
    slug(name),
    slug(name.replaceAll("'", "")),
  ]),
);
const threshold = (
  key: string,
  target: number | string,
  label: string,
): AchievementRule => ({
  kind: "threshold",
  key,
  target,
  label,
});
function unique<T extends { name: string }>(values: T[], name: string): T {
  const found = values.filter((x) => norm(x.name) === norm(name));
  if (found.length !== 1 || !found[0])
    throw Error(`Ambiguous or unknown binding: ${name}`);
  return found[0];
}
function compile(rule: AtlasRule): AchievementRule {
  switch (rule.type) {
    case "untracked":
      return { kind: "untracked", reason: rule.reason };
    case "requirements":
      if (!rule.rules.length) throw Error("Empty achievement requirements");
      return { kind: "all", rules: rule.rules.map(compile) };
    case "quest": {
      if (rule.quest.startsWith("Recipe for Disaster:"))
        return {
          kind: "untracked",
          reason:
            "RuneProfile reports the overall Recipe for Disaster quest, not its individual subquests.",
          completedBy: "quest.117",
        };
      return threshold(
        unique(definitions.quests, rule.quest).key,
        rule.state === "finished" ? 2 : 1,
        rule.quest,
      );
    }
    case "diary": {
      const area =
        rule.area === "Lumbridge"
          ? "Lumbridge & Draynor"
          : rule.area === "Kourend"
            ? "Kourend & Kebos"
            : rule.area;
      const d = definitions.diaries.find(
        (d) => norm(d.area) === norm(area) && norm(d.tier) === norm(rule.tier),
      );
      if (!d) throw Error(`Diary ${area}`);
      return threshold(d.key, 1, `${area} ${rule.tier}`);
    }
    case "threshold": {
      let key = rule.metric;
      if (key.startsWith("bossing.")) {
        let boss = key.split(".")[1] ?? "";
        boss = metricAliases[boss] ?? boss;
        if (!activityKeys.has(boss)) throw Error(`Unknown hiscores ${boss}`);
        key = `activity.${activityKeys.get(boss)}`;
      } else if (key.startsWith("activities.")) {
        const boss = key.split(".")[1] ?? "";
        const activity = activityKeys.get(metricAliases[boss] ?? boss);
        if (!activity) throw Error(`Unknown activity ${boss}`);
        key = `activity.${activity}`;
      } else if (key.startsWith("clues."))
        key = `activity.clue_scrolls_${key.split(".")[1]}`;
      else if (key.startsWith("skills.") && key.split(".").length === 3)
        key = key
          .replace("skills.", "skill.")
          .replace("skill.total.", "skill.overall.");
      return threshold(key, rule.value, rule.metric);
    }
    case "items":
      return {
        kind: rule.match,
        rules: rule.items.map((i) => {
          const name =
            i.name === "Trident of the Seas"
              ? "Trident of the Seas (full)"
              : i.name;
          const matches = definitions.items.filter(
            (x) => norm(x.name) === norm(name) && (!i.key || x.key === i.key),
          );
          if (!matches[0]) throw Error(`Unknown item ${name}`);
          // Graceful recolours are separate log slots. Any logged variant qualifies; never sum duplicated pages.
          return matches.length === 1
            ? threshold(matches[0].key, i.quantity, i.name)
            : {
                kind: "any",
                rules: matches.map((i2) =>
                  threshold(i2.key, i.quantity, i.name),
                ),
              };
        }),
      };
    case "all":
    case "any":
      return { kind: "milestones", match: rule.type, ids: rule.milestones };
    case "combat-tier": {
      const tier = [
        "easy",
        "medium",
        "hard",
        "elite",
        "master",
        "grandmaster",
      ].indexOf(rule.tier.toLowerCase());
      if (tier < 0)
        throw Error(`Unknown combat achievement tier: ${rule.tier}`);
      return threshold(
        "combat.tier",
        tier + 1,
        `${rule.tier} combat achievements`,
      );
    }
    case "collection-rank":
      return {
        kind: "rank",
        fraction: rule.fraction,
        roundDownTo: rule.roundDownTo,
      };
    case "catalog": {
      let scope = rule.scope;
      if (scope.startsWith("collection.page."))
        scope = unique(definitions.pages, scope.slice(16)).key;
      if (scope.startsWith("combatTasks.boss.")) {
        let boss = scope.slice(17);
        boss = bossAliases[boss] ?? boss;
        boss =
          definitions.tasks.find((t) => norm(t.boss) === norm(boss))?.boss ??
          boss;
        if (!definitions.tasks.some((t) => t.boss === boss))
          throw Error(`Unknown task boss ${boss}`);
        scope = `combatTasks.boss.${boss}`;
      }
      return threshold(
        `${scope}.current`,
        rule.goal === "all" ? `${scope}.total` : rule.goal,
        scope,
      );
    }
    default:
      throw Error("Unknown achievement rule");
  }
}
const nodes = catalog.map((n) => ({
  id: n.id,
  rule: compile(n.rule),
  required: n.links.filter((l) => l.kind === "required").map((l) => l.id),
  anyRequired: n.rule.type === "any",
  ...(n.rule.type === "quest" &&
  !n.rule.quest.startsWith("Recipe for Disaster:")
    ? {
        prerequisites: (() => {
          const key = unique(definitions.quests, n.rule.quest).key;
          const entry =
            questPrerequisites.quests[
              key as keyof typeof questPrerequisites.quests
            ];
          if (!entry)
            throw Error(
              `Missing verified quest prerequisites: ${n.rule.quest}`,
            );
          if (key === "quest.47" && n.rule.state !== "started")
            throw Error(
              "Fairytale II prerequisites currently cover only the fairy-ring checkpoint",
            );
          return entry.rule as AchievementRule;
        })(),
      }
    : {}),
}));
const version = createHash("sha256")
  .update(
    JSON.stringify({
      nodes,
      definitions,
      logic: await Promise.all(
        ["evaluator.ts", "facts.ts"].map((file) =>
          Bun.file(
            new URL(`../src/achievements/${file}`, import.meta.url),
          ).text(),
        ),
      ),
    }),
  )
  .digest("hex")
  .slice(0, 16);
function formattedJson(value: unknown, path: URL): string {
  const formatted = Bun.spawnSync(
    [
      fileURLToPath(new URL("node_modules/.bin/biome", root)),
      "format",
      "--stdin-file-path",
      fileURLToPath(path),
    ],
    { stdin: Buffer.from(JSON.stringify(value)) },
  );
  if (formatted.exitCode !== 0) throw Error(formatted.stderr.toString());
  return formatted.stdout.toString();
}
const target = new URL("packages/domain/src/achievements/compiled.json", root);
const manifest = new URL("packages/domain/src/achievements/version.json", root);
const output = formattedJson({ version, nodes }, target);
const versionOutput = formattedJson({ version, count: nodes.length }, manifest);
if (process.argv.includes("--check")) {
  if (
    (await Bun.file(target).text()) !== output ||
    (await Bun.file(manifest).text()) !== versionOutput
  )
    throw Error(
      "Achievement rules are stale. Run bun packages/domain/scripts/compile-achievements.ts",
    );
} else {
  await Bun.write(target, output);
  await Bun.write(manifest, versionOutput);
}
console.log(`Bound ${nodes.length} milestones; version ${version}`);
