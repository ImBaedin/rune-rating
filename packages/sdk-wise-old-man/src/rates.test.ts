import { describe, expect, test } from "bun:test";
import {
  fetchWiseOldManEhbRates,
  fetchWiseOldManEhpRates,
} from "./rates";
import type { WiseOldManRequestError } from "./player";

describe("Wise Old Man efficiency rates", () => {
  test("fetches EHP skill method and bonus rates", async () => {
    const rates = await fetchWiseOldManEhpRates("ironman", {
      fetch: async () =>
        Response.json([
          {
            skill: "mining",
            methods: [{ startExp: 0, rate: 100_000 }],
            bonuses: [
              {
                originSkill: "mining",
                bonusSkill: "smithing",
                startExp: 0,
                endExp: 200_000_000,
                end: false,
                ratio: 0.1,
              },
            ],
          },
        ]),
    });

    expect(rates).toMatchObject([
      {
        skill: "mining",
        methods: [{ startExp: 0, rate: 100_000 }],
        bonuses: [{ bonusSkill: "smithing", ratio: 0.1 }],
      },
    ]);
  });

  test("fetches EHB boss rates", async () => {
    const rates = await fetchWiseOldManEhbRates("ironman", {
      fetch: async () =>
        Response.json([
          {
            boss: "zulrah",
            rate: 45,
          },
        ]),
    });

    expect(rates).toEqual([{ boss: "zulrah", rate: 45 }]);
  });

  test("maps a rate limit to the shared WOM request error", async () => {
    expect(
      fetchWiseOldManEhbRates("ironman", {
        fetch: async () => new Response(null, { status: 429 }),
      }),
    ).rejects.toMatchObject({
      code: "rateLimited",
    } satisfies Partial<WiseOldManRequestError>);
  });
});
