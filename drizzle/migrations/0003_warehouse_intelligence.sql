ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "geography" jsonb;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "classifications" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sector_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "metrics" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "relationships" jsonb DEFAULT '[]'::jsonb NOT NULL;

CREATE INDEX IF NOT EXISTS "organizations_classifications_gin_idx" ON "organizations" USING gin ("classifications");
