import { classifyLocalPartWithNames } from "./patterns";
import { pickDominantPattern, scorePatternConfidence, confidenceLabelFromScore } from "./confidence";
import { formatTemplateForPattern } from "./patterns";
import type {
  EmailPatternEvidenceRecord,
  EmailPatternId,
  EmailPatternSource,
  OrganizationEmailPattern,
  PublicEmailObservation,
} from "./types";

function evidenceId(orgId: string, email: string, sourceUrl: string): string {
  return `${orgId}:${email}:${sourceUrl}`.replace(/[^a-z0-9:_-]/gi, "_");
}

export function observationsToEvidence(
  organizationId: string,
  observations: PublicEmailObservation[],
  maxRecords = 20,
): EmailPatternEvidenceRecord[] {
  const now = new Date().toISOString();
  const records: EmailPatternEvidenceRecord[] = [];

  for (const obs of observations.slice(0, maxRecords)) {
    const pattern =
      obs.firstName && obs.lastName
        ? classifyLocalPartWithNames(obs.localPart, obs.firstName, obs.lastName)
        : null;

    records.push({
      id: evidenceId(organizationId, obs.email, obs.sourceUrl),
      organizationId,
      domain: obs.domain,
      email: obs.email,
      localPart: obs.localPart,
      pattern,
      firstName: obs.firstName,
      lastName: obs.lastName,
      sourceUrl: obs.sourceUrl,
      sourceType: "public_web",
      observedAt: now,
    });
  }

  return records;
}

export function inferOrganizationEmailPattern(input: {
  domain: string | null;
  evidence: EmailPatternEvidenceRecord[];
  mxProvider: string | null;
  lastCheckedAt: string;
}): OrganizationEmailPattern {
  const { domain, evidence, mxProvider, lastCheckedAt } = input;
  const votes = new Map<EmailPatternId, number>();

  for (const row of evidence) {
    if (!row.pattern) continue;
    votes.set(row.pattern, (votes.get(row.pattern) ?? 0) + 1);
  }

  const classified = evidence.filter((e) => e.pattern).length;
  const { pattern: dominant, count: dominantCount } = pickDominantPattern(votes);

  let source: EmailPatternSource = "unknown";
  if (evidence.length === 0) {
    source = "unknown";
  } else if (classified > 0 && dominantCount > 0) {
    source = "observed_public_emails";
  } else if (evidence.length > 0) {
    source = "inferred";
  }

  const confidence = scorePatternConfidence({
    dominantCount,
    totalClassified: classified,
    totalObserved: evidence.length,
    source: source === "inferred" ? "inferred" : source === "unknown" ? "unknown" : "observed_public_emails",
  });

  const resolvedPattern =
    dominantCount > 0 ? dominant : evidence.length > 0 ? "unknown" : "unknown";

  return {
    domain,
    pattern: resolvedPattern,
    formatTemplate: formatTemplateForPattern(resolvedPattern),
    confidence,
    confidenceLabel: confidenceLabelFromScore(confidence),
    source,
    evidenceCount: evidence.length,
    sampleEvidence: evidence.slice(0, 3).map((e) => e.email),
    mxProvider,
    catchAllStatus: "unknown",
    lastCheckedAt,
  };
}
