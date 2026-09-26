import { expect, mock, test } from "bun:test";
import type { api } from "@rune-rating/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ComparisonShellContext,
  type ComparisonShellContextValue,
} from "../src/features/comparison/context";

const summary = {
  type: "quests" as const,
  completed: 1,
  started: 0,
  notStarted: 0,
  total: 1,
  earnedPoints: 5,
  totalPoints: 5,
};
const context: ComparisonShellContextValue = {
  names: ["Alice", "Bob"],
  comparison: null,
  efficiency: null,
  leftProfile: null,
  rightProfile: null,
  runeProfile: { left: null, right: null },
  runeProfileUnavailableMessage: "Bob's provider data is unavailable",
  overviewHistory: null,
  overviewHistoryError: null,
  isOverviewHistoryLoading: false,
  historyPeriod: "month",
  setHistoryPeriod() {},
  womQueueCompletionToken: 0,
};
const category = {
  summary,
  items: [
    {
      key: "test-quest",
      label: "Test quest",
      group: "members",
      points: 5,
      state: "finished",
      completed: true,
      current: 1,
      total: 1,
    },
  ],
};
type Activities = FunctionReturnType<typeof api.comparisons.getActivities>;
let activities: Activities | undefined = null;
mock.module("convex/react", () => ({
  useQuery: (_reference: unknown, args: { rsn?: string }) =>
    args.rsn ? (args.rsn === "Alice" ? category : null) : activities,
}));
const { default: QuestsPage } = await import("../src/pages/QuestsPage");

test("quest cards do not describe an unavailable player as missing completed quests", () => {
  const html = renderToStaticMarkup(
    createElement(
      ComparisonShellContext.Provider,
      {
        value: context,
      },
      createElement(QuestsPage),
    ),
  );
  expect(html).not.toContain("Bob missing");
  expect(html).not.toContain("Alice only");
  expect(html).not.toContain("Both players match");
  expect(html).toContain(
    "No confirmed quest differences in the available data.",
  );
  expect(html).toContain('<span class="green">—</span>');
});

const recharts = await import("recharts");
let capturedCharts: Array<
  Array<{ left: number | null; right: number | null }>
> = [];
mock.module("recharts", () => ({
  ...recharts,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  BarChart: ({
    data,
  }: {
    data: Array<{ left: number | null; right: number | null }>;
  }) => {
    capturedCharts.push(data);
    return null;
  },
}));
const { default: BossingPage } = await import("../src/pages/BossingPage");
const { default: MinigamesPage } = await import("../src/pages/MinigamesPage");
const { default: CluesPage } = await import("../src/pages/CluesPage");
function renderPage(component: ComponentType) {
  return renderToStaticMarkup(
    createElement(
      ComparisonShellContext.Provider,
      { value: context },
      createElement(component),
    ),
  )
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
}
function scores(
  left: number | null,
  right: number | null,
  ranked = false,
): NonNullable<Activities> {
  const score = {
    left,
    right,
    delta: left === null || right === null ? null : left - right,
    leader:
      left === null || right === null
        ? ("indeterminate" as const)
        : left === right
          ? ("tie" as const)
          : left > right
            ? ("left" as const)
            : ("right" as const),
  };
  const rank = {
    left: ranked ? 100 : null,
    right: ranked ? 100 : null,
    delta: ranked ? 0 : null,
    leader: ranked ? ("tie" as const) : ("indeterminate" as const),
  };
  return {
    left: { displayRsn: "Alice", normalizedRsn: "alice", fetchedAt: 1 },
    right: { displayRsn: "Bob", normalizedRsn: "bob", fetchedAt: 1 },
    activities: [
      { key: "boss.zulrah", name: "Zulrah", category: "bossing", score, rank },
      {
        key: "minigame.soulWars",
        name: "Soul Wars Zeal",
        category: "minigames",
        score,
        rank,
      },
      {
        key: "clue.easy",
        name: "Clue Scrolls (easy)",
        category: "clues",
        score,
        rank,
      },
    ],
  };
}

test("activity summary pages preserve loading, missing, and partial scores", () => {
  for (const Page of [BossingPage, MinigamesPage, CluesPage]) {
    activities = undefined;
    expect(renderPage(Page)).toContain("Loading value");
    for (const result of [null, scores(100, null)]) {
      activities = result;
      const text = renderPage(Page);
      expect(text).toContain("Complete scores unavailable");
      expect(text).not.toContain("Alice ahead");
      expect(text).not.toContain("Alice is ahead");
      expect(text).not.toContain("Tie ahead");
      expect(text).not.toContain("Scores are tied");
    }
  }
});

test("activity summaries distinguish real zero ties from positive leads", () => {
  for (const [Page, tie] of [
    [BossingPage, "Kill counts are tied"],
    [MinigamesPage, "Scores are tied"],
    [CluesPage, "Completions are tied"],
  ] as const) {
    activities = scores(0, 0);
    expect(renderPage(Page)).toContain(tie);
    activities = scores(10, 0);
    expect(renderPage(Page)).toContain("Alice ahead");
    activities = scores(0, 10);
    expect(renderPage(Page)).toContain("Bob ahead");
  }
});

test("minigame rank counts and badges follow rank availability, not score", () => {
  activities = scores(0, 0);
  let text = renderPage(MinigamesPage);
  expect(text).toContain("0 ranked");
  expect(text).toContain("Unranked");
  activities = scores(0, 0, true);
  text = renderPage(MinigamesPage);
  expect(text).toContain("1 ranked");
  expect(text).not.toContain("Unranked");
});

test("activity page chart adapters preserve unavailable scores and real zeros", () => {
  for (const Page of [BossingPage, MinigamesPage, CluesPage]) {
    for (const right of [null, 0]) {
      activities = scores(100, right);
      capturedCharts = [];
      renderPage(Page);
      expect(capturedCharts.flat()).toContainEqual(
        expect.objectContaining({ left: 100, right }),
      );
    }
  }
});
