import ts from "typescript";

const input = process.argv[2];
if (!input)
  throw Error(
    "Usage: bun packages/sdk-runeprofile/scripts/extract-achievement-definitions.ts /path/to/pinned/catalog/files",
  );
const enums: Record<string, number> = {
  "QuestType.FREE": 0,
  "QuestType.MEMBERS": 1,
  "QuestType.MINI": 2,
  "QuestDifficulty.NOVICE": 0,
  "QuestDifficulty.INTERMEDIATE": 1,
  "QuestDifficulty.EXPERIENCED": 2,
  "QuestDifficulty.MASTER": 3,
  "QuestDifficulty.GRANDMASTER": 4,
  "QuestDifficulty.SPECIAL": 5,
};
function literal(n: ts.Node): unknown {
  if (ts.isAsExpression(n) || ts.isSatisfiesExpression(n))
    return literal(n.expression);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isObjectLiteralExpression(n))
    return Object.fromEntries(
      n.properties.map((p) => {
        if (!ts.isPropertyAssignment(p)) throw Error(p.getText());
        return [
          p.name.getText().replace(/^["']|["']$/g, ""),
          literal(p.initializer),
        ];
      }),
    );
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n))
    return ts.isNumericLiteral(n) ? Number(n.text) : n.text;
  if (ts.isPropertyAccessExpression(n) && n.getText() in enums)
    return enums[n.getText()];
  throw Error(n.getText());
}
async function read(file: string, name: string) {
  const s = ts.createSourceFile(
    file,
    await Bun.file(`${input}/${file}.ts`).text(),
    ts.ScriptTarget.Latest,
    true,
  );
  let result: unknown;
  function walk(n: ts.Node) {
    if (
      ts.isVariableDeclaration(n) &&
      n.name.getText() === name &&
      n.initializer
    )
      result = literal(n.initializer);
    ts.forEachChild(n, walk);
  }
  walk(s);
  if (!result) throw Error(name);
  return result as any;
}
const quests = await read("quests", "QUESTS");
const tabs = await read("collection", "COLLECTION_LOG_TABS");
const items = await read("collection", "COLLECTION_LOG_ITEMS");
const tasks = await read("combat", "COMBAT_ACHIEVEMENT_TASKS");
const diaries = await read("diaries", "ACHIEVEMENT_DIARIES");
const data = {
  revision: (await Bun.file(`${input}/tree.json`).json()).sha,
  quests: quests.map((q: any) => ({
    key: `quest.${q.id}`,
    name: q.name,
    group: ["free", "members", "mini"][q.type],
  })),
  items: Object.entries(items).map(([id, name]) => ({
    key: `collection.item.${id}`,
    name,
  })),
  pages: tabs.flatMap((tab: any) =>
    tab.pages.map((p: any) => ({
      key: `collection.page.${p.name}`,
      name: p.name,
      group: tab.name,
      items: p.items.map((id: number) => `collection.item.${id}`),
    })),
  ),
  tasks: tasks.map((t: any) => ({
    key: `combatAchievement.${t.index}`,
    name: t.name,
    boss: t.monster,
    tier: t.tierId,
  })),
  diaries: diaries.flatMap((d: any) =>
    ["easy", "medium", "hard", "elite"].map((tier) => ({
      key: `diary.${d.id}.${tier}`,
      area: d.name,
      tier,
    })),
  ),
};
await Bun.write(
  new URL("../../domain/src/achievements/definitions.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
);
console.log({
  quests: data.quests.length,
  items: data.items.length,
  pages: data.pages.length,
  tasks: data.tasks.length,
  diaries: data.diaries.length,
});
