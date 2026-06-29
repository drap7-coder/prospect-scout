import { isGenericInboxLocalPart } from "./genericInboxes";
import type { PublicEmailObservation } from "./types";

const EMAIL_REGEX =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/gi;

const MAILTO_REGEX =
  /mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24})/gi;

const BLOCKED_URL_HOSTS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "facebook.com",
  "www.facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "www.instagram.com",
]);

export function isBlockedEvidenceUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_URL_HOSTS.has(host) || host.includes("linkedin.com");
  } catch {
    return true;
  }
}

function parseLocalAndDomain(email: string): { localPart: string; domain: string } | null {
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const localPart = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  if (!localPart || !domain.includes(".")) return null;
  return { localPart, domain };
}

/** Extract person names paired with mailto links when anchor text looks like a name. */
export function extractMailtoNamePairs(html: string): Array<{
  email: string;
  firstName: string;
  lastName: string;
}> {
  const pairs: Array<{ email: string; firstName: string; lastName: string }> = [];
  const anchorRegex =
    /<a[^>]+href=["']mailto:([^"'?]+)[^"']*["'][^>]*>([^<]{2,80})<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const email = match[1]?.trim().toLowerCase();
    const text = match[2]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!email || !text) continue;
    const nameParts = text.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) continue;
    const firstName = nameParts[0]!;
    const lastName = nameParts[nameParts.length - 1]!;
    if (!/^[A-Za-z][A-Za-z'-]+$/.test(firstName)) continue;
    if (!/^[A-Za-z][A-Za-z'-]+$/.test(lastName)) continue;
    pairs.push({ email, firstName, lastName });
  }
  return pairs;
}

export function extractEmailsFromHtml(
  html: string,
  sourceUrl: string,
  expectedDomain: string,
): PublicEmailObservation[] {
  if (isBlockedEvidenceUrl(sourceUrl)) return [];

  const seen = new Set<string>();
  const observations: PublicEmailObservation[] = [];
  const nameByEmail = new Map<string, { firstName: string; lastName: string }>();

  for (const pair of extractMailtoNamePairs(html)) {
    nameByEmail.set(pair.email.toLowerCase(), {
      firstName: pair.firstName,
      lastName: pair.lastName,
    });
  }

  const candidates = new Set<string>();
  for (const match of html.matchAll(EMAIL_REGEX)) {
    candidates.add(match[0].toLowerCase());
  }
  for (const match of html.matchAll(MAILTO_REGEX)) {
    candidates.add(match[1].toLowerCase());
  }

  for (const email of candidates) {
    if (seen.has(email)) continue;
    const parsed = parseLocalAndDomain(email);
    if (!parsed) continue;
    if (parsed.domain !== expectedDomain.toLowerCase()) continue;
    if (isGenericInboxLocalPart(parsed.localPart)) continue;

    seen.add(email);
    const names = nameByEmail.get(email) ?? null;
    observations.push({
      email,
      localPart: parsed.localPart,
      domain: parsed.domain,
      sourceUrl,
      firstName: names?.firstName ?? null,
      lastName: names?.lastName ?? null,
    });
  }

  return observations;
}
