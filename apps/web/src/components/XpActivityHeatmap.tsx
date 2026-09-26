import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, useId, useState } from "react";
import { SegmentedControl } from "./primitives/SelectionControls";

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
        <SegmentedControl
          label="Heatmap display"
          className="segmented"
          value={mode}
          options={[
            ["perPlayer", "Per Player"],
            ["combined", "Combined"],
          ]}
          onChange={setMode}
        />
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
  const instructionsId = useId();
  const [activeIndex, setActiveIndex] = useState(values.days.length - 1);
  const focusedIndex = Math.min(activeIndex, values.days.length - 1);
  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next: number;
    switch (event.key) {
      case "ArrowUp":
        next = index - 1;
        break;
      case "ArrowDown":
        next = index + 1;
        break;
      case "ArrowLeft":
        next = index - 7;
        break;
      case "ArrowRight":
        next = index + 7;
        break;
      case "Home":
        next = event.ctrlKey ? 0 : index % 7;
        break;
      case "End":
        next = event.ctrlKey
          ? values.days.length - 1
          : index + Math.floor((values.days.length - 1 - index) / 7) * 7;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next < 0 || next >= values.days.length) return;
    setActiveIndex(next);
    event.currentTarget
      .closest("table")
      ?.querySelector<HTMLButtonElement>(`button[data-day-index="${next}"]`)
      ?.focus();
  };
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
      <p id={instructionsId} className="sr-only">
        Use up and down arrows to move one day, left and right arrows to move
        one week. Home and End move to the first or last week in the row;
        Control+Home and Control+End reach the first or last day. Press Enter
        for details or Tab to leave the calendar.
      </p>
      <Popover.Root<HeatmapCell>>
        {({ payload }) => (
          <>
            <table
              // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: ARIA grid on a table preserves native cell semantics and adds roving keyboard focus.
              role="grid"
              aria-label={`${name} daily XP`}
              aria-describedby={instructionsId}
              aria-rowcount={7}
              aria-colcount={values.columns}
              className={`xp-heatmap-grid ${accent}`}
              style={style}
            >
              <tbody className="xp-heatmap-weekdays">
                {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                  <tr
                    aria-rowindex={weekday}
                    className="xp-heatmap-weekday"
                    key={weekday}
                  >
                    {values.days.map((cell, index) =>
                      cell.row === weekday ? (
                        <td
                          aria-colindex={cell.column}
                          className="xp-heatmap-slot"
                          key={cell.id}
                          style={{ gridColumn: cell.column, gridRow: cell.row }}
                        >
                          <Popover.Trigger
                            data-day-index={index}
                            tabIndex={index === focusedIndex ? 0 : -1}
                            onFocus={() => setActiveIndex(index)}
                            onKeyDown={(event) => moveFocus(event, index)}
                            payload={cell}
                            aria-label={`${name}, ${formatDate(cell.date)}, ${cell.gained === null ? "No data" : `${formatCompact(cell.gained)} XP gained`}`}
                            className={`xp-heatmap-cell intensity-${cell.value}`}
                            openOnHover
                            delay={250}
                            closeDelay={120}
                          />
                        </td>
                      ) : null,
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Popover.Portal>
              <Popover.Positioner
                className="rr-popup-positioner"
                side="top"
                sideOffset={8}
              >
                <Popover.Popup className="rr-popup rr-info-popup rr-heatmap-popup">
                  <Popover.Title>{name}</Popover.Title>
                  <Popover.Description>
                    {payload
                      ? `${formatDate(payload.date)} · ${payload.gained === null ? "No data" : `${formatCompact(payload.gained)} XP gained`}`
                      : ""}
                  </Popover.Description>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </>
        )}
      </Popover.Root>
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
