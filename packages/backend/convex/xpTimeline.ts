import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "./_generated/server.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

const rangeValidator = v.union(
  v.literal("week"),
  v.literal("month"),
  v.literal("quarter"),
  v.literal("year"),
);

const nullableNumber = v.union(v.number(), v.null());
const nullableSide = v.union(v.literal("left"), v.literal("right"), v.null());

const pointValidator = v.object({
  date: v.number(),
  leftXp: nullableNumber,
  rightXp: nullableNumber,
  leftGained: nullableNumber,
  rightGained: nullableNumber,
  gap: nullableNumber,
});

const eventValidator = v.object({
  kind: v.union(
    v.literal("leadChange"),
    v.literal("spike"),
    v.literal("inactivity"),
  ),
  date: v.number(),
  endDate: v.union(v.number(), v.null()),
  side: nullableSide,
  value: nullableNumber,
});

const datedValueValidator = v.object({
  date: v.number(),
  side: nullableSide,
  value: v.number(),
});

const streakValidator = v.object({
  side: nullableSide,
  startDate: v.union(v.number(), v.null()),
  endDate: v.union(v.number(), v.null()),
  days: v.number(),
});

const activePeriodValidator = v.object({
  startDate: v.union(v.number(), v.null()),
  endDate: v.union(v.number(), v.null()),
  days: v.number(),
  value: v.number(),
});

const playerValidator = v.object({
  rsn: v.string(),
  fetchedAt: v.union(v.number(), v.null()),
});

const summaryValidator = v.object({
  currentGap: nullableNumber,
  leftGained: nullableNumber,
  rightGained: nullableNumber,
  leftAveragePerDay: nullableNumber,
  rightAveragePerDay: nullableNumber,
  biggestSingleDayGain: v.union(datedValueValidator, v.null()),
  biggestLeadChange: v.union(datedValueValidator, v.null()),
  longestLeadStreak: streakValidator,
  mostActivePeriod: activePeriodValidator,
  maxLead: v.union(datedValueValidator, v.null()),
  maxDeficit: v.union(datedValueValidator, v.null()),
});

const gainWindowsValidator = v.object({
  sevenDays: v.object({ left: nullableNumber, right: nullableNumber }),
  thirtyDays: v.object({ left: nullableNumber, right: nullableNumber }),
  ninetyDays: v.object({ left: nullableNumber, right: nullableNumber }),
});

type TimelinePoint = { date: number; value: number };
type Side = "left" | "right";
type DashboardPoint = {
  date: number;
  leftXp: number | null;
  rightXp: number | null;
  leftGained: number | null;
  rightGained: number | null;
  gap: number | null;
};
type DashboardEvent = {
  kind: "leadChange" | "spike" | "inactivity";
  date: number;
  endDate: number | null;
  side: Side | null;
  value: number | null;
};
type TimelineHistory = {
  left: {
    rsn: string;
    timeline: TimelinePoint[];
    fetchedAt: number | null;
  };
  right: {
    rsn: string;
    timeline: TimelinePoint[];
    fetchedAt: number | null;
  };
};
type OverviewHistory = {
  left: {
    rsn: string;
    timeline: TimelinePoint[];
    sevenDayGained: number | null;
    fetchedAt: number | null;
  };
  right: {
    rsn: string;
    timeline: TimelinePoint[];
    sevenDayGained: number | null;
    fetchedAt: number | null;
  };
};

const getOverviewHistory = makeFunctionReference<
  "action",
  {
    leftRsn: string;
    rightRsn: string;
    period: "year";
  },
  OverviewHistory
>("wiseOldMan:getOverviewHistory");

type SkillTimelinesHistory = {
  left: {
    rsn: string;
    timelines: Array<{
      skillKey: string;
      timeline: TimelinePoint[];
      fetchedAt: number | null;
    }>;
  };
  right: {
    rsn: string;
    timelines: Array<{
      skillKey: string;
      timeline: TimelinePoint[];
      fetchedAt: number | null;
    }>;
  };
};

const getSkillTimelines = makeFunctionReference<
  "action",
  {
    leftRsn: string;
    rightRsn: string;
    skillKeys: string[];
    period: "year";
  },
  SkillTimelinesHistory
>("wiseOldMan:getSkillTimelines");

const rangeDays = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
} as const;

function startOfDay(timestamp: number) {
  return Math.floor(timestamp / DAY_MS) * DAY_MS;
}

function valueAt(points: TimelinePoint[], timestamp: number) {
  let value: number | null = null;
  for (const point of points) {
    if (point.date > timestamp) break;
    value = point.value;
  }
  return value;
}

function gainBetween(points: TimelinePoint[], start: number, end: number) {
  const startValue = valueAt(points, start);
  const endValue = valueAt(points, end);
  return startValue === null || endValue === null
    ? null
    : Math.max(0, endValue - startValue);
}

function aggregateTimelines(timelines: TimelinePoint[][]) {
  const dates = [
    ...new Set(
      timelines.flatMap((timeline) => timeline.map((point) => point.date)),
    ),
  ].sort((left, right) => left - right);

  return dates.flatMap((date) => {
    let total = 0;
    let hasValue = false;
    for (const timeline of timelines) {
      const value = valueAt(timeline, date);
      if (value !== null) {
        total += value;
        hasValue = true;
      }
    }
    return hasValue ? [{ date, value: total }] : [];
  });
}

function aggregateSkillTimelines(
  history: SkillTimelinesHistory,
): TimelineHistory {
  const fetchedAt = (side: "left" | "right") => {
    const values = history[side].timelines
      .map((timeline) => timeline.fetchedAt)
      .filter((value): value is number => value !== null);
    return values.length > 0 ? Math.min(...values) : null;
  };

  return {
    left: {
      rsn: history.left.rsn,
      fetchedAt: fetchedAt("left"),
      timeline: aggregateTimelines(
        history.left.timelines.map((timeline) => timeline.timeline),
      ),
    },
    right: {
      rsn: history.right.rsn,
      fetchedAt: fetchedAt("right"),
      timeline: aggregateTimelines(
        history.right.timelines.map((timeline) => timeline.timeline),
      ),
    },
  };
}

export function buildXpTimelineDashboard(
  leftTimeline: TimelinePoint[],
  rightTimeline: TimelinePoint[],
  range: keyof typeof rangeDays,
  now = Date.now(),
) {
  const end = startOfDay(now);
  const start = end - rangeDays[range] * DAY_MS;
  const points: DashboardPoint[] = [];
  const leftObservedDays = new Set(
    leftTimeline.map((point) => startOfDay(point.date)),
  );
  const rightObservedDays = new Set(
    rightTimeline.map((point) => startOfDay(point.date)),
  );

  for (let date = start; date <= end; date += DAY_MS) {
    const leftXp = valueAt(leftTimeline, date);
    const rightXp = valueAt(rightTimeline, date);
    const previous = points.at(-1);
    const leftHasDailyPair =
      leftObservedDays.has(date) && leftObservedDays.has(date - DAY_MS);
    const rightHasDailyPair =
      rightObservedDays.has(date) && rightObservedDays.has(date - DAY_MS);
    points.push({
      date,
      leftXp,
      rightXp,
      leftGained:
        !leftHasDailyPair ||
        leftXp === null ||
        previous?.leftXp === null ||
        !previous
          ? null
          : Math.max(0, leftXp - previous.leftXp),
      rightGained:
        !rightHasDailyPair ||
        rightXp === null ||
        previous?.rightXp === null ||
        !previous
          ? null
          : Math.max(0, rightXp - previous.rightXp),
      gap: leftXp === null || rightXp === null ? null : leftXp - rightXp,
    });
  }

  const validPoints = points.filter(
    (point) => point.leftXp !== null || point.rightXp !== null,
  );
  const first = validPoints[0] ?? null;
  const last = validPoints.at(-1) ?? null;
  const elapsedDays = Math.max(1, validPoints.length - 1);
  const leftGained =
    first?.leftXp === null ||
    first?.leftXp === undefined ||
    last?.leftXp === null ||
    last?.leftXp === undefined
      ? null
      : Math.max(0, last.leftXp - first.leftXp);
  const rightGained =
    first?.rightXp === null ||
    first?.rightXp === undefined ||
    last?.rightXp === null ||
    last?.rightXp === undefined
      ? null
      : Math.max(0, last.rightXp - first.rightXp);

  let biggestSingleDayGain: {
    date: number;
    side: Side | null;
    value: number;
  } | null = null;
  let biggestLeadChange: {
    date: number;
    side: Side | null;
    value: number;
  } | null = null;
  let maxLead: { date: number; side: Side | null; value: number } | null = null;
  let maxDeficit: {
    date: number;
    side: Side | null;
    value: number;
  } | null = null;
  const events: DashboardEvent[] = [];
  let inactivityStart: number | null = null;
  let streakStart: number | null = null;
  let streakSide: Side | null = null;
  let longestLeadStreak = {
    side: null as Side | null,
    startDate: null as number | null,
    endDate: null as number | null,
    days: 0,
  };

  for (const [index, point] of points.entries()) {
    for (const [side, gained] of [
      ["left", point.leftGained],
      ["right", point.rightGained],
    ] as const) {
      if (
        gained !== null &&
        gained > 0 &&
        (biggestSingleDayGain === null || gained > biggestSingleDayGain.value)
      ) {
        biggestSingleDayGain = { date: point.date, side, value: gained };
      }
    }

    const previousGap = index > 0 ? points[index - 1]?.gap : null;
    if (point.gap !== null) {
      if (point.gap > 0 && (maxLead === null || point.gap > maxLead.value)) {
        maxLead = { date: point.date, side: "left", value: point.gap };
      }
      if (
        point.gap < 0 &&
        (maxDeficit === null || point.gap < maxDeficit.value)
      ) {
        maxDeficit = { date: point.date, side: "right", value: point.gap };
      }
      if (previousGap !== null && previousGap !== undefined) {
        const change = point.gap - previousGap;
        if (
          change !== 0 &&
          (biggestLeadChange === null ||
            Math.abs(change) > Math.abs(biggestLeadChange.value))
        ) {
          biggestLeadChange = {
            date: point.date,
            side: change >= 0 ? "left" : "right",
            value: change,
          };
        }
        if (
          Math.sign(point.gap) !== 0 &&
          Math.sign(previousGap) !== 0 &&
          Math.sign(point.gap) !== Math.sign(previousGap)
        ) {
          events.push({
            kind: "leadChange",
            date: point.date,
            endDate: null,
            side: point.gap > 0 ? "left" : "right",
            value: point.gap,
          });
        }
      }
    }

    const currentSide =
      point.gap === null || point.gap === 0
        ? null
        : point.gap > 0
          ? ("left" as const)
          : ("right" as const);
    if (currentSide !== streakSide) {
      streakSide = currentSide;
      streakStart = currentSide === null ? null : point.date;
    }
    if (currentSide !== null && streakStart !== null) {
      const days = Math.floor((point.date - streakStart) / DAY_MS) + 1;
      if (days > longestLeadStreak.days) {
        longestLeadStreak = {
          side: currentSide,
          startDate: streakStart,
          endDate: point.date,
          days,
        };
      }
    }

    const bothInactive = point.leftGained === 0 && point.rightGained === 0;
    if (bothInactive && inactivityStart === null) inactivityStart = point.date;
    const closesInactivity = !bothInactive || index === points.length - 1;
    if (inactivityStart !== null && closesInactivity) {
      const endDate = bothInactive ? point.date : point.date - DAY_MS;
      if (endDate - inactivityStart >= 2 * DAY_MS) {
        events.push({
          kind: "inactivity",
          date: inactivityStart,
          endDate,
          side: null,
          value: null,
        });
      }
      inactivityStart = null;
    }
  }

  if (biggestSingleDayGain && biggestSingleDayGain.value > 0) {
    events.push({
      kind: "spike",
      date: biggestSingleDayGain.date,
      endDate: null,
      side: biggestSingleDayGain.side,
      value: biggestSingleDayGain.value,
    });
  }

  const activeWindowDays = Math.min(7, Math.max(1, points.length - 1));
  let mostActivePeriod = {
    startDate: null as number | null,
    endDate: null as number | null,
    days: activeWindowDays,
    value: 0,
  };
  for (let index = activeWindowDays; index < points.length; index += 1) {
    let value = 0;
    for (
      let pointIndex = index - activeWindowDays + 1;
      pointIndex <= index;
      pointIndex += 1
    ) {
      value +=
        (points[pointIndex]?.leftGained ?? 0) +
        (points[pointIndex]?.rightGained ?? 0);
    }
    if (value > mostActivePeriod.value) {
      mostActivePeriod = {
        startDate: points[index - activeWindowDays + 1]?.date ?? null,
        endDate: points[index]?.date ?? null,
        days: activeWindowDays,
        value,
      };
    }
  }

  return {
    points,
    summaries: {
      currentGap: last?.gap ?? null,
      leftGained,
      rightGained,
      leftAveragePerDay: leftGained === null ? null : leftGained / elapsedDays,
      rightAveragePerDay:
        rightGained === null ? null : rightGained / elapsedDays,
      biggestSingleDayGain,
      biggestLeadChange,
      longestLeadStreak,
      mostActivePeriod,
      maxLead,
      maxDeficit,
    },
    gainWindows: {
      sevenDays: {
        left: gainBetween(leftTimeline, end - 7 * DAY_MS, end),
        right: gainBetween(rightTimeline, end - 7 * DAY_MS, end),
      },
      thirtyDays: {
        left: gainBetween(leftTimeline, end - 30 * DAY_MS, end),
        right: gainBetween(rightTimeline, end - 30 * DAY_MS, end),
      },
      ninetyDays: {
        left: gainBetween(leftTimeline, end - 90 * DAY_MS, end),
        right: gainBetween(rightTimeline, end - 90 * DAY_MS, end),
      },
    },
    events: events
      .sort((left, right) => right.date - left.date)
      .slice(0, 6)
      .reverse(),
  };
}

export const getDashboard = action({
  args: {
    leftRsn: v.string(),
    rightRsn: v.string(),
    range: rangeValidator,
    skillKey: v.optional(v.string()),
    skillKeys: v.optional(v.array(v.string())),
  },
  returns: v.object({
    left: playerValidator,
    right: playerValidator,
    points: v.array(pointValidator),
    heatmapPoints: v.array(pointValidator),
    summaries: summaryValidator,
    gainWindows: gainWindowsValidator,
    events: v.array(eventValidator),
  }),
  handler: async (ctx, args) => {
    const skillKeys = args.skillKeys ?? (args.skillKey ? [args.skillKey] : []);
    const history: TimelineHistory =
      skillKeys.length > 0
        ? aggregateSkillTimelines(
            await ctx.runAction(getSkillTimelines, {
              leftRsn: args.leftRsn,
              rightRsn: args.rightRsn,
              skillKeys,
              period: "year",
            }),
          )
        : await ctx.runAction(getOverviewHistory, {
            leftRsn: args.leftRsn,
            rightRsn: args.rightRsn,
            period: "year",
          });
    const dashboard = buildXpTimelineDashboard(
      history.left.timeline,
      history.right.timeline,
      args.range,
    );
    const heatmapDashboard =
      args.range === "year"
        ? dashboard
        : buildXpTimelineDashboard(
            history.left.timeline,
            history.right.timeline,
            "year",
          );
    return {
      left: { rsn: history.left.rsn, fetchedAt: history.left.fetchedAt },
      right: { rsn: history.right.rsn, fetchedAt: history.right.fetchedAt },
      heatmapPoints: heatmapDashboard.points,
      ...dashboard,
    };
  },
});
