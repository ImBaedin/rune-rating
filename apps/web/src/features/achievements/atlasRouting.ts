import { atlasNodeHeight, atlasNodeWidth } from "./atlasViewport";

type PlacedNode = {
  id: string;
  category: string;
  position: [number, number];
  destination: boolean;
};

/** Same-row progressions enter from the facing side; downward paths enter above. */
export function connectionHandles(
  source: PlacedNode,
  target: PlacedNode,
  detour: boolean,
): { sourceHandle: string; targetHandle: string } {
  const dx = target.position[0] - source.position[0];
  if (
    Math.abs(target.position[1] - source.position[1]) < 1 &&
    Math.abs(dx) > 30
  )
    return dx > 0
      ? { sourceHandle: "right", targetHandle: "in-left" }
      : { sourceHandle: "left", targetHandle: "in-right" };
  return {
    sourceHandle: dx > 30 || detour ? "right" : dx < -30 ? "left" : "out",
    targetHandle: "in",
  };
}

/** Detour only when a vertical route would cross another node's frame or labels. */
export function hasBlockingNode(
  source: PlacedNode,
  target: PlacedNode,
  nodes: readonly PlacedNode[],
): boolean {
  const [x, y] = source.position;
  if (Math.abs(x - target.position[0]) >= 1) return false;
  const start = y + (source.destination ? 48 : 36);
  const end = target.position[1] - (target.destination ? 48 : 36);
  return nodes.some((node) => {
    if (
      node.id === source.id ||
      node.id === target.id ||
      node.category !== source.category
    )
      return false;
    const top = node.position[1] - (node.destination ? 48 : 36);
    return (
      Math.abs(node.position[0] - x) < atlasNodeWidth / 2 + 8 &&
      top < end &&
      top + atlasNodeHeight > start
    );
  });
}
