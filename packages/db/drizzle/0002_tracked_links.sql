CREATE TABLE IF NOT EXISTS "tracked_links" (
  "short_id" text PRIMARY KEY,
  "target_url" text NOT NULL,
  "ig_user_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
