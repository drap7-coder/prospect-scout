import { buildEnterpriseRegistry } from "./registry";
import { normalizeBrandPhrase } from "@/lib/domainIntelligence/normalize";

/** Canonical enterprise ids — merge fragmented parent-name slugs. */
const ENTERPRISE_ID_ALIASES: Record<string, string> = {
  centene: "centene-corporation",
  "unitedhealth-group-inc": "unitedhealth-group",
  "unitedhealth-group-incorporated": "unitedhealth-group",
  "elevance-health": "elevance-health-inc",
  "humana-inc": "humana-inc",
  "molina-healthcare": "molina-healthcare-inc",
  "the-cigna-group": "the-cigna-group",
  "cvs-health-corporation": "cvs-health",
  guidewell: "guidewell-mutual-holding-corporation",
  "florida-blue": "guidewell-mutual-holding-corporation",
};

export function canonicalEnterpriseId(id: string): string {
  const normalized = id.toLowerCase().trim();
  return ENTERPRISE_ID_ALIASES[normalized] ?? normalized;
}

export function registryEntryForParentName(parentName: string) {
  const normalized = normalizeBrandPhrase(parentName);
  for (const entry of buildEnterpriseRegistry()) {
    if (entry.parentNames.includes(normalized)) return entry;
  }
  return null;
}

export function registryEntryForDomain(domain: string) {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  for (const entry of buildEnterpriseRegistry()) {
    if (entry.canonicalDomain.toLowerCase() === normalized) return entry;
  }
  return null;
}

export function registryEntryById(id: string) {
  const canonical = canonicalEnterpriseId(id);
  for (const entry of buildEnterpriseRegistry()) {
    if (canonicalEnterpriseId(entry.id) === canonical) return entry;
  }
  return null;
}
