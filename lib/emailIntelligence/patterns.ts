import type { EmailPatternId } from "./types";

export const EMAIL_PATTERN_IDS: EmailPatternId[] = [
  "first.last",
  "first_last",
  "firstlast",
  "flast",
  "firstl",
  "first",
  "last",
  "unknown",
];

export const PATTERN_FORMAT_TEMPLATES: Record<EmailPatternId, string> = {
  "first.last": "{first}.{last}@{domain}",
  first_last: "{first}_{last}@{domain}",
  firstlast: "{first}{last}@{domain}",
  flast: "{f}{last}@{domain}",
  firstl: "{first}{l}@{domain}",
  first: "{first}@{domain}",
  last: "{last}@{domain}",
  unknown: "unknown@{domain}",
};

export function formatTemplateForPattern(pattern: EmailPatternId): string {
  return PATTERN_FORMAT_TEMPLATES[pattern] ?? PATTERN_FORMAT_TEMPLATES.unknown;
}

/** Normalize a person name token for pattern matching. */
export function normalizeNameToken(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function buildLocalPart(
  pattern: EmailPatternId,
  firstName: string,
  lastName: string,
): string | null {
  const first = normalizeNameToken(firstName);
  const last = normalizeNameToken(lastName);
  if (!first && !last) return null;
  const f = first.charAt(0);
  const l = last.charAt(0);

  switch (pattern) {
    case "first.last":
      return first && last ? `${first}.${last}` : null;
    case "first_last":
      return first && last ? `${first}_${last}` : null;
    case "firstlast":
      return first && last ? `${first}${last}` : null;
    case "flast":
      return f && last ? `${f}${last}` : null;
    case "firstl":
      return first && l ? `${first}${l}` : null;
    case "first":
      return first || null;
    case "last":
      return last || null;
    default:
      return null;
  }
}

/** Match a local part against a person name using known patterns. */
export function classifyLocalPartWithNames(
  localPart: string,
  firstName: string,
  lastName: string,
): EmailPatternId | null {
  const normalizedLocal = localPart.toLowerCase();
  for (const pattern of EMAIL_PATTERN_IDS) {
    if (pattern === "unknown") continue;
    const expected = buildLocalPart(pattern, firstName, lastName);
    if (expected && expected === normalizedLocal) return pattern;
  }
  return null;
}
