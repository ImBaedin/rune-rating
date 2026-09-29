import { getBossIconUrls } from "../../bossIcons";
import {
  type AtlasDefinition,
  type AtlasLocation,
  type AtlasSectionId,
  atlasDefinitions,
  atlasDemoCompleted,
  atlasLocations,
  atlasPlacements,
  atlasPosition,
  atlasSections,
} from "./atlasData";
import { atlasIcons } from "./atlasIcons";

export { atlasSections, graphHeight, graphWidth, laneWidth } from "./atlasData";

export type AtlasCategory = AtlasSectionId;
export type AtlasStatus = "complete" | "available" | "locked" | "unknown";
export type AtlasNode = Omit<AtlasDefinition, "location"> & {
  category: AtlasCategory;
  group?: string;
  status: AtlasStatus;
  position: [number, number];
  location: AtlasLocation;
  parents: string[];
  destination: boolean;
};
const sectionStyles: Record<AtlasCategory, { icon: string; color: string }> = {
  quests: { icon: atlasIcons.quest, color: "#e7b957" },
  travel: { icon: atlasIcons.map, color: "#9bbab1" },
  equipment: { icon: atlasIcons.dragonHunterLance, color: "#c69d7e" },
  "skilling-equipment": { icon: atlasIcons.dragonAxe, color: "#8fb58b" },
  skills: { icon: atlasIcons.skills, color: "#6f93ad" },
  diaries: { icon: atlasIcons.diary, color: "#b9c866" },
  combat: { icon: atlasIcons.combat, color: "#d97a5e" },
  collections: { icon: atlasIcons.bronzeStaffOfCollection, color: "#ad99be" },
  account: { icon: atlasIcons.maxCape, color: "#b9c5ad" },
};
export const atlasCategories = atlasSections.map((section) => ({
  ...section,
  ...sectionStyles[section.id],
}));
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing atlas default");
  return value;
}
export const defaultAtlasLocation = required(atlasLocations.lumbridge);
export const atlasNodes: AtlasNode[] = atlasDefinitions.map((definition) => {
  const placement = atlasPlacements[definition.id];
  const location = atlasLocations[definition.location];
  if (!placement || !location)
    throw new Error(`Invalid atlas definition: ${definition.id}`);
  const category = placement.section;
  const requirements = definition.links.filter(
    (link) => link.kind === "required",
  );
  const ready =
    definition.rule.type === "any"
      ? requirements.some((link) => atlasDemoCompleted.has(link.id))
      : requirements.every((link) => atlasDemoCompleted.has(link.id));
  return {
    ...definition,
    category,
    group: placement.group,
    location,
    icon: definition.icon.startsWith("boss:")
      ? (getBossIconUrls(definition.icon.slice(5))[0] ?? atlasIcons.combat)
      : atlasIcons[definition.icon as keyof typeof atlasIcons],
    position: atlasPosition(definition.id),
    parents: definition.links.map((link) => link.id),
    status: atlasDemoCompleted.has(definition.id)
      ? "complete"
      : ready
        ? "available"
        : "locked",
    destination: definition.featured,
  };
});
export const atlasNodeById = new Map(atlasNodes.map((node) => [node.id, node]));
export const defaultAtlasNode = required(
  atlasNodes.find((node) => node.id === "song") ?? atlasNodes[0],
);
export const statusLabels: Record<AtlasStatus, string> = {
  complete: "Completed",
  available: "Available",
  locked: "Locked",
  unknown: "Unknown",
};
export const connectionLabels = {
  required: "Requirement",
  progression: "Suggested progression",
  supports: "Preparation",
} as const;
export function prerequisiteIds(ids: Iterable<string>): Set<string> {
  const result = new Set(ids);
  function visit(id: string) {
    for (const parent of atlasNodeById.get(id)?.parents ?? []) {
      if (result.has(parent)) continue;
      result.add(parent);
      visit(parent);
    }
  }
  for (const id of result) visit(id);
  return result;
}
export function atlasColor(category: AtlasCategory) {
  return sectionStyles[category].color;
}
