CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ig_user_id" text NOT NULL,
  "keyword" text DEFAULT '' NOT NULL,
  "media_id" text,
  "message" text NOT NULL,
  "link" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "automation_rules_message_bytes_chk" CHECK (octet_length("message") <= 1000)
);

CREATE TABLE IF NOT EXISTS "automation_events" (
  "comment_id" text PRIMARY KEY,
  "ig_user_id" text NOT NULL,
  "rule_id" uuid REFERENCES "automation_rules"("id"),
  "status" text NOT NULL,
  "reason" text,
  "message_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "automation_events_status_chk" CHECK ("status" IN ('queued','sent','failed','expired'))
);
CREATE INDEX IF NOT EXISTS "automation_events_ig_created_idx" ON "automation_events" ("ig_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "link_clicks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "short_id" text NOT NULL,
  "clicked_at" timestamptz DEFAULT now() NOT NULL
);
