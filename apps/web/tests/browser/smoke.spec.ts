import { expect, test } from "@playwright/test";

const comparison = "/compare/GIM%20Wamuu/Starmie%20Iron";
const views = [
  "",
  "skills",
  "xp-timeline",
  "efficiency",
  "activity",
  "quests",
  "achievement-diaries",
  "combat-achievements",
  "bossing",
  "clues",
  "minigames",
  "collections",
];

for (const view of views) {
  test(`comparison direct load: ${view || "overview"}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${comparison}/${view}`);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByText("RuneRating could not load this page."),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("public headers link to a comparison and rating URL reset follows history", async ({
  page,
}) => {
  for (const path of ["/", "/leaderboard", "/rating"]) {
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Pause motion" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Compare", exact: true }).first(),
    ).toHaveAttribute("href", /\/compare\//);
  }
  await page.goto("/rating?rsn=GIM%20Wamuu");
  const input = page.getByRole("textbox").first();
  await expect(input).toHaveValue("GIM Wamuu");
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Rating", exact: true })
    .click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeDisabled();
  await page.goBack();
  await expect(input).toHaveValue("GIM Wamuu");
  await page.goForward();
  await expect(input).toHaveValue("");
});

test("leaderboard filters are shareable and empty search is explained", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  await expect(
    page.getByRole("button", { name: "Pause motion" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Ironman", exact: true }).click();
  await expect(page).toHaveURL(/account=ironman/);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Ironman", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("textbox", { name: "Search RSN" })
    .fill("invalid.name.too.long");
  await expect(page.getByRole("status")).toContainText("Use 1–12");
  await page.getByRole("textbox", { name: "Search RSN" }).fill("zzemptyzz");
  await expect(page.getByRole("status")).toHaveText(
    "No matching rated profiles yet",
  );
});

test("rating dialog closes with Escape and restores focus", async ({
  page,
}) => {
  await page.goto("/rating?rsn=GIM%20Wamuu");
  const trigger = page
    .getByRole("button", { name: /How.*(works|calculated)|rating system/i })
    .first();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("timeline range survives reload and metric picker supports keyboard", async ({
  page,
}) => {
  await page.goto(`${comparison}/xp-timeline`);
  await expect(
    page.locator('[aria-label="Data source health"]'),
  ).not.toContainText("waiting");
  await page.getByRole("radio", { name: "7d", exact: true }).click();
  await expect(page).toHaveURL(/range=7d/);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "7d", exact: true }),
  ).toBeChecked();
  await expect(
    page.locator('[aria-label="Data source health"]'),
  ).not.toContainText("waiting");
  const metric = page
    .getByRole("combobox", { name: /Metric: Total XP/ })
    .first();
  await metric.click();
  await expect(metric).toHaveAttribute("aria-expanded", "true");
  const search = page.getByRole("combobox", { name: "Search timeline skills" });
  await search.fill("Attack");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("combobox", { name: /Metric: Attack/ }).first(),
  ).toBeVisible();
});

test("granular collection lookup", async ({ page }) => {
  await page.goto(`${comparison}/collections`);
  await expect(
    page.locator('[aria-label="Data source health"]'),
  ).not.toContainText("waiting");
  await page
    .getByRole("searchbox", { name: /search/i })
    .last()
    .fill("Dragon warhammer");
  await expect(
    page.getByText("Dragon warhammer", { exact: true }).first(),
  ).toBeVisible();
});

test("decorations survive unavailable WebGL and runtime reduced motion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.includes("webgl")) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(
    page.getByRole("button", { name: "Resume motion" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume motion" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Motion reduced" }),
  ).toBeVisible();
  await expect(page.locator(".faulty-terminal-container canvas")).toHaveCount(
    0,
  );
});

test("rating PNG export downloads an image", async ({ page }) => {
  await page.goto("/rating?rsn=GIM%20Wamuu");
  const exportButton = page.getByRole("button", { name: "Export PNG" });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(await download.failure()).toBeNull();
});

test("OG rating endpoint returns a PNG", async ({ request }) => {
  const response = await request.get("/og/rating/GIM%20Wamuu");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const body = await response.body();
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
});

test("player autocomplete accepts a recent name with the keyboard", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "rune-rating:player-lookups",
      JSON.stringify(["GIM Wamuu", "Starmie Iron"]),
    );
  });
  await page.goto(`${comparison}/skills`);
  await expect(
    page.locator('[aria-label="Data source health"]'),
  ).not.toContainText("waiting");
  const player = page.getByRole("combobox", { name: "Player A RSN" });
  await player.fill("Star");
  await expect(
    page.getByRole("option", { name: "Starmie Iron" }),
  ).toBeVisible();
  await player.press("ArrowDown");
  await player.press("Enter");
  await expect(player).toHaveValue("Starmie Iron");
  // No submit: suggestion selection must not navigate or create another profile.
  await expect(page).toHaveURL(/GIM%20Wamuu\/Starmie%20Iron\/skills/);
});

test("clipboard failures and cancelled native sharing keep the rating usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    });
  });
  await page.goto("/rating?rsn=GIM%20Wamuu");
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeEnabled();
  const rankImage = page.locator(".share-card-identity img");
  const size = await rankImage.boundingBox();
  expect(size).not.toBeNull();
  expect(Math.abs((size?.width ?? 0) - (size?.height ?? 0))).toBeLessThan(1);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not copy the link",
  );
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeEnabled();
});
