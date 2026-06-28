import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/** Form 5500 filing row linked to a canonical organization. */
export const erisaFilings = pgTable(
  "erisa_filings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Stable import key: `{ein}-{planNumber}-{filingYear}`. */
    filingKey: text("filing_key").notNull(),
    sponsorEin: text("sponsor_ein").notNull(),
    sponsorName: text("sponsor_name").notNull(),
    sponsorState: text("sponsor_state"),
    sponsorCity: text("sponsor_city"),
    planName: text("plan_name"),
    planNumber: text("plan_number"),
    filingYear: integer("filing_year").notNull(),
    participantCount: integer("participant_count"),
    healthWelfarePlan: boolean("health_welfare_plan").notNull().default(false),
    selfFunded: boolean("self_funded").notNull().default(false),
    fundingArrangement: text("funding_arrangement"),
    welfareBenefitTypes: jsonb("welfare_benefit_types")
      .$type<string[]>()
      .notNull()
      .default([]),
    ackId: text("ack_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("erisa_filings_filing_key_uidx").on(table.filingKey),
    index("erisa_filings_organization_id_idx").on(table.organizationId),
    index("erisa_filings_sponsor_ein_idx").on(table.sponsorEin),
    index("erisa_filings_sponsor_state_idx").on(table.sponsorState),
    index("erisa_filings_participant_count_idx").on(table.participantCount),
  ],
);

export type ErisaFilingRow = typeof erisaFilings.$inferSelect;
export type NewErisaFilingRow = typeof erisaFilings.$inferInsert;
