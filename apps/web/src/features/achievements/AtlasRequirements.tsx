import { ChevronRight, ExternalLink } from "lucide-react";
import type { AtlasDetailRequirement } from "./atlasData";

const groups = [
  { id: "skills", label: "Skill levels" },
  { id: "quests", label: "Quest requirements" },
  { id: "other", label: "Other requirements" },
] as const;

export function AtlasRequirements({
  requirements,
  onSelect,
}: {
  requirements: AtlasDetailRequirement[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="atlas-detail-requirements" aria-label="Requirements">
      {groups.map((group) => {
        const rows = requirements.filter(
          (requirement) => requirement.group === group.id,
        );
        if (!rows.length) return null;
        return (
          <details key={group.id} open={rows.length <= 6}>
            <summary>
              {group.label}
              <span>{rows.length}</span>
            </summary>
            <ul>
              {rows.map((requirement) => {
                const content = (
                  <span>
                    {requirement.label}
                    {requirement.note && <small>{requirement.note}</small>}
                  </span>
                );
                const milestoneId = requirement.milestoneId;
                const href = `https://oldschool.runescape.wiki/w/${requirement.wiki}`;
                return (
                  <li key={`${requirement.label}-${requirement.wiki}`}>
                    {milestoneId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelect(milestoneId)}
                        >
                          {content}
                          <ChevronRight size={13} />
                        </button>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="atlas-requirement-guide"
                          aria-label={`Guide for ${requirement.label}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </>
                    ) : (
                      <a href={href} target="_blank" rel="noreferrer">
                        {content}
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
