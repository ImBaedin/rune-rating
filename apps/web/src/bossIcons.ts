import bossAbyssalSirePhase1 from "./assets/bosses/abyssal-sire-phase-1-.png";
import bossAlchemicalHydraSerpentine from "./assets/bosses/alchemical-hydra-serpentine-.png";
import bossAmoxliatl from "./assets/bosses/amoxliatl.png";
import bossAraxxor from "./assets/bosses/araxxor.png";
import bossArtio from "./assets/bosses/artio.png";
import bossBrandaTheFireQueen from "./assets/bosses/branda-the-fire-queen.png";
import bossBrutus from "./assets/bosses/brutus.png";
import bossBryophyta from "./assets/bosses/bryophyta.png";
import bossCallisto from "./assets/bosses/callisto.png";
import bossCalvarIon from "./assets/bosses/calvar-ion.png";
import bossCerberus from "./assets/bosses/cerberus.png";
import bossChambersOfXericLogo from "./assets/bosses/chambers-of-xeric-logo.png";
import bossChaosElemental from "./assets/bosses/chaos-elemental.png";
import bossChaosFanatic from "./assets/bosses/chaos-fanatic.png";
import bossChestBarrows from "./assets/bosses/chest-barrows-.png";
import bossCommanderZilyana from "./assets/bosses/commander-zilyana.png";
import bossCorporealBeast from "./assets/bosses/corporeal-beast.png";
import bossCorruptedHunllef from "./assets/bosses/corrupted-hunllef.png";
import bossCrazyArchaeologist from "./assets/bosses/crazy-archaeologist.png";
import bossCrystallineHunllef from "./assets/bosses/crystalline-hunllef.png";
import bossDagannothPrime from "./assets/bosses/dagannoth-prime.png";
import bossDagannothRex from "./assets/bosses/dagannoth-rex.png";
import bossDagannothSupreme from "./assets/bosses/dagannoth-supreme.png";
import bossDawn from "./assets/bosses/dawn.png";
import bossDerangedArchaeologist from "./assets/bosses/deranged-archaeologist.png";
import bossDoomOfMokhaiotl from "./assets/bosses/doom-of-mokhaiotl.png";
import bossDukeSucellus from "./assets/bosses/duke-sucellus.png";
import bossEldricTheIceKing from "./assets/bosses/eldric-the-ice-king.png";
import bossGeneralGraardor from "./assets/bosses/general-graardor.png";
import bossGiantMole from "./assets/bosses/giant-mole.png";
import bossHespori from "./assets/bosses/hespori.png";
import bossKRilTsutsaroth from "./assets/bosses/k-ril-tsutsaroth.png";
import bossKalphiteQueen from "./assets/bosses/kalphite-queen.png";
import bossKingBlackDragon from "./assets/bosses/king-black-dragon.png";
import bossKraken from "./assets/bosses/kraken.png";
import bossKreeArra from "./assets/bosses/kree-arra.png";
import bossLunarChestClosed from "./assets/bosses/lunar-chest-closed-.png";
import bossMadAngel from "./assets/bosses/mad-angel.webp";
import bossMaggotKing from "./assets/bosses/maggot-king.png";
import bossMimicDetail from "./assets/bosses/mimic-detail.png";
import bossNex from "./assets/bosses/nex.png";
import bossObor from "./assets/bosses/obor.png";
import bossPhantomMuspahRanged from "./assets/bosses/phantom-muspah-ranged-.png";
import bossSarachnis from "./assets/bosses/sarachnis.png";
import bossScorpia from "./assets/bosses/scorpia.png";
import bossScurrius from "./assets/bosses/scurrius.png";
import bossShellbaneGryphon from "./assets/bosses/shellbane-gryphon.png";
import bossSkotizo from "./assets/bosses/skotizo.png";
import bossSolHeredit from "./assets/bosses/sol-heredit.png";
import bossSpindel from "./assets/bosses/spindel.png";
import bossTempoross from "./assets/bosses/tempoross.png";
import bossTheHueycoatl from "./assets/bosses/the-hueycoatl.png";
import bossTheLeviathan from "./assets/bosses/the-leviathan.png";
import bossTheNightmare from "./assets/bosses/the-nightmare.png";
import bossTheWhisperer from "./assets/bosses/the-whisperer.png";
import bossTheatreOfBloodLogo from "./assets/bosses/theatre-of-blood-logo.png";
import bossThermonuclearSmokeDevil from "./assets/bosses/thermonuclear-smoke-devil.png";
import bossTombsOfAmascut from "./assets/bosses/tombs-of-amascut.png";
import bossTzkalZuk from "./assets/bosses/tzkal-zuk.png";
import bossTztokJad from "./assets/bosses/tztok-jad.png";
import bossVardorvis from "./assets/bosses/vardorvis.png";
import bossVenenatis from "./assets/bosses/venenatis.png";
import bossVetIon from "./assets/bosses/vet-ion.png";
import bossVorkath from "./assets/bosses/vorkath.png";
import bossWintertodtIcon from "./assets/bosses/wintertodt-icon.png";
import bossYama from "./assets/bosses/yama.png";
import bossZalcanoWeakened from "./assets/bosses/zalcano-weakened-.png";
import bossZulrahSerpentine from "./assets/bosses/zulrah-serpentine-.png";

type BossIcon = string | readonly [string, string];

const bossIconUrls = {
  "Mad Angel": bossMadAngel,
  "Maggot King": bossMaggotKing,
  "Abyssal Sire": bossAbyssalSirePhase1,
  "Alchemical Hydra": bossAlchemicalHydraSerpentine,
  Amoxliatl: bossAmoxliatl,
  Araxxor: bossAraxxor,
  Artio: bossArtio,
  "Barrows Chests": bossChestBarrows,
  Brutus: bossBrutus,
  Bryophyta: bossBryophyta,
  Callisto: bossCallisto,
  "Calvar'ion": bossCalvarIon,
  Cerberus: bossCerberus,
  "Chambers of Xeric": bossChambersOfXericLogo,
  "Chambers of Xeric: Challenge Mode": bossChambersOfXericLogo,
  "Chaos Elemental": bossChaosElemental,
  "Chaos Fanatic": bossChaosFanatic,
  "Commander Zilyana": bossCommanderZilyana,
  "Corporeal Beast": bossCorporealBeast,
  "Crazy Archaeologist": bossCrazyArchaeologist,
  "Dagannoth Prime": bossDagannothPrime,
  "Dagannoth Rex": bossDagannothRex,
  "Dagannoth Supreme": bossDagannothSupreme,
  "Deranged Archaeologist": bossDerangedArchaeologist,
  "Doom of Mokhaiotl": bossDoomOfMokhaiotl,
  "Duke Sucellus": bossDukeSucellus,
  "General Graardor": bossGeneralGraardor,
  "Giant Mole": bossGiantMole,
  "Grotesque Guardians": bossDawn,
  Hespori: bossHespori,
  "Kalphite Queen": bossKalphiteQueen,
  "King Black Dragon": bossKingBlackDragon,
  Kraken: bossKraken,
  "Kree'Arra": bossKreeArra,
  "K'ril Tsutsaroth": bossKRilTsutsaroth,
  "Lunar Chests": bossLunarChestClosed,
  Mimic: bossMimicDetail,
  Nex: bossNex,
  Nightmare: bossTheNightmare,
  "Phosani's Nightmare": bossTheNightmare,
  Obor: bossObor,
  "Phantom Muspah": bossPhantomMuspahRanged,
  Sarachnis: bossSarachnis,
  Scorpia: bossScorpia,
  Scurrius: bossScurrius,
  "Shellbane Gryphon": bossShellbaneGryphon,
  Skotizo: bossSkotizo,
  "Sol Heredit": bossSolHeredit,
  Spindel: bossSpindel,
  Tempoross: bossTempoross,
  "The Gauntlet": bossCrystallineHunllef,
  "The Corrupted Gauntlet": bossCorruptedHunllef,
  "The Hueycoatl": bossTheHueycoatl,
  "The Leviathan": bossTheLeviathan,
  "The Royal Titans": [bossBrandaTheFireQueen, bossEldricTheIceKing],
  "The Whisperer": bossTheWhisperer,
  "Theatre of Blood": bossTheatreOfBloodLogo,
  "Theatre of Blood: Hard Mode": bossTheatreOfBloodLogo,
  "Thermonuclear Smoke Devil": bossThermonuclearSmokeDevil,
  "Tombs of Amascut": bossTombsOfAmascut,
  "Tombs of Amascut: Expert Mode": bossTombsOfAmascut,
  "TzKal-Zuk": bossTzkalZuk,
  "TzTok-Jad": bossTztokJad,
  Vardorvis: bossVardorvis,
  Venenatis: bossVenenatis,
  "Vet'ion": bossVetIon,
  Vorkath: bossVorkath,
  Wintertodt: bossWintertodtIcon,
  Yama: bossYama,
  Zalcano: bossZalcanoWeakened,
  Zulrah: bossZulrahSerpentine,
} as const satisfies Record<string, BossIcon>;

export function getBossIconUrls(name: string): readonly string[] {
  const icon = bossIconUrls[name as keyof typeof bossIconUrls];
  if (!icon) return [];
  return typeof icon === "string" ? [icon] : icon;
}
