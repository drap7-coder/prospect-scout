import type { Organization } from "@/lib/discovery/organization";
import { healthPlansConnectorApi } from "./connectors/healthPlans";
import { manufacturersConnectorApi } from "./connectors/manufacturers";
import type { WarehouseConnectorId } from "./types";

export const PRODUCTION_WAREHOUSE_CONNECTOR_IDS: WarehouseConnectorId[] = [
  "health-plans",
  "manufacturers",
];

function connectorApi(id: WarehouseConnectorId) {
  if (id === "health-plans") return healthPlansConnectorApi;
  if (id === "manufacturers") return manufacturersConnectorApi;
  throw new Error(`Unknown warehouse connector: ${id}`);
}

/** All organizations indexed across production warehouse connectors. */
export function getWarehouseOrganizations(): Organization[] {
  const orgs: Organization[] = [];
  for (const connectorId of PRODUCTION_WAREHOUSE_CONNECTOR_IDS) {
    orgs.push(...connectorApi(connectorId).getOrganizations());
  }
  return orgs;
}

export function getWarehouseIndexSize(): number {
  let total = 0;
  for (const connectorId of PRODUCTION_WAREHOUSE_CONNECTOR_IDS) {
    total += connectorApi(connectorId).getIndexSize();
  }
  return total;
}

export function getWarehouseCoveredBuyerPacks(): Set<string> {
  const packs = new Set<string>();
  for (const connectorId of PRODUCTION_WAREHOUSE_CONNECTOR_IDS) {
    const api = connectorApi(connectorId);
    if (api.getIndexSize() > 0) {
      packs.add(api.definition.buyerPack);
    }
  }
  return packs;
}

export { connectorApi as warehouseConnectorApi };
