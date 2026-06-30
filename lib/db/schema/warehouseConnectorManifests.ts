import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Persisted import manifest per production warehouse connector (survives cold start). */
export const warehouseConnectorManifests = pgTable("warehouse_connector_manifests", {
  connectorId: text("connector_id").primaryKey(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
  importMode: text("import_mode").notNull(),
  manifest: jsonb("manifest").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WarehouseConnectorManifestRow =
  typeof warehouseConnectorManifests.$inferSelect;
export type NewWarehouseConnectorManifestRow =
  typeof warehouseConnectorManifests.$inferInsert;
