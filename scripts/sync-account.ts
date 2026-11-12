import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = fs.readFileSync(path.join(root, ".env"), "utf8");
let dbUrl = "";
for (const line of envFile.split("\n")) {
  if (line.startsWith("DATABASE_URL=")) {
    dbUrl = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
}

const acct = JSON.parse(fs.readFileSync(path.join(root, "real-ig-account.json"), "utf8"));
const sql = postgres(dbUrl, { max: 1 });

async function sync() {
  console.log("Syncing @jinbandhan to Neon PostgreSQL...");

  // 1. Create or get user
  const userRows = await sql`
    INSERT INTO users (email, role, locale)
    VALUES ('chahat@jinbandhan.com', 'creator', 'en')
    ON CONFLICT (email) DO UPDATE SET updated_at = now()
    RETURNING id;
  `;
  const userId = userRows[0]!.id;

  // 2. Create or get creator profile
  const creatorRows = await sql`
    INSERT INTO creators (user_id, slug, display_name, bio, plan, kyc_status)
    VALUES (${userId}, 'jinbandhan', 'Jinbandhan', 'Verified Jain Matrimony & Community Profiles', 'creator', 'approved')
    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
    RETURNING id;
  `;
  const creatorId = creatorRows[0]!.id;

  // 3. Upsert ig_accounts
  await sql`
    INSERT INTO ig_accounts (
      creator_id, ig_user_id, username, access_token_encrypted, scopes, raw_profile
    )
    VALUES (
      ${creatorId},
      ${acct.igUserId},
      ${acct.username},
      ${acct.accessTokenEncrypted},
      ARRAY['instagram_basic','instagram_manage_comments','instagram_manage_messages','pages_show_list','pages_read_engagement'],
      ${JSON.stringify({ name: acct.name, accountType: acct.accountType })}::jsonb
    )
    ON CONFLICT (ig_user_id) DO UPDATE SET
      access_token_encrypted = ${acct.accessTokenEncrypted},
      username = ${acct.username},
      updated_at = now();
  `;

  // 4. Upsert active rule into automation_rules
  const rules = JSON.parse(fs.readFileSync(path.join(root, "real-ig-rules.json"), "utf8"));
  for (const r of rules) {
    await sql`
      INSERT INTO automation_rules (
        ig_user_id, keyword, media_id, message, link, active
      )
      VALUES (
        ${r.igUserId},
        ${r.keyword ?? ''},
        ${r.mediaId},
        ${r.message},
        ${r.link},
        ${r.active}
      )
      ON CONFLICT DO NOTHING;
    `;
  }

  console.log("✓ Successfully synced @jinbandhan and active rules into Neon Postgres!");
  await sql.end();
  process.exit(0);
}

sync().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
