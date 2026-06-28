import { getErisaFilingsForProspect } from "@/lib/import/erisa/memoryIndex";
import type { RawProspect } from "@/lib/search/types";
import type {
  OrganizationIntelligenceModule,
  OrganizationIntelligenceProfile,
} from "../framework/types";
import {
  buildBenefitsIntelligenceModule,
  buildBenefitsRelationshipEdges,
  isBenefitsIntelligenceDetail,
} from "../modules/benefits/buildBenefitsIntelligence";
import { mergeRelationshipEdges } from "../relationships/graph";
import type { OrganizationRelationshipGraph } from "../relationships/types";

export interface IntelligenceBuildInput {
  organizationId: string;
  organizationName?: string;
  ein?: string;
  erisaIntelPresent?: boolean;
}

type ModuleBuildResult = {
  module: OrganizationIntelligenceModule | null;
  relationshipEdges: import("../relationships/types").OrganizationRelationshipEdge[];
};

const MODULE_BUILDERS: ((input: IntelligenceBuildInput) => ModuleBuildResult)[] = [
  buildBenefitsModuleResult,
];

function buildBenefitsModuleResult(input: IntelligenceBuildInput): ModuleBuildResult {
  const filings = getErisaFilingsForProspect(input.organizationId, input.ein, {
    erisaIntelPresent: input.erisaIntelPresent,
    organizationName: input.organizationName,
  });
  const benefitsModule = buildBenefitsIntelligenceModule({
    organizationId: input.organizationId,
    filings,
  });
  const serviceProviders = benefitsModule && isBenefitsIntelligenceDetail(benefitsModule.detail)
    ? benefitsModule.detail.serviceProviders
    : [];
  return {
    module: benefitsModule,
    relationshipEdges: benefitsModule
      ? buildBenefitsRelationshipEdges({
          organizationId: input.organizationId,
          serviceProviders,
        })
      : [],
  };
}

/** Build the intelligence profile for an organization from all registered modules. */
export function buildOrganizationIntelligence(
  input: IntelligenceBuildInput,
): OrganizationIntelligenceProfile {
  const modules: OrganizationIntelligenceModule[] = [];
  const relationshipGroups: OrganizationRelationshipGraph["edges"][] = [];

  for (const builder of MODULE_BUILDERS) {
    const result = builder(input);
    if (result.module) modules.push(result.module);
    if (result.relationshipEdges.length > 0) {
      relationshipGroups.push(result.relationshipEdges);
    }
  }

  return {
    organizationId: input.organizationId,
    modules,
  };
}

export function buildOrganizationRelationshipGraph(
  input: IntelligenceBuildInput,
): OrganizationRelationshipGraph {
  const relationshipGroups: OrganizationRelationshipGraph["edges"][] = [];

  for (const builder of MODULE_BUILDERS) {
    const result = builder(input);
    if (result.relationshipEdges.length > 0) {
      relationshipGroups.push(result.relationshipEdges);
    }
  }

  return mergeRelationshipEdges(input.organizationId, relationshipGroups);
}

/** Convenience wrapper for prospect-shaped inputs. */
export function buildIntelligenceForProspect(
  prospect: Pick<RawProspect, "id" | "ein" | "name" | "erisaIntel">,
): {
  organizationIntelligence: OrganizationIntelligenceProfile;
  relationshipGraph: OrganizationRelationshipGraph;
} {
  const einFromId = prospect.id.match(/^erisa-(\d{9})$/i)?.[1];
  const input: IntelligenceBuildInput = {
    organizationId: prospect.id,
    organizationName: prospect.name,
    ein: prospect.ein ?? einFromId,
    erisaIntelPresent: Boolean(prospect.erisaIntel),
  };

  return {
    organizationIntelligence: buildOrganizationIntelligence(input),
    relationshipGraph: buildOrganizationRelationshipGraph(input),
  };
}
