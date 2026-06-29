import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { emailPatternEvidence } from "@/lib/db/schema/emailPatternEvidence";
import type { EmailPatternEvidenceRecord } from "./types";

export async function persistEmailPatternEvidence(
  records: EmailPatternEvidenceRecord[],
): Promise<void> {
  if (!isDatabaseConfigured() || records.length === 0) return;
  const db = getDb();

  try {
    for (const row of records) {
      await db
        .insert(emailPatternEvidence)
        .values({
          id: row.id,
          organizationId: row.organizationId,
          domain: row.domain,
          email: row.email,
          localPart: row.localPart,
          pattern: row.pattern,
          firstName: row.firstName,
          lastName: row.lastName,
          sourceUrl: row.sourceUrl,
          sourceType: row.sourceType,
          observedAt: new Date(row.observedAt),
        })
        .onConflictDoUpdate({
          target: emailPatternEvidence.id,
          set: {
            pattern: row.pattern,
            firstName: row.firstName,
            lastName: row.lastName,
            observedAt: new Date(row.observedAt),
          },
        });
    }
  } catch (error) {
    // Allow enrichment to proceed when migration 0004 has not been applied yet.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("email_pattern_evidence")) {
      console.warn(
        "email_pattern_evidence table missing — run npm run db:migrate to persist evidence",
      );
      return;
    }
    throw error;
  }
}

export async function loadEmailPatternEvidence(
  organizationId: string,
): Promise<EmailPatternEvidenceRecord[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(emailPatternEvidence)
    .where(eq(emailPatternEvidence.organizationId, organizationId))
    .limit(20);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    domain: row.domain,
    email: row.email,
    localPart: row.localPart,
    pattern: row.pattern,
    firstName: row.firstName,
    lastName: row.lastName,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType,
    observedAt: row.observedAt.toISOString(),
  }));
}

export async function deleteEmailPatternEvidenceForOrg(
  organizationId: string,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .delete(emailPatternEvidence)
    .where(eq(emailPatternEvidence.organizationId, organizationId));
}
