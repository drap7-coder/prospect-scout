/** Compact USD for intelligence bullets. */
export function formatUsdCompact(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString()}K`;
  return `$${value.toLocaleString()}`;
}

export function formatWebsiteDisplay(website: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return website;
  }
}
