import { describe, expect, test } from "bun:test";
import { fetchHiscores, type HiscoresRequestError } from "./client";
import { makeHiscoresFixture } from "./fixtures";

describe("fetchHiscores", () => {
  test("maps a broken source contract to invalidResponse", async () => {
    const fixture = makeHiscoresFixture();
    fixture.activities = fixture.activities
      .filter((activity) => activity.name !== "Mimic")
      .map((activity, id) => ({ ...activity, id }));

    const request = fetchHiscores("Fixture Player", {
      fetch: async () => Response.json(fixture),
    });

    await expect(request).rejects.toEqual(
      expect.objectContaining({
        name: "HiscoresRequestError",
        code: "invalidResponse",
      } satisfies Partial<HiscoresRequestError>),
    );
  });
});
