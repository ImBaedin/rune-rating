import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  getBezierPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Viewport,
  ViewportPortal,
} from "@xyflow/react";
import {
  ArrowRight,
  Check,
  Focus,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
} from "lucide-react";
import {
  type CSSProperties,
  createContext,
  memo,
  type RefObject,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { atlasGroupById, isAtlasGraphLink, rowHeight } from "./atlasData";
import {
  type AtlasCategory,
  type AtlasNode,
  atlasColor,
  atlasNodeById,
  atlasNodes,
  atlasSections,
  laneWidth,
  statusLabels,
} from "./atlasPreview";
import { connectionHandles, hasBlockingNode } from "./atlasRouting";
import {
  type AtlasPan,
  atlasInitialZoom,
  atlasMaxZoom,
  atlasMinZoom,
  atlasNodeHeight,
  atlasNodeWidth,
  sectionAtViewportCenter,
  sectionViewport,
} from "./atlasViewport";
import { useAtlasSafariGesture } from "./useAtlasSafariGesture";

export type AtlasNavigation = {
  section: AtlasCategory;
  nodeId?: string;
  lane?: number;
  groupId?: string;
  row?: number;
};
type MilestoneNode = Node<
  {
    milestone: AtlasNode;
    dimmed: boolean;
    prerequisite: boolean;
    active: boolean;
    hovered: boolean;
  },
  "milestone"
>;
type MilestoneEdge = Edge<{
  kind: string;
  dimmed: boolean;
  complete: boolean;
  active: boolean;
  detour: boolean;
}>;
type GraphProps = {
  nodes: AtlasNode[];
  navigation: AtlasNavigation;
  paused: boolean;
  onReset: () => void;
  nodeIcons: RefObject<Map<string, HTMLElement>>;
  visibleIds: Set<string>;
  matchingIds: Set<string>;
  activePath: Set<string>;
  selectedId: string | null;
  hoveredId: string | null;
  onPreview: (id: string | null, immediate?: boolean) => void;
  onSelect: (id: string) => void;
  onInteractionStart: () => void;
  onDragChange: (active: boolean) => void;
  onSectionChange: (section: AtlasCategory) => void;
};
type NodeActions = Pick<GraphProps, "nodeIcons" | "onPreview" | "onSelect"> & {
  reveal: (element: HTMLElement) => void;
};
const NodeActionsContext = createContext<NodeActions | null>(null);
const bridges = new Map<string, number>();
const connections = atlasNodes.flatMap((node) =>
  node.links.flatMap((link) => {
    const parent = atlasNodeById.get(link.id);
    if (!parent) return [];
    if (!isAtlasGraphLink(parent.id, node.id, link)) {
      bridges.set(node.id, (bridges.get(node.id) ?? 0) + 1);
      bridges.set(parent.id, (bridges.get(parent.id) ?? 0) + 1);
      return [];
    }
    const detour = hasBlockingNode(parent, node, atlasNodes);
    return [
      {
        parent,
        node,
        kind: link.kind,
        detour,
        ...connectionHandles(parent, node, detour),
      },
    ];
  }),
);

const Milestone = memo(function Milestone({ data }: NodeProps<MilestoneNode>) {
  const actions = useContext(NodeActionsContext);
  if (!actions) throw new Error("Milestone rendered outside the atlas");
  const node = data.milestone;
  const bridgeCount = bridges.get(node.id) ?? 0;
  return (
    <div
      className="atlas-node"
      data-status={node.status}
      data-destination={node.destination || undefined}
      data-dimmed={data.dimmed}
      data-prerequisite={data.prerequisite}
      data-selected={data.active}
      data-tooltip-above={node.position[1] > 400}
      style={{ "--node-color": atlasColor(node.category) } as CSSProperties}
    >
      <div
        className="atlas-node-icon"
        ref={(element) => {
          if (element) actions.nodeIcons.current.set(node.id, element);
          else actions.nodeIcons.current.delete(node.id);
        }}
      >
        <Handle
          id="in"
          type="target"
          position={Position.Top}
          isConnectable={false}
        />
        <Handle
          id="out"
          type="source"
          position={Position.Bottom}
          isConnectable={false}
        />
        <Handle
          id="in-left"
          type="target"
          position={Position.Left}
          isConnectable={false}
        />
        <Handle
          id="in-right"
          type="target"
          position={Position.Right}
          isConnectable={false}
        />
        <Handle
          id="left"
          type="source"
          position={Position.Left}
          isConnectable={false}
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          isConnectable={false}
        />
        <img
          className="atlas-game-icon"
          src={node.icon}
          alt=""
          width={40}
          height={40}
        />
        <span className="atlas-node-status">
          {node.status === "complete" ? (
            <Check size={10} strokeWidth={3} />
          ) : node.status === "locked" ? (
            <LockKeyhole size={9} />
          ) : (
            <span />
          )}
        </span>
      </div>
      <span className="atlas-node-title">{node.name}</span>
      <span className="atlas-node-subtitle">{node.subtitle}</span>
      {bridgeCount > 0 && (
        <span className="atlas-node-bridge">
          <ArrowRight size={10} /> {bridgeCount} in details
        </span>
      )}
      <button
        type="button"
        className="atlas-node-button"
        aria-pressed={data.active}
        aria-label={`${node.name}: ${node.subtitle}. ${statusLabels[node.status]}`}
        onClick={() => actions.onSelect(node.id)}
        onFocus={(event) => {
          if (!event.currentTarget.matches(":focus-visible")) return;
          actions.onPreview(node.id, true);
          actions.reveal(event.currentTarget);
        }}
        onBlur={() => actions.onPreview(null)}
      />
      {data.hovered && (
        <span className="atlas-node-tooltip" role="tooltip">
          <strong>
            {statusLabels[node.status]} <span>MILESTONE</span>
          </strong>
          <span>{node.description}</span>
          <small>
            <MapPin size={11} /> {node.location.name}
          </small>
        </span>
      )}
    </div>
  );
});

function Connection(props: EdgeProps<MilestoneEdge>) {
  let [path] = getBezierPath(props);
  if (props.data?.detour) {
    // Long connections travel beside intervening cards; endpoints still come from handles.
    const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = props;
    const rail = Math.max(sx, tx) + 130;
    path = `M ${sx} ${sy} C ${rail} ${sy}, ${rail} ${sy + 25}, ${rail} ${sy + 55} L ${rail} ${ty - 55} C ${rail} ${ty - 20}, ${tx} ${ty - 20}, ${tx} ${ty}`;
  }
  return (
    <BaseEdge
      id={props.id}
      path={path}
      className="atlas-connection"
      data-kind={props.data?.kind}
      data-dimmed={props.data?.dimmed}
      data-complete={props.data?.complete}
      data-active={props.data?.active}
      interactionWidth={0}
    />
  );
}
const nodeTypes = { milestone: Milestone };
const edgeTypes = { atlas: Connection };

export function AchievementGraph(props: GraphProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvas(props: GraphProps) {
  const {
    navigation,
    paused,
    onReset,
    onInteractionStart,
    onDragChange,
    onPreview,
  } = props;
  const container = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<MilestoneNode, MilestoneEdge>();
  const initialized = flow.viewportInitialized;
  const lastNavigation = useRef<AtlasNavigation | null>(null);
  const activeNavigation = useRef<AtlasNavigation | null>(null);
  const visibleSection = useRef(navigation.section);
  const viewportWidth = useRef(0);
  const moving = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    viewportWidth.current = element.clientWidth;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) viewportWidth.current = entry.contentRect.width;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  const nodes: MilestoneNode[] = useMemo(
    () =>
      props.nodes.map((node) => ({
        id: node.id,
        type: "milestone",
        position: {
          x: node.position[0] - atlasNodeWidth / 2,
          y: node.position[1] - (node.destination ? 48 : 36),
        },
        width: atlasNodeWidth,
        height: atlasNodeHeight,
        handles: [
          {
            id: "in",
            type: "target",
            position: Position.Top,
            x: 94.5,
            y: -0.5,
            width: 1,
            height: 1,
          },
          {
            id: "out",
            type: "source",
            position: Position.Bottom,
            x: 94.5,
            y: (node.destination ? 96 : 72) - 0.5,
            width: 1,
            height: 1,
          },
          {
            id: "left",
            type: "source",
            position: Position.Left,
            x: 95 - (node.destination ? 48 : 36) - 0.5,
            y: (node.destination ? 48 : 36) - 0.5,
            width: 1,
            height: 1,
          },
          {
            id: "in-left",
            type: "target",
            position: Position.Left,
            x: 95 - (node.destination ? 48 : 36) - 0.5,
            y: (node.destination ? 48 : 36) - 0.5,
            width: 1,
            height: 1,
          },
          {
            id: "in-right",
            type: "target",
            position: Position.Right,
            x: 95 + (node.destination ? 48 : 36) - 0.5,
            y: (node.destination ? 48 : 36) - 0.5,
            width: 1,
            height: 1,
          },
          {
            id: "right",
            type: "source",
            position: Position.Right,
            x: 95 + (node.destination ? 48 : 36) - 0.5,
            y: (node.destination ? 48 : 36) - 0.5,
            width: 1,
            height: 1,
          },
        ],
        data: {
          milestone: node,
          dimmed: !props.visibleIds.has(node.id),
          prerequisite:
            props.visibleIds.has(node.id) && !props.matchingIds.has(node.id),
          active: props.selectedId === node.id,
          hovered: !props.selectedId && props.hoveredId === node.id,
        },
        zIndex:
          props.hoveredId === node.id || props.selectedId === node.id ? 10 : 1,
      })),
    [
      props.nodes,
      props.visibleIds,
      props.matchingIds,
      props.selectedId,
      props.hoveredId,
    ],
  );
  const nodeById = useMemo(
    () => new Map(props.nodes.map((node) => [node.id, node])),
    [props.nodes],
  );
  const edges: MilestoneEdge[] = useMemo(
    () =>
      connections.map(
        ({ parent, node, sourceHandle, targetHandle, kind, detour }) => ({
          id: `${parent.id}-${node.id}`,
          source: parent.id,
          target: node.id,
          sourceHandle,
          targetHandle,
          type: "atlas",
          data: {
            kind,
            detour,
            dimmed:
              !props.visibleIds.has(parent.id) ||
              !props.visibleIds.has(node.id),
            complete:
              nodeById.get(parent.id)?.status === "complete" &&
              nodeById.get(node.id)?.status === "complete",
            active:
              props.activePath.has(parent.id) && props.activePath.has(node.id),
          },
        }),
      ),
    [props.visibleIds, props.activePath, nodeById],
  );

  useEffect(() => {
    if (!initialized || lastNavigation.current === navigation) return;
    const bounds = container.current?.getBoundingClientRect();
    const section = atlasSections.find(
      (item) => item.id === navigation.section,
    );
    if (!bounds || !section) return;
    const zoom = flow.getZoom();
    const next = sectionViewport(section, bounds.width, zoom);
    const group = atlasGroupById.get(navigation.groupId ?? "");
    if (group)
      next.y = 20 - (group.row + (navigation.row ?? 0)) * rowHeight * zoom;
    const node = navigation.nodeId
      ? atlasNodeById.get(navigation.nodeId)
      : undefined;
    if (node) {
      const availableWidth = bounds.width - (bounds.width > 800 ? 330 : 0);
      next.x = availableWidth / 2 - node.position[0] * zoom;
      next.y = bounds.height / 2 - node.position[1] * zoom;
    } else if (navigation.lane !== undefined) {
      next.x =
        bounds.width / 2 -
        (section.x + 160 + navigation.lane * laneWidth) * zoom;
    }
    activeNavigation.current = navigation;
    visibleSection.current = navigation.section;
    void flow
      .setViewport(next, {
        duration: lastNavigation.current && !paused ? 650 : 0,
      })
      .then(() => {
        if (activeNavigation.current === navigation)
          activeNavigation.current = null;
      });
    lastNavigation.current = navigation;
  }, [navigation, initialized, flow, paused]);

  function beginInteraction() {
    activeNavigation.current = null;
    onInteractionStart();
  }

  function syncVisibleSection(viewport: Viewport) {
    if (activeNavigation.current) return;
    const width = viewportWidth.current;
    if (!width) return;
    const section = sectionAtViewportCenter(atlasSections, viewport, width);
    if (section && section.id !== visibleSection.current) {
      visibleSection.current = section.id;
      startTransition(() => props.onSectionChange(section.id));
    }
  }

  function startMove() {
    if (settle.current) clearTimeout(settle.current);
    if (!moving.current) {
      moving.current = true;
      onDragChange(true);
    }
  }
  function endMove() {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      moving.current = false;
      onDragChange(false);
    }, 160);
  }
  useAtlasSafariGesture(
    container,
    () => {
      beginInteraction();
      startMove();
    },
    endMove,
  );

  const reveal = useCallback(
    (element: HTMLElement) => {
      const bounds = container.current?.getBoundingClientRect();
      if (!bounds) return;
      const rect = element.getBoundingClientRect();
      const x =
        rect.left < bounds.left
          ? bounds.left + 20 - rect.left
          : rect.right > bounds.right
            ? bounds.right - 20 - rect.right
            : 0;
      const y =
        rect.top < bounds.top
          ? bounds.top + 20 - rect.top
          : rect.bottom > bounds.bottom
            ? bounds.bottom - 20 - rect.bottom
            : 0;
      if (x || y) {
        const view = flow.getViewport();
        void flow.setViewport({ ...view, x: view.x + x, y: view.y + y });
      }
    },
    [flow],
  );
  const actions = useMemo(
    () => ({
      nodeIcons: props.nodeIcons,
      onSelect: props.onSelect,
      onPreview,
      reveal,
    }),
    [props.nodeIcons, props.onSelect, onPreview, reveal],
  );

  return (
    <NodeActionsContext value={actions}>
      <div className="atlas-graph-viewport" ref={container}>
        <ReactFlow<MilestoneNode, MilestoneEdge>
          nodes={nodes}
          onlyRenderVisibleElements
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: 24, y: 20, zoom: atlasInitialZoom }}
          minZoom={atlasMinZoom}
          maxZoom={atlasMaxZoom}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          autoPanOnNodeFocus={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnScroll
          panOnScrollSpeed={1}
          paneClickDistance={5}
          nodeClickDistance={5}
          preventScrolling
          attributionPosition="top-right"
          onMoveStart={(event, viewport) => {
            if (event) beginInteraction();
            syncVisibleSection(viewport);
            startMove();
          }}
          onMove={(_event, viewport) => syncVisibleSection(viewport)}
          onMoveEnd={(_event, viewport) => {
            syncVisibleSection(viewport);
            endMove();
          }}
          onNodeMouseEnter={(_event, node) => {
            if (!moving.current) onPreview(node.id);
          }}
          onNodeMouseMove={(_event, node) => {
            if (!moving.current && props.hoveredId !== node.id)
              onPreview(node.id);
          }}
          onNodeMouseLeave={() => onPreview(null)}
          aria-label="Milestone canvas; drag, scroll, or use arrow keys to pan, pinch to zoom, Home to recenter"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.target instanceof HTMLInputElement ||
              event.target instanceof HTMLSelectElement
            )
              return;
            if (event.key === "Home") {
              event.preventDefault();
              beginInteraction();
              void flow.zoomTo(atlasInitialZoom);
              onReset();
              return;
            }
            const amount = event.shiftKey ? 150 : 48;
            const directions: Record<string, AtlasPan> = {
              ArrowLeft: { x: amount, y: 0 },
              ArrowRight: { x: -amount, y: 0 },
              ArrowUp: { x: 0, y: amount },
              ArrowDown: { x: 0, y: -amount },
            };
            const delta = directions[event.key];
            if (delta) {
              event.preventDefault();
              beginInteraction();
              const current = flow.getViewport();
              void flow.setViewport({
                ...current,
                x: current.x + delta.x,
                y: current.y + delta.y,
              });
            }
          }}
        >
          <AtlasBackdrop />
        </ReactFlow>
      </div>
      <ZoomControls
        onReset={onReset}
        paused={paused}
        onInteractionStart={beginInteraction}
      />
    </NodeActionsContext>
  );
}

// Static chapter headings do not rerender when the active tab follows a pan.
const AtlasBackdrop = memo(function AtlasBackdrop() {
  return (
    <ViewportPortal>
      {atlasSections
        .filter((section) => !section.groups.length)
        .map((section) => (
          <div
            key={section.id}
            className="atlas-section-heading"
            style={{ left: section.x + 55, width: section.width - 110 }}
          >
            <strong>
              {String(section.index + 1).padStart(2, "0")} / {section.label}
            </strong>
            {section.paths.map((path, lane) =>
              path ? (
                <span key={path} style={{ left: 105 + lane * laneWidth }}>
                  {path}
                </span>
              ) : null,
            )}
          </div>
        ))}
      {atlasSections.flatMap((section) =>
        section.groups.map((group, index) => (
          <div
            key={group.id}
            className="atlas-group"
            data-group={group.id}
            data-alternate={index % 2 === 1}
            style={
              {
                left: section.x + 40,
                top: group.row * rowHeight + 12,
                width: section.width - 80,
                height: group.rows * rowHeight + 120,
                "--group-color": atlasColor(section.id),
              } as CSSProperties
            }
          >
            <span className="atlas-group-kicker">
              {section.label} / {String(index + 1).padStart(2, "0")}
            </span>
            <strong>{group.label}</strong>
            <p>{group.description}</p>
            {group.paths.map((path) => (
              <span
                className="atlas-group-path"
                key={path.label}
                style={{
                  left: 120 + path.lane * laneWidth,
                  top: 96 + path.row * rowHeight,
                }}
              >
                {path.label}
              </span>
            ))}
          </div>
        )),
      )}
    </ViewportPortal>
  );
});

function ZoomControls({
  onReset,
  paused,
  onInteractionStart,
}: {
  onReset: () => void;
  paused: boolean;
  onInteractionStart: () => void;
}) {
  const flow = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const options = { duration: paused ? 0 : 180 };
  return (
    <fieldset className="atlas-zoom" aria-label="Graph zoom controls">
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom <= atlasMinZoom}
        onClick={() => {
          onInteractionStart();
          void flow.zoomTo(Math.max(atlasMinZoom, zoom - 0.17), options);
        }}
      >
        <Minus size={15} />
      </button>
      <span aria-live="polite">
        {Math.round((zoom / atlasInitialZoom) * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom >= atlasMaxZoom}
        onClick={() => {
          onInteractionStart();
          void flow.zoomTo(Math.min(atlasMaxZoom, zoom + 0.17), options);
        }}
      >
        <Plus size={15} />
      </button>
      <button
        type="button"
        aria-label="Reset graph view"
        onClick={() => {
          onInteractionStart();
          void flow.zoomTo(atlasInitialZoom);
          onReset();
        }}
      >
        <Focus size={15} />
      </button>
    </fieldset>
  );
}
