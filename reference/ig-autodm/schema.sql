-- Production schema (Postgres). Tokens are stored encrypted at the app layer.
CREATE TABLE ig_accounts (
  ig_user_id        text PRIMARY KEY,            -- natural key; app-scoped, changes if you change the Meta app
  owner_id          uuid NOT NULL,
  username          text NOT NULL,
  token_enc         text NOT NULL,
  token_expires_at  timestamptz NOT NULL,
  subscribed_at     timestamptz,                 -- NULL = provisional (connected but not subscribed)
  reauth_required_at timestamptz,                -- set once on 190/102; scheduler skips these
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE automation_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id  text NOT NULL REFERENCES ig_accounts,
  keyword     text NOT NULL DEFAULT '',          -- '' = any comment
  media_id    text,                              -- NULL = all posts
  message     text NOT NULL CHECK (octet_length(message) <= 1000),
  link        text,
  active      boolean NOT NULL DEFAULT true
);
-- THE key invariant: one private reply per comment, enforced by the database.
CREATE TABLE automation_events (
  comment_id   text PRIMARY KEY,
  ig_user_id   text NOT NULL,
  rule_id      uuid,
  status       text NOT NULL CHECK (status IN ('queued','sent','failed','expired')),
  reason       text,
  message_id   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Claim:  INSERT ... ON CONFLICT (comment_id) DO NOTHING RETURNING comment_id;  (no row = duplicate, skip)
CREATE INDEX ON automation_events (ig_user_id, created_at);   -- hourly-cap and analytics queries
CREATE TABLE link_clicks (id bigserial PRIMARY KEY, short_id text NOT NULL, at timestamptz NOT NULL DEFAULT now());
