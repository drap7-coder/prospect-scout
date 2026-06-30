CREATE TABLE IF NOT EXISTS "warehouse_connector_manifests" (
  "connector_id" text PRIMARY KEY NOT NULL,
  "imported_at" timestamp with time zone NOT NULL,
  "import_mode" text NOT NULL,
  "manifest" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
