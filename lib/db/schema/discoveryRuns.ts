import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Snapshot of SearchIntent at discovery time. */
export type DiscoveryRunIntentSnapshot = {
  query: string;
  sectorId: string | null;
  industryId: string | null;
  organizationTypeId: string | null;
  state: string | null;
  city: string | null;
  region: string;
  keywords: string[];
};

/**
 * Audit log for a discovery pipeline execution (v2 diagnostics + query).
 * Additive persistence — does not replace in-memory discovery yet.
 */
export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryText: text("query_text").notNull(),
    intent: jsonb("intent").$type<DiscoveryRunIntentSnapshot>().notNull(),
    connectorCandidates: jsonb("connector_candidates")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    mergedUnique: integer("merged_unique").notNull().default(0),
    rankedCount: integer("ranked_count").notNull().default(0),
    displayedCount: integer("displayed_count").notNull().default(0),
    totalBeforeDedupe: integer("total_before_dedupe").notNull().default(0),
    latencyMs: numeric("latency_ms", { precision: 10, scale: 2 }),
    stagesRun: jsonb("stages_run").$type<string[]>().notNull().default([]),
    expanded: boolean("expanded").notNull().default(false),
    fallbackReason: text("fallback_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("discovery_runs_created_at_idx").on(table.createdAt),
    index("discovery_runs_query_text_idx").on(table.queryText),
  ],
);

export type DiscoveryRunRow = typeof discoveryRuns.$inferSelect;
export type NewDiscoveryRunRow = typeof discoveryRuns.$inferInsert;
