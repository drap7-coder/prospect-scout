import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type ProspectScoutDb = NeonHttpDatabase<typeof schema>;

let cachedDb: ProspectScoutDb | null = null;

/** True when DATABASE_URL is set (Neon Postgres connection string). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Returns a Drizzle client backed by Neon serverless HTTP.
 * Throws if DATABASE_URL is missing — callers should guard with isDatabaseConfigured().
 */
export function getDb(): ProspectScoutDb {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon Postgres connection string to enable persistence.",
    );
  }
  if (!cachedDb) {
    const sql = neon(url);
    cachedDb = drizzle(sql, { schema });
  }
  return cachedDb;
}

export { schema };
