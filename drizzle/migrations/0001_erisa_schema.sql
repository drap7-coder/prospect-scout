ALTER TABLE "organizations" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE "erisa_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"filing_key" text NOT NULL,
	"sponsor_ein" text NOT NULL,
	"sponsor_name" text NOT NULL,
	"sponsor_state" text,
	"sponsor_city" text,
	"plan_name" text,
	"plan_number" text,
	"filing_year" integer NOT NULL,
	"participant_count" integer,
	"health_welfare_plan" boolean DEFAULT false NOT NULL,
	"self_funded" boolean DEFAULT false NOT NULL,
	"funding_arrangement" text,
	"welfare_benefit_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ack_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erisa_service_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"provider_name" text NOT NULL,
	"provider_ein" text,
	"service_code" text,
	"compensation_amount" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erisa_filings" ADD CONSTRAINT "erisa_filings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erisa_service_providers" ADD CONSTRAINT "erisa_service_providers_filing_id_erisa_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."erisa_filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "erisa_filings_filing_key_uidx" ON "erisa_filings" USING btree ("filing_key");--> statement-breakpoint
CREATE INDEX "erisa_filings_organization_id_idx" ON "erisa_filings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "erisa_filings_sponsor_ein_idx" ON "erisa_filings" USING btree ("sponsor_ein");--> statement-breakpoint
CREATE INDEX "erisa_filings_sponsor_state_idx" ON "erisa_filings" USING btree ("sponsor_state");--> statement-breakpoint
CREATE INDEX "erisa_filings_participant_count_idx" ON "erisa_filings" USING btree ("participant_count");--> statement-breakpoint
CREATE INDEX "erisa_service_providers_filing_id_idx" ON "erisa_service_providers" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "erisa_service_providers_provider_ein_idx" ON "erisa_service_providers" USING btree ("provider_ein");
