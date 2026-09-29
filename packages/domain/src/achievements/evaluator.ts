import compiled from "./compiled.json";

export type AchievementContributors = {
  label: string;
  items: { key: string; label: string; milestoneId?: string }[];
};
export type AchievementCollectionLog = {
  items: { key: string; label: string; itemId: number; obtained: boolean }[];
};
export type AchievementBreakdown = {
  label: string;
  unit: "XP" | "levels" | "slots";
  items: {
    key: string;
    label: string;
    current: number;
    target: number;
    milestoneId?: string;
  }[];
};
export type AchievementFact = {
  value: number | null;
  upper?: number;
  contributors?: AchievementContributors;
  collectionLog?: AchievementCollectionLog;
  candidates?: {
    label: string;
    completedLabel?: string;
    unit: AchievementBreakdown["unit"];
    mode: "leading" | "next" | "blocking";
    items: {
      key: string;
      label: string;
      current: number;
      target: number | null;
    }[];
  };
};
export type AchievementFacts = Record<string, AchievementFact>;
export type AchievementSourceKey =
  | "skills"
  | "activities"
  | "quests"
  | "diaries"
  | "combatAchievements"
  | "collectionSummary"
  | "collectionDetail";
export type AchievementSourceFreshness = {
  key: AchievementSourceKey;
  label: string;
  provider: "Hiscores" | "RuneProfile";
  status: "fresh" | "stale" | "refreshing" | "failed" | "missing";
  fetchedAt: number | null;
  staleAt: number | null;
  reason: string | null;
};
export type AchievementRule =
  | {
      kind: "threshold";
      key: string;
      target: number | string;
      label: string;
      boostable?: boolean;
    }
  | { kind: "all" | "any"; rules: AchievementRule[] }
  | { kind: "milestones"; match: "all" | "any"; ids: string[] }
  | { kind: "untracked"; reason: string; completedBy?: string }
  | { kind: "rank"; fraction: number; roundDownTo: number };
export type AchievementBinding = {
  id: string;
  rule: AchievementRule;
  required: string[];
  anyRequired: boolean;
  prerequisites?: AchievementRule;
};
export type AchievementEvidence = {
  key: string;
  label: string;
  met: boolean | null;
  current: number | null;
  target: number | null;
  reason: string | null;
};
export type AchievementEvaluation = AchievementEvidence & {
  evidence: AchievementEvidence[];
  contributors?: AchievementContributors;
  breakdown?: AchievementBreakdown;
  collectionLog?: AchievementCollectionLog;
  readiness?: {
    met: boolean | null;
    reason: string | null;
    evidence: AchievementEvidence[];
  };
};
export const achievementBindings = compiled.nodes as AchievementBinding[];
export const achievementVersion = compiled.version;
export function achievementSourceKeys(
  id: string,
  bindings = achievementBindings,
): AchievementSourceKey[] {
  const sources = new Set<AchievementSourceKey>();
  const visited = new Set<string>();
  const byId = new Map(bindings.map((node) => [node.id, node]));
  function fact(key: string) {
    if (/^skills?\.|^account\.combatLevel/.test(key)) sources.add("skills");
    else if (
      key.startsWith("activity.") ||
      key.startsWith("hiscores.") ||
      key === "collection.obtained"
    )
      sources.add("activities");
    else if (/^quests?\./.test(key)) sources.add("quests");
    else if (/^diary\.|^diaries\./.test(key)) sources.add("diaries");
    else if (/^combat/.test(key)) sources.add("combatAchievements");
    else if (key === "collection.total") sources.add("collectionSummary");
    else if (key.startsWith("collection.")) sources.add("collectionDetail");
    else throw Error(`Unknown achievement source: ${key}`);
  }
  function rule(r: AchievementRule) {
    switch (r.kind) {
      case "threshold":
        fact(r.key);
        if (typeof r.target === "string") fact(r.target);
        break;
      case "rank":
        fact("collection.total");
        fact("collection.obtained");
        break;
      case "all":
      case "any":
        r.rules.forEach(rule);
        break;
      case "milestones":
        for (const id of r.ids) visit(id, false);
        break;
      case "untracked":
        if (r.completedBy) fact(r.completedBy);
        break;
    }
  }
  function visit(nodeId: string, includeReadiness: boolean) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = byId.get(nodeId);
    if (!node) throw Error(`Unknown achievement: ${nodeId}`);
    rule(node.rule);
    if (includeReadiness) {
      if (node.prerequisites) rule(node.prerequisites);
      for (const id of node.required) visit(id, false);
    }
  }
  visit(id, true);
  return [...sources].sort();
}
// One character per catalog node: completed, available, locked, unknown.
export const achievementStatusNames = [
  "complete",
  "available",
  "locked",
  "unknown",
] as const;

function combineTruth(
  values: (boolean | null)[],
  any: boolean,
): boolean | null {
  if (any && values.includes(true)) return true;
  if (!any && values.includes(false)) return false;
  if (values.includes(null)) return null;
  return !any;
}

export function evaluateAchievements(
  facts: AchievementFacts,
  bindings = achievementBindings,
) {
  const byId = new Map(bindings.map((n) => [n.id, n]));
  const pageMilestones = new Map(
    bindings.flatMap((node) => {
      const r = node.rule;
      return r.kind === "threshold" &&
        r.key.startsWith("collection.page.") &&
        r.target === r.key.replace(/\.current$/, ".total")
        ? [[r.key.replace(/\.current$/, ""), node.id] as const]
        : [];
    }),
  );
  const withMilestone = <T extends { key: string }>(item: T) => {
    const milestoneId = pageMilestones.get(item.key);
    return milestoneId ? { ...item, milestoneId } : item;
  };
  const results = new Map<string, AchievementEvaluation>();
  const visiting = new Set<string>();
  const unknown = (
    label: string,
    reason = "This data has not been reported.",
  ): AchievementEvaluation => ({
    key: reason,
    label,
    met: null,
    current: null,
    target: null,
    reason,
    evidence: [],
  });
  function threshold(
    key: string,
    target: number | null,
    label: string,
  ): AchievementEvaluation {
    const fact = facts[key];
    const current = fact?.value ?? null;
    let met: boolean | null = null;
    if (current !== null && target !== null) {
      if (current >= target) met = true;
      else if (fact?.upper === undefined || fact.upper < target) met = false;
    }
    const result = {
      key,
      label,
      met,
      current,
      target,
      reason:
        met === null ? "Some required data is unavailable or unranked." : null,
    };
    const candidates = fact?.candidates;
    let breakdown: AchievementBreakdown | undefined;
    if (candidates) {
      const completedLeader = candidates.mode === "leading" && met === true;
      const items = candidates.items
        .flatMap((item) => {
          const goal = item.target ?? target;
          if (goal === null || goal <= 0) return [];
          if (completedLeader ? item.current < goal : item.current >= goal)
            return [];
          return [{ ...item, target: goal }];
        })
        .sort(
          (a, b) =>
            (candidates.mode === "blocking"
              ? a.current - b.current
              : a.target - a.current - (b.target - b.current)) ||
            a.label.localeCompare(b.label),
        );
      if (items.length)
        breakdown = {
          label: completedLeader
            ? (candidates.completedLabel ?? candidates.label)
            : candidates.label,
          unit: candidates.unit,
          items:
            completedLeader || candidates.mode === "blocking"
              ? items.map(withMilestone)
              : items.slice(0, 3).map(withMilestone),
        };
    }
    return {
      ...result,
      evidence: [result],
      ...(fact?.contributors
        ? {
            contributors: {
              ...fact.contributors,
              items: fact.contributors.items.map(withMilestone),
            },
          }
        : {}),
      ...(breakdown ? { breakdown } : {}),
      ...(fact?.collectionLog ? { collectionLog: fact.collectionLog } : {}),
    };
  }
  function combine(
    children: AchievementEvaluation[],
    any: boolean,
    label: string,
  ): AchievementEvaluation {
    const met = combineTruth(
      children.map((child) => child.met),
      any,
    );
    return {
      key: label,
      label,
      met,
      current: children.filter((c) => c.met === true).length,
      target: any ? 1 : children.length,
      reason: met === null ? "Some requirements cannot yet be verified." : null,
      evidence: children
        .flatMap((c) => (c.evidence.length ? c.evidence : [c]))
        .map(({ key, label, met, current, target, reason }) => ({
          key,
          label,
          met,
          current,
          target,
          reason,
        }))
        .slice(0, 40),
    };
  }
  function rule(r: AchievementRule): AchievementEvaluation {
    switch (r.kind) {
      case "threshold": {
        const target =
          typeof r.target === "number"
            ? r.target
            : (facts[r.target]?.value ?? null);
        const result = threshold(
          r.key,
          typeof r.target === "string" && target === 0 ? null : target,
          r.label,
        );
        if (r.boostable && result.met === false) {
          const reason =
            "Your base level is below the requirement. A temporary boost may qualify, but is not reported by Hiscores.";
          return {
            ...result,
            met: null,
            reason,
            evidence: result.evidence.map((item) => ({
              ...item,
              met: null,
              reason,
            })),
          };
        }
        return result;
      }
      case "rank": {
        const total = facts["collection.total"]?.value;
        return threshold(
          "collection.obtained",
          total
            ? Math.floor((total * r.fraction) / r.roundDownTo) * r.roundDownTo
            : null,
          "Collection log slots",
        );
      }
      case "untracked":
        return r.completedBy && facts[r.completedBy]?.value === 2
          ? {
              key: r.completedBy,
              label: "Overall quest completed",
              met: true,
              current: 2,
              target: 2,
              reason: null,
              evidence: [],
            }
          : unknown("Not individually tracked", r.reason);
      case "all":
      case "any":
        return combine(r.rules.map(rule), r.kind === "any", "Requirements");
      case "milestones":
        return combine(
          r.ids.map(evaluate),
          r.match === "any",
          "Connected milestones",
        );
    }
  }
  function evaluate(id: string): AchievementEvaluation {
    const cached = results.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node || visiting.has(id))
      throw Error(`Invalid achievement dependency: ${id}`);
    visiting.add(id);
    const result = rule(node.rule);
    visiting.delete(id);
    results.set(id, result);
    return result;
  }
  const readiness = new Map(
    bindings.flatMap((node) =>
      node.prerequisites
        ? [
            [
              node.id,
              combine(
                [
                  rule(node.prerequisites),
                  ...(node.required.length
                    ? [
                        combine(
                          node.required.map(evaluate),
                          node.anyRequired,
                          "Required milestones",
                        ),
                      ]
                    : []),
                ],
                false,
                "Prerequisites",
              ),
            ] as const,
          ]
        : [],
    ),
  );
  const progress = bindings.map((node) => {
    const result = evaluate(node.id);
    const ready = readiness.get(node.id);
    return ready
      ? {
          ...result,
          readiness: {
            met: ready.met,
            reason: ready.reason,
            evidence: ready.evidence,
          },
        }
      : result;
  });
  const states = bindings
    .map((n) => {
      const result = evaluate(n.id);
      if (result.met === true) return "0";
      if (result.met === null) return "3";
      const prerequisiteResult = readiness.get(n.id);
      if (prerequisiteResult)
        return prerequisiteResult.met === null
          ? "3"
          : prerequisiteResult.met
            ? "1"
            : "2";
      if (!n.required.length) return "1";
      const prereqs = n.required.map((id) => evaluate(id).met);
      const ready = combineTruth(prereqs, n.anyRequired);
      return ready === null ? "3" : ready ? "1" : "2";
    })
    .join("");
  return { version: achievementVersion, states, progress };
}
