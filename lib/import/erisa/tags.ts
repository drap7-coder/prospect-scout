import type { ErisaCsvRow } from "./types";

export const ERISA_ORG_TAGS = {
  employer: "Employer",
  planSponsor: "Plan Sponsor",
  benefitsBuyer: "Benefits Buyer",
  healthWelfare: "Health & Welfare Plan",
  selfFunded: "Self-Funded Employer",
} as const;

/** Build organization tags from filing attributes. */
export function buildErisaTags(row: ErisaCsvRow): string[] {
  const tags = new Set<string>([
    ERISA_ORG_TAGS.employer,
    ERISA_ORG_TAGS.planSponsor,
    ERISA_ORG_TAGS.benefitsBuyer,
  ]);
  if (row.healthWelfarePlan) tags.add(ERISA_ORG_TAGS.healthWelfare);
  if (row.selfFunded) tags.add(ERISA_ORG_TAGS.selfFunded);
  return [...tags];
}

export function mergeErisaTags(
  existing: string[],
  incoming: string[],
): string[] {
  return [...new Set([...existing, ...incoming])];
}
