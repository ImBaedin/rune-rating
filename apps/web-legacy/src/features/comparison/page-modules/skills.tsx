import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BarChart3, Medal, Target, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ComparisonKpiCard,
  SourceChip as HeaderSourceChip,
  PageHeader,
  PlayerPairLine,
  SegmentedControl,
} from "../../../components/comparison-ui";
import {
  agilityIcon,
  attackIcon,
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
  hunterIcon,
  magicIcon,
  miningIcon,
  prayerIcon,
  rangedIcon,
  runecraftIcon,
  sailingWorldIcon,
  skillsIcon,
  slayerIcon,
  smithingIcon,
  strengthIcon,
  thievingIcon,
  toDataUrl,
  woodcuttingIcon,
} from "../../../osrsIcons";
import type { SkillsComparison } from "../context";
import { useComparisonShell } from "../context";
import {
  formatCompact,
  formatCompactDelta,
  formatDelta,
  formatValue,
} from "../formatters";
import { comparisonPath } from "../navigation";
import { LoadingOverlay, PanelHeader } from "./shared";

type SkillRow = NonNullable<SkillsComparison>["skills"][number];
type SkillCategory = "Combat" | "Gathering" | "Artisan" | "Support" | "Other";

const skillIconUrls: Record<string, string> = toDataUrl({
  Attack: attackIcon,
  Strength: strengthIcon,
  Defence: defenceIcon,
  Hitpoints: hitpointsIcon,
  Ranged: rangedIcon,
  Prayer: prayerIcon,
  Magic: magicIcon,
  Cooking: cookingIcon,
  Woodcutting: woodcuttingIcon,
  Fletching: fletchingIcon,
  Fishing: fishingIcon,
  Firemaking: firemakingIcon,
  Crafting: craftingIcon,
  Smithing: smithingIcon,
  Mining: miningIcon,
  Herblore: herbloreIcon,
  Agility: agilityIcon,
  Thieving: thievingIcon,
  Slayer: slayerIcon,
  Farming: farmingIcon,
  Runecraft: runecraftIcon,
  Hunter: hunterIcon,
  Construction: constructionIcon,
  Sailing: sailingWorldIcon,
});
const skillsIconUrl = toDataUrl(skillsIcon);

const skillCategories: Record<Exclude<SkillCategory, "Other">, Set<string>> = {
  Combat: new Set([
    "Attack",
    "Strength",
    "Defence",
    "Hitpoints",
    "Ranged",
    "Prayer",
    "Magic",
  ]),
  Gathering: new Set(["Mining", "Fishing", "Woodcutting", "Hunter", "Farming"]),
  Artisan: new Set([
    "Cooking",
    "Smithing",
    "Fletching",
    "Firemaking",
    "Crafting",
    "Herblore",
    "Construction",
    "Runecraft",
  ]),
  Support: new Set(["Agility", "Thieving", "Slayer"]),
};

const categoryOrder: SkillCategory[] = [
  "Combat",
  "Gathering",
  "Artisan",
  "Support",
  "Other",
];

const xpForLevel = (level: number) => {
  let points = 0;
  for (let current = 1; current < level; current += 1) {
    points += Math.floor(current + 300 * 2 ** (current / 7));
  }
  return Math.floor(points / 4);
};

const skillCategory = (name: string): SkillCategory =>
  (Object.entries(skillCategories).find(([, skills]) =>
    skills.has(name),
  )?.[0] ?? "Other") as SkillCategory;

const categoryClass = (category: SkillCategory) =>
  category === "Other" ? "support" : category.toLowerCase();

export function SkillsRoutePage() {
  const { comparison, names } = useComparisonShell();
  return <SkillsPage comparison={comparison} names={names} />;
}

function SkillsPage({
  comparison,
  names,
}: {
  comparison: SkillsComparison | undefined;
  names: [string, string];
}) {
  const [category, setCategory] = useState<SkillCategory>("Combat");
  const isLoading = comparison === undefined;
  const skills =
    comparison?.skills.filter((skill) => skill.key !== "skill.overall") ?? [];
  const overall = comparison?.skills.find(
    (skill) => skill.key === "skill.overall",
  );
  const filteredSkills =
    category === "Other"
      ? skills.filter((skill) => skillCategory(skill.name) === "Other")
      : skills.filter((skill) => skillCategory(skill.name) === category);
  const categoryRows = filteredSkills.length > 0 ? filteredSkills : skills;
  const leftLeads = skills.filter((skill) => skill.xp.leader === "left").length;
  const rightLeads = skills.filter(
    (skill) => skill.xp.leader === "right",
  ).length;
  const largestGap = [...skills].sort(
    (left, right) =>
      Math.abs(right.xp.delta ?? 0) - Math.abs(left.xp.delta ?? 0),
  )[0];
  const closestRace = [...skills]
    .filter((skill) => skill.xp.delta !== null)
    .sort(
      (left, right) =>
        Math.abs(left.xp.delta ?? 0) - Math.abs(right.xp.delta ?? 0),
    )[0];
  const categorySummary = useMemo(() => buildCategorySummary(skills), [skills]);

  return (
    <div className="skills-page">
      <PageHeader
        title="Skills"
        meta={<HeaderSourceChip label="Official Hiscores" />}
        controls={
          <SegmentedControl
            label="Skill category"
            value={category}
            options={categoryOrder.map((item) => [item, item])}
            onChange={setCategory}
          />
        }
      />

      <section className="skills-summary-grid">
        <SkillSummaryCard
          icon={Trophy}
          label="XP categories led"
          value={`${leftLeads} / ${rightLeads}`}
          detail={
            <PlayerPairLine
              names={names}
              left={`${leftLeads} leads`}
              right={`${rightLeads} leads`}
            />
          }
          isLoading={isLoading}
        />
        <SkillSummaryCard
          icon={BarChart3}
          label="Total XP gap"
          value={formatCompactDelta(overall?.xp.delta ?? null)}
          detail="Official Hiscores total XP"
          isLoading={isLoading}
          tone={(overall?.xp.delta ?? 0) < 0 ? "green" : "blue"}
        />
        <SkillSummaryCard
          icon={Medal}
          label="Total level gap"
          value={formatDelta(overall?.level.delta ?? null)}
          detail="Total level difference"
          isLoading={isLoading}
          tone={(overall?.level.delta ?? 0) < 0 ? "green" : "blue"}
        />
        <SkillSummaryCard
          icon={Target}
          label="Largest skill gap"
          value={largestGap?.name ?? "Waiting"}
          detail={formatCompactDelta(largestGap?.xp.delta ?? null)}
          isLoading={isLoading}
        />
      </section>

      <section className="skills-dashboard-grid">
        <SkillsDetailTable
          names={names}
          rows={categoryRows}
          category={category}
          isLoading={isLoading}
        />
        <SkillGapChart
          names={names}
          rows={categoryRows}
          isLoading={isLoading}
        />
        <SkillHighlights
          names={names}
          largestGap={largestGap}
          closestRace={closestRace}
          rows={skills}
          isLoading={isLoading}
        />
      </section>

      <section className="skills-bottom-grid">
        <CategoryComposition rows={categorySummary} isLoading={isLoading} />
        <SkillMilestones names={names} rows={skills} isLoading={isLoading} />
        <CategorySummary
          names={names}
          rows={categorySummary}
          overall={overall}
          isLoading={isLoading}
        />
      </section>
    </div>
  );
}

function SkillSummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
  isLoading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: React.ReactNode;
  tone?: "blue" | "green";
  isLoading: boolean;
}) {
  return (
    <ComparisonKpiCard
      className={`skill-summary-card ${tone}`}
      icon={<Icon size={20} />}
      isLoading={isLoading}
      label={label}
      tone={tone}
    >
      <div className="skill-summary-card-body">
        <strong>{isLoading ? "..." : value}</strong>
        <div className="rr-kpi-detail">
          {isLoading ? "Loading skills" : detail}
        </div>
      </div>
    </ComparisonKpiCard>
  );
}

function SkillGapChart({
  names,
  rows,
  isLoading,
}: {
  names: [string, string];
  rows: SkillRow[];
  isLoading: boolean;
}) {
  const chartRows = rows
    .filter((skill) => skill.xp.delta !== null)
    .sort(
      (left, right) =>
        Math.abs(right.xp.delta ?? 0) - Math.abs(left.xp.delta ?? 0),
    )
    .slice(0, 10)
    .map((skill) => ({
      name: skill.name,
      left: skill.xp.left ?? 0,
      right: skill.xp.right ?? 0,
    }));
  return (
    <article className="panel skill-progress-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Skill XP comparison"
        eyebrow="Top gaps in selected category"
        action={
          <div className="xp-chart-legend">
            <span>
              <i className="blue" />
              {names[0]}
            </span>
            <span>
              <i className="green" />
              {names[1]}
            </span>
          </div>
        }
      />
      <div className="skill-progress-chart">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart
            data={chartRows}
            layout="vertical"
            margin={{ top: 8, right: 18, bottom: 8, left: 36 }}
          >
            <CartesianGrid stroke="#e7ebef" horizontal={false} />
            <XAxis tickFormatter={formatCompact} type="number" />
            <YAxis dataKey="name" type="category" width={70} />
            <Tooltip formatter={(value) => formatCompact(Number(value))} />
            <Bar dataKey="left" fill="var(--blue)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="right" fill="var(--green)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading skill chart" />
    </article>
  );
}

function SkillHighlights({
  names,
  largestGap,
  closestRace,
  rows,
  isLoading,
}: {
  names: [string, string];
  largestGap: SkillRow | undefined;
  closestRace: SkillRow | undefined;
  rows: SkillRow[];
  isLoading: boolean;
}) {
  const highestLeft = [...rows].sort(
    (left, right) => (right.level.left ?? 0) - (left.level.left ?? 0),
  )[0];
  const highestRight = [...rows].sort(
    (left, right) => (right.level.right ?? 0) - (left.level.right ?? 0),
  )[0];
  const items = [
    {
      title: "Largest gap",
      skill: largestGap,
      detail: formatCompactDelta(largestGap?.xp.delta ?? null),
      tone: (largestGap?.xp.delta ?? 0) < 0 ? "green" : "blue",
    },
    {
      title: "Closest race",
      skill: closestRace,
      detail: formatCompact(Math.abs(closestRace?.xp.delta ?? 0)),
      tone: (closestRace?.xp.delta ?? 0) < 0 ? "green" : "blue",
    },
    {
      title: `${names[0]} best level`,
      skill: highestLeft,
      detail: `Level ${formatValue(highestLeft?.level.left ?? null)}`,
      tone: "blue",
    },
    {
      title: `${names[1]} best level`,
      skill: highestRight,
      detail: `Level ${formatValue(highestRight?.level.right ?? null)}`,
      tone: "green",
    },
  ] as const;

  return (
    <article className="panel skills-highlights-panel" aria-busy={isLoading}>
      <PanelHeader title="Skill highlights" eyebrow="Current snapshots" />
      <div className="skills-highlight-list">
        {items.map((item) => (
          <div className="skills-highlight-item" key={item.title}>
            <span className={`skills-highlight-icon ${item.tone}`}>
              <OsrsSkillIcon name={item.skill?.name ?? "Overall"} />
            </span>
            <div>
              <small>{item.title}</small>
              <strong>{item.skill?.name ?? "Waiting"}</strong>
              <b className={item.tone === "green" ? "green-text" : "blue-text"}>
                {item.detail}
              </b>
            </div>
          </div>
        ))}
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading skill highlights" />
    </article>
  );
}

function SkillsDetailTable({
  names,
  rows,
  category,
  isLoading,
}: {
  names: [string, string];
  rows: SkillRow[];
  category: SkillCategory;
  isLoading: boolean;
}) {
  return (
    <article className="panel skills-detail-panel" aria-busy={isLoading}>
      <PanelHeader
        title={`${category} skills`}
        eyebrow="Level, XP, and category leader"
      />
      <div className="table-scroll skills-detail-scroll">
        <table className="skills-detail-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th className="blue-text player-column">
                <span title={names[0]}>{names[0]}</span>
              </th>
              <th className="green-text player-column">
                <span title={names[1]}>{names[1]}</span>
              </th>
              <th>XP gap</th>
              <th>Level gap</th>
              <th>Ahead</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((skill) => (
              <SkillDetailRow key={skill.key} names={names} skill={skill} />
            ))}
          </tbody>
        </table>
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading skill detail" />
    </article>
  );
}

function SkillDetailRow({
  names,
  skill,
}: {
  names: [string, string];
  skill: SkillRow;
}) {
  const category = skillCategory(skill.name);
  return (
    <tr>
      <td>
        <span className={`skill-icon ${categoryClass(category)}`}>
          <OsrsSkillIcon name={skill.name} />
        </span>
        <strong>{skill.name}</strong>
        <small>{category}</small>
      </td>
      <td>
        <strong>{formatValue(skill.level.left)}</strong>
        <small>{formatValue(skill.xp.left)} XP</small>
      </td>
      <td>
        <strong>{formatValue(skill.level.right)}</strong>
        <small>{formatValue(skill.xp.right)} XP</small>
      </td>
      <td className={skill.xp.leader === "right" ? "green-text" : "blue-text"}>
        {formatCompactDelta(skill.xp.delta)}
      </td>
      <td
        className={skill.level.leader === "right" ? "green-text" : "blue-text"}
      >
        {formatDelta(skill.level.delta)}
      </td>
      <td>
        <span
          className={`winner ${skill.xp.leader === "right" ? "green" : "blue"}`}
          title={sideBadgeTitle(skill.xp.leader, names)}
        >
          <span aria-hidden="true">{sideBadgeLabel(skill.xp.leader)}</span>
          <span className="sr-only">
            {sideBadgeTitle(skill.xp.leader, names)}
          </span>
        </span>
      </td>
    </tr>
  );
}

function CategoryComposition({
  rows,
  isLoading,
}: {
  rows: CategorySummaryRow[];
  isLoading: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.totalXp));
  return (
    <article className="panel composition-panel" aria-busy={isLoading}>
      <PanelHeader title="XP composition" eyebrow="Combined category share" />
      <div className="composition-body">
        {rows.map((row) => (
          <div className="composition-row" key={row.category}>
            <div>
              <strong>{row.category}</strong>
              <span>{formatCompact(row.totalXp)} XP</span>
            </div>
            <div className="composition-track">
              <i
                className={categoryClass(row.category)}
                style={{ width: `${Math.max(4, (row.totalXp / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        <div className="composition-legend">
          {rows.map((row) => (
            <span key={row.category}>
              <i className={categoryClass(row.category)} />
              {row.category}
            </span>
          ))}
        </div>
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading category totals" />
    </article>
  );
}

function SkillMilestones({
  names,
  rows,
  isLoading,
}: {
  names: [string, string];
  rows: SkillRow[];
  isLoading: boolean;
}) {
  const milestoneRows = [...rows]
    .sort(
      (left, right) =>
        milestoneRemaining(left, "left") +
        milestoneRemaining(left, "right") -
        (milestoneRemaining(right, "left") +
          milestoneRemaining(right, "right")),
    )
    .slice(0, 6);
  return (
    <article className="panel skill-milestones-panel" aria-busy={isLoading}>
      <PanelHeader title="Closest milestones" eyebrow="Next major level" />
      <div className="milestone-head">
        <span>Skill</span>
        <span className="blue-text">{names[0]}</span>
        <span className="green-text">{names[1]}</span>
      </div>
      {milestoneRows.map((skill) => (
        <div className="milestone-row" key={skill.key}>
          <strong>
            <OsrsSkillIcon name={skill.name} />
            {skill.name}
            <small>{skillCategory(skill.name)}</small>
          </strong>
          <MilestoneBar side="left" skill={skill} />
          <MilestoneBar side="right" skill={skill} />
        </div>
      ))}
      <LoadingOverlay isLoading={isLoading} label="Loading milestones" />
    </article>
  );
}

function MilestoneBar({
  side,
  skill,
}: {
  side: "left" | "right";
  skill: SkillRow;
}) {
  const level = skill.level[side] ?? 1;
  const xp = skill.xp[side] ?? 0;
  const target = nextMajorMilestoneLevel(level);
  const currentLevelXp = xpForLevel(Math.max(1, level));
  const targetXp = xpForLevel(target);
  const progress =
    targetXp <= currentLevelXp
      ? 100
      : Math.min(
          100,
          ((xp - currentLevelXp) / (targetXp - currentLevelXp)) * 100,
        );
  return (
    <div className="milestone-progress">
      <span>
        <b>{formatValue(Math.max(0, targetXp - xp))} XP</b>
        <em>to {target}</em>
      </span>
      <i>
        <b
          className={side === "left" ? "blue" : "green"}
          style={{ width: `${progress}%` }}
        />
      </i>
    </div>
  );
}

type CategorySummaryRow = {
  category: SkillCategory;
  left: number;
  right: number;
  totalXp: number;
  leftAverage: number;
  rightAverage: number;
};
type CategoryDisplayRow = Omit<CategorySummaryRow, "category"> & {
  category: SkillCategory | "Total";
};

function buildCategorySummary(rows: SkillRow[]): CategorySummaryRow[] {
  return categoryOrder
    .map((category) => {
      const categoryRows = rows.filter(
        (skill) => skillCategory(skill.name) === category,
      );
      const left = categoryRows.reduce(
        (sum, skill) => sum + (skill.xp.left ?? 0),
        0,
      );
      const right = categoryRows.reduce(
        (sum, skill) => sum + (skill.xp.right ?? 0),
        0,
      );
      return {
        category,
        left,
        right,
        totalXp: left + right,
        leftAverage:
          categoryRows.reduce(
            (sum, skill) => sum + (skill.level.left ?? 0),
            0,
          ) / Math.max(1, categoryRows.length),
        rightAverage:
          categoryRows.reduce(
            (sum, skill) => sum + (skill.level.right ?? 0),
            0,
          ) / Math.max(1, categoryRows.length),
      };
    })
    .filter((row) => row.totalXp > 0);
}

function CategorySummary({
  names,
  rows,
  overall,
  isLoading,
}: {
  names: [string, string];
  rows: CategorySummaryRow[];
  overall: SkillRow | undefined;
  isLoading: boolean;
}) {
  const labels = names;
  const totalRow: CategoryDisplayRow = {
    category: "Total",
    left: overall?.xp.left ?? rows.reduce((sum, row) => sum + row.left, 0),
    right: overall?.xp.right ?? rows.reduce((sum, row) => sum + row.right, 0),
    totalXp: rows.reduce((sum, row) => sum + row.totalXp, 0),
    leftAverage: overall?.level.left ?? 0,
    rightAverage: overall?.level.right ?? 0,
  };
  return (
    <article className="panel category-summary-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Category summary"
        eyebrow="Combined XP and average level"
      />
      <div className="category-summary-head">
        <span>Category</span>
        <span className="blue-text">
          {labels[0]}
          <br />
          <small>Total XP / Avg lvl</small>
        </span>
        <span className="green-text">
          {labels[1]}
          <br />
          <small>Total XP / Avg lvl</small>
        </span>
        <span>XP diff</span>
        <span>Ahead</span>
      </div>
      {[...rows, totalRow].map((row) => (
        <div
          className={`category-summary-row ${row.category === "Total" ? "total" : ""}`}
          key={row.category}
        >
          <strong>{row.category}</strong>
          <span>
            {formatCompact(row.left)} / {row.leftAverage.toFixed(1)}
          </span>
          <span>
            {formatCompact(row.right)} / {row.rightAverage.toFixed(1)}
          </span>
          <span className={row.left >= row.right ? "blue-text" : "green-text"}>
            {formatCompactDelta(row.left - row.right)}
          </span>
          <b className={row.left > row.right ? "blue-text" : "green-text"}>
            {row.left === row.right
              ? "—"
              : row.left > row.right
                ? labels[0]
                : labels[1]}
          </b>
        </div>
      ))}
      <LoadingOverlay isLoading={isLoading} label="Loading category summary" />
    </article>
  );
}

export function SkillsTable({
  names,
  comparison,
  isLoading,
}: {
  names: [string, string];
  comparison: SkillsComparison | undefined;
  isLoading: boolean;
}) {
  const skillRows =
    comparison?.skills.filter((skill) => skill.key !== "skill.overall") ?? [];
  const previewRows = skillRows
    .filter((skill) => skill.xp.delta !== null && skill.xp.delta !== 0)
    .sort(
      (left, right) =>
        Math.abs(right.xp.delta ?? 0) - Math.abs(left.xp.delta ?? 0),
    )
    .slice(0, 8);
  const rows = previewRows.length > 0 ? previewRows : skillRows.slice(0, 8);
  return (
    <article className="panel skills-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Largest skill gaps"
        eyebrow="Hiscores · Overview preview"
        action={
          <Link to={comparisonPath("skills", names)} className="text-button">
            Full skills page
            <ArrowRight size={13} />
          </Link>
        }
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th className="blue-text player-column">
                <span title={comparison?.left.displayRsn ?? names[0]}>
                  {comparison?.left.displayRsn ?? names[0]}
                </span>
              </th>
              <th>XP</th>
              <th className="green-text player-column">
                <span title={comparison?.right.displayRsn ?? names[1]}>
                  {comparison?.right.displayRsn ?? names[1]}
                </span>
              </th>
              <th>XP</th>
              <th>Delta Level</th>
              <th>Ahead</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((skill) => (
              <tr key={skill.name}>
                <td>
                  <span className="skill-icon">
                    <OsrsSkillIcon name={skill.name} />
                  </span>
                  {skill.name}
                </td>
                <td className="blue-text">{formatValue(skill.level.left)}</td>
                <td>{formatValue(skill.xp.left)}</td>
                <td className="green-text">{formatValue(skill.level.right)}</td>
                <td>{formatValue(skill.xp.right)}</td>
                <td
                  className={
                    skill.level.leader === "right" ? "green-text" : "blue-text"
                  }
                >
                  {formatDelta(skill.level.delta)}
                </td>
                <td>
                  <span
                    className={`winner ${skill.level.leader === "right" ? "green" : "blue"}`}
                    title={sideBadgeTitle(skill.level.leader, names)}
                  >
                    <span aria-hidden="true">
                      {sideBadgeLabel(skill.level.leader)}
                    </span>
                    <span className="sr-only">
                      {sideBadgeTitle(skill.level.leader, names)}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading skills" />
    </article>
  );
}

function OsrsSkillIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`osrs-skill-icon ${className}`.trim()}
      src={skillIconUrls[name] ?? skillsIconUrl}
    />
  );
}

function sideBadgeLabel(
  leader: "left" | "right" | "tie" | "indeterminate" | null | undefined,
) {
  if (leader === "left") return "P1";
  if (leader === "right") return "P2";
  if (leader === "tie") return "Tie";
  return "-";
}

function sideBadgeTitle(
  leader: "left" | "right" | "tie" | "indeterminate" | null | undefined,
  names: [string, string],
) {
  if (leader === "left") return `${names[0]} ahead`;
  if (leader === "right") return `${names[1]} ahead`;
  if (leader === "tie") return "Tied";
  return "Leader unavailable";
}

function nextMajorMilestoneLevel(level: number) {
  return (
    [50, 75, 90, 99, 100, 110, 120, 126].find(
      (milestone) => milestone > level,
    ) ?? 126
  );
}

function milestoneRemaining(skill: SkillRow, side: "left" | "right") {
  const level = skill.level[side] ?? 1;
  const xp = skill.xp[side] ?? 0;
  return Math.max(0, xpForLevel(nextMajorMilestoneLevel(level)) - xp);
}
