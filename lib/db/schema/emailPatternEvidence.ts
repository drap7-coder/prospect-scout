import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const emailPatternIdEnum = pgEnum("email_pattern_id", [
  "first.last",
  "first_last",
  "firstlast",
  "flast",
  "firstl",
  "first",
  "last",
  "unknown",
]);

export const emailEvidenceSourceEnum = pgEnum("email_evidence_source", [
  "public_web",
]);

/**
 * Observed public emails supporting organization email-pattern inference.
 * Primary intelligence lives on organizations.sector_attributes.emailPattern.
 */
export const emailPatternEvidence = pgTable(
  "email_pattern_evidence",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    domain: text("domain").notNull(),
    email: text("email").notNull(),
    localPart: text("local_part").notNull(),
    pattern: emailPatternIdEnum("pattern"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    sourceUrl: text("source_url").notNull(),
    sourceType: emailEvidenceSourceEnum("source_type").notNull().default("public_web"),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("email_pattern_evidence_org_idx").on(table.organizationId),
    index("email_pattern_evidence_domain_idx").on(table.domain),
  ],
);

export type EmailPatternEvidenceRow = typeof emailPatternEvidence.$inferSelect;
export type NewEmailPatternEvidenceRow = typeof emailPatternEvidence.$inferInsert;
