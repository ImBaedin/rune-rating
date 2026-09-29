// Object key order must not turn equivalent canonical values into new revisions.
export async function contentHash(value: unknown): Promise<string> {
  const json = JSON.stringify(value, (_key, item) => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, item[key]]),
      );
    }
    return item;
  });
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(json),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
