import type { WarehouseConnectorDefinition, WarehouseConnectorId } from "../types";
import { PRODUCTION_WAREHOUSE_CONNECTOR_IDS } from "../organizations";
import { healthPlansConnectorApi, HEALTH_PLANS_CONNECTOR } from "./healthPlans";
import { manufacturersConnectorApi, MANUFACTURERS_CONNECTOR } from "./manufacturers";

export const WAREHOUSE_CONNECTORS: Record<
  WarehouseConnectorId,
  WarehouseConnectorDefinition
> = {
  "health-plans": HEALTH_PLANS_CONNECTOR,
  manufacturers: MANUFACTURERS_CONNECTOR,
};

export { PRODUCTION_WAREHOUSE_CONNECTOR_IDS };

export function getWarehouseConnector(
  id: WarehouseConnectorId,
): WarehouseConnectorDefinition {
  return WAREHOUSE_CONNECTORS[id];
}

export { healthPlansConnectorApi, manufacturersConnectorApi };
