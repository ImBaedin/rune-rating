import adamantRank from "./assets/ranks/individual-live/rank-adamant-individual-live.png";
import blackRank from "./assets/ranks/individual-live/rank-black-individual-live.png";
import bronzeRank from "./assets/ranks/individual-live/rank-bronze-individual-live.png";
import dragonRank from "./assets/ranks/individual-live/rank-dragon-individual-live.png";
import ironRank from "./assets/ranks/individual-live/rank-iron-individual-live.png";
import mithrilRank from "./assets/ranks/individual-live/rank-mithril-individual-live.png";
import runeRank from "./assets/ranks/individual-live/rank-rune-individual-live.png";
import steelRank from "./assets/ranks/individual-live/rank-steel-individual-live.png";
import rankSheet from "./assets/ranks/individual-live/rune-rating-rank-sheet-individual-live-small.png";

const tierColors = {
  Bronze: { base: "#9b6439", light: "#d29a63", dark: "#4f2f1f" },
  Iron: { base: "#a8adb0", light: "#eef2f3", dark: "#5a6267" },
  Steel: { base: "#6b7881", light: "#cbd5dc", dark: "#2c363d" },
  Black: { base: "#242321", light: "#68625c", dark: "#090909" },
  Mithril: { base: "#4c5291", light: "#8d92dc", dark: "#20274f" },
  Adamant: { base: "#4d8f62", light: "#a9d891", dark: "#23452f" },
  Rune: { base: "#2aa7ae", light: "#9df4f1", dark: "#18535e" },
  Dragon: { base: "#b53827", light: "#ff7245", dark: "#551b18" },
} as const;

export type RuneRatingTier = keyof typeof tierColors;

export const runeRatingTiers = Object.keys(tierColors) as RuneRatingTier[];

const rankImages: Record<RuneRatingTier, string> = {
  Bronze: bronzeRank,
  Iron: ironRank,
  Steel: steelRank,
  Black: blackRank,
  Mithril: mithrilRank,
  Adamant: adamantRank,
  Rune: runeRank,
  Dragon: dragonRank,
};

export function tierColorsFor(tier: string) {
  return tierColors[
    (tier as RuneRatingTier) in tierColors ? (tier as RuneRatingTier) : "Bronze"
  ];
}

export function tierImage(tier: string) {
  const key =
    (tier as RuneRatingTier) in rankImages
      ? (tier as RuneRatingTier)
      : "Bronze";
  return rankImages[key];
}

export function ratingSystemImage() {
  return rankSheet;
}
