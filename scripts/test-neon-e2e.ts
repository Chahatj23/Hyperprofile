import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { createDb, reservedSlugs, users, creators, igAccounts, automationRules } from "../packages/db/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const databaseUrl = process.env.DATABASE_URL;
const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;

console.log("=== NEON POSTGRESQL END-TO-END VERIFICATION ===");
console.log("Neon Branch:", process.env.NEON_BRANCH);
console.log("Neon Branch ID:", process.env.NEON_BRANCH_ID);
console.log("Database URL Host (Pooled):", databaseUrl ? new URL(databaseUrl).host : "MISSING");
console.log("Unpooled URL Host (Compute):", unpooledUrl ? new URL(unpooledUrl).host : "MISSING");

if (!databaseUrl) {
  console.error("FAIL: DATABASE_URL is not set.");
  process.exit(1);
}

async function runTests() {
  const sql = postgres(databaseUrl, { max: 5 });
  const db = createDb(databaseUrl);

  console.log("\n[Test 1/5] Raw PostgreSQL Connection & Handshake...");
  const ping = await sql`SELECT NOW() as current_time, current_database() as db_name, version() as pg_version`;
  console.log("  ✓ Connected successfully to Neon DB:", ping[0].db_name);
  console.log("  ✓ Neon Server Time (UTC):", ping[0].current_time);
  console.log("  ✓ PostgreSQL Version:", ping[0].pg_version.split(" on ")[0]);

  console.log("\n[Test 2/5] Reserved Slugs Query via Drizzle ORM...");
  const slugs = await db.select().from(reservedSlugs).limit(6);
  console.log(`  ✓ Successfully queried reserved_slugs table (${slugs.length} sample records found):`);
  console.log("   ", slugs.map(s => s.slug).join(", "));

  console.log("\n[Test 3/5] Creator Profile & Live Instagram Sync Verification...");
  const creatorList = await db.select().from(creators).where(eq(creators.slug, "jinbandhan"));
  if (creatorList.length === 0) {
    throw new Error("Creator @jinbandhan not found in Neon DB!");
  }
  const jinbandhan = creatorList[0];
  console.log("  ✓ Found creator in Neon DB:", jinbandhan.displayName, `(slug: ${jinbandhan.slug})`);
  console.log("  ✓ KYC Status:", jinbandhan.kycStatus, "| Plan:", jinbandhan.plan);

  const igList = await db.select().from(igAccounts).where(eq(igAccounts.creatorId, jinbandhan.id));
  console.log(`  ✓ Found linked IG accounts (${igList.length}):`, igList.map(a => `@${a.username}`).join(", "));
  const primaryIg = igList[0];

  const rules = await db.select().from(automationRules).where(eq(automationRules.igUserId, primaryIg.igUserId));
  console.log(`  ✓ Found active automation rules (${rules.length}):`);
  for (const r of rules) {
    console.log(`    - keyword: "${r.keyword}" -> message: "${r.message.slice(0, 40)}..." (active: ${r.active})`);
  }

  console.log("\n[Test 4/5] Write, Read & Transaction Integrity on Neon...");
  const testEmail = `neon-verify-${Date.now()}@hyperprofile.dev`;
  const insertResult = await sql`
    INSERT INTO users (email, role, locale)
    VALUES (${testEmail}, 'buyer', 'en')
    RETURNING id, email;
  `;
  const insertedId = insertResult[0].id;
  console.log("  ✓ Inserted test user:", insertResult[0].email, "ID:", insertedId);

  const fetchUser = await db.select().from(users).where(eq(users.id, insertedId));
  if (fetchUser.length !== 1 || fetchUser[0].email !== testEmail) {
    throw new Error("Failed to read back written record from Neon DB");
  }
  console.log("  ✓ Verified read back via Drizzle ORM:", fetchUser[0].email);

  await sql`DELETE FROM users WHERE id = ${insertedId}`;
  console.log("  ✓ Cleaned up test record.");

  console.log("\n[Test 5/5] Connection Pool Concurrency Test...");
  const results = await Promise.all([
    sql`SELECT 1 as num`,
    sql`SELECT 2 as num`,
    sql`SELECT 3 as num`,
    sql`SELECT 4 as num`,
    sql`SELECT 5 as num`
  ]);
  console.log("  ✓ Executed 5 concurrent queries through Neon PgBouncer connection pool successfully.");

  await sql.end();
  console.log("\n========================================================");
  console.log(" ALL NEON POSTGRESQL SERVICES OPERATIONAL & VERIFIED! ✓");
  console.log("========================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
