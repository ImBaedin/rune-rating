import XpTimelinePage from "../../../XpTimelinePage";
import { useComparisonShell } from "../context";

export function XpTimelineRoutePage() {
  const { comparison, names } = useComparisonShell();
  return (
    <XpTimelinePage
      names={names}
      skills={
        comparison?.skills.filter((skill) => skill.key !== "skill.overall") ??
        []
      }
      currentXp={{
        left:
          comparison?.skills.find((skill) => skill.key === "skill.overall")?.xp
            .left ?? null,
        right:
          comparison?.skills.find((skill) => skill.key === "skill.overall")?.xp
            .right ?? null,
      }}
    />
  );
}
