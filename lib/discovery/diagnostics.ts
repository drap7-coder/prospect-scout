import {
  organizationsFromDirectory,
  deriveDomain,
  organizationDedupeKey,
  normalizeNameKey,
  type Organization,
} from "./organization";
import {
  allHighValueDirectoryOrganizations,
  sourceDirectoryCatalogStats,
} from "./connectors/highValueDirectoryConnectors";

export interface CoverageReport {
  total: number;
  sourceCoveragePercent: number;
  confidence: number;
  bySector: Record<string, number>;
  byOrganizationType: Record<string, number>;
  byBuyerPack: Record<string, number>;
  /** High-level category counts for the diagnostics UI. */
  categories: {
    companies: number;
    nonprofits: number;
    government: number;
    education: number;
    healthcare: number;
    manufacturers: number;
    financialServices: number;
    technology: number;
    retail: number;
  };
}

export interface ConnectorHealthItem {
  connectorId: string;
  label: string;
  recordsIngested: number;
  freshness: "static-snapshot" | "live";
  duplicates: number;
  failures: number;
  sourceCoveragePercent: number;
  confidence: number;
  industry: string;
}

export interface CompletenessReport {
  total: number;
  withWebsite: number;
  withDomain: number;
  withHeadquarters: number;
  withState: number;
  withIndustry: number;
  withOrganizationType: number;
  pctWebsite: number;
  pctDomain: number;
  pctHeadquarters: number;
  pctState: number;
  pctIndustry: number;
  pctOrganizationType: number;
}

export interface DuplicateGroup {
  kind: "domain" | "similar-name" | "probable-duplicate";
  key: string;
  organizations: { id: string; name: string; domain: string | null }[];
}

export interface DuplicateReport {
  duplicateDomains: DuplicateGroup[];
  similarNames: DuplicateGroup[];
  probableDuplicates: DuplicateGroup[];
}

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function categorizeOrg(org: Organization): keyof CoverageReport["categories"] | null {
  if (org.sectorId === "nonprofit" || org.ownership === "nonprofit") return "nonprofits";
  if (org.ownership === "government" || org.sectorId === "public-sector") return "government";
  if (org.sectorId === "education" || org.industries.includes("universities")) return "education";
  if (org.sectorId === "healthcare") return "healthcare";
  if (org.sectorId === "manufacturing") return "manufacturers";
  if (org.sectorId === "financial-services") return "financialServices";
  if (org.sectorId === "technology") return "technology";
  if (org.sectorId === "retail-consumer") return "retail";
  if (org.ownership === "public" || org.ownership === "private") return "companies";
  return "companies";
}

/** Measure catalog coverage by sector, org type, and high-level category. */
export function computeCoverage(orgs?: Organization[]): CoverageReport {
  const list = orgs ?? catalogOrganizations();
  const bySector: Record<string, number> = {};
  const byOrganizationType: Record<string, number> = {};
  const byBuyerPack: Record<string, number> = {};
  const categories: CoverageReport["categories"] = {
    companies: 0,
    nonprofits: 0,
    government: 0,
    education: 0,
    healthcare: 0,
    manufacturers: 0,
    financialServices: 0,
    technology: 0,
    retail: 0,
  };

  for (const org of list) {
    const sector = org.sectorId ?? "unknown";
    bySector[sector] = (bySector[sector] ?? 0) + 1;

    const orgType = org.organizationType ?? "unknown";
    byOrganizationType[orgType] = (byOrganizationType[orgType] ?? 0) + 1;

    const pack = org.buyerPack ?? "unknown";
    byBuyerPack[pack] = (byBuyerPack[pack] ?? 0) + 1;

    const cat = categorizeOrg(org);
    if (cat) categories[cat] += 1;
  }

  return {
    total: list.length,
    sourceCoveragePercent: list.length >= 100_000 ? 100 : pct(list.length, 100_000),
    confidence: list.length >= 100_000 ? 0.78 : 0.62,
    bySector,
    byOrganizationType,
    byBuyerPack,
    categories,
  };
}

/** Measure field completeness across the catalog. */
export function computeCompleteness(orgs?: Organization[]): CompletenessReport {
  const list = orgs ?? catalogOrganizations();
  const total = list.length;

  let withWebsite = 0;
  let withDomain = 0;
  let withHeadquarters = 0;
  let withState = 0;
  let withIndustry = 0;
  let withOrganizationType = 0;

  for (const org of list) {
    if (org.website) withWebsite += 1;
    if (org.domain || deriveDomain(org.website)) withDomain += 1;
    if (org.headquarters) withHeadquarters += 1;
    if (org.states.length > 0) withState += 1;
    if (org.industries.length > 0) withIndustry += 1;
    if (org.organizationType) withOrganizationType += 1;
  }

  return {
    total,
    withWebsite,
    withDomain,
    withHeadquarters,
    withState,
    withIndustry,
    withOrganizationType,
    pctWebsite: pct(withWebsite, total),
    pctDomain: pct(withDomain, total),
    pctHeadquarters: pct(withHeadquarters, total),
    pctState: pct(withState, total),
    pctIndustry: pct(withIndustry, total),
    pctOrganizationType: pct(withOrganizationType, total),
  };
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeNameKey(a);
  const nb = normalizeNameKey(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const tokensA = new Set(na.split(" "));
  const tokensB = new Set(nb.split(" "));
  const intersection = [...tokensA].filter((t) => tokensB.has(t) && t.length >= 3);
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.length / union.size;
}

/** Detect duplicate domains, similar names, and probable duplicate organizations. */
export function detectDuplicates(orgs?: Organization[]): DuplicateReport {
  const list = orgs ?? catalogOrganizations();

  const byDomain = new Map<string, Organization[]>();
  for (const org of list) {
    const domain = org.domain ?? deriveDomain(org.website);
    if (!domain) continue;
    const group = byDomain.get(domain) ?? [];
    group.push(org);
    byDomain.set(domain, group);
  }

  const duplicateDomains: DuplicateGroup[] = [];
  for (const [domain, group] of byDomain) {
    if (group.length < 2) continue;
    duplicateDomains.push({
      kind: "domain",
      key: domain,
      organizations: group.map((o) => ({
        id: o.id,
        name: o.canonicalName,
        domain: o.domain ?? deriveDomain(o.website),
      })),
    });
  }

  const similarNames: DuplicateGroup[] = [];
  const probableDuplicates: DuplicateGroup[] = [];
  const byPrefix = new Map<string, Organization[]>();
  for (const org of list) {
    const key = normalizeNameKey(org.canonicalName).split(" ").slice(0, 3).join(" ");
    if (!key) continue;
    const group = byPrefix.get(key) ?? [];
    if (group.length < 40) group.push(org);
    byPrefix.set(key, group);
  }

  for (const group of byPrefix.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
      const a = group[i]!;
      const b = group[j]!;
      if (organizationDedupeKey(a) === organizationDedupeKey(b)) continue;

      const sim = nameSimilarity(a.canonicalName, b.canonicalName);
      if (sim >= 0.85 && similarNames.length < 200) {
        similarNames.push({
          kind: "similar-name",
          key: `${a.canonicalName} ~ ${b.canonicalName}`,
          organizations: [
            { id: a.id, name: a.canonicalName, domain: a.domain },
            { id: b.id, name: b.canonicalName, domain: b.domain },
          ],
        });
      }

      const sharedDomain =
        a.domain && b.domain && a.domain === b.domain;
      const aliasOverlap = a.aliases.some((alias) =>
        normalizeNameKey(alias) === normalizeNameKey(b.canonicalName),
      );
      if ((sharedDomain || (sim >= 0.7 && aliasOverlap)) && probableDuplicates.length < 200) {
        probableDuplicates.push({
          kind: "probable-duplicate",
          key: `${a.id} / ${b.id}`,
          organizations: [
            { id: a.id, name: a.canonicalName, domain: a.domain },
            { id: b.id, name: b.canonicalName, domain: b.domain },
          ],
        });
      }
      }
    }
  }

  return {
    duplicateDomains,
    similarNames,
    probableDuplicates,
  };
}

export interface DiagnosticsReport {
  coverage: CoverageReport;
  completeness: CompletenessReport;
  duplicates: DuplicateReport;
  connectorHealth: ConnectorHealthItem[];
  generatedAt: string;
}

export function catalogOrganizations(): Organization[] {
  return [...organizationsFromDirectory(), ...allHighValueDirectoryOrganizations()];
}

export function computeConnectorHealth(orgs?: Organization[]): ConnectorHealthItem[] {
  const list = orgs ?? catalogOrganizations();
  const duplicateKeys = new Map<string, number>();
  for (const org of list) {
    const key = organizationDedupeKey(org);
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  }

  const stats = [
    {
      connectorId: "directory",
      label: "Master Directory",
      recordsIngested: organizationsFromDirectory().length,
      sourceCoveragePercent: pct(organizationsFromDirectory().length, list.length),
      confidence: 0.92,
      industry: "cross-industry",
    },
    ...sourceDirectoryCatalogStats(),
  ];

  return stats.map((item) => ({
    ...item,
    freshness: "static-snapshot" as const,
    duplicates: list.filter((org) =>
      org.sources.some((src) => src.connector === item.connectorId) &&
      (duplicateKeys.get(organizationDedupeKey(org)) ?? 0) > 1
    ).length,
    failures: 0,
  }));
}

export function runDiagnostics(orgs?: Organization[]): DiagnosticsReport {
  const list = orgs ?? catalogOrganizations();
  return {
    coverage: computeCoverage(list),
    completeness: computeCompleteness(list),
    duplicates: detectDuplicates(list),
    connectorHealth: computeConnectorHealth(list),
    generatedAt: new Date().toISOString(),
  };
}
