-- Email pattern evidence for organization-level contact intelligence
CREATE TYPE "email_pattern_id" AS ENUM(
  'first.last',
  'first_last',
  'firstlast',
  'flast',
  'firstl',
  'first',
  'last',
  'unknown'
);

CREATE TYPE "email_evidence_source" AS ENUM('public_web');

CREATE TABLE IF NOT EXISTS "email_pattern_evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "domain" text NOT NULL,
  "email" text NOT NULL,
  "local_part" text NOT NULL,
  "pattern" "email_pattern_id",
  "first_name" text,
  "last_name" text,
  "source_url" text NOT NULL,
  "source_type" "email_evidence_source" DEFAULT 'public_web' NOT NULL,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_pattern_evidence_org_idx" ON "email_pattern_evidence" ("organization_id");
CREATE INDEX IF NOT EXISTS "email_pattern_evidence_domain_idx" ON "email_pattern_evidence" ("domain");
