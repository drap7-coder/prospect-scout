import type { ErisaCsvRow } from "@/lib/import/erisa/types";
import type {
  IntelligenceMetric,
  IntelligenceProvenance,
  OrganizationIntelligenceModule,
} from "@/lib/intelligence/framework/types";
import type { OrganizationRelationshipEdge } from "@/lib/intelligence/relationships/types";

export const BENEFITS_MODULE_ID = "benefits" as const;
export const BENEFITS_MODULE_TITLE = "Benefits Intelligence";
export const BENEFITS_MODULE_ICON = "◆";

export const ERISA_FORM_5500_PROVENANCE: IntelligenceProvenance = {
  sourceId: "erisa-form-5500",
  sourceLabel: "ERISA Form 5500",
  sourceUrl:
    "https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets",
  confidence: 0.88,
};

export interface BenefitsServiceProviderRecord {
  name: string;
  role: "pbm" | "tpa" | "health_insurer" | "consultant" | "trustee" | "auditor" | "other";
  ein?: string;
  filingYear?: number;
  planName?: string | null;
  provenance: IntelligenceProvenance;
}

export interface BenefitsFilingRecord {
  planName: string | null;
  planNumber: string | null;
  filingYear: number;
  participantCount: number | null;
  healthWelfarePlan: boolean;
  selfFunded: boolean;
  fundingArrangement: string | null;
  ackId: string | null;
  provenance: IntelligenceProvenance;
}

export interface BenefitsVendorSummary {
  totalVendors: number;
  pbms: number;
  tpas: number;
  healthInsurers: number;
  consultants: number;
  trustees: number;
  auditors: number;
}

export interface BenefitsIntelligenceTotals {
  benefitPlanCount: number;
  welfarePlanCount: number;
  pensionPlanCount: number;
  /** Sum of participants across filings — always ERISA plan participants, not covered lives. */
  totalErisaPlanParticipants: number;
  latestFilingYear: number | null;
  selfFundedPlanCount: number;
}

export interface BenefitsIntelligenceDetail {
  totals: BenefitsIntelligenceTotals;
  filings: BenefitsFilingRecord[];
  serviceProviders: BenefitsServiceProviderRecord[];
  vendorSummary: BenefitsVendorSummary;
}

function formatParticipantCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

function metric(
  id: string,
  value: string,
  label: string,
  provenance: IntelligenceProvenance = ERISA_FORM_5500_PROVENANCE,
): IntelligenceMetric {
  return { id, value, label, provenance };
}

function uniquePlanKey(row: ErisaCsvRow): string {
  return `${row.planNumber ?? "001"}::${row.planName ?? "plan"}`;
}

export function aggregateBenefitsFromFilings(rows: ErisaCsvRow[]): {
  totals: BenefitsIntelligenceTotals;
  filings: BenefitsFilingRecord[];
} {
  const planMap = new Map<string, ErisaCsvRow>();
  for (const row of rows) {
    const key = uniquePlanKey(row);
    const existing = planMap.get(key);
    if (!existing || row.filingYear >= existing.filingYear) {
      planMap.set(key, row);
    }
  }

  const latestByPlan = [...planMap.values()];
  let totalParticipants = 0;
  let welfarePlanCount = 0;
  let pensionPlanCount = 0;
  let selfFundedPlanCount = 0;
  let latestFilingYear: number | null = null;

  for (const row of latestByPlan) {
    if (row.healthWelfarePlan) welfarePlanCount += 1;
    else pensionPlanCount += 1;
    if (row.selfFunded) selfFundedPlanCount += 1;
    if (row.participantCount != null) totalParticipants += row.participantCount;
    latestFilingYear =
      latestFilingYear == null
        ? row.filingYear
        : Math.max(latestFilingYear, row.filingYear);
  }

  const filings: BenefitsFilingRecord[] = [...rows]
    .sort((a, b) => b.filingYear - a.filingYear || (b.participantCount ?? 0) - (a.participantCount ?? 0))
    .map((row) => ({
      planName: row.planName,
      planNumber: row.planNumber,
      filingYear: row.filingYear,
      participantCount: row.participantCount,
      healthWelfarePlan: row.healthWelfarePlan,
      selfFunded: row.selfFunded,
      fundingArrangement: row.fundingArrangement,
      ackId: row.ackId,
      provenance: ERISA_FORM_5500_PROVENANCE,
    }));

  return {
    totals: {
      benefitPlanCount: latestByPlan.length,
      welfarePlanCount,
      pensionPlanCount,
      totalErisaPlanParticipants: totalParticipants,
      latestFilingYear,
      selfFundedPlanCount,
    },
    filings,
  };
}

function emptyVendorSummary(): BenefitsVendorSummary {
  return {
    totalVendors: 0,
    pbms: 0,
    tpas: 0,
    healthInsurers: 0,
    consultants: 0,
    trustees: 0,
    auditors: 0,
  };
}

export function buildBenefitsSummaryMetrics(
  totals: BenefitsIntelligenceTotals,
  vendorSummary: BenefitsVendorSummary,
): IntelligenceMetric[] {
  const metrics: IntelligenceMetric[] = [];

  if (totals.benefitPlanCount > 0) {
    metrics.push(
      metric(
        "benefit-plans",
        String(totals.benefitPlanCount),
        totals.benefitPlanCount === 1 ? "benefit plan" : "benefit plans",
      ),
    );
  }

  if (totals.totalErisaPlanParticipants > 0) {
    metrics.push(
      metric(
        "plan-participants",
        formatParticipantCount(totals.totalErisaPlanParticipants),
        "ERISA plan participants",
      ),
    );
  }

  if (vendorSummary.totalVendors > 0) {
    metrics.push(
      metric(
        "vendors",
        String(vendorSummary.totalVendors),
        vendorSummary.totalVendors === 1 ? "vendor identified" : "vendors identified",
      ),
    );
  }

  if (totals.latestFilingYear != null) {
    metrics.push(
      metric(
        "latest-filing",
        String(totals.latestFilingYear),
        "Latest filing",
      ),
    );
  }

  return metrics.slice(0, 4);
}

export function buildBenefitsIntelligenceModule(input: {
  organizationId: string;
  filings: ErisaCsvRow[];
  serviceProviders?: BenefitsServiceProviderRecord[];
}): OrganizationIntelligenceModule | null {
  if (input.filings.length === 0) return null;

  const { totals, filings } = aggregateBenefitsFromFilings(input.filings);
  const serviceProviders = input.serviceProviders ?? [];
  const vendorSummary = summarizeVendors(serviceProviders);

  const summaryMetrics = buildBenefitsSummaryMetrics(totals, vendorSummary);
  if (summaryMetrics.length === 0) return null;

  const detail: BenefitsIntelligenceDetail = {
    totals,
    filings,
    serviceProviders,
    vendorSummary,
  };

  return {
    id: BENEFITS_MODULE_ID,
    title: BENEFITS_MODULE_TITLE,
    icon: BENEFITS_MODULE_ICON,
    summaryMetrics,
    confidence: ERISA_FORM_5500_PROVENANCE.confidence,
    provenance: [ERISA_FORM_5500_PROVENANCE],
    detail,
  };
}

export function summarizeVendors(
  providers: BenefitsServiceProviderRecord[],
): BenefitsVendorSummary {
  const summary = emptyVendorSummary();
  for (const provider of providers) {
    summary.totalVendors += 1;
    switch (provider.role) {
      case "pbm":
        summary.pbms += 1;
        break;
      case "tpa":
        summary.tpas += 1;
        break;
      case "health_insurer":
        summary.healthInsurers += 1;
        break;
      case "consultant":
        summary.consultants += 1;
        break;
      case "trustee":
        summary.trustees += 1;
        break;
      case "auditor":
        summary.auditors += 1;
        break;
      default:
        break;
    }
  }
  return summary;
}

export function buildBenefitsRelationshipEdges(input: {
  organizationId: string;
  serviceProviders: BenefitsServiceProviderRecord[];
}): OrganizationRelationshipEdge[] {
  const roleToRelationship = {
    pbm: "uses",
    tpa: "uses",
    health_insurer: "uses",
    consultant: "consults",
    trustee: "administers",
    auditor: "audits",
    other: "uses",
  } as const;

  const roleLabels: Record<BenefitsServiceProviderRecord["role"], string> = {
    pbm: "PBM",
    tpa: "TPA",
    health_insurer: "Health insurer",
    consultant: "Consultant",
    trustee: "Trustee",
    auditor: "Auditor",
    other: "Vendor",
  };

  return input.serviceProviders.map((provider, index) => ({
    id: `benefits-edge-${input.organizationId}-${index}`,
    fromOrganizationId: input.organizationId,
    toOrganizationName: provider.name,
    relationship: roleToRelationship[provider.role],
    role: roleLabels[provider.role],
    provenance: provider.provenance,
    metadata: provider.ein ? { providerEin: provider.ein } : undefined,
  }));
}

export function isBenefitsIntelligenceDetail(
  detail: unknown,
): detail is BenefitsIntelligenceDetail {
  return (
    typeof detail === "object" &&
    detail != null &&
    "totals" in detail &&
    "filings" in detail
  );
}
