import type { BuyerPackId } from "@/lib/search/types";

/** Internal pipeline anchor (formerly buyer pack). */
export type TaxonomyTarget = BuyerPackId;

export interface TaxonomyOrganizationType {
  id: string;
  label: string;
  sectorId: string;
  industryId: string;
  taxonomyTarget: TaxonomyTarget;
  keywords: string[];
}

export interface TaxonomyIndustry {
  id: string;
  label: string;
  sectorId: string;
  taxonomyTargets: TaxonomyTarget[];
  keywords: string[];
}

export interface TaxonomySector {
  id: string;
  label: string;
  keywords: string[];
}

export interface TaxonomyInference {
  sectorId?: string;
  industryId?: string;
  organizationTypeId?: string;
  taxonomyTarget?: TaxonomyTarget;
  signals?: string[];
  sources?: string[];
}

export interface ProviderPlanInput {
  taxonomyTarget: TaxonomyTarget;
  queryText: string;
  sectorId?: string | null;
  organizationTypeId?: string | null;
}
