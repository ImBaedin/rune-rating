type QuestCompletion = { completed: boolean | null; points: number | null };

export function questCompletionDiffers(
  left: Pick<QuestCompletion, "completed"> | null,
  right: Pick<QuestCompletion, "completed"> | null,
) {
  return (
    typeof left?.completed === "boolean" &&
    typeof right?.completed === "boolean" &&
    left.completed !== right.completed
  );
}

export function questPointBand(points: number | null) {
  return points === null ? null : String(Math.min(points, 5));
}

export function questPointCompletions(
  items: QuestCompletion[] | undefined,
  band: string,
) {
  if (
    !items ||
    items.some(
      (item) =>
        item.completed === null || (item.completed && item.points === null),
    )
  )
    return null;
  return items.filter(
    (item) => item.completed && questPointBand(item.points) === band,
  ).length;
}
