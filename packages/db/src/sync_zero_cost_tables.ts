import postgres from "postgres";

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_ewyBbR0sP3Co@ep-spring-mountain-azf3l1in.c-3.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

const sql = postgres(url, { ssl: "require", max: 1 });

async function run() {
  console.log("Ensuring zero-cost launch tables exist in Neon...");

  await sql`
    CREATE TABLE IF NOT EXISTS "job_queue" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "queue_name" text NOT NULL,
      "payload" jsonb NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "attempts" integer DEFAULT 0 NOT NULL,
      "max_attempts" integer DEFAULT 3 NOT NULL,
      "available_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "job_queue_fetch_idx" ON "job_queue" ("queue_name", "status", "available_at");
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "daily_rollups" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "creator_id" uuid NOT NULL,
      "date" text NOT NULL,
      "page_views" integer DEFAULT 0 NOT NULL,
      "link_clicks" integer DEFAULT 0 NOT NULL,
      "orders_count" integer DEFAULT 0 NOT NULL,
      "gmv_paise" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "daily_rollups_creator_date_uidx" ON "daily_rollups" ("creator_id", "date");
  `;

  console.log("job_queue and daily_rollups tables synced successfully!");
  await sql.end();
}

run().catch((err) => {
  console.error("Failed to sync tables:", err);
  process.exit(1);
});
