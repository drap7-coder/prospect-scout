import {
  buildPageUrl,
  normalizeWebsiteOrigin,
  type TextFetchLike,
} from "@/lib/providers/publicWeb";
import { extractEmailsFromHtml, isBlockedEvidenceUrl } from "./extractEmails";
import type { PublicEmailObservation } from "./types";

export const MAX_EMAIL_SOURCES_PER_COMPANY = 5;
export const MAX_OBSERVED_EMAILS_PER_COMPANY = 20;

/** Public pages likely to expose staff/contact emails (same-origin only). */
export const EMAIL_INTELLIGENCE_PAGE_PATHS = [
  { path: "/contact", trailLabel: "Contact page" },
  { path: "/about", trailLabel: "About page" },
  { path: "/leadership", trailLabel: "Leadership page" },
  { path: "/team", trailLabel: "Team page" },
  { path: "/", trailLabel: "Home page" },
] as const;

export interface PublicWebExtractOptions {
  fetchImpl?: TextFetchLike;
  maxSources?: number;
  maxEmails?: number;
}

function resolveFetch(opts?: PublicWebExtractOptions): TextFetchLike {
  const impl = opts?.fetchImpl ?? (globalThis.fetch as unknown as TextFetchLike);
  if (!impl) {
    throw new Error("No fetch implementation available for email intelligence.");
  }
  return impl;
}

/** Bounded same-origin public web extraction for corporate email evidence. */
export async function extractPublicEmailEvidence(
  website: string,
  expectedDomain: string,
  opts?: PublicWebExtractOptions,
): Promise<PublicEmailObservation[]> {
  const fetchImpl = resolveFetch(opts);
  const maxSources = opts?.maxSources ?? MAX_EMAIL_SOURCES_PER_COMPANY;
  const maxEmails = opts?.maxEmails ?? MAX_OBSERVED_EMAILS_PER_COMPANY;

  let origin: string;
  try {
    origin = normalizeWebsiteOrigin(website);
  } catch {
    return [];
  }

  const all: PublicEmailObservation[] = [];
  const seenEmails = new Set<string>();
  let sourcesChecked = 0;

  for (const page of EMAIL_INTELLIGENCE_PAGE_PATHS) {
    if (sourcesChecked >= maxSources) break;
    if (all.length >= maxEmails) break;

    const url = buildPageUrl(origin, page.path);
    if (isBlockedEvidenceUrl(url)) continue;

    sourcesChecked += 1;
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "ProspectScout/1.0 (email intelligence; +https://github.com/drap7-coder/prospect-scout)",
        },
      });
      if (!response.ok) continue;
      const html = await response.text();
      const found = extractEmailsFromHtml(html, url, expectedDomain);
      for (const obs of found) {
        if (seenEmails.has(obs.email)) continue;
        seenEmails.add(obs.email);
        all.push(obs);
        if (all.length >= maxEmails) break;
      }
    } catch {
      continue;
    }
  }

  return all;
}
