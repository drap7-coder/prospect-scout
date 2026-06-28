CREATE TYPE "public"."ownership_type" AS ENUM('public', 'private', 'nonprofit', 'government');--> statement-breakpoint
CREATE TYPE "public"."external_id_type" AS ENUM('cik', 'ein', 'npi', 'fda', 'domain', 'other');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"website" text,
	"domain" text,
	"organization_type" text,
	"canonical_organization_type" text NOT NULL,
	"industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sector_id" text,
	"headquarters" text,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"states" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ownership" "ownership_type",
	"employee_range" text,
	"member_estimate" integer,
	"revenue_range" text,
	"description" text,
	"buyer_pack" text,
	"health_plan_type" text,
	"relevance" numeric(5, 2),
	"confidence" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"id_type" "external_id_type" NOT NULL,
	"id_value" text NOT NULL,
	"source_connector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"connector" text NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text,
	"source_url" text,
	"last_updated" text,
	"confidence" numeric(4, 3),
	"retrieved_at" timestamp with time zone NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_text" text NOT NULL,
	"intent" jsonb NOT NULL,
	"connector_candidates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"merged_unique" integer DEFAULT 0 NOT NULL,
	"ranked_count" integer DEFAULT 0 NOT NULL,
	"displayed_count" integer DEFAULT 0 NOT NULL,
	"total_before_dedupe" integer DEFAULT 0 NOT NULL,
	"latency_ms" numeric(10, 2),
	"stages_run" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expanded" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_ids" ADD CONSTRAINT "external_ids_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sources" ADD CONSTRAINT "organization_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_domain_idx" ON "organizations" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "organizations_sector_id_idx" ON "organizations" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "organizations_canonical_name_idx" ON "organizations" USING btree ("canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "external_ids_type_value_uidx" ON "external_ids" USING btree ("id_type","id_value");--> statement-breakpoint
CREATE INDEX "external_ids_organization_id_idx" ON "external_ids" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_sources_org_connector_source_uidx" ON "organization_sources" USING btree ("organization_id","connector","source_id");--> statement-breakpoint
CREATE INDEX "organization_sources_connector_idx" ON "organization_sources" USING btree ("connector");--> statement-breakpoint
CREATE INDEX "discovery_runs_created_at_idx" ON "discovery_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "discovery_runs_query_text_idx" ON "discovery_runs" USING btree ("query_text");
