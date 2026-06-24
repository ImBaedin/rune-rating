export const featuredRsns = [
  "IronBaedin",
  "GIM Wamuu",
  "Starmie Iron",
  "A ID EN",
  "pgn",
  "How to surge",
  "Andilusia",
  "Manafication",
  "Mijato911",
] as const;

export const fallbackExampleRsn = featuredRsns[0];

export const fallbackCompareRsns: [string, string] = [
  featuredRsns[1],
  featuredRsns[2],
];

export function randomExampleRsn() {
  return featuredRsns[randomIndex(featuredRsns.length)] ?? fallbackExampleRsn;
}

export function randomCompareRsns(): [string, string] {
  if (featuredRsns.length < 2) return fallbackCompareRsns;

  const leftIndex = randomIndex(featuredRsns.length);
  const rightOffset = randomIndex(featuredRsns.length - 1) + 1;
  const rightIndex = (leftIndex + rightOffset) % featuredRsns.length;

  return [
    featuredRsns[leftIndex] ?? fallbackCompareRsns[0],
    featuredRsns[rightIndex] ?? fallbackCompareRsns[1],
  ];
}

function randomIndex(length: number) {
  return Math.floor(Math.random() * length);
}
