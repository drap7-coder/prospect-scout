import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { erisaFilings } from "./erisaFilings";

/** Schedule C service provider row (v1 — populated when CSV includes clean fields). */
export const erisaServiceProviders = pgTable(
  "erisa_service_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => erisaFilings.id, { onDelete: "cascade" }),
    providerName: text("provider_name").notNull(),
    providerEin: text("provider_ein"),
    serviceCode: text("service_code"),
    compensationAmount: numeric("compensation_amount", {
      precision: 14,
      scale: 2,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("erisa_service_providers_filing_id_idx").on(table.filingId),
    index("erisa_service_providers_provider_ein_idx").on(table.providerEin),
  ],
);

export type ErisaServiceProviderRow = typeof erisaServiceProviders.$inferSelect;
export type NewErisaServiceProviderRow =
  typeof erisaServiceProviders.$inferInsert;
