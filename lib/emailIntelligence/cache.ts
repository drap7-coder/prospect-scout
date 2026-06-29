import type {
  EmailPatternEvidenceRecord,
  OrganizationEmailPattern,
} from "./types";

const evidenceByOrganization = new Map<string, EmailPatternEvidenceRecord[]>();

export function getInMemoryEmailEvidence(
  organizationId: string,
): EmailPatternEvidenceRecord[] {
  return evidenceByOrganization.get(organizationId) ?? [];
}

export function setInMemoryEmailEvidence(
  organizationId: string,
  evidence: EmailPatternEvidenceRecord[],
): void {
  evidenceByOrganization.set(organizationId, evidence);
}

export function clearInMemoryEmailEvidence(): void {
  evidenceByOrganization.clear();
}

export function mergeInMemoryEmailEvidence(
  organizationId: string,
  evidence: EmailPatternEvidenceRecord[],
): void {
  const existing = getInMemoryEmailEvidence(organizationId);
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const row of evidence) {
    byId.set(row.id, row);
  }
  setInMemoryEmailEvidence(organizationId, [...byId.values()].slice(0, 20));
}

/** Default cache TTL — avoid rechecking the same company frequently. */
export function emailIntelligenceCacheTtlMs(): number {
  const days = Number(process.env.EMAIL_INTELLIGENCE_CACHE_DAYS ?? "30");
  if (!Number.isFinite(days) || days <= 0) return 30 * 24 * 60 * 60 * 1000;
  return days * 24 * 60 * 60 * 1000;
}

export function shouldSkipEmailEnrichment(
  pattern: OrganizationEmailPattern | null,
  ttlMs: number,
  force = false,
): boolean {
  if (force) return false;
  if (!pattern?.lastCheckedAt) return false;
  const checked = Date.parse(pattern.lastCheckedAt);
  if (!Number.isFinite(checked)) return false;
  return Date.now() - checked < ttlMs;
}
