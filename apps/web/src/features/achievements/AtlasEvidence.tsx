import { api } from "@rune-rating/backend/convex/_generated/api";
import type { AchievementEvidence } from "@rune-rating/domain/achievements";
import { useQuery } from "convex/react";
import { AtlasCollectionLog } from "./AtlasCollectionLog";
import { AtlasSourceFreshness } from "./AtlasSourceFreshness";

function EvidenceName({
  item,
  onSelect,
}: {
  item: { label: string; milestoneId?: string };
  onSelect: (id: string) => void;
}) {
  const id = item.milestoneId;
  return id ? (
    <button
      type="button"
      className="atlas-evidence-link"
      onClick={() => onSelect(id)}
    >
      {item.label}
      <span aria-hidden="true"> ↗</span>
    </button>
  ) : (
    <span>{item.label}</span>
  );
}

function label(value: string) {
  return value
    .replace(/^collection\.item\./, "Item ")
    .replace(/^collection\.page\./, "")
    .replace(/^combatTasks\.boss\./, "")
    .replace(/^skill[s]?\./, "")
    .replace(/^activity\./, "")
    .replace(/[._]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}
function evidenceValue(item: AchievementEvidence) {
  if (item.current === null) return "Unknown";
  if (item.key.startsWith("quest."))
    return (
      ["Not started", "Quest started", "Quest completed"][item.current] ??
      "Unknown"
    );
  if (item.key.startsWith("diary."))
    return item.current ? "Tier completed" : "Not completed";
  const count = `${item.current.toLocaleString()}${item.met === null ? " confirmed" : ""}`;
  return item.target === null
    ? count
    : `${count} / ${item.target.toLocaleString()}`;
}

export function AtlasEvidence({
  rsn,
  nodeId,
  onSelect,
}: {
  rsn: string;
  nodeId: string;
  onSelect: (id: string) => void;
}) {
  const result = useQuery(api.achievements.detail, { rsn, nodeId });
  if (result === undefined)
    return <p className="atlas-evidence-note">Loading progress…</p>;
  if (!result)
    return (
      <p className="atlas-evidence-note">Progress is not available yet.</p>
    );
  return (
    <section className="atlas-account-evidence" aria-label="Your progress">
      <span className="atlas-overline">YOUR PROGRESS</span>
      {result.reason && <p>{result.reason}</p>}
      {result.current !== null && result.target !== null && (
        <p className="atlas-evidence-total">
          {result.collectionLog ? (
            <>
              {result.current} <span>of</span> {result.target}{" "}
              <span>items logged</span>
            </>
          ) : (
            evidenceValue(result)
          )}
        </p>
      )}
      {result.collectionLog ? (
        <AtlasCollectionLog items={result.collectionLog.items} />
      ) : (
        result.key.startsWith("collection.page.") && (
          <p>Item-level details are not available for this page yet.</p>
        )
      )}
      {result.breakdown && (
        <div className="atlas-evidence-breakdown">
          <h3 className="atlas-overline">{result.breakdown.label}</h3>
          <ul>
            {result.breakdown.items.map((item) => {
              const remaining = Math.max(0, item.target - item.current);
              const unit = result.breakdown?.unit;
              return (
                <li key={item.key}>
                  <strong>
                    <EvidenceName item={item} onSelect={onSelect} />
                  </strong>
                  <span>
                    {item.current.toLocaleString()} /{" "}
                    {item.target.toLocaleString()} {unit}
                  </span>
                  <small>
                    {remaining === 0
                      ? "Completed"
                      : `${remaining.toLocaleString()} ${unit} remaining`}
                  </small>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {result.evidence.length > 1 && (
        <ul>
          {[
            ...new Map(
              result.evidence.map((item) => [item.key, item]),
            ).values(),
          ].map((item) => (
            <li
              key={item.key}
              data-met={item.met === null ? "unknown" : String(item.met)}
            >
              <span>{label(item.label)}</span>
              <span>{evidenceValue(item)}</span>
            </li>
          ))}
        </ul>
      )}
      {result.contributors && (
        <div className="atlas-evidence-contributors">
          <h3 className="atlas-overline">{result.contributors.label}</h3>
          {result.contributors.items.length ? (
            <ul>
              {result.contributors.items.map((item) => (
                <li key={item.key} data-met="true">
                  <span aria-hidden="true">✓</span>
                  <EvidenceName item={item} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          ) : (
            <p>None recorded yet.</p>
          )}
        </div>
      )}
      {result.readiness && result.met !== true && (
        <details className="atlas-readiness-evidence" open>
          <summary>Prerequisite check</summary>
          <p>
            {result.readiness.met === true
              ? "Account prerequisites are met. Bring the supplies listed in the Wiki guide and prepare for the required encounters."
              : result.readiness.met === false
                ? "Some prerequisites are not yet met."
                : "Some prerequisites cannot be verified from the available data."}
          </p>
          <ul>
            {[
              ...new Map(
                result.readiness.evidence.map((item) => [item.key, item]),
              ).values(),
            ].map((item) => (
              <li
                key={item.key}
                data-met={item.met === null ? "unknown" : String(item.met)}
              >
                <span>
                  {label(item.label)}
                  {item.reason && <small>{item.reason}</small>}
                </span>
                <span>{evidenceValue(item)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <AtlasSourceFreshness sources={result.sourceFreshness ?? []} />
    </section>
  );
}
