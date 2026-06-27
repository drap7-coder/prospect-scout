import type { Organization } from "./organization";

/** Canonical organization types — every indexed org maps to exactly one. */
export const CANONICAL_ORG_TYPES = [
  { id: "health-plan", label: "Health Plan" },
  { id: "hospital-health-system", label: "Hospital / Health System" },
  { id: "pbm", label: "PBM" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "manufacturer", label: "Manufacturer" },
  { id: "employer", label: "Employer" },
  { id: "provider-group", label: "Provider Group" },
  { id: "tpa", label: "TPA" },
  { id: "government", label: "Government" },
  { id: "nonprofit", label: "Nonprofit" },
  { id: "university", label: "University" },
  { id: "vendor", label: "Vendor" },
  { id: "other", label: "Other" },
] as const;

export type CanonicalOrgTypeId = (typeof CANONICAL_ORG_TYPES)[number]["id"];

const TAXONOMY_ID_MAP: Record<string, CanonicalOrgTypeId> = {
  "health-plan": "health-plan",
  pbm: "pbm",
  tpa: "tpa",
  hospital: "hospital-health-system",
  "health-system": "hospital-health-system",
  "physician-group": "provider-group",
  "pharma-manufacturer": "manufacturer",
  "medical-device": "manufacturer",
  manufacturer: "manufacturer",
  "food-beverage-company": "manufacturer",
  "packaging-company": "manufacturer",
  "consumer-goods-company": "manufacturer",
  "chemical-company": "manufacturer",
  "automotive-manufacturer": "manufacturer",
  bank: "employer",
  "credit-union": "employer",
  "insurance-carrier": "health-plan",
  "asset-manager": "employer",
  "fintech-company": "vendor",
  "state-agency": "government",
  municipality: "government",
  "public-employer": "government",
  "transit-authority": "government",
  "school-district": "government",
  university: "university",
  "community-college": "university",
  "private-school": "university",
  "consulting-firm": "vendor",
  "accounting-firm": "vendor",
  "law-firm": "vendor",
  "insurance-broker": "vendor",
  "staffing-firm": "vendor",
  employer: "employer",
};

/** Label / alias phrases → canonical type (longest match wins). */
const LABEL_ALIASES: { pattern: RegExp; type: CanonicalOrgTypeId }[] = [
  { pattern: /\bpharmacy benefit manager\b|\bpbm\b/i, type: "pbm" },
  { pattern: /\bthird[- ]party admin|\btpa\b/i, type: "tpa" },
  {
    pattern:
      /\bmedicare advantage|\bmedicaid mco|\bmanaged care org|\bhealth insurer|\bcommercial insurer|\bblue cross|\bblue shield|\bhealth plan|\bhealth insurance|\bmco\b/i,
    type: "health-plan",
  },
  { pattern: /\bhospital|\bhealth system|\bmedical center|\bidn\b/i, type: "hospital-health-system" },
  { pattern: /\bphysician group|\bmedical group|\bprovider group|\bclinic network/i, type: "provider-group" },
  { pattern: /\bpharmacy|\bdrug store|\bcvs|\bwalgreens|\brite aid/i, type: "pharmacy" },
  { pattern: /\bmanufacturer|\bmanufacturing|\bfactory|\bplant\b/i, type: "manufacturer" },
  { pattern: /\buniversity|\bcollege|\bcampus\b/i, type: "university" },
  { pattern: /\bcity of|\bcounty of|\bmunicipality|\bstate agency|\bdepartment of|\bgovernment\b/i, type: "government" },
  { pattern: /\bfoundation|\bnonprofit|\bnon-profit|\bcharitable|\b501\(c\)/i, type: "nonprofit" },
  { pattern: /\bconsulting|\bsoftware vendor|\bsaas|\btechnology vendor/i, type: "vendor" },
];

function inferFromSectorIndustry(org: Organization): CanonicalOrgTypeId | null {
  if (org.sectorId === "nonprofit" || org.ownership === "nonprofit") return "nonprofit";
  if (org.sectorId === "public-sector" || org.ownership === "government") return "government";
  if (org.sectorId === "education" || org.industries.includes("universities")) return "university";
  if (org.industries.includes("payers")) {
    if (org.organizationType === "pbm") return "pbm";
    if (org.organizationType === "tpa") return "tpa";
    return "health-plan";
  }
  if (org.industries.includes("providers")) return "hospital-health-system";
  if (org.sectorId === "manufacturing") return "manufacturer";
  return null;
}

/** Map any taxonomy id, label, or org text to exactly one canonical type. */
export function normalizeCanonicalOrganizationType(
  org: Pick<
    Organization,
    "organizationType" | "canonicalName" | "aliases" | "sectorId" | "industries" | "ownership"
  >,
): CanonicalOrgTypeId {
  if (org.organizationType) {
    const mapped = TAXONOMY_ID_MAP[org.organizationType];
    if (mapped) return mapped;
  }

  const hay = [org.canonicalName, ...org.aliases].join(" ");
  for (const { pattern, type } of LABEL_ALIASES) {
    if (pattern.test(hay)) return type;
  }

  const fromSector = inferFromSectorIndustry(org as Organization);
  if (fromSector) return fromSector;

  if (org.organizationType) return "employer";
  return "other";
}

export function canonicalOrgTypeLabel(id: CanonicalOrgTypeId | string): string {
  return CANONICAL_ORG_TYPES.find((t) => t.id === id)?.label ?? id;
}

const CANONICAL_ID_SET = new Set<string>(CANONICAL_ORG_TYPES.map((t) => t.id));

export function isCanonicalOrgTypeId(id: string): id is CanonicalOrgTypeId {
  return CANONICAL_ID_SET.has(id);
}

/** Map taxonomy / legacy org type ids to canonical ids for UI and URL params. */
export function normalizeCanonicalOrgTypeId(id: string | null): CanonicalOrgTypeId | null {
  if (!id) return null;
  if (isCanonicalOrgTypeId(id)) return id;
  const fromTaxonomy = TAXONOMY_ID_MAP[id];
  if (fromTaxonomy) return fromTaxonomy;
  const legacy: Record<string, CanonicalOrgTypeId> = {
    hospital: "hospital-health-system",
    "health-system": "hospital-health-system",
    "physician-group": "provider-group",
    municipality: "government",
    "state-agency": "government",
    bank: "employer",
    "insurance-carrier": "health-plan",
  };
  return legacy[id] ?? null;
}

/** Whether an org matches a search org-type filter (canonical or legacy taxonomy id). */
export function organizationMatchesOrgTypeFilter(
  org: Pick<Organization, "organizationType" | "canonicalOrganizationType">,
  filterId: string | null | undefined,
): boolean {
  if (!filterId) return true;
  const canonical = normalizeCanonicalOrgTypeId(filterId);
  if (canonical) return org.canonicalOrganizationType === canonical;
  return org.organizationType === filterId;
}

/** Internal pipeline target for provider routing from a canonical org type. */
export function taxonomyTargetForCanonicalOrgType(
  id: CanonicalOrgTypeId,
): "health-plans" | "health-systems" | "manufacturers" | "employers" | "public-sector" | undefined {
  const map: Partial<
    Record<
      CanonicalOrgTypeId,
      "health-plans" | "health-systems" | "manufacturers" | "employers" | "public-sector"
    >
  > = {
    "health-plan": "health-plans",
    pbm: "health-plans",
    tpa: "health-plans",
    "hospital-health-system": "health-systems",
    pharmacy: "health-systems",
    "provider-group": "health-systems",
    manufacturer: "manufacturers",
    employer: "employers",
    government: "public-sector",
    nonprofit: "employers",
    university: "employers",
    vendor: "employers",
    other: undefined,
  };
  return map[id];
}

/** Normalize legacy directory organization type strings to taxonomy ids. */
export function normalizeTaxonomyOrganizationType(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    "health-plan": "health-plan",
    "health-system": "health-system",
    manufacturer: "manufacturer",
    employer: "employer",
    municipality: "municipality",
    university: "university",
  };
  return map[raw] ?? raw;
}
