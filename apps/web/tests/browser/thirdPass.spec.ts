import { expect, test } from "@playwright/test";

const comparison = "/compare/GIM%20Wamuu/Starmie%20Iron";

test("efficiency stays within the viewport across phone, tablet, and desktop breakpoints", async ({
  page,
}) => {
  await page.goto(`${comparison}/efficiency`);
  await expect(
    page.getByRole("heading", { name: "EHP / Efficiency", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [
    320, 360, 720, 721, 768, 820, 821, 1024, 1100, 1101, 1280,
  ]) {
    await page.setViewportSize({ width, height: 800 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  }
});

test("keyboard skip links focus visible content below sticky headers", async ({
  page,
}) => {
  for (const path of ["/leaderboard", `${comparison}/skills`]) {
    await page.goto(path);
    const skip = page.getByRole("link", {
      name: path === "/leaderboard" ? "Skip to content" : "Skip to comparison",
      exact: true,
    });
    await skip.focus();
    await skip.press("Enter");
    await expect(
      page.locator(
        path === "/leaderboard" ? "#public-content" : "#main-content",
      ),
    ).toBeFocused();
    const bounds = await page.evaluate(() => ({
      header: document.querySelector("header")?.getBoundingClientRect().bottom,
      title: document.querySelector("h1")?.getBoundingClientRect().top,
    }));
    expect(bounds.header).toBeDefined();
    expect(bounds.title).toBeGreaterThanOrEqual(
      Math.max(0, bounds.header ?? 0),
    );
  }
});

test("production social card contains the rank artwork, not an empty image slot", async ({
  page,
  request,
}) => {
  const response = await request.get("/og/rating/GIM%20Wamuu");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const dataUrl = `data:image/png;base64,${(await response.body()).toString("base64")}`;
  await page.goto("/");
  const brightPixels = await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    context.drawImage(image, 0, 0);
    // The rank emblem occupies this region; background/rings alone are dark.
    const pixels = context.getImageData(830, 120, 280, 250).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        Math.max(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0) > 170
      )
        count++;
    }
    return count;
  }, dataUrl);
  expect(brightPixels).toBeGreaterThan(100);
});
