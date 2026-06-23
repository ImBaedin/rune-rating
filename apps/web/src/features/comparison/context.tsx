import type { api } from "@rune-rating/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContext } from "react";

export type SkillsComparison = FunctionReturnType<
  typeof api.comparisons.getSkills
>;
export type EfficiencyComparison = FunctionReturnType<
  typeof api.comparisons.getEfficiency
>;
export type PlayerProfile = FunctionReturnType<typeof api.players.getProfile>;
export type RuneProfileDashboard = FunctionReturnType<
  typeof api.runeProfile.getDashboard
>;
export type OverviewHistory = FunctionReturnType<
  typeof api.wiseOldMan.getOverviewHistory
>;
export type HistoryPeriod = "week" | "month" | "quarter" | "year";

export type ComparisonShellContextValue = {
  names: [string, string];
  comparison: SkillsComparison | undefined;
  efficiency: EfficiencyComparison | undefined;
  leftProfile: PlayerProfile | undefined;
  rightProfile: PlayerProfile | undefined;
  runeProfile: RuneProfileDashboard | undefined;
  runeProfileUnavailableMessage: string | null;
  overviewHistory: OverviewHistory | null;
  overviewHistoryError: string | null;
  isOverviewHistoryLoading: boolean;
  historyPeriod: HistoryPeriod;
  setHistoryPeriod: (period: HistoryPeriod) => void;
};

export const ComparisonShellContext =
  createContext<ComparisonShellContextValue | null>(null);

export function useComparisonShell() {
  const context = useContext(ComparisonShellContext);
  if (context === null) {
    throw new Error("useComparisonShell must be used inside ComparisonShell.");
  }
  return context;
}
