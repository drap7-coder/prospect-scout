import type { Organization } from "@/lib/discovery/organization";
import type { TextFetchLike } from "@/lib/providers/publicWeb";
import {
  emailIntelligenceCacheTtlMs,
  mergeInMemoryEmailEvidence,
  shouldSkipEmailEnrichment,
} from "./cache";
import {
  observationsToEvidence,
  inferOrganizationEmailPattern,
} from "./inferPattern";
import { lookupMxProvider } from "./mxLookup";
import { extractPublicEmailEvidence } from "./publicWebExtractor";
import {
  readEmailPatternFromSectorAttributes,
  resolveOrganizationDomain,
  writeEmailPatternToOrganization,
} from "./sectorAttributes";
import { persistEmailPatternEvidence } from "./storage";
import type {
  EmailPatternEnrichmentResult,
  EmailPatternEvidenceRecord,
  OrganizationEmailPattern,
} from "./types";

export interface EnrichEmailPatternOptions {
  fetchImpl?: TextFetchLike;
  force?: boolean;
  skipNetwork?: boolean;
  /** Inject observations for tests (bypasses public web fetch). */
  observations?: import("./types").PublicEmailObservation[];
  mxProvider?: string | null;
}

function unknownPattern(domain: string | null, lastCheckedAt: string): OrganizationEmailPattern {
  return inferOrganizationEmailPattern({
    domain,
    evidence: [],
    mxProvider: null,
    lastCheckedAt,
  });
}

/** Enrich a single organization with company-level email pattern intelligence. */
export async function enrichOrganizationEmailPattern(
  org: Organization,
  opts: EnrichEmailPatternOptions = {},
): Promise<{ org: Organization; result: EmailPatternEnrichmentResult }> {
  const lastCheckedAt = new Date().toISOString();
  const domain = resolveOrganizationDomain(org);
  const existing = readEmailPatternFromSectorAttributes(org.sectorAttributes);
  const ttlMs = emailIntelligenceCacheTtlMs();

  if (!domain) {
    const emailPattern = unknownPattern(null, lastCheckedAt);
    const updated = writeEmailPatternToOrganization(org, emailPattern);
    return {
      org: updated,
      result: { emailPattern, evidence: [] },
    };
  }

  if (shouldSkipEmailEnrichment(existing, ttlMs, opts.force)) {
    return {
      org,
      result: {
        emailPattern: existing!,
        evidence: [],
      },
    };
  }

  let observations = opts.observations ?? [];
  if (!opts.skipNetwork && observations.length === 0 && org.website) {
    observations = await extractPublicEmailEvidence(org.website, domain, {
      fetchImpl: opts.fetchImpl,
    });
  }

  const evidence: EmailPatternEvidenceRecord[] = observationsToEvidence(
    org.id,
    observations,
  );

  const mxProvider =
    opts.mxProvider !== undefined
      ? opts.mxProvider
      : opts.skipNetwork
        ? existing?.mxProvider ?? null
        : await lookupMxProvider(domain);

  const emailPattern = inferOrganizationEmailPattern({
    domain,
    evidence,
    mxProvider,
    lastCheckedAt,
  });

  mergeInMemoryEmailEvidence(org.id, evidence);
  if (!opts.skipNetwork) {
    await persistEmailPatternEvidence(evidence);
  }

  const updated = writeEmailPatternToOrganization(org, emailPattern);
  return { org: updated, result: { emailPattern, evidence } };
}

/** Batch enrich organizations (respects cache TTL unless force). */
export async function enrichOrganizationsEmailPatterns(
  orgs: Organization[],
  opts: EnrichEmailPatternOptions = {},
): Promise<Organization[]> {
  const out: Organization[] = [];
  for (const org of orgs) {
    const { org: enriched } = await enrichOrganizationEmailPattern(org, opts);
    out.push(enriched);
  }
  return out;
}

/** Attach cached email patterns from warehouse orgs onto discovery results. */
export function attachEmailPatternsFromIndex(
  orgs: Organization[],
  index: Map<string, Organization>,
): Organization[] {
  return orgs.map((org) => {
    const cached = index.get(org.id);
    const pattern = readEmailPatternFromSectorAttributes(cached?.sectorAttributes);
    if (!pattern) return org;
    return writeEmailPatternToOrganization(org, pattern);
  });
}

export function readOrganizationEmailPattern(
  org: Organization,
): OrganizationEmailPattern | null {
  return readEmailPatternFromSectorAttributes(org.sectorAttributes);
}
