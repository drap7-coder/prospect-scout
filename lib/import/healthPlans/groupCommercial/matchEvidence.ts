import type { Organization } from "@/lib/discovery/organization";
import { normalizeMatchText, tokenizeMatchText } from "./normalize";
import type { GroupCommercialEvidenceRecord } from "./types";

export type GroupCommercialMatchKind = "direct" | "parent_brand" | null;

export interface GroupCommercialMatchResult {
  kind: GroupCommercialMatchKind;
  record: GroupCommercialEvidenceRecord;
}

function orgNameHaystack(org: Organization): string[] {
  const values = [
    org.canonicalName,
    org.displayName ?? "",
    ...(org.aliases ?? []),
  ];
  return values.map(normalizeMatchText).filter(Boolean);
}

function domainsMatch(orgDomain: string | null | undefined, evidenceDomain: string | null | undefined): boolean {
  if (!orgDomain || !evidenceDomain) return false;
  return normalizeMatchText(orgDomain.replace(/^www\./, "")) ===
    normalizeMatchText(evidenceDomain.replace(/^www\./, ""));
}

function directNameMatch(org: Organization, record: GroupCommercialEvidenceRecord): boolean {
  const haystacks = orgNameHaystack(org);
  const needles = [
    normalizeMatchText(record.organizationName),
    ...(record.aliases ?? []).map(normalizeMatchText),
  ].filter(Boolean);

  return haystacks.some((hay) =>
    needles.some((needle) => hay === needle || hay.includes(needle) || needle.includes(hay)),
  );
}

function brandTokens(record: GroupCommercialEvidenceRecord): string[] {
  const tokens = new Set<string>();
  for (const token of tokenizeMatchText(record.organizationName)) tokens.add(token);
  for (const alias of record.aliases ?? []) {
    for (const token of tokenizeMatchText(alias)) tokens.add(token);
  }
  return [...tokens];
}

function childContainsBrandToken(org: Organization, record: GroupCommercialEvidenceRecord): boolean {
  const tokens = brandTokens(record);
  if (tokens.length === 0) return false;
  const hay = orgNameHaystack(org).join(" ");
  return tokens.some((token) => hay.includes(token));
}

function parentMatches(
  org: Organization,
  record: GroupCommercialEvidenceRecord,
): boolean {
  const parent = normalizeMatchText(org.parentDisplayName ?? "");
  const expectedParent = normalizeMatchText(record.parentOrganization ?? "");
  if (!parent || !expectedParent) return false;
  return parent === expectedParent || parent.includes(expectedParent) || expectedParent.includes(parent);
}

/** Match one organization against curated commercial evidence. */
export function matchGroupCommercialEvidence(
  org: Organization,
  records: GroupCommercialEvidenceRecord[],
): GroupCommercialMatchResult | null {
  for (const record of records) {
    if (directNameMatch(org, record) || domainsMatch(org.domain, record.domain)) {
      return { kind: "direct", record };
    }
  }

  for (const record of records) {
    if (
      record.allowParentBrandInheritance &&
      record.confidence === "high" &&
      record.parentOrganization &&
      parentMatches(org, record) &&
      childContainsBrandToken(org, record)
    ) {
      return { kind: "parent_brand", record };
    }
  }

  return null;
}
