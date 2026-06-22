import { rsnLookupKey } from "@rune-rating/domain";
import {
  fetchOverallXpGains,
  fetchOverallXpTimeline,
  fetchSkillXpGains,
  fetchSkillXpTimelines,
  WiseOldManRequestError,
} from "@rune-rating/sdk-wise-old-man";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server.js";

const OVERVIEW_CACHE_MS = 60 * 60 * 1_000;
const FAILED_REFRESH_BACKOFF_MS = 15 * 60 * 1_000;
const RATE_LIMIT_BACKOFF_MS = 60 * 60 * 1_000;
const NOT_CONNECTED_BACKOFF_MS = 6 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

const periodValidator = v.union(
  v.literal("week"),
  v.literal("month"),
  v.literal("quarter"),
  v.literal("year"),
);

const efficiencyMetricValidator = v.union(v.literal("ehp"), v.literal("ehb"));

const timelinePointValidator = v.object({
  date: v.number(),
  value: v.number(),
});

const skillGainValidator = v.object({
  key: v.string(),
  gained: v.union(v.number(), v.null()),
  start: v.union(v.number(), v.null()),
  end: v.union(v.number(), v.null()),
});

const historyPlayerValidator = v.object({
  rsn: v.string(),
  timeline: v.array(timelinePointValidator),
  sevenDayGained: v.union(v.number(), v.null()),
  fetchedAt: v.union(v.number(), v.null()),
});

const cacheValueValidator = v.object({
  displayRsn: v.string(),
  fetchedAt: v.union(v.number(), v.null()),
  timeline: v.array(timelinePointValidator),
  sevenDayGained: v.union(v.number(), v.null()),
});

const cacheStateValidator = v.object({
  displayRsn: v.string(),
  fetchedAt: v.union(v.number(), v.null()),
  timeline: v.array(timelinePointValidator),
  sevenDayGained: v.union(v.number(), v.null()),
  refreshAllowedAt: v.number(),
  requestId: v.union(v.string(), v.null()),
});

const cacheClaimValidator = v.object({
  shouldFetch: v.boolean(),
  requestId: v.union(v.string(), v.null()),
  cache: cacheValueValidator,
});

type TimelinePoint = { date: number; value: number };
type HistoryPeriod = "week" | "month" | "quarter" | "year";
type SkillGain = {
  key: string;
  gained: number | null;
  start: number | null;
  end: number | null;
};
type CacheValue = {
  displayRsn: string;
  fetchedAt: number | null;
  timeline: TimelinePoint[];
  sevenDayGained: number | null;
};
type CacheClaim = {
  shouldFetch: boolean;
  requestId: string | null;
  cache: CacheValue;
};
type HistoryPlayer = {
  rsn: string;
  timeline: TimelinePoint[];
  sevenDayGained: number | null;
  fetchedAt: number | null;
};
type CacheState = CacheValue & {
  refreshAllowedAt: number;
  requestId: string | null;
};

function cacheValue(cache: CacheValue | null, fallbackRsn: string): CacheValue {
  return {
    displayRsn: cache?.displayRsn ?? fallbackRsn.trim(),
    fetchedAt: cache?.fetchedAt ?? null,
    timeline: cache?.timeline ?? [],
    sevenDayGained: cache?.sevenDayGained ?? null,
  };
}

function refreshBackoffMs(error: unknown) {
  if (error instanceof WiseOldManRequestError) {
    if (error.retryAfterMs !== null) return error.retryAfterMs;
    if (error.code === "rateLimited") return RATE_LIMIT_BACKOFF_MS;
    if (error.code === "notConnected") return NOT_CONNECTED_BACKOFF_MS;
  }
  return FAILED_REFRESH_BACKOFF_MS;
}

function cacheErrorCode(error: unknown) {
  return error instanceof WiseOldManRequestError ? error.code : "failed";
}

function cacheState(
  cache:
    | (CacheValue & {
        refreshAllowedAt: number;
        requestId: string | null;
      })
    | null,
  fallbackRsn: string,
): CacheState {
  return {
    ...cacheValue(cache, fallbackRsn),
    refreshAllowedAt: cache?.refreshAllowedAt ?? 0,
    requestId: cache?.requestId ?? null,
  };
}

export const claimOverviewCacheRefresh = internalMutation({
  args: { rsn: v.string(), now: v.number() },
  returns: cacheClaimValidator,
  handler: async (ctx, args) => {
    const normalizedRsn = rsnLookupKey(args.rsn);
    const existing = await ctx.db
      .query("wiseOldManOverviewCaches")
      .withIndex("by_normalized_rsn", (index) =>
        index.eq("normalizedRsn", normalizedRsn),
      )
      .unique();

    if (existing && existing.refreshAllowedAt > args.now) {
      return {
        shouldFetch: false,
        requestId: null,
        cache: cacheValue(existing, args.rsn),
      };
    }

    const requestId = crypto.randomUUID();
    if (existing) {
      await ctx.db.patch(existing._id, {
        requestId,
        refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
      });
    } else {
      await ctx.db.insert("wiseOldManOverviewCaches", {
        normalizedRsn,
        displayRsn: args.rsn.trim(),
        fetchedAt: null,
        refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
        requestId,
        timeline: [],
        sevenDayGained: null,
      });
    }
    return {
      shouldFetch: true,
      requestId,
      cache: cacheValue(existing, args.rsn),
    };
  },
});

export const completeOverviewCacheRefresh = internalMutation({
  args: {
    rsn: v.string(),
    requestId: v.string(),
    fetchedAt: v.number(),
    timeline: v.array(timelinePointValidator),
    sevenDayGained: v.union(v.number(), v.null()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const normalizedRsn = rsnLookupKey(args.rsn);
    const existing = await ctx.db
      .query("wiseOldManOverviewCaches")
      .withIndex("by_normalized_rsn", (index) =>
        index.eq("normalizedRsn", normalizedRsn),
      )
      .unique();
    if (!existing || existing.requestId !== args.requestId) return false;

    await ctx.db.patch(existing._id, {
      displayRsn: args.rsn.trim(),
      fetchedAt: args.fetchedAt,
      requestId: null,
      timeline: args.timeline,
      sevenDayGained: args.sevenDayGained,
    });
    return true;
  },
});

export const getOverviewCache = internalQuery({
  args: { rsn: v.string() },
  returns: cacheValueValidator,
  handler: async (ctx, args) => {
    const normalizedRsn = rsnLookupKey(args.rsn);
    const existing = await ctx.db
      .query("wiseOldManOverviewCaches")
      .withIndex("by_normalized_rsn", (index) =>
        index.eq("normalizedRsn", normalizedRsn),
      )
      .unique();
    return cacheValue(existing, args.rsn);
  },
});

export const getOverviewCacheState = internalQuery({
  args: { rsn: v.string() },
  returns: cacheStateValidator,
  handler: async (ctx, args) => {
    const normalizedRsn = rsnLookupKey(args.rsn);
    const existing = await ctx.db
      .query("wiseOldManOverviewCaches")
      .withIndex("by_normalized_rsn", (index) =>
        index.eq("normalizedRsn", normalizedRsn),
      )
      .unique();
    return cacheState(existing, args.rsn);
  },
});

export const releaseOverviewCacheRefresh = internalMutation({
  args: {
    rsn: v.string(),
    requestId: v.string(),
    refreshAllowedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedRsn = rsnLookupKey(args.rsn);
    const existing = await ctx.db
      .query("wiseOldManOverviewCaches")
      .withIndex("by_normalized_rsn", (index) =>
        index.eq("normalizedRsn", normalizedRsn),
      )
      .unique();
    if (existing?.requestId === args.requestId) {
      await ctx.db.patch(existing._id, {
        requestId: null,
        refreshAllowedAt: args.refreshAllowedAt,
      });
    }
    return null;
  },
});

function canonicalDailyTimeline(timeline: TimelinePoint[]) {
  const byDay = new Map<number, TimelinePoint>();
  for (const point of timeline) {
    const day = Math.floor(point.date / DAY_MS) * DAY_MS;
    const existing = byDay.get(day);
    if (!existing || point.date > existing.date) byDay.set(day, point);
  }
  return [...byDay.values()].sort((left, right) => left.date - right.date);
}

function projectPeriod(
  cache: CacheValue,
  period: HistoryPeriod,
): HistoryPlayer {
  const duration = {
    week: 7 * DAY_MS,
    month: 30 * DAY_MS,
    quarter: 90 * DAY_MS,
    year: 365 * DAY_MS,
  }[period];
  const cutoff = Date.now() - duration;
  const firstInRange = cache.timeline.findIndex(
    (point) => point.date >= cutoff,
  );
  const start = firstInRange <= 0 ? 0 : firstInRange - 1;
  return {
    rsn: cache.displayRsn,
    timeline: cache.timeline.slice(start),
    sevenDayGained: cache.sevenDayGained,
    fetchedAt: cache.fetchedAt,
  };
}

export const refreshOverviewCache = internalAction({
  args: { rsn: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim: CacheClaim = await ctx.runMutation(
      internal.wiseOldMan.claimOverviewCacheRefresh,
      { rsn: args.rsn, now: Date.now() },
    );
    if (!claim.shouldFetch || !claim.requestId) return null;

    try {
      const [timeline, gains] = await Promise.all([
        fetchOverallXpTimeline(args.rsn, "year", {
          userAgent: "RuneRating/0.1",
          timeoutMs: 30_000,
        }),
        fetchOverallXpGains(args.rsn, "week", {
          userAgent: "RuneRating/0.1",
        }),
      ]);
      await ctx.runMutation(internal.wiseOldMan.completeOverviewCacheRefresh, {
        rsn: args.rsn,
        requestId: claim.requestId,
        fetchedAt: Date.now(),
        timeline: canonicalDailyTimeline(timeline),
        sevenDayGained: gains.gained,
      });
    } catch (error) {
      await ctx.runMutation(internal.wiseOldMan.releaseOverviewCacheRefresh, {
        rsn: args.rsn,
        requestId: claim.requestId,
        refreshAllowedAt: Date.now() + refreshBackoffMs(error),
      });
      if (claim.cache.fetchedAt === null) throw error;
    }

    return null;
  },
});

export const getOverviewHistory = action({
  args: {
    leftRsn: v.string(),
    rightRsn: v.string(),
    period: periodValidator,
  },
  returns: v.object({
    left: historyPlayerValidator,
    right: historyPlayerValidator,
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ left: HistoryPlayer; right: HistoryPlayer }> => {
    const fetchPlayer = async (rsn: string): Promise<HistoryPlayer> => {
      const cache: CacheState = await ctx.runQuery(
        internal.wiseOldMan.getOverviewCacheState,
        { rsn },
      );
      const now = Date.now();
      if (cache.fetchedAt !== null) {
        if (cache.refreshAllowedAt <= now && cache.requestId === null) {
          await ctx.scheduler.runAfter(
            0,
            internal.wiseOldMan.refreshOverviewCache,
            { rsn },
          );
        }
        return projectPeriod(cache, args.period);
      }

      await ctx.runAction(internal.wiseOldMan.refreshOverviewCache, { rsn });
      const refreshed: CacheValue = await ctx.runQuery(
        internal.wiseOldMan.getOverviewCache,
        { rsn },
      );
      return projectPeriod(refreshed, args.period);
    };

    const players = new Map<string, Promise<HistoryPlayer>>();
    const getPlayer = (rsn: string): Promise<HistoryPlayer> => {
      const key = rsnLookupKey(rsn);
      const existing = players.get(key);
      if (existing) return existing;
      const pending = fetchPlayer(rsn);
      players.set(key, pending);
      return pending;
    };
    const [left, right] = await Promise.all([
      getPlayer(args.leftRsn),
      getPlayer(args.rightRsn),
    ]);
    return { left, right };
  },
});

const skillGainsCacheValueValidator = v.object({
  displayRsn: v.string(),
  fetchedAt: v.union(v.number(), v.null()),
  gains: v.array(skillGainValidator),
});

const skillGainsCacheStateValidator = v.object({
  displayRsn: v.string(),
  fetchedAt: v.union(v.number(), v.null()),
  gains: v.array(skillGainValidator),
  refreshAllowedAt: v.number(),
  requestId: v.union(v.string(), v.null()),
});

const skillGainsClaimValidator = v.object({
  shouldFetch: v.boolean(),
  requestId: v.union(v.string(), v.null()),
  cache: skillGainsCacheValueValidator,
});

type SkillGainsCacheValue = {
  displayRsn: string;
  fetchedAt: number | null;
  gains: SkillGain[];
};
type SkillGainsCacheState = SkillGainsCacheValue & {
  refreshAllowedAt: number;
  requestId: string | null;
};
type SkillGainsClaim = {
  shouldFetch: boolean;
  requestId: string | null;
  cache: SkillGainsCacheValue;
};

const skillGainsCacheKey = (rsn: string, period: HistoryPeriod) =>
  `${rsnLookupKey(rsn)}:${period}`;

const skillGainsCacheValue = (
  cache: SkillGainsCacheValue | null,
  fallbackRsn: string,
): SkillGainsCacheValue => ({
  displayRsn: cache?.displayRsn ?? fallbackRsn.trim(),
  fetchedAt: cache?.fetchedAt ?? null,
  gains: cache?.gains ?? [],
});

const skillGainsCacheState = (
  cache:
    | (SkillGainsCacheValue & {
        refreshAllowedAt: number;
        requestId: string | null;
      })
    | null,
  fallbackRsn: string,
): SkillGainsCacheState => ({
  ...skillGainsCacheValue(cache, fallbackRsn),
  refreshAllowedAt: cache?.refreshAllowedAt ?? 0,
  requestId: cache?.requestId ?? null,
});

const womMetricToSkillKey = (metric: string) =>
  `skill.${metric === "runecrafting" ? "runecraft" : metric}`;

const skillKeyToWomMetric = (skillKey: string) => {
  const metric = skillKey.replace(/^skill\./, "");
  return metric === "runecraft" ? "runecrafting" : metric;
};

export const claimSkillGainsCacheRefresh = internalMutation({
  args: { rsn: v.string(), period: periodValidator, now: v.number() },
  returns: skillGainsClaimValidator,
  handler: async (ctx, args) => {
    const key = skillGainsCacheKey(args.rsn, args.period);
    const existing = await ctx.db
      .query("wiseOldManSkillGainsCaches")
      .withIndex("by_key", (index) => index.eq("key", key))
      .unique();
    if (existing && existing.refreshAllowedAt > args.now) {
      return {
        shouldFetch: false,
        requestId: null,
        cache: skillGainsCacheValue(existing, args.rsn),
      };
    }

    const requestId = crypto.randomUUID();
    if (existing) {
      await ctx.db.patch(existing._id, {
        requestId,
        refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
      });
    } else {
      await ctx.db.insert("wiseOldManSkillGainsCaches", {
        key,
        normalizedRsn: rsnLookupKey(args.rsn),
        displayRsn: args.rsn.trim(),
        period: args.period,
        fetchedAt: null,
        refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
        requestId,
        gains: [],
      });
    }
    return {
      shouldFetch: true,
      requestId,
      cache: skillGainsCacheValue(existing, args.rsn),
    };
  },
});

export const completeSkillGainsCacheRefresh = internalMutation({
  args: {
    rsn: v.string(),
    period: periodValidator,
    requestId: v.string(),
    fetchedAt: v.number(),
    gains: v.array(skillGainValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wiseOldManSkillGainsCaches")
      .withIndex("by_key", (index) =>
        index.eq("key", skillGainsCacheKey(args.rsn, args.period)),
      )
      .unique();
    if (!existing || existing.requestId !== args.requestId) return false;
    await ctx.db.patch(existing._id, {
      displayRsn: args.rsn.trim(),
      fetchedAt: args.fetchedAt,
      requestId: null,
      gains: args.gains,
    });
    return true;
  },
});

export const releaseSkillGainsCacheRefresh = internalMutation({
  args: {
    rsn: v.string(),
    period: periodValidator,
    requestId: v.string(),
    refreshAllowedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wiseOldManSkillGainsCaches")
      .withIndex("by_key", (index) =>
        index.eq("key", skillGainsCacheKey(args.rsn, args.period)),
      )
      .unique();
    if (existing?.requestId === args.requestId) {
      await ctx.db.patch(existing._id, {
        requestId: null,
        refreshAllowedAt: args.refreshAllowedAt,
      });
    }
    return null;
  },
});

export const getSkillGainsCache = internalQuery({
  args: { rsn: v.string(), period: periodValidator },
  returns: skillGainsCacheValueValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wiseOldManSkillGainsCaches")
      .withIndex("by_key", (index) =>
        index.eq("key", skillGainsCacheKey(args.rsn, args.period)),
      )
      .unique();
    return skillGainsCacheValue(existing, args.rsn);
  },
});

export const getSkillGainsCacheState = internalQuery({
  args: { rsn: v.string(), period: periodValidator },
  returns: skillGainsCacheStateValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wiseOldManSkillGainsCaches")
      .withIndex("by_key", (index) =>
        index.eq("key", skillGainsCacheKey(args.rsn, args.period)),
      )
      .unique();
    return skillGainsCacheState(existing, args.rsn);
  },
});

export const refreshSkillGainsCache = internalAction({
  args: { rsn: v.string(), period: periodValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim: SkillGainsClaim = await ctx.runMutation(
      internal.wiseOldMan.claimSkillGainsCacheRefresh,
      { rsn: args.rsn, period: args.period, now: Date.now() },
    );
    if (!claim.shouldFetch || !claim.requestId) return null;

    try {
      const result = await fetchSkillXpGains(args.rsn, args.period, {
        userAgent: "RuneRating/0.1",
      });
      await ctx.runMutation(
        internal.wiseOldMan.completeSkillGainsCacheRefresh,
        {
          rsn: args.rsn,
          period: args.period,
          requestId: claim.requestId,
          fetchedAt: Date.now(),
          gains: result.skills
            .filter((skill) => skill.metric !== "overall")
            .map((skill) => ({
              key: womMetricToSkillKey(skill.metric),
              gained: skill.gained,
              start: skill.start,
              end: skill.end,
            })),
        },
      );
    } catch (error) {
      await ctx.runMutation(internal.wiseOldMan.releaseSkillGainsCacheRefresh, {
        rsn: args.rsn,
        period: args.period,
        requestId: claim.requestId,
        refreshAllowedAt: Date.now() + refreshBackoffMs(error),
      });
      if (claim.cache.fetchedAt === null) throw error;
    }
    return null;
  },
});

export const getSkillGains = action({
  args: {
    leftRsn: v.string(),
    rightRsn: v.string(),
    period: periodValidator,
  },
  returns: v.object({
    left: skillGainsCacheValueValidator,
    right: skillGainsCacheValueValidator,
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ left: SkillGainsCacheValue; right: SkillGainsCacheValue }> => {
    const fetchPlayer = async (rsn: string): Promise<SkillGainsCacheValue> => {
      const cache: SkillGainsCacheState = await ctx.runQuery(
        internal.wiseOldMan.getSkillGainsCacheState,
        { rsn, period: args.period },
      );
      const now = Date.now();
      if (cache.fetchedAt !== null) {
        if (cache.refreshAllowedAt <= now && cache.requestId === null) {
          await ctx.scheduler.runAfter(
            0,
            internal.wiseOldMan.refreshSkillGainsCache,
            { rsn, period: args.period },
          );
        }
        return skillGainsCacheValue(cache, rsn);
      }

      await ctx.runAction(internal.wiseOldMan.refreshSkillGainsCache, {
        rsn,
        period: args.period,
      });
      return await ctx.runQuery(internal.wiseOldMan.getSkillGainsCache, {
        rsn,
        period: args.period,
      });
    };
    const [left, right] = await Promise.all([
      fetchPlayer(args.leftRsn),
      fetchPlayer(args.rightRsn),
    ]);
    return { left, right };
  },
});

const skillTimelineCacheValueValidator = v.object({
  displayRsn: v.string(),
  skillKey: v.string(),
  fetchedAt: v.union(v.number(), v.null()),
  timeline: v.array(timelinePointValidator),
});

const skillTimelineCacheStateValidator = v.object({
  displayRsn: v.string(),
  skillKey: v.string(),
  fetchedAt: v.union(v.number(), v.null()),
  timeline: v.array(timelinePointValidator),
  refreshAllowedAt: v.number(),
  requestId: v.union(v.string(), v.null()),
});

const skillTimelineClaimValidator = v.object({
  shouldFetch: v.boolean(),
  requestId: v.union(v.string(), v.null()),
  cache: skillTimelineCacheValueValidator,
});

type SkillTimelineCacheValue = {
  displayRsn: string;
  skillKey: string;
  fetchedAt: number | null;
  timeline: TimelinePoint[];
};
type SkillTimelinePlayer = {
  rsn: string;
  skillKey: string;
  timeline: TimelinePoint[];
  fetchedAt: number | null;
};
type SkillTimelinesPlayer = {
  rsn: string;
  timelines: Array<{
    skillKey: string;
    timeline: TimelinePoint[];
    fetchedAt: number | null;
  }>;
};
type SkillTimelineCacheState = SkillTimelineCacheValue & {
  refreshAllowedAt: number;
  requestId: string | null;
};
type SkillTimelineClaim = {
  shouldFetch: boolean;
  requestId: string | null;
  cache: SkillTimelineCacheValue;
};

const skillTimelineCacheKey = (rsn: string, skillKey: string) =>
  `${rsnLookupKey(rsn)}:${skillKey}`;

const skillTimelineCacheValue = (
  cache: SkillTimelineCacheValue | null,
  fallbackRsn: string,
  skillKey: string,
): SkillTimelineCacheValue => ({
  displayRsn: cache?.displayRsn ?? fallbackRsn.trim(),
  skillKey,
  fetchedAt: cache?.fetchedAt ?? null,
  timeline: cache?.timeline ?? [],
});

const skillTimelineCacheState = (
  cache:
    | (SkillTimelineCacheValue & {
        refreshAllowedAt: number;
        requestId: string | null;
      })
    | null,
  fallbackRsn: string,
  skillKey: string,
): SkillTimelineCacheState => ({
  ...skillTimelineCacheValue(cache, fallbackRsn, skillKey),
  refreshAllowedAt: cache?.refreshAllowedAt ?? 0,
  requestId: cache?.requestId ?? null,
});

export const claimSkillTimelineCacheRefresh = internalMutation({
  args: { rsn: v.string(), skillKey: v.string(), now: v.number() },
  returns: skillTimelineClaimValidator,
  handler: async (ctx, args) => {
    const key = skillTimelineCacheKey(args.rsn, args.skillKey);
    const existing = await ctx.db
      .query("wiseOldManSkillTimelineCaches")
      .withIndex("by_key", (index) => index.eq("key", key))
      .unique();
    if (existing && existing.refreshAllowedAt > args.now) {
      return {
        shouldFetch: false,
        requestId: null,
        cache: skillTimelineCacheValue(existing, args.rsn, args.skillKey),
      };
    }

    const requestId = crypto.randomUUID();
    if (existing) {
      await ctx.db.patch(existing._id, {
        requestId,
        refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
      });
    } else {
      await ctx.db.insert("wiseOldManSkillTimelineCaches", {
        key,
        normalizedRsn: rsnLookupKey(args.rsn),
        displayRsn: args.rsn.trim(),
        skillKey: args.skillKey,
        fetchedAt: null,
        refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
        requestId,
        timeline: [],
      });
    }
    return {
      shouldFetch: true,
      requestId,
      cache: skillTimelineCacheValue(existing, args.rsn, args.skillKey),
    };
  },
});

export const claimSkillTimelineCachesRefresh = internalMutation({
  args: { rsn: v.string(), skillKeys: v.array(v.string()), now: v.number() },
  returns: v.array(skillTimelineClaimValidator),
  handler: async (ctx, args) => {
    const claims: SkillTimelineClaim[] = [];
    for (const skillKey of [...new Set(args.skillKeys)]) {
      const key = skillTimelineCacheKey(args.rsn, skillKey);
      const existing = await ctx.db
        .query("wiseOldManSkillTimelineCaches")
        .withIndex("by_key", (index) => index.eq("key", key))
        .unique();
      if (existing && existing.refreshAllowedAt > args.now) {
        claims.push({
          shouldFetch: false,
          requestId: null,
          cache: skillTimelineCacheValue(existing, args.rsn, skillKey),
        });
        continue;
      }

      const requestId = crypto.randomUUID();
      if (existing) {
        await ctx.db.patch(existing._id, {
          requestId,
          refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
        });
      } else {
        await ctx.db.insert("wiseOldManSkillTimelineCaches", {
          key,
          normalizedRsn: rsnLookupKey(args.rsn),
          displayRsn: args.rsn.trim(),
          skillKey,
          fetchedAt: null,
          refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
          requestId,
          timeline: [],
        });
      }
      claims.push({
        shouldFetch: true,
        requestId,
        cache: skillTimelineCacheValue(existing, args.rsn, skillKey),
      });
    }
    return claims;
  },
});

export const completeSkillTimelineCacheRefresh = internalMutation({
  args: {
    rsn: v.string(),
    skillKey: v.string(),
    requestId: v.string(),
    fetchedAt: v.number(),
    timeline: v.array(timelinePointValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wiseOldManSkillTimelineCaches")
      .withIndex("by_key", (index) =>
        index.eq("key", skillTimelineCacheKey(args.rsn, args.skillKey)),
      )
      .unique();
    if (!existing || existing.requestId !== args.requestId) return false;
    await ctx.db.patch(existing._id, {
      displayRsn: args.rsn.trim(),
      fetchedAt: args.fetchedAt,
      requestId: null,
      timeline: args.timeline,
    });
    return true;
  },
});

export const completeSkillTimelineCacheRefreshes = internalMutation({
  args: {
    rsn: v.string(),
    fetchedAt: v.number(),
    timelines: v.array(
      v.object({
        skillKey: v.string(),
        requestId: v.string(),
        timeline: v.array(timelinePointValidator),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const timeline of args.timelines) {
      const existing = await ctx.db
        .query("wiseOldManSkillTimelineCaches")
        .withIndex("by_key", (index) =>
          index.eq("key", skillTimelineCacheKey(args.rsn, timeline.skillKey)),
        )
        .unique();
      if (!existing || existing.requestId !== timeline.requestId) continue;
      await ctx.db.patch(existing._id, {
        displayRsn: args.rsn.trim(),
        fetchedAt: args.fetchedAt,
        requestId: null,
        timeline: timeline.timeline,
      });
    }
    return null;
  },
});

export const releaseSkillTimelineCacheRefresh = internalMutation({
  args: {
    rsn: v.string(),
    skillKey: v.string(),
    requestId: v.string(),
    refreshAllowedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wiseOldManSkillTimelineCaches")
      .withIndex("by_key", (index) =>
        index.eq("key", skillTimelineCacheKey(args.rsn, args.skillKey)),
      )
      .unique();
    if (existing?.requestId === args.requestId) {
      await ctx.db.patch(existing._id, {
        requestId: null,
        refreshAllowedAt: args.refreshAllowedAt,
      });
    }
    return null;
  },
});

export const releaseSkillTimelineCacheRefreshes = internalMutation({
  args: {
    rsn: v.string(),
    refreshAllowedAt: v.number(),
    claims: v.array(
      v.object({
        skillKey: v.string(),
        requestId: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const claim of args.claims) {
      const existing = await ctx.db
        .query("wiseOldManSkillTimelineCaches")
        .withIndex("by_key", (index) =>
          index.eq("key", skillTimelineCacheKey(args.rsn, claim.skillKey)),
        )
        .unique();
      if (existing?.requestId === claim.requestId) {
        await ctx.db.patch(existing._id, {
          requestId: null,
          refreshAllowedAt: args.refreshAllowedAt,
        });
      }
    }
    return null;
  },
});

export const getSkillTimelineCache = internalQuery({
  args: { rsn: v.string(), skillKey: v.string() },
  returns: skillTimelineCacheValueValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wiseOldManSkillTimelineCaches")
      .withIndex("by_key", (index) =>
        index.eq("key", skillTimelineCacheKey(args.rsn, args.skillKey)),
      )
      .unique();
    return skillTimelineCacheValue(existing, args.rsn, args.skillKey);
  },
});

export const getSkillTimelineCacheStates = internalQuery({
  args: { rsn: v.string(), skillKeys: v.array(v.string()) },
  returns: v.array(skillTimelineCacheStateValidator),
  handler: async (ctx, args) => {
    const caches: SkillTimelineCacheState[] = [];
    for (const skillKey of [...new Set(args.skillKeys)]) {
      const existing = await ctx.db
        .query("wiseOldManSkillTimelineCaches")
        .withIndex("by_key", (index) =>
          index.eq("key", skillTimelineCacheKey(args.rsn, skillKey)),
        )
        .unique();
      caches.push(skillTimelineCacheState(existing, args.rsn, skillKey));
    }
    return caches;
  },
});

function projectSkillTimeline(
  cache: SkillTimelineCacheValue,
  period: HistoryPeriod,
) {
  const projected = projectPeriod(
    {
      displayRsn: cache.displayRsn,
      fetchedAt: cache.fetchedAt,
      timeline: cache.timeline,
      sevenDayGained: null,
    },
    period,
  );
  return {
    rsn: projected.rsn,
    skillKey: cache.skillKey,
    timeline: projected.timeline,
    fetchedAt: projected.fetchedAt,
  };
}

const skillTimelinePlayerValidator = v.object({
  rsn: v.string(),
  skillKey: v.string(),
  timeline: v.array(timelinePointValidator),
  fetchedAt: v.union(v.number(), v.null()),
});

const skillTimelinesPlayerValidator = v.object({
  rsn: v.string(),
  timelines: v.array(
    v.object({
      skillKey: v.string(),
      timeline: v.array(timelinePointValidator),
      fetchedAt: v.union(v.number(), v.null()),
    }),
  ),
});

function projectSkillTimelines(
  caches: SkillTimelineCacheValue[],
  period: HistoryPeriod,
) {
  return caches.map((cache) => projectSkillTimeline(cache, period));
}

export const refreshSkillTimelineCaches = internalAction({
  args: { rsn: v.string(), skillKeys: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claims: SkillTimelineClaim[] = await ctx.runMutation(
      internal.wiseOldMan.claimSkillTimelineCachesRefresh,
      { rsn: args.rsn, skillKeys: args.skillKeys, now: Date.now() },
    );
    const claimed = claims.filter(
      (claim): claim is SkillTimelineClaim & { requestId: string } =>
        claim.shouldFetch && claim.requestId !== null,
    );
    if (claimed.length === 0) return null;

    try {
      const metrics = claimed.map((claim) =>
        skillKeyToWomMetric(claim.cache.skillKey),
      );
      const timelines = await fetchSkillXpTimelines(args.rsn, metrics, "year", {
        userAgent: "RuneRating/0.1",
        timeoutMs: 30_000,
      });
      const byMetric = new Map(
        timelines.map((timeline) => [timeline.metric, timeline.timeline]),
      );
      const completed = claimed.flatMap((claim) => {
        const timeline = byMetric.get(
          skillKeyToWomMetric(claim.cache.skillKey),
        );
        return timeline === undefined
          ? []
          : [
              {
                skillKey: claim.cache.skillKey,
                requestId: claim.requestId,
                timeline: canonicalDailyTimeline(timeline),
              },
            ];
      });
      const missing = claimed.filter(
        (claim) => !byMetric.has(skillKeyToWomMetric(claim.cache.skillKey)),
      );
      await ctx.runMutation(
        internal.wiseOldMan.completeSkillTimelineCacheRefreshes,
        {
          rsn: args.rsn,
          fetchedAt: Date.now(),
          timelines: completed,
        },
      );
      if (missing.length > 0) {
        await ctx.runMutation(
          internal.wiseOldMan.releaseSkillTimelineCacheRefreshes,
          {
            rsn: args.rsn,
            refreshAllowedAt: Date.now() + FAILED_REFRESH_BACKOFF_MS,
            claims: missing.map((claim) => ({
              skillKey: claim.cache.skillKey,
              requestId: claim.requestId,
            })),
          },
        );
        if (missing.some((claim) => claim.cache.fetchedAt === null)) {
          throw new Error("Wise Old Man omitted one or more skill timelines.");
        }
      }
    } catch (error) {
      await ctx.runMutation(
        internal.wiseOldMan.releaseSkillTimelineCacheRefreshes,
        {
          rsn: args.rsn,
          refreshAllowedAt: Date.now() + refreshBackoffMs(error),
          claims: claimed.map((claim) => ({
            skillKey: claim.cache.skillKey,
            requestId: claim.requestId,
          })),
        },
      );
      if (claimed.some((claim) => claim.cache.fetchedAt === null)) throw error;
    }

    return null;
  },
});

export const getSkillTimelines = action({
  args: {
    leftRsn: v.string(),
    rightRsn: v.string(),
    skillKeys: v.array(v.string()),
    period: periodValidator,
  },
  returns: v.object({
    left: skillTimelinesPlayerValidator,
    right: skillTimelinesPlayerValidator,
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    left: SkillTimelinesPlayer;
    right: SkillTimelinesPlayer;
  }> => {
    const skillKeys = [...new Set(args.skillKeys)];
    if (skillKeys.some((skillKey) => !skillKey.startsWith("skill."))) {
      throw new Error("Expected canonical skill keys.");
    }

    const fetchPlayer = async (rsn: string): Promise<SkillTimelinesPlayer> => {
      const caches: SkillTimelineCacheState[] = await ctx.runQuery(
        internal.wiseOldMan.getSkillTimelineCacheStates,
        { rsn, skillKeys },
      );
      const now = Date.now();
      const coldSkillKeys = caches
        .filter((cache) => cache.fetchedAt === null)
        .map((cache) => cache.skillKey);
      const staleSkillKeys = caches
        .filter(
          (cache) =>
            cache.fetchedAt !== null &&
            cache.refreshAllowedAt <= now &&
            cache.requestId === null,
        )
        .map((cache) => cache.skillKey);

      if (coldSkillKeys.length > 0) {
        await ctx.runAction(internal.wiseOldMan.refreshSkillTimelineCaches, {
          rsn,
          skillKeys: coldSkillKeys,
        });
      }
      if (staleSkillKeys.length > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.wiseOldMan.refreshSkillTimelineCaches,
          { rsn, skillKeys: staleSkillKeys },
        );
      }

      const latest: SkillTimelineCacheState[] =
        coldSkillKeys.length > 0
          ? await ctx.runQuery(
              internal.wiseOldMan.getSkillTimelineCacheStates,
              {
                rsn,
                skillKeys,
              },
            )
          : caches;
      return {
        rsn: latest[0]?.displayRsn ?? rsn.trim(),
        timelines: projectSkillTimelines(latest, args.period).map(
          (timeline) => ({
            skillKey: timeline.skillKey,
            timeline: timeline.timeline,
            fetchedAt: timeline.fetchedAt,
          }),
        ),
      };
    };

    const [left, right] = await Promise.all([
      fetchPlayer(args.leftRsn),
      fetchPlayer(args.rightRsn),
    ]);
    return { left, right };
  },
});

export const getSkillTimeline = action({
  args: {
    leftRsn: v.string(),
    rightRsn: v.string(),
    skillKey: v.string(),
    period: periodValidator,
  },
  returns: v.object({
    left: skillTimelinePlayerValidator,
    right: skillTimelinePlayerValidator,
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    left: SkillTimelinePlayer;
    right: SkillTimelinePlayer;
  }> => {
    if (!args.skillKey.startsWith("skill.")) {
      throw new Error("Expected a canonical skill key.");
    }
    const fetchPlayer = async (rsn: string): Promise<SkillTimelinePlayer> => {
      const caches: SkillTimelineCacheState[] = await ctx.runQuery(
        internal.wiseOldMan.getSkillTimelineCacheStates,
        { rsn, skillKeys: [args.skillKey] },
      );
      const cache = caches[0];
      if (!cache) {
        return projectSkillTimeline(
          skillTimelineCacheValue(null, rsn, args.skillKey),
          args.period,
        );
      }
      const now = Date.now();
      if (cache.fetchedAt !== null) {
        if (cache.refreshAllowedAt <= now && cache.requestId === null) {
          await ctx.scheduler.runAfter(
            0,
            internal.wiseOldMan.refreshSkillTimelineCaches,
            { rsn, skillKeys: [args.skillKey] },
          );
        }
        return projectSkillTimeline(cache, args.period);
      }

      await ctx.runAction(internal.wiseOldMan.refreshSkillTimelineCaches, {
        rsn,
        skillKeys: [args.skillKey],
      });
      const refreshedCaches: SkillTimelineCacheState[] = await ctx.runQuery(
        internal.wiseOldMan.getSkillTimelineCacheStates,
        { rsn, skillKeys: [args.skillKey] },
      );
      const refreshed = refreshedCaches[0];
      if (!refreshed) return projectSkillTimeline(cache, args.period);
      return projectSkillTimeline(refreshed, args.period);
    };
    const [left, right] = await Promise.all([
      fetchPlayer(args.leftRsn),
      fetchPlayer(args.rightRsn),
    ]);
    return { left, right };
  },
});

const efficiencyTimelineCacheValueValidator = v.object({
  displayRsn: v.string(),
  metric: efficiencyMetricValidator,
  fetchedAt: v.union(v.number(), v.null()),
  timeline: v.array(timelinePointValidator),
});

const efficiencyTimelineCacheStateValidator = v.object({
  displayRsn: v.string(),
  metric: efficiencyMetricValidator,
  fetchedAt: v.union(v.number(), v.null()),
  timeline: v.array(timelinePointValidator),
  refreshAllowedAt: v.number(),
  requestId: v.union(v.string(), v.null()),
});

const efficiencyTimelineClaimValidator = v.object({
  shouldFetch: v.boolean(),
  requestId: v.union(v.string(), v.null()),
  cache: efficiencyTimelineCacheValueValidator,
});

const efficiencyTimelinePlayerValidator = v.object({
  rsn: v.string(),
  timelines: v.array(
    v.object({
      metric: efficiencyMetricValidator,
      timeline: v.array(timelinePointValidator),
      fetchedAt: v.union(v.number(), v.null()),
    }),
  ),
});

type EfficiencyMetric = "ehp" | "ehb";
type EfficiencyTimelineCacheValue = {
  displayRsn: string;
  metric: EfficiencyMetric;
  fetchedAt: number | null;
  timeline: TimelinePoint[];
};
type EfficiencyTimelineCacheState = EfficiencyTimelineCacheValue & {
  refreshAllowedAt: number;
  requestId: string | null;
};
type EfficiencyTimelineClaim = {
  shouldFetch: boolean;
  requestId: string | null;
  cache: EfficiencyTimelineCacheValue;
};
type EfficiencyTimelinePlayer = {
  rsn: string;
  timelines: Array<{
    metric: EfficiencyMetric;
    timeline: TimelinePoint[];
    fetchedAt: number | null;
  }>;
};

const efficiencyMetrics: EfficiencyMetric[] = ["ehp", "ehb"];

const efficiencyTimelineCacheKey = (rsn: string, metric: EfficiencyMetric) =>
  `${rsnLookupKey(rsn)}:${metric}`;

const efficiencyTimelineCacheValue = (
  cache: EfficiencyTimelineCacheValue | null,
  fallbackRsn: string,
  metric: EfficiencyMetric,
): EfficiencyTimelineCacheValue => ({
  displayRsn: cache?.displayRsn ?? fallbackRsn.trim(),
  metric,
  fetchedAt: cache?.fetchedAt ?? null,
  timeline: cache?.timeline ?? [],
});

const efficiencyTimelineCacheState = (
  cache:
    | (EfficiencyTimelineCacheValue & {
        refreshAllowedAt: number;
        requestId: string | null;
      })
    | null,
  fallbackRsn: string,
  metric: EfficiencyMetric,
): EfficiencyTimelineCacheState => ({
  ...efficiencyTimelineCacheValue(cache, fallbackRsn, metric),
  refreshAllowedAt: cache?.refreshAllowedAt ?? 0,
  requestId: cache?.requestId ?? null,
});

function projectEfficiencyTimeline(
  cache: EfficiencyTimelineCacheValue,
  period: HistoryPeriod,
) {
  const projected = projectPeriod(
    {
      displayRsn: cache.displayRsn,
      fetchedAt: cache.fetchedAt,
      timeline: cache.timeline,
      sevenDayGained: null,
    },
    period,
  );
  return {
    metric: cache.metric,
    timeline: projected.timeline,
    fetchedAt: projected.fetchedAt,
  };
}

export const claimEfficiencyTimelineCachesRefresh = internalMutation({
  args: {
    rsn: v.string(),
    metrics: v.array(efficiencyMetricValidator),
    now: v.number(),
  },
  returns: v.array(efficiencyTimelineClaimValidator),
  handler: async (ctx, args) => {
    const claims: EfficiencyTimelineClaim[] = [];
    for (const metric of [...new Set(args.metrics)]) {
      const key = efficiencyTimelineCacheKey(args.rsn, metric);
      const existing = await ctx.db
        .query("wiseOldManEfficiencyTimelineCaches")
        .withIndex("by_key", (index) => index.eq("key", key))
        .unique();
      const shouldRespectBackoff =
        existing &&
        existing.refreshAllowedAt > args.now &&
        (existing.fetchedAt !== null || existing.errorCode !== undefined);
      if (shouldRespectBackoff) {
        claims.push({
          shouldFetch: false,
          requestId: null,
          cache: efficiencyTimelineCacheValue(existing, args.rsn, metric),
        });
        continue;
      }

      const requestId = crypto.randomUUID();
      if (existing) {
        await ctx.db.patch(existing._id, {
          requestId,
          refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
          errorCode: null,
        });
      } else {
        await ctx.db.insert("wiseOldManEfficiencyTimelineCaches", {
          key,
          normalizedRsn: rsnLookupKey(args.rsn),
          displayRsn: args.rsn.trim(),
          metric,
          fetchedAt: null,
          refreshAllowedAt: args.now + OVERVIEW_CACHE_MS,
          requestId,
          errorCode: null,
          timeline: [],
        });
      }
      claims.push({
        shouldFetch: true,
        requestId,
        cache: efficiencyTimelineCacheValue(existing, args.rsn, metric),
      });
    }
    return claims;
  },
});

export const completeEfficiencyTimelineCacheRefreshes = internalMutation({
  args: {
    rsn: v.string(),
    fetchedAt: v.number(),
    timelines: v.array(
      v.object({
        metric: efficiencyMetricValidator,
        requestId: v.string(),
        timeline: v.array(timelinePointValidator),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const timeline of args.timelines) {
      const existing = await ctx.db
        .query("wiseOldManEfficiencyTimelineCaches")
        .withIndex("by_key", (index) =>
          index.eq(
            "key",
            efficiencyTimelineCacheKey(args.rsn, timeline.metric),
          ),
        )
        .unique();
      if (!existing || existing.requestId !== timeline.requestId) continue;
      await ctx.db.patch(existing._id, {
        displayRsn: args.rsn.trim(),
        fetchedAt: args.fetchedAt,
        requestId: null,
        errorCode: null,
        timeline: timeline.timeline,
      });
    }
    return null;
  },
});

export const releaseEfficiencyTimelineCacheRefreshes = internalMutation({
  args: {
    rsn: v.string(),
    refreshAllowedAt: v.number(),
    errorCode: v.union(v.string(), v.null()),
    claims: v.array(
      v.object({
        metric: efficiencyMetricValidator,
        requestId: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const claim of args.claims) {
      const existing = await ctx.db
        .query("wiseOldManEfficiencyTimelineCaches")
        .withIndex("by_key", (index) =>
          index.eq("key", efficiencyTimelineCacheKey(args.rsn, claim.metric)),
        )
        .unique();
      if (existing?.requestId === claim.requestId) {
        await ctx.db.patch(existing._id, {
          requestId: null,
          refreshAllowedAt: args.refreshAllowedAt,
          errorCode: args.errorCode,
        });
      }
    }
    return null;
  },
});

export const getEfficiencyTimelineCacheStates = internalQuery({
  args: { rsn: v.string(), metrics: v.array(efficiencyMetricValidator) },
  returns: v.array(efficiencyTimelineCacheStateValidator),
  handler: async (ctx, args) => {
    const caches: EfficiencyTimelineCacheState[] = [];
    for (const metric of [...new Set(args.metrics)]) {
      const existing = await ctx.db
        .query("wiseOldManEfficiencyTimelineCaches")
        .withIndex("by_key", (index) =>
          index.eq("key", efficiencyTimelineCacheKey(args.rsn, metric)),
        )
        .unique();
      caches.push(efficiencyTimelineCacheState(existing, args.rsn, metric));
    }
    return caches;
  },
});

export const refreshEfficiencyTimelineCaches = internalAction({
  args: { rsn: v.string(), metrics: v.array(efficiencyMetricValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claims: EfficiencyTimelineClaim[] = await ctx.runMutation(
      internal.wiseOldMan.claimEfficiencyTimelineCachesRefresh,
      { rsn: args.rsn, metrics: args.metrics, now: Date.now() },
    );
    const claimed = claims.filter(
      (claim): claim is EfficiencyTimelineClaim & { requestId: string } =>
        claim.shouldFetch && claim.requestId !== null,
    );
    if (claimed.length === 0) return null;

    try {
      const metrics = claimed.map((claim) => claim.cache.metric);
      const fetchMetrics = async (requestedMetrics: EfficiencyMetric[]) =>
        await fetchSkillXpTimelines(args.rsn, requestedMetrics, "year", {
          userAgent: "RuneRating/0.1",
          timeoutMs: 30_000,
        });
      let timelines = await fetchMetrics(metrics).catch(async (error) => {
        if (metrics.length === 1) throw error;
        const fallbackTimelines = await Promise.all(
          metrics.map((metric) => fetchMetrics([metric])),
        );
        return fallbackTimelines.flat();
      });
      let returnedMetrics = new Set(
        timelines.map((timeline) => timeline.metric),
      );
      const omittedMetrics = metrics.filter(
        (metric) => !returnedMetrics.has(metric),
      );
      if (omittedMetrics.length > 0) {
        const fallbackTimelines = await Promise.all(
          omittedMetrics.map((metric) => fetchMetrics([metric])),
        );
        timelines = [...timelines, ...fallbackTimelines.flat()];
        returnedMetrics = new Set(timelines.map((timeline) => timeline.metric));
      }
      const byMetric = new Map(
        timelines.map((timeline) => [
          timeline.metric as EfficiencyMetric,
          timeline.timeline,
        ]),
      );
      const completed = claimed.flatMap((claim) => {
        const timeline = byMetric.get(claim.cache.metric);
        return timeline === undefined
          ? []
          : [
              {
                metric: claim.cache.metric,
                requestId: claim.requestId,
                timeline: canonicalDailyTimeline(timeline),
              },
            ];
      });
      const missing = claimed.filter(
        (claim) => !byMetric.has(claim.cache.metric),
      );
      await ctx.runMutation(
        internal.wiseOldMan.completeEfficiencyTimelineCacheRefreshes,
        {
          rsn: args.rsn,
          fetchedAt: Date.now(),
          timelines: completed,
        },
      );
      if (missing.length > 0) {
        await ctx.runMutation(
          internal.wiseOldMan.releaseEfficiencyTimelineCacheRefreshes,
          {
            rsn: args.rsn,
            refreshAllowedAt: Date.now() + FAILED_REFRESH_BACKOFF_MS,
            errorCode: "omitted",
            claims: missing.map((claim) => ({
              metric: claim.cache.metric,
              requestId: claim.requestId,
            })),
          },
        );
        if (missing.some((claim) => claim.cache.fetchedAt === null)) {
          throw new Error(
            "Wise Old Man omitted one or more efficiency timelines.",
          );
        }
      }
    } catch (error) {
      await ctx.runMutation(
        internal.wiseOldMan.releaseEfficiencyTimelineCacheRefreshes,
        {
          rsn: args.rsn,
          refreshAllowedAt: Date.now() + refreshBackoffMs(error),
          errorCode: cacheErrorCode(error),
          claims: claimed.map((claim) => ({
            metric: claim.cache.metric,
            requestId: claim.requestId,
          })),
        },
      );
      if (claimed.some((claim) => claim.cache.fetchedAt === null)) throw error;
    }

    return null;
  },
});

export const getEfficiencyTimelines = action({
  args: {
    leftRsn: v.string(),
    rightRsn: v.string(),
    metrics: v.optional(v.array(efficiencyMetricValidator)),
    period: periodValidator,
  },
  returns: v.object({
    left: efficiencyTimelinePlayerValidator,
    right: efficiencyTimelinePlayerValidator,
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    left: EfficiencyTimelinePlayer;
    right: EfficiencyTimelinePlayer;
  }> => {
    const metrics = [...new Set(args.metrics ?? efficiencyMetrics)];
    const fetchPlayer = async (
      rsn: string,
    ): Promise<EfficiencyTimelinePlayer> => {
      const caches: EfficiencyTimelineCacheState[] = await ctx.runQuery(
        internal.wiseOldMan.getEfficiencyTimelineCacheStates,
        { rsn, metrics },
      );
      const now = Date.now();
      const coldMetrics = caches
        .filter((cache) => cache.fetchedAt === null)
        .map((cache) => cache.metric);
      const staleMetrics = caches
        .filter(
          (cache) =>
            cache.fetchedAt !== null &&
            cache.refreshAllowedAt <= now &&
            cache.requestId === null,
        )
        .map((cache) => cache.metric);

      if (coldMetrics.length > 0) {
        await ctx.runAction(
          internal.wiseOldMan.refreshEfficiencyTimelineCaches,
          { rsn, metrics: coldMetrics },
        );
      }
      if (staleMetrics.length > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.wiseOldMan.refreshEfficiencyTimelineCaches,
          { rsn, metrics: staleMetrics },
        );
      }

      const latest: EfficiencyTimelineCacheState[] =
        coldMetrics.length > 0
          ? await ctx.runQuery(
              internal.wiseOldMan.getEfficiencyTimelineCacheStates,
              { rsn, metrics },
            )
          : caches;
      return {
        rsn: latest[0]?.displayRsn ?? rsn.trim(),
        timelines: latest.map((cache) =>
          projectEfficiencyTimeline(cache, args.period),
        ),
      };
    };

    const players = new Map<string, Promise<EfficiencyTimelinePlayer>>();
    const getPlayer = (rsn: string): Promise<EfficiencyTimelinePlayer> => {
      const key = rsnLookupKey(rsn);
      const existing = players.get(key);
      if (existing) return existing;
      const pending = fetchPlayer(rsn);
      players.set(key, pending);
      return pending;
    };

    const [left, right] = await Promise.all([
      getPlayer(args.leftRsn),
      getPlayer(args.rightRsn),
    ]);
    return { left, right };
  },
});
