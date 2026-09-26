type TimelinePoint = { date: number; value: number };
const dayMs = 24 * 60 * 60 * 1000;
const smoothingDays = 14;

export function valueAtTimeline(points: TimelinePoint[], timestamp: number) {
  let value: number | null = null;
  for (const point of points) {
    if (point.date > timestamp) break;
    value = point.value;
  }
  return value;
}

export function buildSmoothedDailyGainTimeline(points: TimelinePoint[]) {
  const firstDate = points[0]?.date;
  const lastDate = points.at(-1)?.date;
  if (firstDate === undefined || lastDate === undefined) return [];
  const samples: TimelinePoint[] = [];
  for (let date = firstDate + dayMs; date <= lastDate; date += dayMs) {
    const startDate = Math.max(firstDate, date - smoothingDays * dayMs);
    const startValue = valueAtTimeline(points, startDate);
    const endValue = valueAtTimeline(points, date);
    if (startValue === null || endValue === null) continue;
    const elapsedDays = (date - startDate) / dayMs;
    samples.push({
      date,
      value: Math.max(0, endValue - startValue) / elapsedDays,
    });
  }
  return samples;
}
