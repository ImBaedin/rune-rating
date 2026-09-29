import type { AchievementCollectionLog } from "@rune-rating/domain/achievements";
import { Package } from "lucide-react";
import { useState } from "react";

function ItemIcon({
  item,
}: {
  item: AchievementCollectionLog["items"][number];
}) {
  const [source, setSource] = useState(0);
  const wikiNames = [
    ...new Set([
      item.label,
      item.label.charAt(0) + item.label.slice(1).toLowerCase(),
    ]),
  ];
  const sources = [
    ...wikiNames.map(
      (name) =>
        `https://oldschool.runescape.wiki/w/Special:Redirect/file/${encodeURIComponent(`${name}.png`)}`,
    ),
    `https://secure.runescape.com/m=itemdb_oldschool/obj_sprite.gif?id=${item.itemId}`,
  ];
  return (
    <span className="atlas-log-item-icon">
      {source < sources.length ? (
        <img
          src={sources[source]}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setSource(source + 1)}
        />
      ) : (
        <Package size={20} aria-hidden="true" />
      )}
    </span>
  );
}

function LogItems({ items }: AchievementCollectionLog) {
  return (
    <ul className="atlas-log-items">
      {items.map((item) => (
        <li key={item.key} data-met={String(item.obtained)}>
          <ItemIcon item={item} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function AtlasCollectionLog({ items }: AchievementCollectionLog) {
  const missing = items.filter((item) => !item.obtained);
  const collected = items.filter((item) => item.obtained);
  return (
    <div className="atlas-collection-log">
      {missing.length ? (
        <section aria-label="Missing log items">
          <h3 className="atlas-overline">Missing items ({missing.length})</h3>
          <LogItems items={missing} />
        </section>
      ) : (
        <p className="atlas-log-complete">Every item on this page is logged.</p>
      )}
      {collected.length > 0 && (
        <details>
          <summary>Show collected ({collected.length})</summary>
          <LogItems items={collected} />
        </details>
      )}
    </div>
  );
}
