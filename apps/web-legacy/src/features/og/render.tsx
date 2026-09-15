import { ImageResponse } from "@vercel/og";
import { tierImage } from "../../runeRatingAssets";
import type { CompareOgModel, RatingOgModel } from "./data";

const dimensions = { width: 1200, height: 630 };
const cacheHeaders = {
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
};

async function bufferedPngResponse(image: ImageResponse) {
  const headers = new Headers(image.headers);
  Object.entries(cacheHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(await image.arrayBuffer(), {
    status: image.status,
    headers,
  });
}

const tierColors: Record<string, { base: string; light: string; dark: string }> =
  {
    Bronze: { base: "#9b6439", light: "#d29a63", dark: "#4f2f1f" },
    Iron: { base: "#a8adb0", light: "#eef2f3", dark: "#5a6267" },
    Steel: { base: "#6b7881", light: "#cbd5dc", dark: "#2c363d" },
    Black: { base: "#242321", light: "#888078", dark: "#090909" },
    Mithril: { base: "#4c5291", light: "#aeb4ff", dark: "#20274f" },
    Adamant: { base: "#4d8f62", light: "#a9d891", dark: "#23452f" },
    Rune: { base: "#2aa7ae", light: "#9df4f1", dark: "#18535e" },
    Dragon: { base: "#b53827", light: "#ff7245", dark: "#551b18" },
    Unranked: { base: "#667085", light: "#d0d5dd", dark: "#1d2939" },
  };

function colorFor(tier: string) {
  return tierColors[tier] ?? tierColors.Unranked!;
}

function rankImageSrc(origin: string | undefined, tier: string | null) {
  if (!tier || tier === "Unranked") return null;

  const src = tierImage(tier);
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  if (!origin) return src;
  return src.startsWith("/") ? `${origin}${src}` : `${origin}/${src}`;
}

function panelStyle() {
  return {
    display: "flex",
    flexDirection: "column" as const,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.055)",
    borderRadius: 24,
    padding: 22,
  };
}

function statRail(stats: Array<{ label: string; value: string }>) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        width: 720,
        height: 126,
        border: "1px solid rgba(190,198,255,0.28)",
        background: "rgba(4,8,18,0.58)",
        borderRadius: 6,
      }}
    >
      {stats.slice(0, 3).map((stat, index) => (
        <div
          key={stat.label}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 240,
            paddingLeft: 30,
            borderLeft:
              index === 0 ? "0" : "1px solid rgba(190,198,255,0.24)",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "rgba(218,222,245,0.66)",
              fontSize: 21,
              fontWeight: 900,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            {stat.label}
          </div>
          <div
            style={{
              display: "flex",
              color: "#fff",
              fontSize: stat.value.length > 10 ? 38 : 46,
              fontWeight: 950,
              marginTop: 12,
              whiteSpace: "nowrap",
            }}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function brand(muted = false) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        color: muted ? "rgba(255,255,255,0.58)" : "#fff",
        fontFamily: "Georgia, serif",
        fontSize: 32,
        fontWeight: 900,
        letterSpacing: 4,
      }}
    >
      RUNERATING
    </div>
  );
}

export function ratingImageResponse(
  model: RatingOgModel,
  options: { origin?: string } = {},
) {
  const colors = colorFor(model.tier);
  const ready = model.status === "ready";
  const rankSrc = rankImageSrc(options.origin, model.tier);
  const displayScore = ready ? String(model.score) : "N/A";
  const nameFontSize =
    model.displayRsn.length > 12 ? 70 : model.displayRsn.length > 10 ? 78 : 88;
  const stats =
    model.stats.length > 0
      ? model.stats
      : [
          { label: "Status", value: "Pending" },
          { label: "Source", value: "Convex" },
          { label: "Identity", value: "RSN" },
        ];

  return bufferedPngResponse(
    new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(115deg, #090b10 0%, #101521 48%, ${colors.dark} 100%)`,
          color: "#fff",
          fontFamily: "Arial, sans-serif",
          padding: 56,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 54,
            top: 164,
            width: 560,
            height: 1,
            background: "rgba(205,212,255,0.24)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -88,
            top: -52,
            width: 530,
            height: 530,
            borderRadius: 530,
            border: `2px solid ${colors.base}`,
            opacity: 0.38,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 82,
            top: 82,
            width: 340,
            height: 340,
            borderRadius: 340,
            border: "1px solid rgba(255,255,255,0.13)",
            background: `linear-gradient(145deg, rgba(255,255,255,0.06), rgba(0,0,0,0.18)), radial-gradient(circle at 50% 50%, ${colors.dark} 0%, rgba(0,0,0,0) 68%)`,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {brand()}
            <div
              style={{
                display: "flex",
                color: colors.light,
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {ready ? "Verified Profile" : "Snapshot Pending"}
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 46 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 640,
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: colors.light,
                  fontFamily: "Georgia, serif",
                  fontSize: 76,
                  fontWeight: 900,
                  letterSpacing: 2,
                  lineHeight: 0.9,
                  textTransform: "uppercase",
                }}
              >
                {model.tier}
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#fff",
                  fontFamily: "Georgia, serif",
                  fontSize: Math.min(nameFontSize, 82),
                  fontWeight: 950,
                  lineHeight: 1,
                  marginTop: 26,
                }}
              >
                {model.displayRsn}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "rgba(255,255,255,0.74)",
                  fontSize: 29,
                  fontWeight: 800,
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 82,
                    height: 1,
                    background: colors.base,
                    marginRight: 22,
                  }}
                />
                {model.percentileLabel}
                <div
                  style={{
                    display: "flex",
                    width: 82,
                    height: 1,
                    background: colors.base,
                    marginLeft: 22,
                  }}
                />
              </div>
              <div style={{ display: "flex", marginTop: 52 }}>
                {statRail(stats)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 392,
                marginLeft: "auto",
                marginTop: 0,
              }}
            >
              {rankSrc ? (
                <img
                  alt={`${model.tier} rank icon`}
                  height={260}
                  src={rankSrc}
                  style={{
                    display: "flex",
                    height: 260,
                    objectFit: "contain",
                    width: 260,
                  }}
                  width={260}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 244,
                    height: 244,
                    borderRadius: 244,
                    background: `linear-gradient(145deg, ${colors.light}, ${colors.base} 48%, ${colors.dark})`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: "#fff",
                      fontSize: 52,
                      fontWeight: 950,
                    }}
                  >
                    N/A
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(4,8,18,0.70)",
                  borderRadius: 6,
                  marginTop: -6,
                  padding: "16px 38px 18px",
                  width: 252,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: "#fff",
                    fontFamily: "Georgia, serif",
                    fontSize: displayScore.length > 3 ? 54 : 72,
                    fontWeight: 950,
                    lineHeight: 1,
                  }}
                >
                  {displayScore}
                </div>
                <div
                  style={{
                    display: "flex",
                    color: colors.light,
                    fontSize: 20,
                    fontWeight: 900,
                    letterSpacing: 6,
                    marginTop: 8,
                    textTransform: "uppercase",
                  }}
                >
                  Score
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "auto",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "rgba(255,255,255,0.44)",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 2,
              }}
            >
              runerating.app
            </div>
          </div>
        </div>
      </div>
    ),
      dimensions,
    ),
  );
}

function compareMetric({
  key,
  label,
  left,
  right,
  leader,
}: {
  key: string;
  label: string;
  left: string;
  right: string;
  leader: "left" | "right" | "tie" | "unknown";
}) {
  return (
    <div
      key={key}
      style={{
        display: "flex",
        alignItems: "center",
        height: 50,
        borderTop: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        fontSize: 24,
        fontWeight: 800,
      }}
    >
      <div
        style={{
          width: 250,
          color: leader === "left" ? "#7dd3fc" : "rgba(255,255,255,0.72)",
        }}
      >
        {left}
      </div>
      <div
        style={{
          flex: 1,
          color: "rgba(255,255,255,0.58)",
          fontSize: 21,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: 250,
          textAlign: "right",
          color: leader === "right" ? "#86efac" : "rgba(255,255,255,0.72)",
        }}
      >
        {right}
      </div>
    </div>
  );
}

function playerPlate({
  key,
  name,
  tier,
  rankSrc,
  side,
}: {
  key: string;
  name: string;
  tier: string | null;
  rankSrc: string | null;
  side: "left" | "right";
}) {
  const color = side === "left" ? "#7dd3fc" : "#86efac";
  const align = side === "left" ? "flex-start" : "flex-end";
  const nameSize = name.length > 12 ? 36 : name.length > 10 ? 42 : 50;

  return (
    <div
      key={key}
      style={{
        display: "flex",
        flexDirection: side === "left" ? "row" : "row-reverse",
        alignItems: "center",
        width: 470,
        height: 118,
        border: "1px solid rgba(205,212,255,0.22)",
        background: "rgba(4,8,18,0.58)",
        borderRadius: 6,
        padding: "16px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 84,
          height: 84,
          borderRadius: 84,
          border: `1px solid ${color}`,
          background: "rgba(255,255,255,0.04)",
          opacity: rankSrc ? 1 : 0.38,
        }}
      >
        {rankSrc ? (
          <img
            alt={`${tier} rank icon`}
            height={76}
            src={rankSrc}
            style={{
              display: "flex",
              height: 76,
              objectFit: "contain",
              width: 76,
            }}
            width={76}
          />
        ) : (
          <div
            style={{
              display: "flex",
              color,
              fontSize: 36,
              fontWeight: 950,
            }}
          >
            ?
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: align,
          marginLeft: side === "left" ? 22 : 0,
          marginRight: side === "right" ? 22 : 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            color,
            fontFamily: "Georgia, serif",
            fontSize: nameSize,
            fontWeight: 950,
            lineHeight: 1,
            textAlign: side === "left" ? "left" : "right",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.64)",
            fontSize: 19,
            fontWeight: 900,
            letterSpacing: 5,
            marginTop: 10,
            textTransform: "uppercase",
          }}
        >
          {tier ?? `${side} player`}
        </div>
      </div>
    </div>
  );
}

export function compareImageResponse(
  model: CompareOgModel,
  options: { origin?: string } = {},
) {
  const leftRankSrc = rankImageSrc(options.origin, model.leftTier);
  const rightRankSrc = rankImageSrc(options.origin, model.rightTier);
  const stats =
    model.stats.length > 0
      ? model.stats
      : [
          {
            label: "Snapshots",
            left: "Pending",
            right: "Pending",
            leader: "unknown" as const,
          },
        ];

  return bufferedPngResponse(
    new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(115deg, #071018 0%, #121923 48%, #07140e 100%)",
          color: "#fff",
          fontFamily: "Arial, sans-serif",
          padding: 42,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 58,
            top: 164,
            width: 1084,
            height: 1,
            background: "rgba(205,212,255,0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 58,
            bottom: 94,
            width: 1084,
            height: 1,
            background: "rgba(205,212,255,0.14)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {brand()}
            <div
              style={{
                display: "flex",
                color: "rgba(255,255,255,0.58)",
                fontSize: 28,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Player Compare
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 38 }}>
            {playerPlate({
              key: "left",
              name: model.left,
              tier: model.leftTier,
              rankSrc: leftRankSrc,
              side: "left",
            })}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.62)",
                fontFamily: "Georgia, serif",
                fontSize: 48,
                fontWeight: 950,
                width: 104,
              }}
            >
              VS
            </div>
            {playerPlate({
              key: "right",
              name: model.right,
              tier: model.rightTier,
              rankSrc: rightRankSrc,
              side: "right",
            })}
          </div>

          <div
            style={{
              ...panelStyle(),
              marginTop: 26,
              padding: "8px 28px 10px",
              borderRadius: 6,
              background: "rgba(4,8,18,0.58)",
            }}
          >
            {stats.slice(0, 6).map((stat) =>
              compareMetric({
                key: stat.label,
                label: stat.label,
                left: stat.left,
                right: stat.right,
                leader: stat.leader,
              }),
            )}
          </div>

        </div>
      </div>
    ),
      dimensions,
    ),
  );
}
