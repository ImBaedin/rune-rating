import type {
  CanonicalActivity,
  CanonicalSkill,
  CanonicalValue,
  HiscoresSnapshot,
} from "@rune-rating/domain";
import { z } from "zod";
import {
  activityCategory,
  HISCORES_ACTIVITY_NAMES,
  HISCORES_SKILL_NAMES,
} from "./manifest";

const skillSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string(),
  rank: z.number().int(),
  level: z.number().int(),
  xp: z.number().int(),
});

const activitySchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string(),
  rank: z.number().int(),
  score: z.number().int(),
});

const responseSchema = z.object({
  name: z.string().min(1),
  skills: z.array(skillSchema),
  activities: z.array(activitySchema),
});

export type HiscoresDto = z.infer<typeof responseSchema>;

export class HiscoresContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HiscoresContractError";
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("'", "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalValue(value: number): CanonicalValue {
  return value < 0
    ? { value: null, availabilityReason: "unranked" }
    : { value, availabilityReason: null };
}

function assertManifest(
  actual: ReadonlyArray<{ id: number; name: string }>,
  expected: readonly string[],
  type: string,
): void {
  if (actual.length !== expected.length) {
    throw new HiscoresContractError(
      `Expected ${expected.length} ${type} entries but received ${actual.length}.`,
    );
  }

  for (const [index, expectedName] of expected.entries()) {
    const entry = actual[index];
    if (!entry || entry.id !== index || entry.name !== expectedName) {
      throw new HiscoresContractError(
        `Unexpected ${type} at index ${index}; expected "${expectedName}" with id ${index}.`,
      );
    }
  }
}

export function parseHiscoresResponse(
  input: unknown,
  fetchedAt = Date.now(),
): HiscoresSnapshot {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) {
    throw new HiscoresContractError(
      `Invalid Hiscores response: ${parsed.error.message}`,
    );
  }

  assertManifest(parsed.data.skills, HISCORES_SKILL_NAMES, "skill");
  assertManifest(parsed.data.activities, HISCORES_ACTIVITY_NAMES, "activity");

  const skills: CanonicalSkill[] = parsed.data.skills.map((skill) => ({
    key: `skill.${slug(skill.name)}`,
    name: skill.name,
    rank: canonicalValue(skill.rank),
    level: canonicalValue(skill.level),
    xp: canonicalValue(skill.xp),
  }));

  const activities: CanonicalActivity[] = parsed.data.activities.map(
    (activity) => ({
      key: `activity.${slug(activity.name)}`,
      name: activity.name,
      category: activityCategory(activity.id),
      rank: canonicalValue(activity.rank),
      score: canonicalValue(activity.score),
    }),
  );

  return {
    source: "hiscores",
    displayRsn: parsed.data.name,
    fetchedAt,
    skills,
    activities,
  };
}
