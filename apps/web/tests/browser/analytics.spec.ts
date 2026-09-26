import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

type CapturedEvent = { event: string; properties: Record<string, unknown> };
const events: CapturedEvent[] = [];
let server: Server;
let origin: string;

test.beforeAll(async () => {
  const directory = mkdtempSync(join(tmpdir(), "rune-analytics-test-"));
  let script: string;
  try {
    const output = join(directory, "harness.js");
    execFileSync("bun", [
      "build",
      "tests/browser/analyticsHarness.ts",
      "--target=browser",
      `--outfile=${output}`,
    ]);
    script = readFileSync(output, "utf8");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  // A local receiver sees real fetch AND sendBeacon bodies in every engine.
  // WebKit does not expose beacon postData through Playwright route interception.
  server = createServer((request, response) => {
    if (request.url?.startsWith("/e/")) {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        events.push(...(Array.isArray(payload) ? payload : [payload]));
        response.writeHead(200, { "content-type": "application/json" });
        response.end("{}");
      });
    } else if (request.url === "/harness.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(script);
    } else {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        '<title>SecretPlayer RuneRating</title><script type="module" src="/harness.js"></script>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server port");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

test("actual analytics transport excludes raw RSNs on pageview, events and pageleave", async ({
  page,
}) => {
  await page.goto(`${origin}/rating?rsn=SecretPlayer`);
  await expect(page.locator("html")).toHaveAttribute(
    "data-analytics-harness",
    "initialized",
  );
  await expect
    .poll(() => events.map((event) => event.event))
    .toEqual(
      expect.arrayContaining([
        "$pageview",
        "share_or_copy_clicked",
        "$pageleave",
      ]),
    );
  expect(JSON.stringify(events)).not.toContain("SecretPlayer");
  for (const event of events) {
    expect(event.properties.token).toBe("test-project-token");
    expect(event.properties).not.toHaveProperty("$current_url");
    expect(event.properties).not.toHaveProperty("$pathname");
    expect(event.properties).not.toHaveProperty("title");
  }
  expect(
    events.find((event) => event.event === "$pageview")?.properties.rsn_hash,
  ).toBe("hashed-name");
});
