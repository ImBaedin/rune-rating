import { Info } from "lucide-react";
import { type CSSProperties, useState } from "react";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const dayMs = 24 * 60 * 60 * 1000;

const formatCompact = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : compactNumber.format(value);
const formatDate = (timestamp: number | null | undefined) =>
  timestamp === null || timestamp === undefined
    ? "—"
    : shortDateFormatter.format(timestamp);
const startOfDay = (timestamp: number) => Math.floor(timestamp / dayMs) * dayMs;

type HeatmapPoint = {
  date: number;
  leftGained: number | null;
  rightGained: number | null;
};
type GainKey = "leftGained" | "rightGained";
type HeatmapCell = {
  column: number;
  date: number;
  gained: number | null;
  id: string;
  row: number;
  value: number;
};
export type HeatmapModel = ReturnType<typeof heatmapValues>;

export function heatmapValues(
  points: HeatmapPoint[],
  keys: GainKey | GainKey[],
  idPrefix = Array.isArray(keys) ? keys.join("-") : keys,
) {
  const gainKeys = Array.isArray(keys) ? keys : [keys];
  const end = startOfDay(points.at(-1)?.date ?? Date.now());
  const start = end - 364 * dayMs;
  const byDay = new Map(
    points.map((point) => {
      const gains = gainKeys.map((key) => point[key]);
      const gained = gains.every((value) => value === null)
        ? null
        : gains.reduce<number>((total, value) => total + (value ?? 0), 0);
      return [startOfDay(point.date), gained];
    }),
  );
  const gains = Array.from(byDay.entries())
    .filter(([date]) => date >= start && date <= end)
    .map(([, value]) => value ?? 0);
  const maximum = Math.max(1, ...gains);
  const leadingDays = new Date(start).getDay();
  const days = Array.from({ length: 365 }, (_, index) => {
    const date = start + index * dayMs;
    const gained = byDay.get(date) ?? null;
    const value =
      gained === null || gained <= 0 ? 0 : Math.ceil((gained / maximum) * 5);
    const gridIndex = leadingDays + index;
    return {
      column: Math.floor(gridIndex / 7) + 1,
      date,
      gained,
      id: `${idPrefix}-${date}`,
      row: (gridIndex % 7) + 1,
      value,
    };
  });
  return {
    columns: Math.ceil((leadingDays + days.length) / 7),
    days,
  };
}

export function XpActivityHeatmap({
  names,
  valuesA,
  valuesB,
  valuesCombined,
}: {
  names: [string, string];
  valuesA: HeatmapModel;
  valuesB: HeatmapModel;
  valuesCombined: HeatmapModel;
}) {
  const [mode, setMode] = useState<"perPlayer" | "combined">("perPlayer");
  return (
    <article className="panel xp-heatmap">
      <div className="xp-chart-heading">
        <strong>XP Activity Heatmap</strong>
        <Info size={12} />
        <div className="segmented">
          <button
            type="button"
            className={mode === "perPlayer" ? "active" : ""}
            onClick={() => setMode("perPlayer")}
          >
            Per Player
          </button>
          <button
            type="button"
            className={mode === "combined" ? "active" : ""}
            onClick={() => setMode("combined")}
          >
            Combined
          </button>
        </div>
      </div>
      {mode === "combined" ? (
        <HeatmapRow
          name="Combined activity"
          values={valuesCombined}
          accent="combined"
        />
      ) : (
        <>
          <HeatmapRow name={names[0]} values={valuesA} accent="blue" />
          <HeatmapRow name={names[1]} values={valuesB} accent="green" />
        </>
      )}
    </article>
  );
}

export function HeatmapRow({
  name,
  values,
  accent,
}: {
  name: string;
  values: HeatmapModel;
  accent: "blue" | "green" | "combined";
}) {
  const style = {
    "--heatmap-columns": values.columns,
  } as CSSProperties;
  return (
    <div className="xp-heatmap-row">
      <div className="xp-heatmap-meta">
        <strong>{name}</strong>
        <span>
          Less <HeatmapLegend accent={accent} /> More
        </span>
      </div>
      <ul className={`xp-heatmap-grid ${accent}`} style={style}>
        {values.days.map((cell: HeatmapCell) => (
          <li
            className="xp-heatmap-slot"
            key={cell.id}
            style={{ gridColumn: cell.column, gridRow: cell.row }}
          >
            <button
              aria-label={`${name}, ${formatDate(cell.date)}, ${formatCompact(cell.gained)} XP gained`}
              className={`xp-heatmap-cell intensity-${cell.value}`}
              title={`${name}\n${formatDate(cell.date)}\n${formatCompact(cell.gained)} XP gained`}
              type="button"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeatmapLegend({ accent }: { accent: "blue" | "green" | "combined" }) {
  return (
    <span className={`xp-heatmap-legend ${accent}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((level) => (
        <i className={`intensity-${level}`} key={level} />
      ))}
    </span>
  );
}
