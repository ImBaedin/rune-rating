import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { type CSSProperties, useRef } from "react";
import type { AtlasSectionId } from "./atlasData";
import {
  type AtlasJumpDestination,
  atlasJumpSections,
} from "./atlasNavigation";

export function AtlasJumpMenu({
  section,
  label,
  icon,
  color,
  active,
  onNavigate,
}: {
  section: AtlasSectionId;
  label: string;
  icon: string;
  color: string;
  active: boolean;
  onNavigate: (destination: AtlasJumpDestination) => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const options = atlasJumpSections.find(
    (entry) => entry.id === section,
  )?.options;

  return (
    <div
      ref={anchor}
      className="atlas-category-tab"
      data-active={active}
      style={{ "--category-color": color } as CSSProperties}
    >
      <button
        type="button"
        className="atlas-category-overview"
        aria-pressed={active}
        onClick={() => onNavigate({ section })}
      >
        <img
          className="atlas-category-icon"
          src={icon}
          alt=""
          width={18}
          height={18}
        />
        <span>{label}</span>
      </button>
      <Menu.Root modal={false}>
        <Menu.Trigger
          className="atlas-category-expand"
          aria-label={`${label} subsections`}
        >
          <ChevronDown size={13} aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            className="atlas-subsection-positioner"
            anchor={anchor}
            side="bottom"
            align="start"
            sideOffset={4}
          >
            <Menu.Popup
              className="atlas-subsection-menu"
              aria-label={`${label} subsections`}
            >
              {options?.map((option) => {
                const isPath =
                  option.destination.groupId !== undefined &&
                  option.destination.lane !== undefined;
                const itemLabel = isPath
                  ? option.label.split(" / ").slice(1).join(" / ")
                  : option.label;
                let kind = "overview";
                if (isPath) kind = "path";
                else if (option.id.startsWith("group/")) kind = "group";
                return (
                  <Menu.Item
                    key={option.id}
                    className="atlas-subsection-item"
                    data-kind={kind}
                    aria-label={option.label}
                    label={itemLabel}
                    onClick={() => onNavigate(option.destination)}
                  >
                    {itemLabel}
                  </Menu.Item>
                );
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
