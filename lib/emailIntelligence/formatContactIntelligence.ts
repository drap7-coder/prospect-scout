import type { OrganizationEmailPattern } from "./types";
import { describeFormatTemplate } from "./generateCandidate";

export interface ContactIntelligenceViewModel {
  title: string;
  domain: string | null;
  patternLabel: string;
  formatTemplate: string;
  confidenceLabel: string;
  confidencePercent: number;
  sourceLabel: string;
  evidenceCount: number;
  sampleEvidence: string[];
  mxProvider: string | null;
  catchAllStatus: string;
  lastCheckedLabel: string;
  hasData: boolean;
  emptyMessage: string | null;
}

const SOURCE_LABELS: Record<OrganizationEmailPattern["source"], string> = {
  observed_public_emails: "Observed public emails",
  inferred: "Inferred from public evidence",
  manual: "Manual",
  unknown: "Unknown",
};

export function buildContactIntelligenceView(
  emailPattern: OrganizationEmailPattern | null | undefined,
): ContactIntelligenceViewModel {
  if (!emailPattern) {
    return {
      title: "Contact Intelligence",
      domain: null,
      patternLabel: "Unknown",
      formatTemplate: describeFormatTemplate("unknown"),
      confidenceLabel: "Low",
      confidencePercent: 0,
      sourceLabel: SOURCE_LABELS.unknown,
      evidenceCount: 0,
      sampleEvidence: [],
      mxProvider: null,
      catchAllStatus: "Unknown",
      lastCheckedLabel: "Not checked",
      hasData: false,
      emptyMessage: "No email pattern intelligence available for this organization yet.",
    };
  }

  const patternLabel =
    emailPattern.pattern === "unknown"
      ? "Unknown"
      : emailPattern.pattern.replace(/\./g, " · ");

  return {
    title: "Contact Intelligence",
    domain: emailPattern.domain,
    patternLabel,
    formatTemplate: emailPattern.formatTemplate,
    confidenceLabel:
      emailPattern.confidenceLabel.charAt(0).toUpperCase() +
      emailPattern.confidenceLabel.slice(1),
    confidencePercent: Math.round(emailPattern.confidence * 100),
    sourceLabel: SOURCE_LABELS[emailPattern.source],
    evidenceCount: emailPattern.evidenceCount,
    sampleEvidence: emailPattern.sampleEvidence,
    mxProvider: emailPattern.mxProvider,
    catchAllStatus:
      emailPattern.catchAllStatus.charAt(0).toUpperCase() +
      emailPattern.catchAllStatus.slice(1),
    lastCheckedLabel: new Date(emailPattern.lastCheckedAt).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" },
    ),
    hasData: true,
    emptyMessage: null,
  };
}
