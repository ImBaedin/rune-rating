type BossIcon = string | readonly [string, string];

const bossIconUrls = {
  "Abyssal Sire":
    "https://oldschool.runescape.wiki/images/thumb/Abyssal_Sire_%28phase_1%29.png/96px-Abyssal_Sire_%28phase_1%29.png?0db8f",
  "Alchemical Hydra":
    "https://oldschool.runescape.wiki/images/thumb/Alchemical_Hydra_%28serpentine%29.png/96px-Alchemical_Hydra_%28serpentine%29.png?925dd",
  Amoxliatl:
    "https://oldschool.runescape.wiki/images/thumb/Amoxliatl.png/96px-Amoxliatl.png?01b12",
  Araxxor:
    "https://oldschool.runescape.wiki/images/thumb/Araxxor.png/96px-Araxxor.png?35d2e",
  Artio:
    "https://oldschool.runescape.wiki/images/thumb/Artio.png/96px-Artio.png?bfba7",
  "Barrows Chests":
    "https://oldschool.runescape.wiki/images/thumb/Chest_%28Barrows%29.png/96px-Chest_%28Barrows%29.png?9aff2",
  Brutus:
    "https://oldschool.runescape.wiki/images/thumb/Brutus.png/96px-Brutus.png?eda9e",
  Bryophyta:
    "https://oldschool.runescape.wiki/images/thumb/Bryophyta.png/96px-Bryophyta.png?08bc8",
  Callisto:
    "https://oldschool.runescape.wiki/images/thumb/Callisto.png/96px-Callisto.png?bfba7",
  "Calvar'ion":
    "https://oldschool.runescape.wiki/images/thumb/Calvar%27ion.png/96px-Calvar%27ion.png?6268f",
  Cerberus:
    "https://oldschool.runescape.wiki/images/thumb/Cerberus.png/96px-Cerberus.png?47f4c",
  "Chambers of Xeric":
    "https://oldschool.runescape.wiki/images/thumb/Chambers_of_Xeric_logo.png/96px-Chambers_of_Xeric_logo.png?34a98",
  "Chambers of Xeric: Challenge Mode":
    "https://oldschool.runescape.wiki/images/thumb/Chambers_of_Xeric_logo.png/96px-Chambers_of_Xeric_logo.png?34a98",
  "Chaos Elemental":
    "https://oldschool.runescape.wiki/images/thumb/Chaos_Elemental.png/96px-Chaos_Elemental.png?c170c",
  "Chaos Fanatic":
    "https://oldschool.runescape.wiki/images/thumb/Chaos_Fanatic.png/96px-Chaos_Fanatic.png?8871d",
  "Commander Zilyana":
    "https://oldschool.runescape.wiki/images/thumb/Commander_Zilyana.png/96px-Commander_Zilyana.png?c5eaa",
  "Corporeal Beast":
    "https://oldschool.runescape.wiki/images/thumb/Corporeal_Beast.png/96px-Corporeal_Beast.png?52ebb",
  "Crazy Archaeologist":
    "https://oldschool.runescape.wiki/images/thumb/Crazy_archaeologist.png/96px-Crazy_archaeologist.png?3ecc9",
  "Dagannoth Prime":
    "https://oldschool.runescape.wiki/images/thumb/Dagannoth_Prime.png/96px-Dagannoth_Prime.png?945b1",
  "Dagannoth Rex":
    "https://oldschool.runescape.wiki/images/thumb/Dagannoth_Rex.png/96px-Dagannoth_Rex.png?a99a9",
  "Dagannoth Supreme":
    "https://oldschool.runescape.wiki/images/thumb/Dagannoth_Supreme.png/96px-Dagannoth_Supreme.png?81f00",
  "Deranged Archaeologist":
    "https://oldschool.runescape.wiki/images/thumb/Deranged_archaeologist.png/96px-Deranged_archaeologist.png?32c7e",
  "Doom of Mokhaiotl":
    "https://oldschool.runescape.wiki/images/thumb/Doom_of_Mokhaiotl.png/96px-Doom_of_Mokhaiotl.png?e5edb",
  "Duke Sucellus":
    "https://oldschool.runescape.wiki/images/thumb/Duke_Sucellus.png/96px-Duke_Sucellus.png?d588a",
  "General Graardor":
    "https://oldschool.runescape.wiki/images/thumb/General_Graardor.png/96px-General_Graardor.png?4dd90",
  "Giant Mole":
    "https://oldschool.runescape.wiki/images/thumb/Giant_Mole.png/96px-Giant_Mole.png?3f58a",
  "Grotesque Guardians":
    "https://oldschool.runescape.wiki/images/thumb/Dawn.png/96px-Dawn.png?8b8ea",
  Hespori:
    "https://oldschool.runescape.wiki/images/thumb/Hespori.png/96px-Hespori.png?83c72",
  "Kalphite Queen":
    "https://oldschool.runescape.wiki/images/thumb/Kalphite_Queen.png/96px-Kalphite_Queen.png?a4955",
  "King Black Dragon":
    "https://oldschool.runescape.wiki/images/thumb/King_Black_Dragon.png/96px-King_Black_Dragon.png?d25f0",
  Kraken:
    "https://oldschool.runescape.wiki/images/thumb/Kraken.png/96px-Kraken.png?a4955",
  "Kree'Arra":
    "https://oldschool.runescape.wiki/images/thumb/Kree%27arra.png/96px-Kree%27arra.png?ba75c",
  "K'ril Tsutsaroth":
    "https://oldschool.runescape.wiki/images/thumb/K%27ril_Tsutsaroth.png/96px-K%27ril_Tsutsaroth.png?73bda",
  "Lunar Chests":
    "https://oldschool.runescape.wiki/images/thumb/Lunar_Chest_%28closed%29.png/96px-Lunar_Chest_%28closed%29.png?19bbc",
  Mimic:
    "https://oldschool.runescape.wiki/images/thumb/Mimic_detail.png/96px-Mimic_detail.png?70bb1",
  Nex: "https://oldschool.runescape.wiki/images/thumb/Nex.png/96px-Nex.png?2a1b3",
  Nightmare:
    "https://oldschool.runescape.wiki/images/thumb/The_Nightmare.png/96px-The_Nightmare.png?0128a",
  "Phosani's Nightmare":
    "https://oldschool.runescape.wiki/images/thumb/The_Nightmare.png/96px-The_Nightmare.png?0128a",
  Obor: "https://oldschool.runescape.wiki/images/thumb/Obor.png/96px-Obor.png?08bc8",
  "Phantom Muspah":
    "https://oldschool.runescape.wiki/images/thumb/Phantom_Muspah_%28ranged%29.png/96px-Phantom_Muspah_%28ranged%29.png?9cf6a",
  Sarachnis:
    "https://oldschool.runescape.wiki/images/thumb/Sarachnis.png/96px-Sarachnis.png?8f040",
  Scorpia:
    "https://oldschool.runescape.wiki/images/thumb/Scorpia.png/96px-Scorpia.png?517c9",
  Scurrius:
    "https://oldschool.runescape.wiki/images/thumb/Scurrius.png/96px-Scurrius.png?e66a5",
  "Shellbane Gryphon":
    "https://oldschool.runescape.wiki/images/thumb/Shellbane_gryphon.png/96px-Shellbane_gryphon.png?bc76e",
  Skotizo:
    "https://oldschool.runescape.wiki/images/thumb/Skotizo.png/96px-Skotizo.png?dc8b8",
  "Sol Heredit":
    "https://oldschool.runescape.wiki/images/thumb/Sol_Heredit.png/96px-Sol_Heredit.png?91250",
  Spindel:
    "https://oldschool.runescape.wiki/images/thumb/Spindel.png/96px-Spindel.png?2c818",
  Tempoross:
    "https://oldschool.runescape.wiki/images/thumb/Tempoross.png/96px-Tempoross.png?12042",
  "The Gauntlet":
    "https://oldschool.runescape.wiki/images/thumb/Crystalline_Hunllef.png/96px-Crystalline_Hunllef.png?7737a",
  "The Corrupted Gauntlet":
    "https://oldschool.runescape.wiki/images/thumb/Corrupted_Hunllef.png/96px-Corrupted_Hunllef.png?0cd55",
  "The Hueycoatl":
    "https://oldschool.runescape.wiki/images/thumb/The_Hueycoatl.png/96px-The_Hueycoatl.png?7b216",
  "The Leviathan":
    "https://oldschool.runescape.wiki/images/thumb/The_Leviathan.png/96px-The_Leviathan.png?d588a",
  "The Royal Titans": [
    "https://oldschool.runescape.wiki/images/thumb/Branda_the_Fire_Queen.png/96px-Branda_the_Fire_Queen.png?0687c",
    "https://oldschool.runescape.wiki/images/thumb/Eldric_the_Ice_King.png/96px-Eldric_the_Ice_King.png?6bd48",
  ],
  "The Whisperer":
    "https://oldschool.runescape.wiki/images/thumb/The_Whisperer.png/96px-The_Whisperer.png?aedab",
  "Theatre of Blood":
    "https://oldschool.runescape.wiki/images/thumb/Theatre_of_Blood_logo.png/96px-Theatre_of_Blood_logo.png?e6e68",
  "Theatre of Blood: Hard Mode":
    "https://oldschool.runescape.wiki/images/thumb/Theatre_of_Blood_logo.png/96px-Theatre_of_Blood_logo.png?e6e68",
  "Thermonuclear Smoke Devil":
    "https://oldschool.runescape.wiki/images/thumb/Thermonuclear_smoke_devil.png/96px-Thermonuclear_smoke_devil.png?de858",
  "Tombs of Amascut":
    "https://oldschool.runescape.wiki/images/thumb/Tombs_of_Amascut.png/96px-Tombs_of_Amascut.png?f9992",
  "Tombs of Amascut: Expert Mode":
    "https://oldschool.runescape.wiki/images/thumb/Tombs_of_Amascut.png/96px-Tombs_of_Amascut.png?f9992",
  "TzKal-Zuk":
    "https://oldschool.runescape.wiki/images/thumb/TzKal-Zuk.png/96px-TzKal-Zuk.png?2d222",
  "TzTok-Jad":
    "https://oldschool.runescape.wiki/images/thumb/TzTok-Jad.png/96px-TzTok-Jad.png?df681",
  Vardorvis:
    "https://oldschool.runescape.wiki/images/thumb/Vardorvis.png/96px-Vardorvis.png?48af8",
  Venenatis:
    "https://oldschool.runescape.wiki/images/thumb/Venenatis.png/96px-Venenatis.png?13693",
  "Vet'ion":
    "https://oldschool.runescape.wiki/images/thumb/Vet%27ion.png/96px-Vet%27ion.png?8695f",
  Vorkath:
    "https://oldschool.runescape.wiki/images/thumb/Vorkath.png/96px-Vorkath.png?1ce3f",
  Wintertodt:
    "https://oldschool.runescape.wiki/images/Wintertodt_icon.png?73109",
  Yama: "https://oldschool.runescape.wiki/images/thumb/Yama.png/96px-Yama.png?7653a",
  Zalcano:
    "https://oldschool.runescape.wiki/images/thumb/Zalcano_%28weakened%29.png/96px-Zalcano_%28weakened%29.png?fa423",
  Zulrah:
    "https://oldschool.runescape.wiki/images/thumb/Zulrah_%28serpentine%29.png/96px-Zulrah_%28serpentine%29.png?29a54",
} as const satisfies Record<string, BossIcon>;

export function getBossIconUrls(name: string): readonly string[] {
  const icon = bossIconUrls[name as keyof typeof bossIconUrls];
  if (!icon) return [];
  return typeof icon === "string" ? [icon] : icon;
}
