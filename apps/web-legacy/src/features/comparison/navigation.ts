import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Search,
  ShieldCheck,
  Swords,
  Target,
  Zap,
} from "lucide-react";

export type AppView =
  | "overview"
  | "skills"
  | "timeline"
  | "efficiency"
  | "activity"
  | "quests"
  | "achievement-diaries"
  | "combat-achievements"
  | "bossing"
  | "clues"
  | "minigames"
  | "collections";

export const navGroups: { label?: string; items: [string, LucideIcon][] }[] = [
  {
    items: [
      ["Overview", LayoutDashboard],
      ["Skills", BarChart3],
      ["XP Timeline", Activity],
      ["EHP / Efficiency", Gauge],
      ["Activity", Zap],
    ],
  },
  {
    items: [
      ["Quests", BookOpen],
      ["Achievement Diaries", ListChecks],
      ["Combat Achievements", ShieldCheck],
      ["Bossing", Swords],
      ["Clues", Search],
      ["Minigames", Target],
      ["Collections", Boxes],
    ],
  },
];

export const navViewByLabel: Record<string, AppView> = {
  Overview: "overview",
  Skills: "skills",
  "XP Timeline": "timeline",
  "EHP / Efficiency": "efficiency",
  Activity: "activity",
  Quests: "quests",
  "Achievement Diaries": "achievement-diaries",
  "Combat Achievements": "combat-achievements",
  Bossing: "bossing",
  Clues: "clues",
  Minigames: "minigames",
  Collections: "collections",
};

export const pageTitles: Record<AppView, string> = {
  overview: "Overview",
  skills: "Skills",
  timeline: "XP Timeline",
  efficiency: "EHP / Efficiency",
  activity: "Activity",
  quests: "Quests",
  "achievement-diaries": "Achievement Diaries",
  "combat-achievements": "Combat Achievements",
  bossing: "Bossing",
  clues: "Clues",
  minigames: "Minigames",
  collections: "Collections",
};

export const routeViewBySegment: Record<string, AppView> = {
  skills: "skills",
  "xp-timeline": "timeline",
  efficiency: "efficiency",
  activity: "activity",
  quests: "quests",
  "achievement-diaries": "achievement-diaries",
  "combat-achievements": "combat-achievements",
  bossing: "bossing",
  clues: "clues",
  minigames: "minigames",
  collections: "collections",
};

export function comparisonPath(view: AppView, rsns: [string, string]) {
  const base = `/compare/${encodeURIComponent(rsns[0])}/${encodeURIComponent(rsns[1])}`;
  if (view === "overview") return base;
  if (view === "timeline") return `${base}/xp-timeline`;
  if (view === "efficiency") return `${base}/efficiency`;
  return `${base}/${view}`;
}

export function viewFromPathname(pathname: string): AppView {
  const segment = pathname.split("/").filter(Boolean).at(-1);
  return segment ? (routeViewBySegment[segment] ?? "overview") : "overview";
}
