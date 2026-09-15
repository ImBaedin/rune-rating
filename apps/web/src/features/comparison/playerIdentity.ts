import type { CSSProperties } from "react";

export type PlayerAccent = "blue" | "green";

export const playerPalette = {
  blue: {
    primary: "var(--player-left)",
    soft: "var(--player-left-soft)",
    foreground: "var(--player-left-foreground)",
  },
  green: {
    primary: "var(--player-right)",
    soft: "var(--player-right-soft)",
    foreground: "var(--player-right-foreground)",
  },
} as const;

export function compactName(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase() || "—"
  );
}

export function playerAvatar(name: string, accent: PlayerAccent) {
  const trimmed = name.trim();
  const label =
    trimmed.length > 0
      ? trimmed
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toLocaleUpperCase()
      : accent === "blue"
        ? "L"
        : "R";
  const palette = playerPalette[accent];

  return {
    label,
    primary: palette.primary,
    soft: palette.soft,
    style: {
      background: palette.primary,
      color: palette.foreground,
    } as CSSProperties,
  };
}
