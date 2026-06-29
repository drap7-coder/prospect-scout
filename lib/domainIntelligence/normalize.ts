import { deriveDomain } from "@/lib/discovery/organization";

const CORPORATE_SUFFIXES =
  /\b(inc|incorporated|corp|corporation|co|company|llc|l\.l\.c\.|lp|l\.p\.|plc|group|holdings|insurance|health|healthcare|plan|plans|services)\b/gi;

/** Normalize organization names for exact directory matching. */
export function normalizeOrganizationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(CORPORATE_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize and validate a website URL. */
export function normalizeWebsiteUrl(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  const trimmed = website.trim();
  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Canonical primary domain from website or raw domain string. */
export function normalizePrimaryDomain(input: {
  website?: string | null;
  domain?: string | null;
}): string | null {
  if (input.domain?.trim()) {
    return input.domain.trim().replace(/^www\./i, "").toLowerCase();
  }
  return deriveDomain(input.website);
}

export function websiteFromDomain(domain: string): string {
  return `https://${domain.replace(/^www\./i, "")}`;
}

export function confidenceLabelFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}
