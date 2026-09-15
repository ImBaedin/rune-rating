import { normalizeRsn } from "@rune-rating/domain";

const appUrl = (import.meta.env.VITE_SITE_URL ?? "https://runerating.app")
  .replace(/\/+$/, "");

function safeRsn(value: string | undefined) {
  if (!value) return null;
  try {
    return normalizeRsn(value);
  } catch {
    return null;
  }
}

function pathPart(value: string) {
  return encodeURIComponent(value).replaceAll("%20", "+");
}

export function absoluteUrl(path: string) {
  return `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function ratingOgImageUrl(rsn: string | undefined) {
  const normalized = safeRsn(rsn);
  return absoluteUrl(
    normalized ? `/og/rating/${pathPart(normalized)}` : "/og/rating.png",
  );
}

export function compareOgImageUrl(leftRsn: string, rightRsn: string) {
  const left = safeRsn(leftRsn) ?? leftRsn;
  const right = safeRsn(rightRsn) ?? rightRsn;
  return absoluteUrl(`/og/compare/${pathPart(left)}/${pathPart(right)}`);
}

export function ratingHead(rsn: string | undefined) {
  const normalized = safeRsn(rsn);
  const title = normalized
    ? `${normalized} RuneRating`
    : "RuneRating Player Rating";
  const description = normalized
    ? `Current RuneRating score, tier, and account profile for ${normalized}.`
    : "Generate a RuneRating card from current canonical OSRS snapshots.";
  const image = ratingOgImageUrl(normalized ?? undefined);
  const url = absoluteUrl(
    normalized ? `/rating?rsn=${encodeURIComponent(normalized)}` : "/rating",
  );

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
  };
}

export function compareHead(leftRsn: string, rightRsn: string) {
  const left = safeRsn(leftRsn) ?? leftRsn;
  const right = safeRsn(rightRsn) ?? rightRsn;
  const title = `${left} vs ${right} | RuneRating`;
  const description = `Compare current OSRS snapshots for ${left} and ${right} across skills, efficiency, unlocks, collections, and combat.`;
  const image = compareOgImageUrl(left, right);
  const url = absoluteUrl(`/compare/${pathPart(left)}/${pathPart(right)}`);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
  };
}
