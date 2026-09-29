import catalog from "./atlasCatalog.json";
import demo from "./atlasDemo.json";
import layout from "./atlasLayout.json";
import requirements from "./atlasRequirements.json";

export type AtlasSectionId =
  | "quests"
  | "travel"
  | "equipment"
  | "skilling-equipment"
  | "skills"
  | "diaries"
  | "combat"
  | "collections"
  | "account";
export type AtlasRule =
  | { type: "quest"; quest: string; state: "started" | "finished" }
  | { type: "threshold"; metric: string; value: number }
  | {
      type: "items";
      match: "all" | "any";
      items: { name: string; quantity: number; key?: string }[];
    }
  | { type: "requirements"; rules: AtlasRule[] }
  | { type: "untracked"; reason: string }
  | { type: "all" | "any"; milestones: string[] }
  | { type: "diary"; area: string; tier: string }
  | { type: "catalog"; scope: string; goal: number | "all" }
  | { type: "combat-tier"; tier: string }
  | {
      type: "collection-rank";
      rank: string;
      fraction: number;
      roundDownTo: number;
    };
export type AtlasLink = {
  id: string;
  kind: "required" | "progression" | "supports";
  display?: "graph" | "details";
};
export type AtlasDetailRequirement = {
  group: "skills" | "quests" | "other";
  label: string;
  note?: string;
  milestoneId?: string;
  wiki: string;
};
export type AtlasDefinition = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  rule: AtlasRule;
  completion: string;
  icon: string;
  location: string;
  links: AtlasLink[];
  wiki: string;
  featured: boolean;
  heuristic?: string;
  requirements?: AtlasDetailRequirement[];
};
export type AtlasPlacement = {
  section: AtlasSectionId;
  group?: string;
  lane: number;
  row: number;
};
export type AtlasGroup = {
  id: string;
  section: AtlasSectionId;
  label: string;
  description: string;
  row: number;
  rows: number;
  paths: { label: string; lane: number; row: number }[];
};
export type AtlasLocation = { name: string; x: number; y: number };

export const atlasLocations: Record<string, AtlasLocation> = {
  varlamore: { name: "Varlamore", x: 0.22, y: 0.45 },
  "fossil-island": { name: "Fossil Island", x: 0.855, y: 0.278 },
  lumbridge: { name: "Lumbridge", x: 0.736, y: 0.463 },
  tirannwn: { name: "Tirannwn", x: 0.42, y: 0.43 },
  prif: { name: "Prifddinas", x: 0.42, y: 0.37 },
  morytania: { name: "Morytania", x: 0.85, y: 0.42 },
  gnome: { name: "Tree Gnome Stronghold", x: 0.5, y: 0.33 },
  varrock: { name: "Varrock", x: 0.735, y: 0.35 },
  desert: { name: "Kharidian Desert", x: 0.78, y: 0.55 },
  kourend: { name: "Great Kourend", x: 0.235, y: 0.27 },
  ardougne: { name: "Ardougne", x: 0.535, y: 0.423 },
  fremennik: { name: "Fremennik lands", x: 0.55, y: 0.255 },
  zanaris: { name: "Lumbridge Swamp · route to Zanaris", x: 0.724, y: 0.493 },
  entrana: { name: "Entrana", x: 0.616, y: 0.4 },
  lunar: { name: "Lunar Isle", x: 0.455, y: 0.18 },
  monastery: { name: "Edgeville Monastery", x: 0.666, y: 0.326 },
  gwd: { name: "God Wars Dungeon · Troll Country", x: 0.602, y: 0.2 },
  karuulm: { name: "Mount Karuulm", x: 0.216, y: 0.187 },
  kraken: { name: "Piscatoris · Kraken Cove", x: 0.484, y: 0.333 },
  zulrah: { name: "Zul-Andra", x: 0.438, y: 0.52 },
  karamja: { name: "Karamja · Mor Ul Rek", x: 0.606, y: 0.5 },
  taverley: { name: "Taverley", x: 0.637, y: 0.365 },
  "farming-guild": { name: "Farming Guild · Kebos", x: 0.158, y: 0.293 },
  "crafting-guild": { name: "Crafting Guild", x: 0.65, y: 0.45 },
  falador: { name: "Falador", x: 0.658, y: 0.405 },
  wilderness: { name: "Wilderness", x: 0.708, y: 0.238 },
  draynor: { name: "Draynor Village", x: 0.692, y: 0.454 },
  "royal-titans": {
    name: "Asgarnian Ice Dungeon · Royal Titans",
    x: 0.666,
    y: 0.49,
  },
  burthorpe: { name: "Burthorpe", x: 0.633, y: 0.333 },
  wintertodt: { name: "Wintertodt · northern Kourend", x: 0.245, y: 0.168 },
};

const detailRequirements = requirements as Record<
  string,
  AtlasDetailRequirement[]
>;
export const atlasDefinitions: AtlasDefinition[] = (
  catalog as AtlasDefinition[]
).map((node) => ({ ...node, requirements: detailRequirements[node.id] }));
export const atlasPlacements = layout.placements as Record<
  string,
  AtlasPlacement
>;
export const atlasFunnels = layout.funnels;
export const atlasDemoCompleted = new Set(demo.completed);
export const laneWidth = 300;
export const rowHeight = 220;
export const atlasGroups = (layout as { groups?: AtlasGroup[] }).groups ?? [];
export const atlasGroupById = new Map(
  atlasGroups.map((group) => [group.id, group]),
);
/** A hidden edge remains a real dependency and a navigable detail-panel link. */
export function isAtlasGraphLink(
  sourceId: string,
  targetId: string,
  link: AtlasLink,
): boolean {
  const source = atlasPlacements[sourceId];
  const target = atlasPlacements[targetId];
  return (
    link.display !== "details" &&
    Boolean(
      source &&
        target &&
        source.section === target.section &&
        source.group === target.group,
    )
  );
}
export function atlasRow(id: string): number {
  const placement = atlasPlacements[id];
  if (!placement) throw new Error(`Missing placement: ${id}`);
  return placement.row + (atlasGroupById.get(placement.group ?? "")?.row ?? 0);
}
let nextSectionX = 0;
export const atlasSections = layout.sections.map((section, index) => {
  const placements = Object.values(atlasPlacements).filter(
    (p) => p.section === section.id,
  );
  const width =
    (Math.max(...placements.map((p) => p.lane)) + 1) * laneWidth + 80;
  const height =
    (Math.max(
      ...placements.map(
        (p) => p.row + (atlasGroupById.get(p.group ?? "")?.row ?? 0),
      ),
    ) +
      1) *
      rowHeight +
    220;
  const result = {
    ...section,
    id: section.id as AtlasSectionId,
    index,
    x: nextSectionX,
    width,
    height,
    groups: atlasGroups.filter((group) => group.section === section.id),
  };
  nextSectionX += width + 160;
  return result;
});
export const graphWidth = nextSectionX;
export const graphHeight = Math.max(
  ...atlasSections.map((section) => section.height),
);

export function atlasPosition(id: string): [number, number] {
  const placement = atlasPlacements[id];
  if (!placement) throw new Error(`Missing placement for ${id}`);
  const section = atlasSections.find(
    (section) => section.id === placement.section,
  );
  if (!section) throw new Error(`Missing section for ${id}`);
  return [
    section.x + 160 + placement.lane * laneWidth,
    170 + atlasRow(id) * rowHeight,
  ];
}

/** Authoring checks, also exercised by Bun tests. No account data is evaluated here. */
export function validateAtlas(): string[] {
  const issues: string[] = [];
  const byId = new Map(atlasDefinitions.map((node) => [node.id, node]));
  if (byId.size !== atlasDefinitions.length)
    issues.push("Duplicate achievement IDs");
  for (const node of atlasDefinitions) {
    if (!atlasPlacements[node.id]) issues.push(`Missing placement: ${node.id}`);
    const placement = atlasPlacements[node.id];
    if (
      placement?.group &&
      atlasGroupById.get(placement.group)?.section !== placement.section
    )
      issues.push(`Invalid group: ${node.id}`);
    if (!atlasLocations[node.location])
      issues.push(`Unknown map anchor: ${node.id}`);
    if (!node.completion || !node.description || !node.wiki)
      issues.push(`Missing authored content: ${node.id}`);
    if (
      [node.name, node.subtitle, node.description, node.completion].some(
        (text) => /\bundefined\b|\bTODO\b|\bTBD\b|\$\{/.test(text),
      )
    )
      issues.push(`Unresolved authored content: ${node.id}`);
    for (const requirement of node.requirements ?? []) {
      if (requirement.milestoneId && !byId.has(requirement.milestoneId))
        issues.push(
          `Invalid detail reference ${requirement.milestoneId} → ${node.id}`,
        );
    }
    for (const link of node.links)
      if (!byId.has(link.id) || link.id === node.id)
        issues.push(`Invalid link ${link.id} → ${node.id}`);
    function validateRule(rule: AtlasRule) {
      if (rule.type === "requirements") {
        if (!rule.rules.length) issues.push(`Empty requirements: ${node.id}`);
        for (const child of rule.rules) validateRule(child);
      }
      if (rule.type === "all" || rule.type === "any") {
        for (const id of rule.milestones) {
          if (
            !node.links.some(
              (link) => link.id === id && link.kind === "required",
            )
          )
            issues.push(`Missing rule connection ${id} → ${node.id}`);
        }
      }
      if (rule.type === "threshold" && rule.value < 0)
        issues.push(`Invalid threshold: ${node.id}`);
    }
    validateRule(node.rule);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) {
      issues.push(`Connection cycle at ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const link of byId.get(id)?.links ?? []) visit(link.id);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  for (const id of Object.keys(atlasPlacements))
    if (!byId.has(id)) issues.push(`Orphan placement: ${id}`);
  for (const id of atlasDemoCompleted)
    if (!byId.has(id)) issues.push(`Unknown demo achievement: ${id}`);
  return issues;
}
