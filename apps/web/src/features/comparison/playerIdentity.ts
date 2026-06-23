import type { CSSProperties } from "react";

export type PlayerAccent = "blue" | "green";

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
  const hash = [...trimmed.toLocaleLowerCase()].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 360,
    accent === "blue" ? 212 : 139,
  );
  const primary = `hsl(${hash} 76% 48%)`;
  const soft = `hsl(${hash} 78% 95%)`;

  return {
    label,
    primary,
    soft,
    style: {
      background: primary,
    } as CSSProperties,
  };
}
