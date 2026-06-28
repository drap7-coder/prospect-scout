import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/** Registry identifier types used for cross-connector merge/dedupe. */
export const externalIdTypeEnum = pgEnum("external_id_type", [
  "cik",
  "ein",
  "npi",
  "fda",
  "domain",
  "other",
]);

/**
 * External registry identifiers (CIK, EIN, NPI, FDA org id, etc.).
 * One organization may have many external ids from different sources.
 */
export const externalIds = pgTable(
  "external_ids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    idType: externalIdTypeEnum("id_type").notNull(),
    idValue: text("id_value").notNull(),
    sourceConnector: text("source_connector"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("external_ids_type_value_uidx").on(table.idType, table.idValue),
    index("external_ids_organization_id_idx").on(table.organizationId),
  ],
);

export type ExternalIdRow = typeof externalIds.$inferSelect;
export type NewExternalIdRow = typeof externalIds.$inferInsert;
