import { HISCORES_ACTIVITY_NAMES, HISCORES_SKILL_NAMES } from "./manifest";

export function makeHiscoresFixture() {
  return {
    name: "Fixture Player",
    skills: HISCORES_SKILL_NAMES.map((name, id) => ({
      id,
      name: name as string,
      rank: id === 4 ? -1 : id + 1,
      level: id === 4 ? 1 : Math.min(id + 1, 99),
      xp: id === 4 ? -1 : id * 1_000,
    })),
    activities: HISCORES_ACTIVITY_NAMES.map((name, id) => ({
      id,
      name: name as string,
      rank: -1,
      score: id === 20 ? 0 : -1,
    })),
  };
}
