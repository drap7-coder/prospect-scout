import type { SourcePlan } from "@/lib/search/types";

/** Live providers surfaced in the results UI. */
export type ProviderBadgeKey = "cms" | "sec" | "rss" | "fda";

/** Internal provider keys including non-badged sources. */
export type LiveProviderKey = ProviderBadgeKey | "public-web";

export type ProviderRunStatus = "ready" | "unavailable";

export type ProviderBadgeStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "skipped";

export const PROVIDER_TIMEOUT_MS: Record<LiveProviderKey, number> = {
  cms: 3000,
  sec: 4000,
  rss: 5000,
  fda: 4000,
  "public-web": 4000,
};

export const PROVIDER_LABELS: Record<string, string> = {
  mock: "Mock",
  cms: "CMS",
  sec: "SEC",
  rss: "RSS",
  fda: "FDA",
};

/** Primary providers — safe to run in parallel. */
export function plannedPrimaryProviders(plan: SourcePlan): ProviderBadgeKey[] {
  const keys: ProviderBadgeKey[] = [];
  if (plan.providers.includes("sec-edgar")) keys.push("sec");
  if (plan.providers.includes("cms")) keys.push("cms");
  if (plan.providers.includes("news-rss")) keys.push("rss");
  if (plan.providers.includes("fda")) keys.push("fda");
  return keys;
}

/** Secondary providers — may depend on primary enrichment (e.g. Public Web). */
export function plannedSecondaryProviders(plan: SourcePlan): LiveProviderKey[] {
  if (plan.providers.includes("company-site")) return ["public-web"];
  return [];
}

export type MockBadgeKey = "mock";

export const ALL_BADGE_KEYS: (MockBadgeKey | ProviderBadgeKey)[] = [
  "mock",
  "cms",
  "sec",
  "rss",
  "fda",
];
