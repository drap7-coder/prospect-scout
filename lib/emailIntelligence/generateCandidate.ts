import {
  buildLocalPart,
  formatTemplateForPattern,
} from "./patterns";
import type { EmailCandidateResult, EmailPatternId, OrganizationEmailPattern } from "./types";

/** Generate a predicted email for a person using a company pattern (future contacts utility). */
export function generateEmailCandidate(
  firstName: string,
  lastName: string,
  domain: string,
  emailPattern: Pick<
    OrganizationEmailPattern,
    "pattern" | "confidence" | "formatTemplate"
  >,
): EmailCandidateResult | null {
  const pattern = emailPattern.pattern;
  if (pattern === "unknown") return null;

  const localPart = buildLocalPart(pattern, firstName, lastName);
  if (!localPart) return null;

  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
  return {
    email: `${localPart}@${normalizedDomain}`,
    pattern,
    confidence: emailPattern.confidence,
    status: "predicted",
  };
}

export function describeFormatTemplate(pattern: EmailPatternId): string {
  return formatTemplateForPattern(pattern);
}
