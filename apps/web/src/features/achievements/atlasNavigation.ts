import { type AtlasSectionId, atlasSections } from "./atlasData";

export type AtlasJumpDestination = {
  section: AtlasSectionId;
  groupId?: string;
  lane?: number;
  row?: number;
};
export type AtlasJumpOption = {
  id: string;
  label: string;
  destination: AtlasJumpDestination;
};

/** Static navigation metadata; no viewport subscription or per-pan rebuilding. */
export const atlasJumpSections = atlasSections.map((section) => {
  const options: AtlasJumpOption[] = [
    {
      id: `section/${section.id}`,
      label: `${section.label} · overview`,
      destination: { section: section.id },
    },
  ];
  section.paths.forEach((label, lane) => {
    if (label)
      options.push({
        id: `path/${section.id}/${lane}`,
        label,
        destination: { section: section.id, lane },
      });
  });
  for (const group of section.groups) {
    options.push({
      id: `group/${group.id}`,
      label: group.label,
      destination: { section: section.id, groupId: group.id },
    });
    group.paths.forEach((path, index) => {
      options.push({
        id: `path/${group.id}/${index}`,
        label: `${group.label} / ${path.label}`,
        destination: {
          section: section.id,
          groupId: group.id,
          lane: path.lane,
          row: path.row,
        },
      });
    });
  }
  return { id: section.id, label: section.label, options };
});
