const validRsn = /^[a-zA-Z0-9 _-]{1,12}$/;

export function normalizeRsn(rsn: string): string {
  const normalized = rsn.trim().replaceAll("_", " ").replace(/\s+/g, " ");

  if (!validRsn.test(normalized)) {
    throw new Error(
      "RSN must be 1-12 characters using letters, numbers, spaces, underscores, or hyphens.",
    );
  }

  return normalized;
}

export function rsnLookupKey(rsn: string): string {
  return normalizeRsn(rsn).toLowerCase();
}
