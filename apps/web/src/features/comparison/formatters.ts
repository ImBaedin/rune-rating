const fmt = new Intl.NumberFormat("en-US");
const percentFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export const formatValue = (value: number | null | undefined) =>
  value == null ? "—" : fmt.format(value);

export const formatDelta = (value: number | null | undefined) =>
  value == null
    ? "—"
    : `${value > 0 ? "+" : ""}${fmt.format(Object.is(value, -0) ? 0 : value)}`;

export const formatSigned = (value: number | null | undefined, suffix = "") =>
  value == null ? "—" : `${formatDelta(value)}${suffix}`;

export const formatRank = (value: number | null | undefined) =>
  value == null ? "Unranked" : `Rank ${formatValue(value)}`;

export const formatPercent = (value: number | null | undefined) =>
  value == null ? "—" : `${percentFmt.format(value)}%`;

export const formatLead = (value: number | null | undefined) => {
  if (value == null) return "—";
  if (value === 0) return "0";
  return `+${formatValue(Math.abs(value))}`;
};

export const formatCountOf = (value: number, max: number | undefined) =>
  max ? `${formatValue(value)} of ${formatValue(max)}` : formatValue(value);

export const formatCompact = (value: number | null | undefined) => {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000)
    return `${sign}${(absolute / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000)
    return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}K`;
  return `${value}`;
};

export const formatCompactDelta = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${formatCompact(value)}`;

export const formatAge = (timestamp: number) => {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
};
