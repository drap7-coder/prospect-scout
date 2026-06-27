/**
 * Health plan subtype — a refinement of the canonical "health-plan" org type.
 * The canonical organization type is never replaced; this is an optional
 * subtype used for filtering and display (e.g. ACA Marketplace issuers).
 */
export const HEALTH_PLAN_TYPES = [
  { id: "commercial", label: "Commercial" },
  { id: "aca_marketplace", label: "ACA Marketplace" },
  { id: "medicare_advantage", label: "Medicare Advantage" },
  { id: "medicaid_managed_care", label: "Medicaid Managed Care" },
] as const;

export type HealthPlanType = (typeof HEALTH_PLAN_TYPES)[number]["id"];

const HEALTH_PLAN_TYPE_IDS = new Set<string>(HEALTH_PLAN_TYPES.map((t) => t.id));

export function isHealthPlanType(value: string | null | undefined): value is HealthPlanType {
  return value != null && HEALTH_PLAN_TYPE_IDS.has(value);
}

export function healthPlanTypeLabel(id: HealthPlanType | string): string {
  return HEALTH_PLAN_TYPES.find((t) => t.id === id)?.label ?? id;
}

/**
 * Map free-text queries to a health plan subtype.
 *
 * ACA Marketplace synonyms: "ACA plans", "exchange plans", "marketplace plans",
 * "HealthCare.gov plans", "QHP issuers". Returns null when no subtype is implied
 * so existing health-plan search behavior is preserved.
 */
export function inferHealthPlanTypeFromQuery(query: string): HealthPlanType | null {
  const hay = query.toLowerCase();

  const acaMarketplace =
    /\baca\b|\bobamacare\b|\bexchange plans?\b|\bmarketplace plans?\b|\bhealth\s*care\.?\s*gov\b|\bhealthcare\.gov\b|\bqhps?\b|\bqualified health plans?\b|\bqhp issuers?\b|\bon[- ]exchange\b/.test(
      hay,
    );
  if (acaMarketplace) return "aca_marketplace";

  const medicareAdvantage =
    /\bmedicare advantage\b|\bma plans?\b|\bmapd\b|\bpart d plans?\b|\bmedicare advantage plans?\b/.test(
      hay,
    );
  if (medicareAdvantage) return "medicare_advantage";

  const medicaidManagedCare =
    /\bmedicaid managed care\b|\bmedicaid mcos?\b|\bmanaged medicaid\b/.test(hay);
  if (medicaidManagedCare) return "medicaid_managed_care";

  return null;
}
