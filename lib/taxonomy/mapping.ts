import type { BuyerPackId, ProviderId } from "@/lib/search/types";
import {
  TAXONOMY_INDUSTRIES,
  TAXONOMY_ORGANIZATION_TYPES,
  TAXONOMY_SECTORS,
  TAXONOMY_TARGET_LABELS,
} from "./data";
import type { ProviderPlanInput, TaxonomyInference, TaxonomyTarget } from "./types";

export function getSector(id: string) {
  return TAXONOMY_SECTORS.find((s) => s.id === id);
}

export function getSectorByLabel(label: string) {
  return TAXONOMY_SECTORS.find((s) => s.label.toLowerCase() === label.toLowerCase());
}

export function getIndustry(id: string) {
  return TAXONOMY_INDUSTRIES.find((i) => i.id === id);
}

export function getIndustryByLabel(label: string) {
  return TAXONOMY_INDUSTRIES.find((i) => i.label.toLowerCase() === label.toLowerCase());
}

export function getOrganizationType(id: string) {
  return TAXONOMY_ORGANIZATION_TYPES.find((o) => o.id === id);
}

export function industriesForSector(sectorId: string | null) {
  if (!sectorId) return TAXONOMY_INDUSTRIES;
  return TAXONOMY_INDUSTRIES.filter((i) => i.sectorId === sectorId);
}

export function organizationTypesForFilters(
  sectorId: string | null,
  industryId: string | null,
) {
  let list = TAXONOMY_ORGANIZATION_TYPES;
  if (sectorId) list = list.filter((o) => o.sectorId === sectorId);
  if (industryId) list = list.filter((o) => o.industryId === industryId);
  return list;
}

export function organizationTypeLabel(id: string | null): string {
  if (!id) return "";
  return getOrganizationType(id)?.label ?? id;
}

export function sectorLabel(id: string | null): string {
  if (!id) return "";
  return getSector(id)?.label ?? id;
}

export function industryLabel(id: string | null): string {
  if (!id) return "";
  return getIndustry(id)?.label ?? id;
}

/** Maps org type or industry to the internal pipeline target. */
export function resolveTaxonomyTarget(input: {
  organizationTypeId?: string | null;
  industryId?: string | null;
  sectorId?: string | null;
}): TaxonomyTarget | undefined {
  if (input.organizationTypeId) {
    return getOrganizationType(input.organizationTypeId)?.taxonomyTarget;
  }
  if (input.industryId) {
    return getIndustry(input.industryId)?.taxonomyTargets[0];
  }
  if (input.sectorId) {
    const industries = industriesForSector(input.sectorId);
    return industries[0]?.taxonomyTargets[0];
  }
  return undefined;
}

export function taxonomyTargetsForSector(sectorId: string): TaxonomyTarget[] {
  const targets = new Set<TaxonomyTarget>();
  for (const industry of industriesForSector(sectorId)) {
    for (const t of industry.taxonomyTargets) targets.add(t);
  }
  return [...targets];
}

export function taxonomyTargetsForIndustry(industryId: string): TaxonomyTarget[] {
  return getIndustry(industryId)?.taxonomyTargets ?? [];
}

/** Human-facing organization type label for a prospect (replaces buyer-pack label). */
export function displayOrganizationType(
  taxonomyTarget: BuyerPackId,
  organizationTypeId?: string | null,
): string {
  if (organizationTypeId) {
    const label = organizationTypeLabel(organizationTypeId);
    if (label) return label;
  }
  return TAXONOMY_TARGET_LABELS[taxonomyTarget] ?? taxonomyTarget;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hayIncludesKeyword(hay: string, keyword: string): boolean {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return false;
  if (kw.includes(" ")) return hay.includes(kw);
  if (hay.includes(kw)) return true;
  const stem = escapeRegex(kw);
  return new RegExp(`\\b${stem}s?\\b`).test(hay);
}

export function inferTaxonomyFromQuery(query: string): TaxonomyInference {
  const hay = query.toLowerCase();
  const inferred: TaxonomyInference = {};

  for (const org of [...TAXONOMY_ORGANIZATION_TYPES].sort(
    (a, b) =>
      Math.max(...b.keywords.map((k) => k.length)) -
      Math.max(...a.keywords.map((k) => k.length)),
  )) {
    if (org.keywords.some((kw) => hayIncludesKeyword(hay, kw))) {
      inferred.organizationTypeId = org.id;
      inferred.industryId = org.industryId;
      inferred.sectorId = org.sectorId;
      inferred.taxonomyTarget = org.taxonomyTarget;
      break;
    }
  }

  if (!inferred.industryId) {
    for (const industry of TAXONOMY_INDUSTRIES) {
      if (industry.keywords.some((kw) => hayIncludesKeyword(hay, kw))) {
        inferred.industryId = industry.id;
        inferred.sectorId = industry.sectorId;
        inferred.taxonomyTarget = industry.taxonomyTargets[0];
        break;
      }
    }
  }

  if (!inferred.sectorId) {
    for (const sector of TAXONOMY_SECTORS) {
      if (sector.keywords.some((kw) => hayIncludesKeyword(hay, kw))) {
        inferred.sectorId = sector.id;
        break;
      }
    }
  }

  return inferred;
}

function queryMentionsPublicCompany(text: string): boolean {
  return /\b(public company|nasdaq|nyse|ticker|10-k|10-q|8-k|edgar|sec filing)\b/i.test(text);
}

function queryMentionsHealthcarePayer(text: string): boolean {
  return /\b(health plan|payer|payor|medicare|medicaid|mco|insurer|advantage|part d|pbm)\b/i.test(text);
}

function queryMentionsHealthcareProvider(text: string): boolean {
  return /\b(hospital|health system|provider|idn|medical center|340b|physician group)\b/i.test(text);
}

function queryMentionsFdaScope(text: string): boolean {
  return /\b(fda|recall|food|pharma|pharmaceutical|device|packaging|contamination|enforcement)\b/i.test(text);
}

/** Taxonomy-driven provider routing — preserves all existing providers. */
export function resolveProviders(input: ProviderPlanInput): ProviderId[] {
  const providers: ProviderId[] = ["mock"];
  const { taxonomyTarget, queryText } = input;
  const q = queryText.toLowerCase();

  const isPublicSector = taxonomyTarget === "public-sector";
  const isHealthcarePayer = taxonomyTarget === "health-plans" || queryMentionsHealthcarePayer(q);
  const isHealthcareProvider = taxonomyTarget === "health-systems" || queryMentionsHealthcareProvider(q);
  const isManufacturing =
    taxonomyTarget === "manufacturers" ||
    /\b(manufactur|factory|plant|packaging|food|beverage|pharma|device)\b/.test(q);
  const isLifeSciences = /\b(pharma|biotech|medical device|life science|drug)\b/.test(q);

  // SEC — public companies across sectors (not pure public-sector entities)
  if (!isPublicSector || queryMentionsPublicCompany(q)) {
    providers.push("sec-edgar");
  }

  // CMS — healthcare payers and providers
  if (isHealthcarePayer || isHealthcareProvider) {
    providers.push("cms");
  }

  // RSS — broad fallback across sectors
  providers.push("news-rss");

  // FDA — life sciences, food, pharma, device, manufacturing
  if (
    isManufacturing ||
    isLifeSciences ||
    taxonomyTarget === "health-systems" ||
    taxonomyTarget === "employers" ||
    queryMentionsFdaScope(q)
  ) {
    providers.push("fda");
  }

  // Public Web / directories — regional org discovery
  if (
    taxonomyTarget === "health-plans" ||
    taxonomyTarget === "manufacturers" ||
    /\b(regional|local|community|private)\b/.test(q)
  ) {
    providers.push("company-site");
  }

  return [...new Set(providers)];
}

/** Legacy sector label → sector id (for URL backward compatibility). */
export function legacyIndustryToSectorId(industry: string | null): string | null {
  if (!industry) return null;
  const map: Record<string, string> = {
    Healthcare: "healthcare",
    Manufacturing: "manufacturing",
    Retail: "retail-consumer",
    "Financial Services": "financial-services",
    "Public Sector": "public-sector",
  };
  return map[industry] ?? getSectorByLabel(industry)?.id ?? null;
}

/** Legacy org type ids used before taxonomy expansion. */
export function normalizeOrganizationTypeId(id: string | null): string | null {
  if (!id) return null;
  if (getOrganizationType(id)) return id;
  const legacy: Record<string, string> = {
    manufacturer: "manufacturer",
    employer: "employer",
    municipality: "municipality",
    university: "university",
    hospital: "hospital",
    "health-plan": "health-plan",
  };
  return legacy[id] ?? id;
}
