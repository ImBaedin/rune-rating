import { expect, test } from "bun:test";
import {
  atlasDefinitions,
  atlasPlacements,
  atlasPosition,
} from "../src/features/achievements/atlasData";
import {
  connectionHandles,
  hasBlockingNode,
} from "../src/features/achievements/atlasRouting";

const nodes = atlasDefinitions.map((node) => ({
  id: node.id,
  category: atlasPlacements[node.id]?.section ?? "",
  position: atlasPosition(node.id),
  destination: node.featured,
}));
const byId = new Map(nodes.map((node) => [node.id, node]));
function node(id: string) {
  const result = byId.get(id);
  if (!result) throw new Error(`Missing node ${id}`);
  return result;
}

test("collection ranks connect across alternating rows and downward at the turns", () => {
  for (const [source, target, sourceHandle, targetHandle] of [
    ["collection-bronze", "collection-iron", "right", "in-left"],
    ["collection-iron", "collection-steel", "right", "in-left"],
    ["collection-steel", "collection-black", "out", "in"],
    ["collection-black", "collection-mithril", "left", "in-right"],
    ["collection-mithril", "collection-adamant", "left", "in-right"],
    ["collection-adamant", "collection-rune", "out", "in"],
    ["collection-rune", "collection-dragon", "right", "in-left"],
    ["collection-dragon", "collection-gilded", "right", "in-left"],
  ] as const) {
    expect(connectionHandles(node(source), node(target), false)).toEqual({
      sourceHandle,
      targetHandle,
    });
    expect(hasBlockingNode(node(source), node(target), nodes)).toBe(false);
  }
});

test("clear supply progression stays straight despite gaps and neighboring funnels", () => {
  for (const [source, target] of [
    ["herblore-38", "herblore-63"],
    ["herblore-63", "herblore-81"],
    ["farming-32", "farming-62"],
    ["farming-62", "farming-85"],
  ] as const) {
    expect(
      hasBlockingNode(node(source), node(target), nodes),
      `${source} to ${target}`,
    ).toBe(false);
  }
});

test("vertical routes still detour when another card lies between the endpoints", () => {
  expect(hasBlockingNode(node("herblore-38"), node("herblore-81"), nodes)).toBe(
    true,
  );
  expect(hasBlockingNode(node("farming-32"), node("farming-85"), nodes)).toBe(
    true,
  );
});
