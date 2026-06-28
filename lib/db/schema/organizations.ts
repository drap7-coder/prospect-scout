import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const ownershipEnum = pgEnum("ownership_type", [
  "public",
  "private",
  "nonprofit",
  "government",
]);

/**
 * Persistent canonical organization record.
 * Mirrors lib/discovery/organization.ts — array fields stored as JSONB.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    website: text("website"),
    domain: text("domain"),
    organizationType: text("organization_type"),
    canonicalOrganizationType: text("canonical_organization_type").notNull(),
    industries: jsonb("industries").$type<string[]>().notNull().default([]),
    sectorId: text("sector_id"),
    headquarters: text("headquarters"),
    locations: jsonb("locations").$type<string[]>().notNull().default([]),
    states: jsonb("states").$type<string[]>().notNull().default([]),
    regions: jsonb("regions").$type<string[]>().notNull().default([]),
    ownership: ownershipEnum("ownership"),
    employeeRange: text("employee_range"),
    memberEstimate: integer("member_estimate"),
    revenueRange: text("revenue_range"),
    description: text("description"),
    buyerPack: text("buyer_pack"),
    healthPlanType: text("health_plan_type"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    relevance: numeric("relevance", { precision: 5, scale: 2 }),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("organizations_domain_idx").on(table.domain),
    index("organizations_sector_id_idx").on(table.sectorId),
    index("organizations_canonical_name_idx").on(table.canonicalName),
  ],
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
