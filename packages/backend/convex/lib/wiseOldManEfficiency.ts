import type { CanonicalActivity, CanonicalSkill } from "@rune-rating/domain";

export type WiseOldManEhpSkillRate = {
  skill: string;
  methods: Array<{
    startExp: number;
    rate: number;
  }>;
  bonuses: Array<{
    originSkill: string;
    bonusSkill: string;
    startExp: number;
    endExp: number;
    end: boolean;
    ratio: number;
  }>;
};

export type WiseOldManEhbBossRate = {
  boss: string;
  rate: number;
};

export type AdjustedEfficiency = {
  ehp: number;
  ehb: number;
};

function skillKeyForWiseOldMan(key: string) {
  const skill = key.replace(/^skill\./, "");
  return skill === "runecraft" ? "runecrafting" : skill;
}

function activityKeyForWiseOldMan(key: string) {
  return key.replace(/^activity\./, "");
}

function hoursForXp(xp: number, methods: WiseOldManEhpSkillRate["methods"]) {
  const orderedMethods = [...methods]
    .filter((method) => method.rate > 0)
    .sort((left, right) => left.startExp - right.startExp);
  let hours = 0;

  for (const [index, method] of orderedMethods.entries()) {
    if (xp <= method.startExp) continue;

    const nextMethod = orderedMethods[index + 1];
    const segmentEnd = Math.min(xp, nextMethod?.startExp ?? xp);
    if (segmentEnd > method.startExp) {
      hours += (segmentEnd - method.startExp) / method.rate;
    }
  }

  return hours;
}

export function calculateAdjustedEfficiency(
  skills: CanonicalSkill[],
  activities: CanonicalActivity[],
  ehpRates: WiseOldManEhpSkillRate[],
  ehbRates: WiseOldManEhbBossRate[],
): AdjustedEfficiency {
  const xpBySkill = new Map<string, number>();
  for (const skill of skills) {
    const xp = skill.xp.value ?? 0;
    xpBySkill.set(skillKeyForWiseOldMan(skill.key), Math.max(0, xp));
  }

  const effectiveXpBySkill = new Map(xpBySkill);
  for (const rate of ehpRates) {
    for (const bonus of rate.bonuses) {
      const originXp = xpBySkill.get(bonus.originSkill) ?? 0;
      const eligibleXp = Math.max(
        0,
        Math.min(originXp, bonus.endExp) - bonus.startExp,
      );
      const currentBonusXp = effectiveXpBySkill.get(bonus.bonusSkill) ?? 0;
      effectiveXpBySkill.set(
        bonus.bonusSkill,
        Math.max(0, currentBonusXp - eligibleXp * bonus.ratio),
      );
    }
  }

  const ehp = ehpRates.reduce((total, rate) => {
    const xp = effectiveXpBySkill.get(rate.skill) ?? 0;
    return total + hoursForXp(xp, rate.methods);
  }, 0);

  const scoreByBoss = new Map<string, number>();
  for (const activity of activities) {
    if (activity.category !== "bossing") continue;
    scoreByBoss.set(
      activityKeyForWiseOldMan(activity.key),
      Math.max(0, activity.score.value ?? 0),
    );
  }

  const ehb = ehbRates.reduce((total, rate) => {
    if (rate.rate <= 0) return total;
    return total + (scoreByBoss.get(rate.boss) ?? 0) / rate.rate;
  }, 0);

  return { ehp, ehb };
}

export function shouldUseIronmanEfficiencyRates(accountTypeKey?: string) {
  if (!accountTypeKey) return false;
  const normalized = accountTypeKey.toLowerCase();
  return (
    normalized.includes("group_ironman") || normalized.includes("group ironman")
  );
}
