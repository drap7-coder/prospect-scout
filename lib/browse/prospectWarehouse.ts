import type { Prospect } from "@/lib/search/types";
import type { OrganizationClassification } from "@/lib/organization/model";
import { classificationFilterLabel } from "@/lib/search/classificationFilters";
import { healthPlanTypeLabel } from "@/lib/discovery/healthPlanType";

export function prospectClassifications(
  prospect: Prospect,
): OrganizationClassification[] {
  if (prospect.classifications?.length) return prospect.classifications;
  if (prospect.healthPlanType) {
    return [
      {
        namespace: "health-plans",
        id: prospect.healthPlanType,
        label: healthPlanTypeLabel(prospect.healthPlanType),
      },
    ];
  }
  return [];
}

export function prospectHasClassification(
  prospect: Prospect,
  namespace: string,
  id: string,
): boolean {
  return prospectClassifications(prospect).some(
    (c) => c.namespace === namespace && c.id === id,
  );
}

export function primaryBusinessLine(prospect: Prospect): string | null {
  const classes = prospectClassifications(prospect);
  const primary = classes[0];
  if (!primary) return null;
  return (
    primary.label ??
    classificationFilterLabel(primary.namespace, primary.id) ??
    primary.id.replace(/_/g, " ")
  );
}

export function primaryGeographyLabel(prospect: Prospect): string {
  if (prospect.geographyNational) return "National";
  const states = prospect.stateCodes ?? (prospect.stateCode ? [prospect.stateCode] : []);
  if (states.length === 0) return prospect.location || "—";
  if (states.length === 1) return states[0]!;
  if (states.length <= 4) return states.join(", ");
  return `${states.length} states`;
}

export function prospectKeyMetric(prospect: Prospect): { label: string; value: string } | null {
  if (prospect.coveredLives != null && prospect.coveredLives > 0) {
    return {
      label: "Covered lives",
      value: prospect.coveredLives.toLocaleString(),
    };
  }
  if (prospect.employeeEstimate != null && prospect.employeeEstimate > 0) {
    return {
      label: "Employees",
      value: prospect.employeeEstimate.toLocaleString(),
    };
  }
  return null;
}

export function classificationKey(c: OrganizationClassification): string {
  return `${c.namespace}:${c.id}`;
}
