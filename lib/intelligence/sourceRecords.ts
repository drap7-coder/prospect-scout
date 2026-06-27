import type {
  Prospect,
  ProspectSourceRecord,
  ProspectSignal,
  SignalSource,
} from "@/lib/search/types";
import type { OrganizationSource } from "@/lib/discovery/organization";
import { displaySource } from "./evidence";

const CONNECTOR_META: Record<
  string,
  { label: string; sourceUrl: string }
> = {
  directory: {
    label: "Directory",
    sourceUrl: "https://github.com/drap7-coder/prospect-scout",
  },
  nces: {
    label: "NCES",
    sourceUrl: "https://educationdata.urban.org/documentation/",
  },
  sec: {
    label: "SEC",
    sourceUrl: "https://www.sec.gov/edgar/search/",
  },
  cms: {
    label: "CMS",
    sourceUrl: "https://data.cms.gov/",
  },
  "aca-marketplace": {
    label: "CMS Marketplace",
    sourceUrl: "https://www.cms.gov/marketplace",
  },
  fda: {
    label: "FDA",
    sourceUrl: "https://open.fda.gov/",
  },
  "irs-nonprofits": {
    label: "IRS",
    sourceUrl: "https://projects.propublica.org/nonprofits/",
  },
  rss: {
    label: "RSS",
    sourceUrl: "https://news.google.com/",
  },
  "public-web": {
    label: "Web",
    sourceUrl: "",
  },
};

const SIGNAL_SOURCE_META: Record<
  SignalSource,
  { connector: string; label: string; sourceUrl: string }
> = {
  Directory: { connector: "directory", ...CONNECTOR_META.directory },
  CMS: { connector: "cms", ...CONNECTOR_META.cms },
  SEC: { connector: "sec", ...CONNECTOR_META.sec },
  FDA: { connector: "fda", ...CONNECTOR_META.fda },
  RSS: { connector: "rss", ...CONNECTOR_META.rss },
  "Public Web": { connector: "public-web", ...CONNECTOR_META["public-web"] },
  Company: { connector: "public-web", ...CONNECTOR_META["public-web"] },
  Careers: { connector: "public-web", ...CONNECTOR_META["public-web"] },
};

function orgSourceToRecord(src: OrganizationSource): ProspectSourceRecord {
  const meta = CONNECTOR_META[src.connector] ?? {
    label: src.sourceName ?? src.connector.toUpperCase(),
    sourceUrl: src.sourceUrl ?? "",
  };
  return {
    connector: src.connector,
    label: src.sourceName ?? meta.label,
    confidence: src.confidence ?? 0.85,
    lastUpdated: src.lastUpdated,
    sourceUrl: src.sourceUrl ?? meta.sourceUrl,
    evidenceText: src.evidence[0],
  };
}

/** Build connector records from discovery organization sources. */
export function sourceRecordsFromOrgSources(
  sources: OrganizationSource[],
): ProspectSourceRecord[] {
  const seen = new Set<string>();
  const out: ProspectSourceRecord[] = [];
  for (const src of sources) {
    const key = src.connector;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(orgSourceToRecord(src));
  }
  return out;
}

function recordFromSignal(signal: ProspectSignal): ProspectSourceRecord {
  const src = displaySource(signal.source);
  const meta = SIGNAL_SOURCE_META[src] ?? SIGNAL_SOURCE_META.Directory;
  return {
    connector: meta.connector,
    label: meta.label,
    confidence:
      signal.strength === "strong"
        ? 0.92
        : signal.strength === "moderate"
          ? 0.78
          : 0.62,
    sourceUrl: meta.sourceUrl,
    evidenceText: signal.evidenceText,
  };
}

/** Merge catalog sources with live signal provenance for rich badges. */
export function buildSourceRecords(
  prospect: Pick<
    Prospect,
    "sourceRecords" | "signals" | "sourceTrail" | "directoryMatch"
  >,
): ProspectSourceRecord[] {
  const byConnector = new Map<string, ProspectSourceRecord>();

  for (const rec of prospect.sourceRecords ?? []) {
    byConnector.set(rec.connector, rec);
  }

  for (const signal of prospect.signals) {
    const rec = recordFromSignal(signal);
    const existing = byConnector.get(rec.connector);
    if (!existing || rec.confidence > existing.confidence) {
      byConnector.set(rec.connector, {
        ...rec,
        lastUpdated: existing?.lastUpdated,
        sourceUrl: existing?.sourceUrl || rec.sourceUrl,
      });
    }
  }

  if (prospect.directoryMatch && !byConnector.has("directory")) {
    byConnector.set("directory", orgSourceToRecord({
      connector: "directory",
      sourceId: "master",
      sourceName: "Organization catalog",
      sourceUrl: CONNECTOR_META.directory.sourceUrl,
      confidence: 0.9,
      retrievedAt: new Date().toISOString(),
      evidence: ["Curated organization record"],
    }));
  }

  const order = ["directory", "nces", "sec", "cms", "aca-marketplace", "fda", "irs-nonprofits", "rss", "public-web"];
  return [...byConnector.values()].sort(
    (a, b) =>
      (order.indexOf(a.connector) === -1 ? 99 : order.indexOf(a.connector)) -
      (order.indexOf(b.connector) === -1 ? 99 : order.indexOf(b.connector)),
  );
}

export function faviconUrl(website: string | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(website) ? website : `https://${website}`,
    );
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
  } catch {
    return null;
  }
}
