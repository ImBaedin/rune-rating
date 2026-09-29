import type { AtlasNode } from "./atlasPreview";

export function normalizeMilestoneSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’‘ʼ]/g, "")
    .replace(/[\u2010-\u2015-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findAtlasMilestones<
  T extends Pick<
    AtlasNode,
    "name" | "subtitle" | "description" | "location" | "rule"
  >,
>(nodes: T[], search: string): T[] {
  const query = normalizeMilestoneSearch(search);
  return nodes
    .filter((node) =>
      normalizeMilestoneSearch(
        `${node.name} ${node.subtitle} ${node.description} ${node.location.name} ${node.rule.type === "quest" ? node.rule.quest : ""}`,
      ).includes(query),
    )
    .sort((a, b) => rank(a.name, query) - rank(b.name, query));
}

function rank(name: string, query: string): number {
  const normalized = normalizeMilestoneSearch(name);
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  if (normalized.includes(query)) return 2;
  return 3;
}
