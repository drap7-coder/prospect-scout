/** Supported corporate email local-part patterns. */
export type EmailPatternId =
  | "first.last"
  | "first_last"
  | "firstlast"
  | "flast"
  | "firstl"
  | "first"
  | "last"
  | "unknown";

export type EmailPatternConfidenceLabel = "low" | "medium" | "high";

export type EmailPatternSource =
  | "observed_public_emails"
  | "inferred"
  | "manual"
  | "unknown";

export type CatchAllStatus = "unknown" | "likely" | "unlikely";

/** Organization-level email naming convention intelligence. */
export interface OrganizationEmailPattern {
  domain: string | null;
  pattern: EmailPatternId;
  formatTemplate: string;
  /** 0–1 numeric confidence. */
  confidence: number;
  confidenceLabel: EmailPatternConfidenceLabel;
  source: EmailPatternSource;
  evidenceCount: number;
  /** Up to three public sample addresses (local@domain). */
  sampleEvidence: string[];
  mxProvider: string | null;
  catchAllStatus: CatchAllStatus;
  lastCheckedAt: string;
}

export type EmailEvidenceSourceType = "public_web";

/** One observed public email tied to an organization. */
export interface EmailPatternEvidenceRecord {
  id: string;
  organizationId: string;
  domain: string;
  email: string;
  localPart: string;
  pattern: EmailPatternId | null;
  firstName: string | null;
  lastName: string | null;
  sourceUrl: string;
  sourceType: EmailEvidenceSourceType;
  observedAt: string;
}

export interface EmailCandidateResult {
  email: string;
  pattern: EmailPatternId;
  confidence: number;
  status: "predicted";
}

export interface PublicEmailObservation {
  email: string;
  localPart: string;
  domain: string;
  sourceUrl: string;
  firstName: string | null;
  lastName: string | null;
}

export interface EmailPatternEnrichmentInput {
  organizationId: string;
  canonicalName: string;
  website: string | null;
  domain: string | null;
}

export interface EmailPatternEnrichmentResult {
  emailPattern: OrganizationEmailPattern;
  evidence: EmailPatternEvidenceRecord[];
}

export const EMAIL_PATTERN_SECTOR_KEY = "emailPattern";
