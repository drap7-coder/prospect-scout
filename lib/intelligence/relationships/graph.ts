import type {
  OrganizationRelationshipEdge,
  OrganizationRelationshipGraph,
} from "./types";

/** Merge relationship edges from multiple intelligence sources for one organization. */
export function mergeRelationshipEdges(
  organizationId: string,
  edgeGroups: OrganizationRelationshipEdge[][],
): OrganizationRelationshipGraph {
  const seen = new Set<string>();
  const edges: OrganizationRelationshipEdge[] = [];

  for (const group of edgeGroups) {
    for (const edge of group) {
      const key = [
        edge.fromOrganizationId,
        edge.toOrganizationId ?? edge.toOrganizationName.toLowerCase(),
        edge.relationship,
        edge.role ?? "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
    }
  }

  return { organizationId, edges };
}

/** Filter edges by relationship type (future graph queries). */
export function edgesByRelationship(
  graph: OrganizationRelationshipGraph,
  relationship: OrganizationRelationshipEdge["relationship"],
): OrganizationRelationshipEdge[] {
  return graph.edges.filter((edge) => edge.relationship === relationship);
}

/** Filter edges where the target matches a vendor role label. */
export function edgesByRole(
  graph: OrganizationRelationshipGraph,
  role: string,
): OrganizationRelationshipEdge[] {
  const needle = role.toLowerCase();
  return graph.edges.filter((edge) => edge.role?.toLowerCase() === needle);
}
