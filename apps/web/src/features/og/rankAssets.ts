// Embed server-only artwork; SSR asset URLs are not emitted to the client build.
import adamant from "../../assets/ranks/individual-live/rank-adamant-individual-live.png?inline";
import black from "../../assets/ranks/individual-live/rank-black-individual-live.png?inline";
import bronze from "../../assets/ranks/individual-live/rank-bronze-individual-live.png?inline";
import dragon from "../../assets/ranks/individual-live/rank-dragon-individual-live.png?inline";
import iron from "../../assets/ranks/individual-live/rank-iron-individual-live.png?inline";
import mithril from "../../assets/ranks/individual-live/rank-mithril-individual-live.png?inline";
import rune from "../../assets/ranks/individual-live/rank-rune-individual-live.png?inline";
import steel from "../../assets/ranks/individual-live/rank-steel-individual-live.png?inline";

const ranks: Record<string, string> = {
  Adamant: adamant,
  Black: black,
  Bronze: bronze,
  Dragon: dragon,
  Iron: iron,
  Mithril: mithril,
  Rune: rune,
  Steel: steel,
};
export function tierPngImage(tier: string) {
  return ranks[tier] ?? bronze;
}
