import {
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  ExternalLink,
  Focus,
  Info,
  LockKeyhole,
  MapPin,
  MousePointer2,
  Search,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppHeader } from "../components/AppHeader";
import { BaseDialog } from "../components/BaseDialog";
import { AtlasAccountLookup } from "../features/achievements/AtlasAccountLookup";
import {
  AtlasCamera,
  type AtlasCameraHandle,
  type AtlasCameraTarget,
} from "../features/achievements/AtlasCamera";
import { AtlasEvidence } from "../features/achievements/AtlasEvidence";
import {
  AchievementGraph,
  type AtlasNavigation,
} from "../features/achievements/AtlasGraph";
import { AtlasJumpMenu } from "../features/achievements/AtlasJumpMenu";
import { AtlasRequirements } from "../features/achievements/AtlasRequirements";
import {
  findAtlasMilestones,
  normalizeMilestoneSearch,
} from "../features/achievements/atlasMilestoneSearch";
import type { AtlasJumpDestination } from "../features/achievements/atlasNavigation";
import {
  type AtlasCategory,
  type AtlasNode,
  atlasCategories,
  atlasColor,
  atlasSections,
  connectionLabels,
  defaultAtlasLocation,
  defaultAtlasNode,
  prerequisiteIds,
  statusLabels,
} from "../features/achievements/atlasPreview";
import {
  type AtlasAccount,
  useAtlasAccount,
} from "../features/achievements/useAtlasAccount";
import { useDecorativeMotionPaused } from "../features/decorativeMotion";

export function AchievementsPage() {
  const account = useAtlasAccount();
  const { nodes: atlasNodes, nodeById: atlasNodeById } = account;
  const [category, setCategory] = useState<AtlasCategory>("quests");
  const [navigation, setNavigation] = useState<AtlasNavigation>({
    section: "quests",
  });
  const currentSection =
    atlasSections.find((section) => section.id === category) ??
    atlasSections[0];
  if (!currentSection) throw new Error("Atlas has no sections");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lastViewed, setLastViewed] = useState<AtlasCameraTarget | null>(null);
  const [focusPath, setFocusPath] = useState(false);
  const paused = useDecorativeMotionPaused();
  const mapLayer = useRef<HTMLDivElement>(null);
  const mapCamera = useRef<AtlasCameraHandle>(null);
  const nodeIcons = useRef(new Map<string, HTMLElement>());
  const dragging = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchResults = useRef<HTMLFieldSetElement>(null);
  const detailsTrigger = useRef<HTMLElement | null>(null);

  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  const viewedNode = atlasNodeById.get(
    selectedId ?? hoveredId ?? lastViewed?.id ?? "",
  );
  const activeNode = viewedNode ?? defaultAtlasNode;
  const cameraLocation = viewedNode?.location ?? defaultAtlasLocation;
  const query = normalizeMilestoneSearch(search);
  const matches = useMemo(
    () => findAtlasMilestones(atlasNodes, query),
    [query, atlasNodes],
  );
  const hasSearchResults = !!query && matches.length > 0;
  useEffect(() => {
    const popup = searchResults.current;
    if (!hasSearchResults || !popup) return;
    const viewport = window.visualViewport;
    function resizeResults() {
      if (!popup) return;
      const bottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;
      const available = Math.max(
        0,
        bottom - popup.getBoundingClientRect().top - 12,
      );
      popup.style.maxHeight = `${available}px`;
    }
    resizeResults();
    const observer = new ResizeObserver(resizeResults);
    const heading = popup.closest(".atlas")?.querySelector(".atlas-heading");
    if (heading) observer.observe(heading);
    if (popup.parentElement) observer.observe(popup.parentElement);
    window.addEventListener("resize", resizeResults);
    viewport?.addEventListener("resize", resizeResults);
    viewport?.addEventListener("scroll", resizeResults);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeResults);
      viewport?.removeEventListener("resize", resizeResults);
      viewport?.removeEventListener("scroll", resizeResults);
    };
  }, [hasSearchResults]);
  const matchingIds = useMemo(
    () => new Set(matches.map((node) => node.id)),
    [matches],
  );
  const visibleIds = useMemo(
    () => prerequisiteIds(focusPath ? [activeNode.id] : matchingIds),
    [focusPath, activeNode.id, matchingIds],
  );
  const activePath = useMemo(
    () => prerequisiteIds([activeNode.id]),
    [activeNode.id],
  );

  const clearHover = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoveredId(null);
  }, []);

  const closeDetails = useCallback(() => {
    clearHover();
    setSelectedId(null);
    setFocusPath(false);
    const trigger = detailsTrigger.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    else searchInput.current?.focus({ preventScroll: true });
  }, [clearHover]);

  useEffect(() => {
    if (!selectedId) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Let a nested menu or dialog handle its own Escape first.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      event.preventDefault();
      closeDetails();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [selectedId, closeDetails]);

  const previewNode = useCallback(
    (id: string | null, immediate = false) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (id === null) {
        setHoveredId(null);
        return;
      }
      if (selectedId || (dragging.current && !immediate)) return;
      const showPreview = () => {
        setHoveredId(id);
        setLastViewed((current) =>
          immediate && current?.id === id
            ? current
            : {
                id,
                element: () => nodeIcons.current.get(id) ?? null,
                pullBack: !immediate,
              },
        );
      };
      if (immediate) showPreview();
      else hoverTimer.current = setTimeout(showPreview, 220);
    },
    [selectedId],
  );

  const selectNode = useCallback(
    (id: string, jump = false) => {
      const trigger = document.activeElement;
      if (
        trigger instanceof HTMLElement &&
        !trigger.closest(".atlas-details")
      ) {
        detailsTrigger.current =
          trigger === document.body || trigger.closest(".atlas-search")
            ? searchInput.current
            : trigger;
      }
      const node = atlasNodeById.get(id);
      const icon = nodeIcons.current.get(id);
      const bounds = icon?.getBoundingClientRect();
      const canvas = icon
        ?.closest(".atlas-graph-viewport")
        ?.getBoundingClientRect();
      if (
        node &&
        (jump ||
          !bounds ||
          !canvas ||
          bounds.left < canvas.left ||
          bounds.right > canvas.right - (window.innerWidth > 820 ? 330 : 0) ||
          bounds.top < canvas.top ||
          bounds.bottom > canvas.bottom)
      ) {
        setCategory(node.category);
        setNavigation({ section: node.category, nodeId: id });
      }
      setSearch("");
      clearHover();
      setSelectedId(id);
      // Pinning the preview must not restart its camera flight.
      setLastViewed((current) =>
        current?.id === id
          ? current
          : {
              id,
              element: () => nodeIcons.current.get(id) ?? null,
              pullBack: false,
            },
      );
    },
    [clearHover, atlasNodeById],
  );

  function navigateTo(destination: AtlasJumpDestination) {
    setCategory(destination.section);
    setFocusPath(false);
    setSelectedId(null);
    clearHover();
    setSearch("");
    setNavigation({ ...destination });
  }

  function resetView() {
    clearHover();
    setSelectedId(null);
    setFocusPath(false);
    setSearch("");
    setNavigation({ section: category });
  }

  function parallax(event: PointerEvent<HTMLElement>) {
    if (paused || dragging.current || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    mapLayer.current?.style.setProperty(
      "--parallax-x",
      `${(event.clientX / bounds.width - 0.5) * 12}px`,
    );
    mapLayer.current?.style.setProperty(
      "--parallax-y",
      `${((event.clientY - bounds.top) / bounds.height - 0.5) * 12}px`,
    );
  }

  const changeDragging = useCallback(
    (active: boolean) => {
      dragging.current = active;
      if (active) clearHover();
    },
    [clearHover],
  );
  const freezeCamera = useCallback(
    () => mapCamera.current?.freezeFocalPoint(),
    [],
  );

  return (
    <div className="achievement-page" data-motion-paused={paused}>
      <AppHeader active="achievements" />
      <main
        id="public-content"
        className="atlas"
        onPointerMove={parallax}
        onPointerLeave={() => {
          mapLayer.current?.style.setProperty("--parallax-x", "0px");
          mapLayer.current?.style.setProperty("--parallax-y", "0px");
        }}
      >
        <div className="atlas-world" ref={mapLayer} aria-hidden="true">
          <AtlasCamera
            ref={mapCamera}
            location={cameraLocation}
            target={lastViewed}
            paused={paused}
          />
        </div>
        <div className="atlas-shade" aria-hidden="true" />

        <AtlasHeading account={account} />

        <div className="atlas-toolbar">
          <fieldset
            className="atlas-filters"
            aria-label="Achievement categories"
          >
            {atlasCategories.map(({ id, label, icon, color }) => (
              <AtlasJumpMenu
                key={id}
                section={id}
                label={label}
                icon={icon}
                color={color}
                active={category === id}
                onNavigate={navigateTo}
              />
            ))}
          </fieldset>
          <div className="atlas-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInput}
              aria-label="Find a milestone"
              name="milestone"
              autoComplete="off"
              spellCheck={false}
              placeholder="Find a milestone…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setFocusPath(false);
                searchResults.current?.scrollTo(0, 0);
              }}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear milestone search"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
            {query && matches.length > 0 && (
              <fieldset
                ref={searchResults}
                className="atlas-search-results"
                aria-label="Matching milestones"
              >
                {matches.slice(0, 8).map((node) => (
                  <button
                    type="button"
                    key={node.id}
                    onClick={() => selectNode(node.id, true)}
                  >
                    <img src={node.icon} alt="" width={24} height={24} />
                    <span>
                      {node.name}
                      <small>
                        {
                          atlasCategories.find(
                            (section) => section.id === node.category,
                          )?.label
                        }{" "}
                        · {node.subtitle}
                      </small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))}
                <small>
                  Showing {Math.min(8, matches.length)} of {matches.length}{" "}
                  matching milestones
                  {matches.length > 8
                    ? ". Refine your search to find more."
                    : "."}
                </small>
              </fieldset>
            )}
          </div>
        </div>

        <div className="atlas-workspace">
          <section className="atlas-map" aria-label="Achievement graph">
            <div className="atlas-map-caption">
              <span className="atlas-overline">
                {String(currentSection.index + 1).padStart(2, "0")} /{" "}
                {currentSection.label.toUpperCase()}
              </span>
              <span>
                {focusPath
                  ? "Following connected milestones"
                  : currentSection.description}
              </span>
            </div>
            <AchievementGraph
              nodes={atlasNodes}
              navigation={navigation}
              paused={paused}
              onReset={resetView}
              nodeIcons={nodeIcons}
              visibleIds={visibleIds}
              matchingIds={matchingIds}
              activePath={activePath}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onPreview={previewNode}
              onSelect={selectNode}
              onInteractionStart={freezeCamera}
              onDragChange={changeDragging}
              onSectionChange={setCategory}
            />
            {matches.length === 0 && !focusPath && (
              <div className="atlas-empty" role="status">
                <Search size={24} />
                <strong>No milestones found</strong>
                <p>Try another milestone name.</p>
                <button type="button" onClick={resetView}>
                  Clear search <ArrowRight size={14} />
                </button>
              </div>
            )}
            <div className="atlas-map-bottom">
              <div className="atlas-location" aria-live="polite">
                <MapPin size={14} />
                <span>{cameraLocation.name}</span>
              </div>
              <span className="atlas-map-hint">
                <MousePointer2 size={12} /> Drag or scroll to pan · pinch to
                zoom
              </span>
            </div>
          </section>

          {selectedId && (
            <AchievementDetails
              account={account}
              node={activeNode}
              focusPath={focusPath}
              onClose={closeDetails}
              onFocus={() => {
                selectNode(activeNode.id);
                setFocusPath(!focusPath);
              }}
              onSelect={selectNode}
            />
          )}
        </div>

        <footer className="atlas-footer">
          <p>Select a milestone to see its requirements and related goals.</p>
          <a
            href="https://oldschool.runescape.wiki/w/File:Old_School_RuneScape_world_map.png"
            target="_blank"
            rel="noreferrer"
          >
            Map © Jagex · OSRS Wiki <ExternalLink size={11} />
          </a>
        </footer>
      </main>
    </div>
  );
}

function AtlasHeading({ account }: { account: AtlasAccount }) {
  return (
    <header className="atlas-heading">
      <div>
        <h1>Achievement atlas</h1>
        <span className="atlas-preview-tag">{account.rsn ?? "EXPLORE"}</span>
      </div>
      <div className="atlas-account-note">
        <div>
          <AtlasAccountLookup key={account.rsn ?? "sample"} account={account} />
        </div>
        <BaseDialog
          trigger={
            <>
              <Info size={16} />
              <span className="atlas-sr-only">About the achievement atlas</span>
            </>
          }
          title="Your achievement atlas"
          description="Explore connected milestones and your account’s progress."
        >
          <div className="atlas-about">
            <p>
              Follow a quest line, plan an upgrade or find your next grind.
              Search for a milestone or use the category menus to jump around.
              Enter your RuneScape name to see your progress.
            </p>
            <p>
              Account progress requires a public RuneProfile. Enable the
              RuneProfile plugin and sync your account to get started. “Unknown”
              means we don’t have enough data to check a milestone.
            </p>
            <p>
              Paths show selected prerequisites. Check the Wiki guide for the
              full requirements. Equipment milestones track logged acquisitions
              or components; they do not confirm current ownership or assembly.
              Refreshing checks provider data, so sync the RuneProfile plugin
              first if your recent progress is missing.
            </p>
            <p>
              Select a milestone to open its details. Press Escape to close
              them.
            </p>
            <p>
              Map imagery © Jagex, sourced from the{" "}
              <a
                href="https://oldschool.runescape.wiki/w/File:Old_School_RuneScape_world_map.png"
                target="_blank"
                rel="noreferrer"
              >
                OSRS Wiki
              </a>
              .
            </p>
          </div>
        </BaseDialog>
      </div>
    </header>
  );
}

function AchievementDetails({
  account,
  node,
  focusPath,
  onClose,
  onFocus,
  onSelect,
}: {
  account: AtlasAccount;
  node: AtlasNode;
  focusPath: boolean;
  onClose: () => void;
  onFocus: () => void;
  onSelect: (id: string) => void;
}) {
  const { nodes: atlasNodes, nodeById: atlasNodeById } = account;
  const closeButtonId = `atlas-close-${node.id}`;
  useEffect(() => {
    document.getElementById(closeButtonId)?.focus({ preventScroll: true });
  }, [closeButtonId]);
  const parents = node.parents
    .map((id) => atlasNodeById.get(id))
    .filter((item): item is AtlasNode => Boolean(item));
  const children = atlasNodes.filter(
    (item) =>
      item.parents.includes(node.id) ||
      item.requirements?.some(
        (requirement) => requirement.milestoneId === node.id,
      ),
  );
  return (
    <aside
      className="atlas-details"
      aria-label="Milestone details"
      style={{ "--node-color": atlasColor(node.category) } as CSSProperties}
    >
      <div className="atlas-details-top">
        <span className="atlas-overline">SELECTED MILESTONE</span>
        <button
          id={closeButtonId}
          type="button"
          aria-label="Close milestone details"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="atlas-detail-content" key={node.id}>
        <div className="atlas-detail-art">
          <img
            className="atlas-game-icon"
            src={node.icon}
            alt=""
            width={48}
            height={48}
          />
        </div>
        <div className="atlas-detail-type">
          {atlasCategories
            .find((item) => item.id === node.category)
            ?.label.toUpperCase()}{" "}
          <span>·</span> {account.rsn ?? "SAMPLE"}
        </div>
        <h2>{node.name}</h2>
        <p className="atlas-detail-subtitle">{node.subtitle}</p>
        <p className="atlas-detail-description">{node.description}</p>
        <div className="atlas-detail-status" data-status={node.status}>
          {node.status === "complete" ? (
            <Check size={13} />
          ) : node.status === "locked" ? (
            <LockKeyhole size={12} />
          ) : (
            <Compass size={13} />
          )}
          {statusLabels[node.status]}
          {!account.rsn && <small>Sample progress</small>}
        </div>

        {account.rsn && (
          <AtlasEvidence
            rsn={account.rsn}
            nodeId={node.id}
            onSelect={onSelect}
          />
        )}
        <div className="atlas-completion-rule">
          <span className="atlas-overline">TO COMPLETE</span>
          <p>{node.completion}</p>
          {node.rule.type === "items" && (
            <ul>
              {node.rule.items.map((item) => (
                <li key={item.key ?? item.name}>
                  {item.quantity > 1 ? `${item.quantity} × ` : ""}
                  {item.name}
                </li>
              ))}
            </ul>
          )}
          {node.heuristic && (
            <p className="atlas-heuristic">{node.heuristic}</p>
          )}
        </div>
        {node.requirements?.length ? (
          <AtlasRequirements
            requirements={node.requirements}
            onSelect={onSelect}
          />
        ) : null}
        <div className="atlas-detail-connections">
          {parents.length > 0 && (
            <span className="atlas-overline">
              {node.rule.type === "any"
                ? "ANY ONE OF THESE"
                : "RELATED MILESTONES"}
            </span>
          )}
          {parents.length > 0 &&
            parents.map((parent) => (
              <button
                key={parent.id}
                type="button"
                onClick={() => onSelect(parent.id)}
              >
                <span
                  className="atlas-requirement-state"
                  data-complete={parent.status === "complete"}
                >
                  {parent.status === "complete" ? (
                    <Check size={12} />
                  ) : (
                    <span />
                  )}
                </span>
                <span>
                  {parent.name}
                  <small>
                    {
                      connectionLabels[
                        node.links.find((link) => link.id === parent.id)
                          ?.kind ?? "progression"
                      ]
                    }{" "}
                    ·{" "}
                    {
                      atlasCategories.find(
                        (section) => section.id === parent.category,
                      )?.label
                    }
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          {children.length > 0 && (
            <div className="atlas-unlocks">
              <span className="atlas-overline">CONTINUE EXPLORING</span>
              {children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onSelect(child.id)}
                >
                  <img
                    className="atlas-related-icon"
                    src={child.icon}
                    alt=""
                    width={20}
                    height={20}
                  />
                  <span>
                    {child.name}
                    <small>
                      {child.links.some((link) => link.id === node.id)
                        ? connectionLabels[
                            child.links.find((link) => link.id === node.id)
                              ?.kind ?? "progression"
                          ]
                        : "Related requirement"}
                    </small>
                  </span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="atlas-detail-actions">
        <button
          type="button"
          className="atlas-focus-button"
          aria-pressed={focusPath}
          onClick={onFocus}
        >
          <Focus size={15} />
          {focusPath ? "Show surrounding paths" : "Follow this path"}
          <ArrowRight size={15} />
        </button>
        <a
          className="atlas-wiki-link"
          href={`https://oldschool.runescape.wiki/w/${node.wiki}`}
          target="_blank"
          rel="noreferrer"
        >
          OSRS Wiki guide <ExternalLink size={12} />
        </a>
      </div>
    </aside>
  );
}
