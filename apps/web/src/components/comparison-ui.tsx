import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  type LucideIcon,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
import "./comparison-ui.css";

export type PlayerSide = "left" | "right";
export type ComparisonTone =
  | PlayerSide
  | "blue"
  | "green"
  | "amber"
  | "orange"
  | "purple"
  | "violet"
  | "slate"
  | "muted"
  | "tie";

export const playerAccentClass = (side: PlayerSide) =>
  side === "left" ? "blue" : "green";

export function sideLabel(
  side: PlayerSide | "tie" | "indeterminate" | null | undefined,
  names: [string, string],
  fallback = "Unavailable",
) {
  if (side === "left") return names[0];
  if (side === "right") return names[1];
  if (side === "tie") return "Tie";
  return fallback;
}

export function sideTone(
  side: PlayerSide | "tie" | "indeterminate" | null | undefined,
) {
  if (side === "left") return "left";
  if (side === "right") return "right";
  if (side === "tie") return "tie";
  return "muted";
}

export function PageHeader({
  title,
  meta,
  controls,
}: {
  title: string;
  meta?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <header className="rr-page-header">
      <div className="rr-page-header-main">
        <h1>{title}</h1>
        {meta ? <div className="rr-page-header-meta">{meta}</div> : null}
      </div>
      {controls ? (
        <div className="rr-page-header-controls">{controls}</div>
      ) : null}
    </header>
  );
}

export function SourceChip({
  label,
  status = "ok",
  href,
}: {
  label: string;
  status?: "ok" | "warn" | "muted";
  href?: string;
}) {
  const content = (
    <>
      <span>{label.slice(0, 1).toUpperCase()}</span>
      {label}
      <i className={status} aria-hidden="true" />
    </>
  );

  if (href) {
    return (
      <a
        className="rr-source-chip"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return <div className="rr-source-chip">{content}</div>;
}

export function DataNotice({
  children,
  tone = "warning",
  icon: Icon = Info,
}: {
  children: ReactNode;
  tone?: "warning" | "error" | "info";
  icon?: LucideIcon;
}) {
  return (
    <div className={`rr-data-notice ${tone}`}>
      <Icon size={15} aria-hidden="true" />
      {children}
    </div>
  );
}

export function FilterBar({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <section
      className={`rr-filter-bar ${className}`.trim()}
      aria-label={label ?? "Filters"}
    >
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={`rr-segmented ${className}`.trim()}>
      <legend>{label}</legend>
      {options.map(([option, text]) => (
        <button
          type="button"
          className={value === option ? "active" : ""}
          onClick={() => onChange(option)}
          key={option}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  compact = false,
  className = "",
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`rr-select-field ${compact ? "compact" : ""} ${className}`.trim()}
    >
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => {
          const raw = event.target.value;
          const selected = options.find(([option]) => String(option) === raw);
          onChange((selected?.[0] ?? raw) as T);
        }}
      >
        {options.map(([option, text]) => (
          <option value={option} key={String(option)}>
            {text}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

export function SearchField({
  value,
  placeholder,
  onChange,
  label = "Search",
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="rr-search-field">
      <Search size={15} aria-hidden="true" />
      <input
        aria-label={label}
        type="search"
        name={`${label.toLocaleLowerCase().replaceAll(" ", "-")}-search`}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function CheckboxField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="rr-checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}

export function ComparisonKpiCard({
  label,
  value,
  detail,
  tone = "blue",
  icon,
  isLoading = false,
  loadingValue = "...",
  loadingDetail = "Loading current snapshots",
  iconPosition = "start",
  children,
  className = "",
}: {
  label: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  tone?: ComparisonTone;
  icon?: ReactNode;
  isLoading?: boolean;
  loadingValue?: ReactNode;
  loadingDetail?: ReactNode;
  iconPosition?: "start" | "end";
  children?: ReactNode;
  className?: string;
}) {
  const normalizedIconPosition =
    iconPosition === "end" ? "start" : iconPosition;

  return (
    <article
      className={`rr-kpi-card rr-tone-${tone} icon-${normalizedIconPosition} ${className}`.trim()}
    >
      {icon && normalizedIconPosition === "start" ? (
        <span className="rr-kpi-icon">{icon}</span>
      ) : null}
      <div className="rr-kpi-content">
        <span className="rr-kpi-label">{label}</span>
        {children ?? (
          <>
            <strong>{isLoading ? loadingValue : value}</strong>
            {detail !== undefined ? (
              <div className="rr-kpi-detail">
                {isLoading ? loadingDetail : detail}
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

export function PairedMetricCard({
  label,
  left,
  right,
  delta,
  names,
  formatter,
  deltaFormatter = formatter,
  isLoading = false,
  invertDelta = false,
  nullDetail = "Awaiting both snapshots",
  gapLabel = "gap",
}: {
  label: string;
  left: number | null;
  right: number | null;
  delta: number | null;
  names: [string, string];
  formatter: (value: number | null | undefined) => string;
  deltaFormatter?: (value: number | null | undefined) => string;
  isLoading?: boolean;
  invertDelta?: boolean;
  nullDetail?: string;
  gapLabel?: string;
}) {
  const displayedDelta = invertDelta && delta !== null ? -delta : delta;
  const tone = displayedDelta && displayedDelta < 0 ? "right" : "left";

  return (
    <ComparisonKpiCard label={label} tone={tone} className="rr-paired-metric">
      <strong className={tone === "right" ? "green" : "blue"}>
        {isLoading ? "..." : deltaFormatter(displayedDelta)}
        <small> {gapLabel}</small>
      </strong>
      <PlayerPairLine
        names={names}
        left={isLoading ? "..." : formatter(left)}
        right={isLoading ? "..." : formatter(right)}
      />
      <em>{delta === null ? nullDetail : names[0]}</em>
    </ComparisonKpiCard>
  );
}

export function PlayerPairLine({
  names,
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  names: [string, string];
  left: ReactNode;
  right: ReactNode;
  leftLabel?: ReactNode;
  rightLabel?: ReactNode;
}) {
  return (
    <dl className="rr-player-pair">
      <div>
        <dt>
          <i className="blue" />
          <span>{leftLabel ?? names[0]}</span>
        </dt>
        <dd>{left}</dd>
      </div>
      <div>
        <dt>
          <i className="green" />
          <span>{rightLabel ?? names[1]}</span>
        </dt>
        <dd>{right}</dd>
      </div>
    </dl>
  );
}

export function Panel({
  children,
  className = "",
  as: Component = "article",
}: {
  children: ReactNode;
  className?: string;
  as?: "article" | "section" | "aside" | "div";
}) {
  return (
    <Component className={`rr-panel ${className}`.trim()}>{children}</Component>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  names,
  help: _help = false,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  names?: [string, string];
  help?: boolean;
  icon?: ReactNode;
}) {
  return (
    <header className="rr-panel-header">
      <div>
        <h2>
          {icon}
          {title}
        </h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ?? (names ? <PlayerLegend names={names} /> : null)}
    </header>
  );
}

export function PlayerLegend({ names }: { names: [string, string] }) {
  return (
    <div className="rr-player-legend">
      <span>
        <i className="blue" />
        {names[0]}
      </span>
      <span>
        <i className="green" />
        {names[1]}
      </span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rr-empty-state">{children}</div>;
}

export function Pagination({
  total,
  pageSize,
  currentPage,
  pageCount,
  itemLabel,
  onPrevious,
  onNext,
  variant = "icons",
}: {
  total: number;
  pageSize: number;
  currentPage: number;
  pageCount: number;
  itemLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  variant?: "icons" | "text";
}) {
  const start = total === 0 ? "0" : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  return (
    <div className="rr-pagination">
      <span>
        Showing {total === 0 ? start : `${start}-${end}`} of {total} {itemLabel}
      </span>
      <div>
        <button
          type="button"
          aria-label="Previous page"
          disabled={currentPage === 1}
          onClick={onPrevious}
        >
          {variant === "icons" ? <ChevronLeft size={14} /> : "Prev"}
        </button>
        <strong>{currentPage}</strong>
        <button
          type="button"
          aria-label="Next page"
          disabled={currentPage === pageCount}
          onClick={onNext}
        >
          {variant === "icons" ? <ChevronRight size={14} /> : "Next"}
        </button>
      </div>
    </div>
  );
}

export function PairChartTooltip({
  active,
  payload,
  label,
  names,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number | null;
    color?: string;
  }>;
  label?: ReactNode;
  names: [string, string];
  formatter: (value: number | null | undefined) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rr-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => {
        const side = entry.dataKey === "right" ? "right" : "left";
        return (
          <span key={String(entry.dataKey)}>
            <i
              className={playerAccentClass(side)}
              style={entry.color ? { background: entry.color } : undefined}
            />
            {side === "left" ? names[0] : names[1]}
            <b>{formatter(entry.value)}</b>
          </span>
        );
      })}
    </div>
  );
}
