import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Provenance records linking an organization to a discovery connector.
 * Mirrors OrganizationSource in lib/discovery/organization.ts.
 */
export const organizationSources = pgTable(
  "organization_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    connector: text("connector").notNull(),
    sourceId: text("source_id").notNull(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    lastUpdated: text("last_updated"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_sources_org_connector_source_uidx").on(
      table.organizationId,
      table.connector,
      table.sourceId,
    ),
    index("organization_sources_connector_idx").on(table.connector),
  ],
);

export type OrganizationSourceRow = typeof organizationSources.$inferSelect;
export type NewOrganizationSourceRow = typeof organizationSources.$inferInsert;
