import { normalizeRsn } from "@rune-rating/domain";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server.js";
import { getRefreshCooldownMs } from "./lib/config";
import { categorySnapshotKey } from "./lib/keys";
import { findPlayerByRsn } from "./lib/players";
import {
  collectionItemComparisonKey,
  collectionLeader,
  collectionRefreshStatusFromQueueJob,
  collectionSnapshotValue,
} from "./runeProfileCollectionTransforms";
import {
  canonicalItemValidator,
  categoryDataValidator,
  comparisonLeaderValidator,
} from "./validators";

const runeProfileCategoryValidator = v.union(
  v.literal("quests"),
  v.literal("diaries"),
  v.literal("combatAchievements"),
);

const categoryResultValidator = v.object({
  fetchedAt: v.number(),
  summary: categoryDataValidator,
  items: v.array(canonicalItemValidator),
});
const collectionLogItemValidator = v.object({
  id: v.number(),
  name: v.string(),
  quantity: v.number(),
});
const collectionLogPageValidator = v.object({
  name: v.string(),
  obtained: v.number(),
  total: v.number(),
  items: v.array(collectionLogItemValidator),
});
const collectionLogTabValidator = v.object({
  name: v.string(),
  obtained: v.number(),
  total: v.number(),
  pages: v.array(collectionLogPageValidator),
});
const collectionSideSummaryValidator = v.union(
  v.object({
    fetchedAt: v.number(),
    obtained: v.number(),
    total: v.number(),
    percent: v.number(),
  }),
  v.null(),
);
const collectionPageComparisonValidator = v.object({
  name: v.string(),
  left: collectionSideSummaryValidator,
  right: collectionSideSummaryValidator,
  delta: v.union(v.number(), v.null()),
  leader: comparisonLeaderValidator,
});
const collectionTabComparisonValidator = v.object({
  name: v.string(),
  left: collectionSideSummaryValidator,
  right: collectionSideSummaryValidator,
  delta: v.union(v.number(), v.null()),
  leader: comparisonLeaderValidator,
  pages: v.array(collectionPageComparisonValidator),
});
const collectionItemComparisonValidator = v.object({
  key: v.string(),
  label: v.string(),
  tab: v.string(),
  tabs: v.array(v.string()),
  page: v.string(),
  pages: v.array(v.string()),
  itemId: v.union(v.number(), v.null()),
  leftQuantity: v.union(v.number(), v.null()),
  rightQuantity: v.union(v.number(), v.null()),
  leftOwned: v.union(v.boolean(), v.null()),
  rightOwned: v.union(v.boolean(), v.null()),
  quantityDelta: v.union(v.number(), v.null()),
  leader: comparisonLeaderValidator,
});

type CollectionRefreshResult = Array<{
  rsn: string;
  status:
    | "fresh"
    | "queued"
    | "running"
    | "retrying"
    | "notConnected"
    | "rateLimited"
    | "failed";
  errorCode: string | null;
  estimatedRunAt: number | null;
  retryAt: number | null;
  position: number | null;
}>;

function combatSnapshotLooksInvalid(summary: {
  type: string;
  completed?: number;
  points?: number;
}) {
  return (
    summary.type === "combatAchievements" &&
    (summary.completed ?? 0) > 0 &&
    (summary.points ?? 0) === 0
  );
}

function combatItemsMismatchSummary(
  summary: { type: string; completed?: number; points?: number },
  items: Array<{ completed: boolean | null }>,
) {
  if (summary.type !== "combatAchievements") return false;
  const completedItems = items.filter((item) => item.completed === true).length;
  const completed = summary.completed ?? 0;
  return (
    (items.length > 0 && completed > 0 && completedItems === 0) ||
    (completed > 0 && (summary.points ?? 0) === 0)
  );
}

export const getCollectionRefreshPlan = internalQuery({
  args: { rsns: v.array(v.string()) },
  returns: v.array(
    v.object({
      rsn: v.string(),
      shouldRefresh: v.boolean(),
      status: v.union(v.literal("fresh"), v.literal("notConnected")),
      errorCode: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const cooldownMs = await getRefreshCooldownMs(ctx);
    const now = Date.now();
    const plan = [];

    for (const rsn of args.rsns) {
      const player = await findPlayerByRsn(ctx, rsn);
      if (!player) {
        plan.push({
          rsn,
          shouldRefresh: false,
          status: "notConnected" as const,
          errorCode: "notConnected",
        });
        continue;
      }

      const summary = await ctx.db
        .query("categorySnapshots")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            categorySnapshotKey(player._id, "collection", "summary"),
          ),
        )
        .unique();
      const detailRows = await ctx.db
        .query("canonicalItems")
        .withIndex("by_player_and_category", (index) =>
          index.eq("playerId", player._id).eq("category", "collection"),
        )
        .take(1);
      const isFresh =
        summary !== null &&
        now - summary.fetchedAt < cooldownMs &&
        detailRows.length > 0;
      plan.push({
        rsn,
        shouldRefresh: !isFresh,
        status: "fresh" as const,
        errorCode: null,
      });
    }

    return plan;
  },
});

const dashboardPlayerValidator = v.object({
  fetchedAt: v.number(),
  quests: v.object({
    completed: v.number(),
    started: v.number(),
    notStarted: v.number(),
    total: v.number(),
    earnedPoints: v.number(),
    totalPoints: v.number(),
  }),
  diaries: v.object({
    completed: v.number(),
    total: v.number(),
  }),
  combatAchievements: v.object({
    completed: v.number(),
    total: v.number(),
    points: v.number(),
    tierReached: v.union(v.string(), v.null()),
  }),
  collection: v.object({
    obtained: v.number(),
    total: v.number(),
  }),
});

export const getDashboard = query({
  args: { leftRsn: v.string(), rightRsn: v.string() },
  returns: v.object({
    left: v.union(dashboardPlayerValidator, v.null()),
    right: v.union(dashboardPlayerValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const getPlayer = async (rsn: string) => {
      const player = await findPlayerByRsn(ctx, rsn);
      if (!player) return null;
      const [quests, diaries, combatAchievements, collection] =
        await Promise.all([
          ctx.db
            .query("categorySnapshots")
            .withIndex("by_key", (index) =>
              index.eq("key", categorySnapshotKey(player._id, "quests", "all")),
            )
            .unique(),
          ctx.db
            .query("categorySnapshots")
            .withIndex("by_key", (index) =>
              index.eq(
                "key",
                categorySnapshotKey(player._id, "diaries", "all"),
              ),
            )
            .unique(),
          ctx.db
            .query("categorySnapshots")
            .withIndex("by_key", (index) =>
              index.eq(
                "key",
                categorySnapshotKey(player._id, "combatAchievements", "all"),
              ),
            )
            .unique(),
          ctx.db
            .query("categorySnapshots")
            .withIndex("by_key", (index) =>
              index.eq(
                "key",
                categorySnapshotKey(player._id, "collection", "summary"),
              ),
            )
            .unique(),
        ]);
      if (
        quests?.data.type !== "quests" ||
        diaries?.data.type !== "diaries" ||
        combatAchievements?.data.type !== "combatAchievements" ||
        combatSnapshotLooksInvalid(combatAchievements.data) ||
        collection?.data.type !== "collection"
      ) {
        return null;
      }
      return {
        fetchedAt: Math.min(
          quests.fetchedAt,
          diaries.fetchedAt,
          combatAchievements.fetchedAt,
          collection.fetchedAt,
        ),
        quests: {
          completed: quests.data.completed,
          started: quests.data.started,
          notStarted: quests.data.notStarted,
          total: quests.data.total,
          earnedPoints: quests.data.earnedPoints,
          totalPoints: quests.data.totalPoints,
        },
        diaries: {
          completed: diaries.data.completed,
          total: diaries.data.total,
        },
        combatAchievements: {
          completed: combatAchievements.data.completed,
          total: combatAchievements.data.total,
          points: combatAchievements.data.points,
          tierReached: combatAchievements.data.tierReached,
        },
        collection: {
          obtained: collection.data.obtained,
          total: collection.data.total,
        },
      };
    };

    const [left, right] = await Promise.all([
      getPlayer(args.leftRsn),
      getPlayer(args.rightRsn),
    ]);
    return { left, right };
  },
});

export const getCategory = query({
  args: { rsn: v.string(), category: runeProfileCategoryValidator },
  returns: v.union(categoryResultValidator, v.null()),
  handler: async (ctx, args) => {
    const player = await findPlayerByRsn(ctx, args.rsn);
    if (!player) return null;
    const snapshot = await ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq("key", categorySnapshotKey(player._id, args.category, "all")),
      )
      .unique();
    if (!snapshot) return null;
    const items = await ctx.db
      .query("canonicalItems")
      .withIndex("by_player_and_category", (index) =>
        index.eq("playerId", player._id).eq("category", args.category),
      )
      .collect();
    const categoryItems = combatItemsMismatchSummary(snapshot.data, items)
      ? []
      : items;
    return {
      fetchedAt: snapshot.fetchedAt,
      summary: snapshot.data,
      items: categoryItems.map((item) => ({
        key: item.itemKey,
        label: item.label,
        group: item.group,
        state: item.state,
        completed: item.completed,
        current: item.current,
        total: item.total,
        points: item.points,
      })),
    };
  },
});

export const getItem = query({
  args: {
    leftRsn: v.string(),
    rightRsn: v.string(),
    category: runeProfileCategoryValidator,
    itemKey: v.string(),
  },
  returns: v.object({
    left: v.union(canonicalItemValidator, v.null()),
    right: v.union(canonicalItemValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const players = await Promise.all([
      findPlayerByRsn(ctx, args.leftRsn),
      findPlayerByRsn(ctx, args.rightRsn),
    ]);
    const getItem = async (player: (typeof players)[number]) => {
      if (!player) return null;
      const item = await ctx.db
        .query("canonicalItems")
        .withIndex("by_key", (index) =>
          index.eq("key", `${player._id}:${args.category}:${args.itemKey}`),
        )
        .unique();
      return item
        ? {
            key: item.itemKey,
            label: item.label,
            group: item.group,
            state: item.state,
            completed: item.completed,
            current: item.current,
            total: item.total,
            points: item.points,
          }
        : null;
    };
    const [left, right] = await Promise.all([
      getItem(players[0]),
      getItem(players[1]),
    ]);
    return { left, right };
  },
});

export const getCollectionComparison = query({
  args: { leftRsn: v.string(), rightRsn: v.string() },
  returns: v.object({
    left: collectionSideSummaryValidator,
    right: collectionSideSummaryValidator,
    leftDetailAvailable: v.boolean(),
    rightDetailAvailable: v.boolean(),
    tabs: v.array(collectionTabComparisonValidator),
    items: v.array(collectionItemComparisonValidator),
  }),
  handler: async (ctx, args) => {
    const [leftPlayer, rightPlayer] = await Promise.all([
      findPlayerByRsn(ctx, args.leftRsn),
      findPlayerByRsn(ctx, args.rightRsn),
    ]);

    const readPlayer = async (player: typeof leftPlayer) => {
      if (!player) {
        return {
          summary: null,
          detailAvailable: false,
          tabSnapshots: new Map<
            string,
            ReturnType<typeof collectionSnapshotValue>
          >(),
          pageSnapshots: new Map<
            string,
            ReturnType<typeof collectionSnapshotValue>
          >(),
          items: new Map<
            string,
            {
              key: string;
              label: string;
              tabs: string[];
              pages: string[];
              itemId: number | null;
              quantity: number;
              owned: boolean;
            }
          >(),
        };
      }

      const [snapshots, itemRows] = await Promise.all([
        ctx.db
          .query("categorySnapshots")
          .withIndex("by_player_and_category", (index) =>
            index.eq("playerId", player._id).eq("category", "collection"),
          )
          .take(500),
        ctx.db
          .query("canonicalItems")
          .withIndex("by_player_and_category", (index) =>
            index.eq("playerId", player._id).eq("category", "collection"),
          )
          .take(2500),
      ]);
      const summary = collectionSnapshotValue(
        snapshots.find((snapshot) => snapshot.segment === "summary"),
      );
      const tabSnapshots = new Map<
        string,
        ReturnType<typeof collectionSnapshotValue>
      >();
      const pageSnapshots = new Map<
        string,
        ReturnType<typeof collectionSnapshotValue>
      >();
      for (const snapshot of snapshots) {
        if (snapshot.segment.startsWith("tab:")) {
          tabSnapshots.set(
            snapshot.segment.slice(4),
            collectionSnapshotValue(snapshot),
          );
        } else if (snapshot.segment.startsWith("page:")) {
          pageSnapshots.set(
            snapshot.segment.slice(5),
            collectionSnapshotValue(snapshot),
          );
        }
      }
      const items = new Map<
        string,
        {
          key: string;
          label: string;
          tabs: string[];
          pages: string[];
          itemId: number | null;
          quantity: number;
          owned: boolean;
        }
      >();
      for (const item of itemRows) {
        const itemId = item.points;
        const itemKey = collectionItemComparisonKey(item);
        const existing = items.get(itemKey);
        if (existing) {
          if (!existing.tabs.includes(item.group))
            existing.tabs.push(item.group);
          const page = item.state ?? "Unknown";
          if (!existing.pages.includes(page)) existing.pages.push(page);
          existing.quantity = Math.max(existing.quantity, item.current ?? 0);
          existing.owned = existing.owned || item.completed === true;
          continue;
        }
        items.set(itemKey, {
          key: itemKey,
          label: item.label,
          tabs: [item.group],
          pages: [item.state ?? "Unknown"],
          itemId,
          quantity: item.current ?? 0,
          owned: item.completed === true,
        });
      }
      return {
        summary,
        detailAvailable: tabSnapshots.size > 0,
        tabSnapshots,
        pageSnapshots,
        items,
      };
    };

    const [left, right] = await Promise.all([
      readPlayer(leftPlayer),
      readPlayer(rightPlayer),
    ]);
    const tabNames = [
      ...new Set([...left.tabSnapshots.keys(), ...right.tabSnapshots.keys()]),
    ].sort((a, b) => {
      const leftTotal =
        (left.tabSnapshots.get(b)?.total ?? 0) +
        (right.tabSnapshots.get(b)?.total ?? 0);
      const rightTotal =
        (left.tabSnapshots.get(a)?.total ?? 0) +
        (right.tabSnapshots.get(a)?.total ?? 0);
      return leftTotal - rightTotal || a.localeCompare(b);
    });
    const tabs = tabNames.map((name) => {
      const leftTab = left.tabSnapshots.get(name) ?? null;
      const rightTab = right.tabSnapshots.get(name) ?? null;
      const delta =
        leftTab && rightTab ? leftTab.obtained - rightTab.obtained : null;
      const pagePrefix = `${name}:`;
      const pageNames = [
        ...new Set(
          [...left.pageSnapshots.keys(), ...right.pageSnapshots.keys()].filter(
            (pageKey) => pageKey.startsWith(pagePrefix),
          ),
        ),
      ]
        .map((pageKey) => pageKey.slice(pagePrefix.length))
        .sort((a, b) => {
          const aKey = `${name}:${a}`;
          const bKey = `${name}:${b}`;
          const bGap = Math.abs(
            (left.pageSnapshots.get(bKey)?.obtained ?? 0) -
              (right.pageSnapshots.get(bKey)?.obtained ?? 0),
          );
          const aGap = Math.abs(
            (left.pageSnapshots.get(aKey)?.obtained ?? 0) -
              (right.pageSnapshots.get(aKey)?.obtained ?? 0),
          );
          return bGap - aGap || a.localeCompare(b);
        });
      return {
        name,
        left: leftTab,
        right: rightTab,
        delta,
        leader: collectionLeader(delta),
        pages: pageNames.map((pageName) => {
          const key = `${name}:${pageName}`;
          const leftPage = left.pageSnapshots.get(key) ?? null;
          const rightPage = right.pageSnapshots.get(key) ?? null;
          const pageDelta =
            leftPage && rightPage
              ? leftPage.obtained - rightPage.obtained
              : null;
          return {
            name: pageName,
            left: leftPage,
            right: rightPage,
            delta: pageDelta,
            leader: collectionLeader(pageDelta),
          };
        }),
      };
    });

    const itemKeys = [
      ...new Set([...left.items.keys(), ...right.items.keys()]),
    ].sort((a, b) => {
      const leftA = left.items.get(a);
      const rightA = right.items.get(a);
      const leftB = left.items.get(b);
      const rightB = right.items.get(b);
      const aDelta = Math.abs((leftA?.quantity ?? 0) - (rightA?.quantity ?? 0));
      const bDelta = Math.abs((leftB?.quantity ?? 0) - (rightB?.quantity ?? 0));
      return (
        bDelta - aDelta ||
        (leftA?.tabs[0] ?? rightA?.tabs[0] ?? "").localeCompare(
          leftB?.tabs[0] ?? rightB?.tabs[0] ?? "",
        ) ||
        (leftA?.label ?? rightA?.label ?? "").localeCompare(
          leftB?.label ?? rightB?.label ?? "",
        )
      );
    });
    const items = itemKeys.map((key) => {
      const leftItem = left.items.get(key) ?? null;
      const rightItem = right.items.get(key) ?? null;
      const leftQuantity =
        leftItem?.quantity ?? (left.detailAvailable ? 0 : null);
      const rightQuantity =
        rightItem?.quantity ?? (right.detailAvailable ? 0 : null);
      const quantityDelta =
        leftQuantity !== null && rightQuantity !== null
          ? leftQuantity - rightQuantity
          : null;
      const source = leftItem ?? rightItem;
      const tabs = [
        ...new Set([...(leftItem?.tabs ?? []), ...(rightItem?.tabs ?? [])]),
      ].sort((a, b) => a.localeCompare(b));
      const pages = [
        ...new Set([...(leftItem?.pages ?? []), ...(rightItem?.pages ?? [])]),
      ].sort((a, b) => a.localeCompare(b));
      return {
        key,
        label: source?.label ?? key,
        tab: tabs[0] ?? "Unknown",
        tabs,
        page: pages.join(", ") || "Unknown",
        pages,
        itemId: source?.itemId ?? null,
        leftQuantity,
        rightQuantity,
        leftOwned: leftQuantity === null ? null : leftQuantity > 0,
        rightOwned: rightQuantity === null ? null : rightQuantity > 0,
        quantityDelta,
        leader: collectionLeader(quantityDelta),
      };
    });

    return {
      left: left.summary,
      right: right.summary,
      leftDetailAvailable: left.detailAvailable,
      rightDetailAvailable: right.detailAvailable,
      tabs,
      items,
    };
  },
});

export const replaceCollectionLog = internalMutation({
  args: {
    rsn: v.string(),
    fetchedAt: v.number(),
    collectionLog: v.object({
      obtained: v.number(),
      total: v.number(),
      tabs: v.array(collectionLogTabValidator),
    }),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const player = await findPlayerByRsn(ctx, args.rsn);
    if (!player) return false;

    const previousSnapshots = await ctx.db
      .query("categorySnapshots")
      .withIndex("by_player_and_category", (index) =>
        index.eq("playerId", player._id).eq("category", "collection"),
      )
      .take(500);
    for (const snapshot of previousSnapshots) {
      await ctx.db.delete(snapshot._id);
    }
    const previousItems = await ctx.db
      .query("canonicalItems")
      .withIndex("by_player_and_category", (index) =>
        index.eq("playerId", player._id).eq("category", "collection"),
      )
      .take(2500);
    for (const item of previousItems) {
      await ctx.db.delete(item._id);
    }

    const snapshotValues = [
      {
        segment: "summary",
        obtained: args.collectionLog.obtained,
        total: args.collectionLog.total,
      },
      ...args.collectionLog.tabs.flatMap((tab) => [
        {
          segment: `tab:${tab.name}`,
          obtained: tab.obtained,
          total: tab.total,
        },
        ...tab.pages.map((page) => ({
          segment: `page:${tab.name}:${page.name}`,
          obtained: page.obtained,
          total: page.total,
        })),
      ]),
    ];
    for (const snapshot of snapshotValues) {
      await ctx.db.insert("categorySnapshots", {
        key: categorySnapshotKey(player._id, "collection", snapshot.segment),
        playerId: player._id,
        source: "runeProfile",
        category: "collection",
        segment: snapshot.segment,
        fetchedAt: args.fetchedAt,
        completeness: "complete",
        data: {
          type: "collection",
          obtained: snapshot.obtained,
          total: snapshot.total,
        },
      });
    }

    for (const tab of args.collectionLog.tabs) {
      for (const page of tab.pages) {
        for (const item of page.items) {
          const itemKey = `collection.${tab.name}.${page.name}.${item.id}`;
          await ctx.db.insert("canonicalItems", {
            key: `${player._id}:collection:${itemKey}`,
            playerId: player._id,
            source: "runeProfile",
            category: "collection",
            revision: String(args.fetchedAt),
            itemKey,
            label: item.name,
            group: tab.name,
            state: page.name,
            completed: item.quantity > 0,
            current: item.quantity,
            total: null,
            points: item.id,
          });
        }
      }
    }

    return true;
  },
});

export const refreshCollectionLog = action({
  args: { rsns: v.array(v.string()) },
  returns: v.array(
    v.object({
      rsn: v.string(),
      status: v.union(
        v.literal("fresh"),
        v.literal("queued"),
        v.literal("running"),
        v.literal("retrying"),
        v.literal("notConnected"),
        v.literal("rateLimited"),
        v.literal("failed"),
      ),
      errorCode: v.union(v.string(), v.null()),
      estimatedRunAt: v.union(v.number(), v.null()),
      retryAt: v.union(v.number(), v.null()),
      position: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args): Promise<CollectionRefreshResult> => {
    const results: CollectionRefreshResult = [];
    const normalizedRsns: string[] = [];
    const seen = new Set<string>();

    for (const rsn of args.rsns.slice(0, 2)) {
      try {
        const normalizedRsn = normalizeRsn(rsn);
        const key = normalizedRsn.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        normalizedRsns.push(normalizedRsn);
      } catch (error) {
        results.push({
          rsn,
          status: "failed",
          errorCode:
            error instanceof Error ? "invalidRsn" : "invalidCollectionRefresh",
          estimatedRunAt: null,
          retryAt: null,
          position: null,
        });
      }
    }

    if (args.rsns.length > 2) {
      for (const rsn of args.rsns.slice(2)) {
        results.push({
          rsn,
          status: "failed",
          errorCode: "tooManyRsns",
          estimatedRunAt: null,
          retryAt: null,
          position: null,
        });
      }
    }

    const refreshPlan: Array<{
      rsn: string;
      shouldRefresh: boolean;
      status: "fresh" | "notConnected";
      errorCode: string | null;
    }> = await ctx.runQuery(internal.runeProfile.getCollectionRefreshPlan, {
      rsns: normalizedRsns,
    });

    const rsnsToRefresh = new Set(
      refreshPlan
        .filter((entry) => entry.shouldRefresh)
        .map((entry) => entry.rsn.toLocaleLowerCase()),
    );
    for (const entry of refreshPlan) {
      if (entry.shouldRefresh) continue;
      results.push({
        rsn: entry.rsn,
        status: entry.status,
        errorCode: entry.errorCode,
        estimatedRunAt: null,
        retryAt: null,
        position: null,
      });
    }

    for (const rsn of normalizedRsns) {
      if (!rsnsToRefresh.has(rsn.toLocaleLowerCase())) continue;
      const job: {
        status:
          | "idle"
          | "queued"
          | "running"
          | "retrying"
          | "succeeded"
          | "failed";
        estimatedRunAt: number | null;
        retryAt: number | null;
        position: number | null;
        lastErrorCode: string | null;
      } = await ctx.runMutation(
        internal.providerQueue.enqueueCollectionDetail,
        {
          rsn,
        },
      );
      const status = collectionRefreshStatusFromQueueJob(job);
      results.push({
        rsn,
        status,
        errorCode: job.lastErrorCode,
        estimatedRunAt: job.estimatedRunAt,
        retryAt: job.retryAt,
        position: job.position,
      });
    }
    return results;
  },
});
