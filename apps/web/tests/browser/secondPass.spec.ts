import { expect, test } from "@playwright/test";

const comparison = "/compare/GIM%20Wamuu/Starmie%20Iron";

test("headers follow their intended scrolling behavior at each breakpoint", async ({
  page,
}) => {
  // A short viewport guarantees scrollable content even with a small leaderboard.
  await page.setViewportSize({
    width: page.viewportSize()?.width ?? 1280,
    height: 500,
  });
  for (const path of ["/leaderboard", `${comparison}/clues`]) {
    await page.goto(path);
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    await page.mouse.move(250, 400);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(100);
    const top = await header.evaluate((el) => el.getBoundingClientRect().top);
    // The taller comparison header deliberately scrolls away on phones.
    if (path === "/leaderboard" || (page.viewportSize()?.width ?? 0) > 820) {
      expect(Math.abs(top)).toBeLessThan(1);
    } else {
      expect(top).toBeLessThan(-100);
    }
  }
  if ((page.viewportSize()?.width ?? 0) > 820) {
    for (const width of [821, 900, 1024, 1120, 1280, 1440]) {
      await page.setViewportSize({ width, height: 500 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  }
});

test("social-preview comparison URL opens a valid comparison", async ({
  page,
}) => {
  await page.goto(comparison);
  const advertised = await page
    .locator('meta[property="og:url"]')
    .getAttribute("content");
  expect(advertised).toBeTruthy();
  const pathname = new URL(advertised ?? "").pathname;
  expect(pathname).toBe(comparison);
  await page.goto(pathname);
  await expect(
    page.getByRole("heading", {
      name: "That comparison URL contains an invalid RSN.",
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toBeVisible();
});

test("heatmaps have one Tab stop per player and arrow-key access to day details", async ({
  page,
}) => {
  await page.goto(`${comparison}/xp-timeline`);
  const left = page.getByRole("grid", { name: "GIM Wamuu daily XP" });
  const right = page.getByRole("grid", { name: "Starmie Iron daily XP" });
  await expect(left).toBeVisible();
  const active = left.locator('button[tabindex="0"]');
  await expect(active).toHaveCount(1);
  await expect(right.locator('button[tabindex="0"]')).toHaveCount(1);
  await expect(left.getByRole("button")).toHaveCount(365);
  await active.focus();
  const initialColumn = await active.evaluate((el) =>
    Number(el.closest("td")?.getAttribute("aria-colindex")),
  );
  await active.press("ArrowLeft");
  await expect(active).toBeFocused();
  expect(
    await active.evaluate((el) =>
      Number(el.closest("td")?.getAttribute("aria-colindex")),
    ),
  ).toBe(initialColumn - 1);
  await active.press("Control+Home");
  const firstLabel = await active.getAttribute("aria-label");
  await active.press("ArrowDown");
  await expect(active).not.toHaveAttribute("aria-label", firstLabel ?? "");
  await active.press("ArrowUp");
  await expect(active).toHaveAttribute("aria-label", firstLabel ?? "");
  await active.press("Control+End");
  await active.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(active).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(right.locator('button[tabindex="0"]')).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("clue targets require improving the named player's current rank", async ({
  page,
}) => {
  await page.goto(`${comparison}/clues`);
  const panel = page.locator(".clues-opportunity-panel");
  await expect(panel).toContainText("Unreached rank targets for Starmie Iron");
  await expect(page.locator(".clues-page")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const targets = await panel.locator(".clues-opportunity").all();
  if (!targets.length)
    await expect(panel).toContainText("No unreached targets");
  for (const target of targets) {
    const ranks = (await target.locator("div > small").innerText())
      .split("→")
      .map((value) => Number(value.replaceAll(",", "").trim()));
    expect(ranks[0]).toBeGreaterThan(ranks[1] ?? 0);
    expect(
      Number(
        (await target.locator("b").innerText())
          .replaceAll(",", "")
          .replace("Pass", "")
          .trim(),
      ),
    ).toBe((ranks[0] ?? 0) - (ranks[1] ?? 0));
  }
});

test("efficiency total chart uses five distinct axis positions and labels", async ({
  page,
}) => {
  await page.goto(`${comparison}/efficiency`);
  await page.getByRole("radio", { name: "EHB", exact: true }).check();
  const chart = page.getByRole("img", {
    name: "Effective hours comparison timeline",
  });
  await expect(chart).toBeVisible();
  const ticks = await chart
    .locator('text[text-anchor="end"]')
    .evaluateAll((els) =>
      els.map((el) => ({ label: el.textContent, y: el.getAttribute("y") })),
    );
  expect(ticks).toHaveLength(5);
  expect(new Set(ticks.map((tick) => tick.y)).size).toBe(5);
  expect(new Set(ticks.map((tick) => tick.label)).size).toBe(5);
});
