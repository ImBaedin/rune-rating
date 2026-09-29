export {
  agilityIcon,
  attackIcon,
  combatAchievementsIcon,
  constructionIcon,
  cookingIcon,
  craftingIcon,
  defenceIcon,
  farmingIcon,
  firemakingIcon,
  fishingIcon,
  fletchingIcon,
  herbloreIcon,
  hitpointsIcon,
  holidayEventIcon,
  hunterIcon,
  largeMapIcon,
  magicIcon,
  minigameMapIcon,
  miningIcon,
  prayerIcon,
  prifddinasIcon,
  questStartIcon,
  rangedIcon,
  runecraftIcon,
  sailingWorldIcon,
  skillsIcon,
  slayerIcon,
  smithingIcon,
  strengthIcon,
  thievingIcon,
  woodcuttingIcon,
} from "../node_modules/@dava96/osrs-icons/dist/esm/generated/category-icons.js";

const extractDataUrl = (cursorValue: string) => {
  const match = cursorValue.match(/url\(['"]?([^'")]+)['"]?\)/);
  return match?.[1] ?? "";
};

export function toDataUrl(cursorValue: string): string;
export function toDataUrl<T extends Record<string, string>>(
  cursorValues: T,
): { [K in keyof T]: string };
export function toDataUrl(
  value: string | Record<string, string>,
): string | Record<string, string> {
  if (typeof value === "string") return extractDataUrl(value);
  return Object.fromEntries(
    Object.entries(value).map(([key, cursor]) => [key, extractDataUrl(cursor)]),
  );
}
