import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { type AppView, navGroups, navViewByLabel } from "../navigation";

export function Sidebar({
  isOpen,
  onClose,
  skillCount,
  getPath,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  skillCount: number | null;
  getPath: (view: AppView) => string;
  onNavigate: () => void;
}) {
  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">
          <span />
          <span />
        </div>
        <div>
          <strong>RuneRating</strong>
          <small>COMPARE INTELLIGENCE</small>
        </div>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>

      <nav>
        {navGroups.map((group, groupIndex) => (
          <div
            className="nav-group"
            key={group.label ?? `primary-${groupIndex}`}
          >
            {group.label && <p className="nav-label">{group.label}</p>}
            {group.items.map(([label, Icon]) => {
              const view = navViewByLabel[label];
              if (!view) return null;
              return (
                <Link
                  to={getPath(view)}
                  activeOptions={{ exact: true }}
                  className="nav-item"
                  key={label}
                  onClick={onNavigate}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{label}</span>
                  {label === "Skills" && <small>{skillCount ?? "—"}</small>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
