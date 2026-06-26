/**
 * Thin connector adapters wrapping existing providers.
 * Non-destructive: delegate to current fetch/match functions; normalize into Organization.
 */
import type { DiscoveryConnector, ConnectorRecord } from "../connector";
import { sourceStamp } from "../connector";
import { mergeOrganizations } from "../organization";
import type { Organization } from "../organization";
import { RSS_FEED_SOURCES } from "@/lib/providers/rssNews";
import { CMS_ORGANIZATIONS } from "@/lib/providers/cms";
import { FDA_FIRM_REGISTRY } from "@/lib/providers/fda";
import {
  HEALTH_PLAN_DIRECTORY,
} from "@/lib/providers/directories/healthPlanDirectory";
import {
  MANUFACTURER_DIRECTORY,
} from "@/lib/providers/directories/manufacturerDirectory";

function stubOrg(
  id: string,
  name: string,
  extras: Partial<Organization> = {},
): Organization {
  return {
    id,
    canonicalName: name,
    aliases: extras.aliases ?? [],
    website: extras.website ?? null,
    domain: extras.domain ?? null,
    organizationType: extras.organizationType ?? null,
    industries: extras.industries ?? [],
    sectorId: extras.sectorId ?? null,
    headquarters: extras.headquarters ?? null,
    locations: extras.locations ?? [],
    states: extras.states ?? [],
    regions: extras.regions ?? [],
    ownership: extras.ownership ?? null,
    employeeRange: null,
    revenueRange: null,
    description: null,
    sources: extras.sources ?? [],
    buyerPack: extras.buyerPack ?? null,
  };
}

/** RSS feed registry → Organization stubs (enrichment via existing RSS provider). */
export const rssConnector: DiscoveryConnector = {
  id: "rss",
  label: "RSS / Press Releases",

  discover(): ConnectorRecord[] {
    return RSS_FEED_SOURCES.map((feed) => ({
      __type: "rss",
      feed,
    }));
  },

  normalize(record: ConnectorRecord): Organization {
    const feed = record.feed as (typeof RSS_FEED_SOURCES)[number];
    return stubOrg(feed.id, feed.organizationName, {
      aliases: feed.aliases,
      headquarters: feed.location,
      regions: [feed.region],
      buyerPack: feed.buyerPacks[0] ?? null,
      sources: [sourceStamp("rss", feed.id, ["Curated RSS feed registry"])],
    });
  },

  merge: mergeOrganizations,
};

/** CMS contract registry → Organization stubs. */
export const cmsConnector: DiscoveryConnector = {
  id: "cms",
  label: "CMS Medicare Contracts",

  discover(): ConnectorRecord[] {
    return CMS_ORGANIZATIONS.map((org) => ({ __type: "cms", org }));
  },

  normalize(record: ConnectorRecord): Organization {
    const org = record.org as (typeof CMS_ORGANIZATIONS)[number];
    return stubOrg(org.id, org.organizationName, {
      aliases: org.aliases ?? [],
      organizationType: "health-plan",
      industries: ["payers"],
      sectorId: "healthcare",
      states: org.states ?? [],
      regions: [],
      buyerPack: "health-plans",
      sources: [sourceStamp("cms", org.id, ["CMS contract registry"])],
    });
  },

  merge: mergeOrganizations,
};

/** FDA firm registry → Organization stubs. */
export const fdaConnector: DiscoveryConnector = {
  id: "fda",
  label: "FDA Enforcement",

  discover(): ConnectorRecord[] {
    return FDA_FIRM_REGISTRY.map((firm) => ({ __type: "fda", firm }));
  },

  normalize(record: ConnectorRecord): Organization {
    const firm = record.firm as (typeof FDA_FIRM_REGISTRY)[number];
    return stubOrg(firm.id, firm.firmName, {
      headquarters: firm.location,
      regions: [firm.region],
      industries: ["food-beverage", "life-sciences"],
      sectorId: "manufacturing",
      buyerPack: "manufacturers",
      sources: [sourceStamp("fda", firm.id, ["FDA firm registry"])],
    });
  },

  merge: mergeOrganizations,
};

/** Public web directory (health plans + manufacturers). */
export const publicWebConnector: DiscoveryConnector = {
  id: "public-web",
  label: "Public Web Directory",

  discover(): ConnectorRecord[] {
    const entries = [...HEALTH_PLAN_DIRECTORY, ...MANUFACTURER_DIRECTORY];
    return entries.map((entry) => ({ __type: "public-web", entry }));
  },

  normalize(record: ConnectorRecord): Organization {
    const entry = record.entry as (typeof HEALTH_PLAN_DIRECTORY)[number];
    return stubOrg(`web-${entry.id}`, entry.name, {
      aliases: entry.aliases,
      website: entry.website,
      domain: entry.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0],
      headquarters: `${entry.state}`,
      states: [entry.state],
      regions: [entry.region],
      industries: entry.id.includes("mfg") ? ["industrial-products"] : ["payers"],
      sectorId: entry.id.includes("mfg") ? "manufacturing" : "healthcare",
      buyerPack: entry.id.includes("mfg") ? "manufacturers" : "health-plans",
      sources: [sourceStamp("public-web", entry.id, ["Regional directory"])],
    });
  },

  merge: mergeOrganizations,
};

/** SEC is enrichment-only — no static catalog; discover returns empty. */
export const secConnector: DiscoveryConnector = {
  id: "sec",
  label: "SEC EDGAR",

  discover(): ConnectorRecord[] {
    return [];
  },

  normalize(record: ConnectorRecord): Organization {
    const match = record.match as { cik: string; title: string; ticker: string };
    return stubOrg(`sec-${match.cik}`, match.title, {
      organizationType: "public-company",
      ownership: "public",
      industries: [],
      sources: [sourceStamp("sec", match.cik, [`Ticker: ${match.ticker}`])],
    });
  },

  merge: mergeOrganizations,
};

export const ALL_CONNECTORS: DiscoveryConnector[] = [
  // directoryConnector registered separately to avoid circular import
];
