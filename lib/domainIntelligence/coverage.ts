import type { Organization } from "@/lib/discovery/organization";
import { deriveDomain } from "@/lib/discovery/organization";
import type { DomainCoverageBucket, DomainCoverageReport } from "./types";

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function bucketFromOrgs(label: string, orgs: Organization[]): DomainCoverageBucket {
  const total = orgs.length;
  let withWebsite = 0;
  let withDomain = 0;
  for (const org of orgs) {
    if (org.website?.trim()) withWebsite += 1;
    if (org.domain?.trim() || deriveDomain(org.website)) withDomain += 1;
  }
  return {
    label,
    total,
    withWebsite,
    withDomain,
    pctWebsite: pct(withWebsite, total),
    pctDomain: pct(withDomain, total),
  };
}

/** Compute warehouse domain coverage overall and by industry dimensions. */
export function computeDomainCoverageReport(
  organizations: Organization[],
): DomainCoverageReport {
  const byBuyerPackMap = new Map<string, Organization[]>();
  const bySectorMap = new Map<string, Organization[]>();

  for (const org of organizations) {
    const pack = org.buyerPack ?? "unknown";
    const sector = org.sectorId ?? "unknown";
    byBuyerPackMap.set(pack, [...(byBuyerPackMap.get(pack) ?? []), org]);
    bySectorMap.set(sector, [...(bySectorMap.get(sector) ?? []), org]);
  }

  const overall = bucketFromOrgs("all", organizations);

  return {
    generatedAt: new Date().toISOString(),
    total: overall.total,
    withWebsite: overall.withWebsite,
    withDomain: overall.withDomain,
    pctWebsite: overall.pctWebsite,
    pctDomain: overall.pctDomain,
    byBuyerPack: [...byBuyerPackMap.entries()]
      .map(([label, orgs]) => bucketFromOrgs(label, orgs))
      .sort((a, b) => b.total - a.total),
    bySector: [...bySectorMap.entries()]
      .map(([label, orgs]) => bucketFromOrgs(label, orgs))
      .sort((a, b) => b.total - a.total),
  };
}
