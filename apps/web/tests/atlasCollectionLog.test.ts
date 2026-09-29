import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AtlasCollectionLog } from "../src/features/achievements/AtlasCollectionLog";

test("missing log items come first with icons and collected items default to collapsed", () => {
  const html = renderToStaticMarkup(
    createElement(AtlasCollectionLog, {
      items: [
        {
          key: "collected",
          label: "Collected reward",
          itemId: 1,
          obtained: true,
        },
        { key: "missing", label: "Missing reward", itemId: 2, obtained: false },
      ],
    }),
  );
  expect(html).toContain('aria-label="Missing log items"');
  expect(html.indexOf("Missing reward")).toBeLessThan(
    html.indexOf("Show collected (1)"),
  );
  expect(html).toContain("Special:Redirect/file/Missing%20reward.png");
  expect(html).toContain("<details>");
  expect(html).not.toContain("<details open");
});

test("fully completed logs offer their collected list without an empty missing section", () => {
  const html = renderToStaticMarkup(
    createElement(AtlasCollectionLog, {
      items: [
        {
          key: "collected",
          label: "Collected reward",
          itemId: 1,
          obtained: true,
        },
      ],
    }),
  );
  expect(html).toContain("Every item on this page is logged.");
  expect(html).toContain("Show collected (1)");
  expect(html).not.toContain("Missing items");
});
