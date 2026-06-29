import type { Organization } from "@/lib/discovery/organization";
import type { OrganizationExternalId } from "@/lib/organization/model";
import { resolveHighConfidenceDomain } from "./resolveDomain";
import type { DomainLookupResult } from "./types";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "./types";

export interface ImportPropagationResult {
  lookup: DomainLookupResult;
  ambiguous: boolean;
  lane: "regional_plan_registry" | "parent_propagation" | "directory_or_ids" | "source_data";
}

function laneFromLookup(lookup: DomainLookupResult): ImportPropagationResult["lane"] {
  if (lookup.source === "regional_plan_registry") return "regional_plan_registry";
  if (lookup.source === "parent_propagation") return "parent_propagation";
  if (lookup.source === "source_data" || lookup.source === "derived") return "source_data";
  return "directory_or_ids";
}

/**
 * Lane 3 — safe import-time domain propagation.
 * Stamps domains only when confidence is high and ambiguity is zero.
 */
export function resolveImportTimeDomain(
  org: Organization,
  externalIds?: OrganizationExternalId[],
): ImportPropagationResult | null {
  const lookup = resolveHighConfidenceDomain({
    organization: org,
    externalIds: externalIds ?? org.externalIds,
  });
  if (!lookup || lookup.confidence < DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD) return null;

  return {
    lookup,
    ambiguous: false,
    lane: laneFromLookup(lookup),
  };
}
