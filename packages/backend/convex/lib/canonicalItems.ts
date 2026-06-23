import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type CanonicalItemDoc = Doc<"canonicalItems">;

export type CanonicalItemSyncInput = Pick<
  CanonicalItemDoc,
  | "itemKey"
  | "label"
  | "group"
  | "state"
  | "completed"
  | "current"
  | "total"
  | "points"
>;

type CanonicalItemPatch = Partial<
  Pick<
    CanonicalItemDoc,
    | "source"
    | "category"
    | "revision"
    | "itemKey"
    | "label"
    | "group"
    | "state"
    | "completed"
    | "current"
    | "total"
    | "points"
  >
>;

function itemKey(
  playerId: Id<"players">,
  category: CanonicalItemDoc["category"],
  item: Pick<CanonicalItemDoc, "itemKey">,
) {
  return `${playerId}:${category}:${item.itemKey}`;
}

function changedFields(
  existing: CanonicalItemDoc,
  next: Omit<CanonicalItemDoc, "_id" | "_creationTime">,
) {
  const patch: Record<string, unknown> = {};
  for (const field of [
    "source",
    "category",
    "itemKey",
    "label",
    "group",
    "state",
    "completed",
    "current",
    "total",
    "points",
  ] as const) {
    if (existing[field] !== next[field]) {
      patch[field] = next[field];
    }
  }
  if (Object.keys(patch).length > 0 && existing.revision !== next.revision) {
    patch.revision = next.revision;
  }
  return patch as CanonicalItemPatch;
}

export async function syncCanonicalItemsForCategory(
  ctx: MutationCtx,
  args: {
    playerId: Id<"players">;
    source: CanonicalItemDoc["source"];
    category: CanonicalItemDoc["category"];
    revision: string;
    items: CanonicalItemSyncInput[];
    maxExisting?: number;
  },
) {
  const previous = await ctx.db
    .query("canonicalItems")
    .withIndex("by_player_and_category", (index) =>
      index.eq("playerId", args.playerId).eq("category", args.category),
    )
    .take(args.maxExisting ?? 5000);
  const remaining = new Map(previous.map((item) => [item.key, item]));

  for (const item of args.items) {
    const key = itemKey(args.playerId, args.category, item);
    const next = {
      key,
      playerId: args.playerId,
      source: args.source,
      category: args.category,
      revision: args.revision,
      ...item,
    };
    const existing = remaining.get(key);
    if (!existing) {
      await ctx.db.insert("canonicalItems", next);
      continue;
    }

    remaining.delete(key);
    const patch = changedFields(existing, next);
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
    }
  }

  for (const stale of remaining.values()) {
    await ctx.db.delete(stale._id);
  }
}
