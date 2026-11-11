CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "locale" text DEFAULT 'en' NOT NULL,
  "role" text DEFAULT 'creator' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uidx" ON "users" ("email");

CREATE TABLE IF NOT EXISTS "creators" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "bio" text,
  "theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "plan" text DEFAULT 'free' NOT NULL,
  "kyc_status" text DEFAULT 'none' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "creators_slug_uidx" ON "creators" ("slug");

CREATE TABLE IF NOT EXISTS "ig_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid REFERENCES "creators"("id"),
  "ig_user_id" text NOT NULL,
  "username" text NOT NULL,
  "access_token_encrypted" text NOT NULL,
  "token_expires_at" timestamptz,
  "subscribed_at" timestamptz,
  "reauth_required_at" timestamptz,
  "scopes" text[],
  "raw_profile" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ig_accounts_ig_user_uidx" ON "ig_accounts" ("ig_user_id");

CREATE TABLE IF NOT EXISTS "webhook_inbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "event_id" text NOT NULL,
  "raw_body" text NOT NULL,
  "received_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz,
  "error" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_inbox_provider_event_uidx" ON "webhook_inbox" ("provider","event_id");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor" text NOT NULL,
  "action" text NOT NULL,
  "entity" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reserved_slugs" (
  "slug" text PRIMARY KEY,
  "reason" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "_phase0_health" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "ok" boolean DEFAULT true NOT NULL
);
