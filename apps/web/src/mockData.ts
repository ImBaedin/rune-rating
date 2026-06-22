export type Player = {
  id: "a" | "b";
  name: string;
  initials: string;
  accent: "blue" | "green";
  accountType: string;
  totalLevel: number;
  totalXp: number;
  combatLevel: number;
  questPoints: number;
  questMax: number;
  diaries: number;
  diaryMax: number;
  ehp: number;
  updated: string;
};

export const players: [Player, Player] = [
  {
    id: "a",
    name: "Northstar",
    initials: "NS",
    accent: "blue",
    accountType: "Main account",
    totalLevel: 2277,
    totalXp: 301742884,
    combatLevel: 126.1,
    questPoints: 267,
    questMax: 290,
    diaries: 42,
    diaryMax: 48,
    ehp: 156.8,
    updated: "2m ago",
  },
  {
    id: "b",
    name: "Moss Giant",
    initials: "MG",
    accent: "green",
    accountType: "Main account",
    totalLevel: 2203,
    totalXp: 283028991,
    combatLevel: 121.9,
    questPoints: 241,
    questMax: 290,
    diaries: 37,
    diaryMax: 48,
    ehp: 151,
    updated: "7m ago",
  },
];

export const skills = [
  {
    name: "Attack",
    aLevel: 99,
    aXp: "13,034,431",
    bLevel: 96,
    bXp: "9,684,577",
    delta: "+3",
    lead: "a",
  },
  {
    name: "Strength",
    aLevel: 99,
    aXp: "13,084,815",
    bLevel: 97,
    bXp: "10,711,806",
    delta: "+2",
    lead: "a",
  },
  {
    name: "Defence",
    aLevel: 99,
    aXp: "13,034,431",
    bLevel: 95,
    bXp: "9,098,199",
    delta: "+4",
    lead: "a",
  },
  {
    name: "Hitpoints",
    aLevel: 99,
    aXp: "16,154,448",
    bLevel: 99,
    bXp: "16,056,432",
    delta: "—",
    lead: "a",
  },
  {
    name: "Ranged",
    aLevel: 99,
    aXp: "13,402,300",
    bLevel: 98,
    bXp: "11,805,055",
    delta: "+1",
    lead: "a",
  },
  {
    name: "Prayer",
    aLevel: 95,
    aXp: "9,112,048",
    bLevel: 99,
    bXp: "13,459,221",
    delta: "-4",
    lead: "b",
  },
];

export const comparisonRows = [
  { label: "Categories led", a: "10", b: "5" },
  { label: "Total level difference", a: "+74", b: "-74" },
  { label: "Total XP difference", a: "+18.7M", b: "-18.7M" },
  { label: "Combat level difference", a: "+4.2", b: "-4.2" },
  { label: "EHP difference", a: "+5.8", b: "-5.8" },
  { label: "Efficiency difference", a: "+3.21%", b: "-3.21%" },
];
