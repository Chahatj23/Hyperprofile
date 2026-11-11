import { logger } from "@hyperprofile/shared";
import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { reservedSlugs, users } from "./schema.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://hyperprofile:hyperprofile@localhost:5432/hyperprofile";

const RESERVED = ["admin", "api", "www", "app", "login", "signup", "hyperprofile", "support"];

async function main() {
  const db = createDb(databaseUrl);
  for (const slug of RESERVED) {
    await db.insert(reservedSlugs).values({ slug, reason: "system" }).onConflictDoNothing();
  }
  const existing = await db.select().from(users).where(eq(users.email, "demo@hyperprofile.local")).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({
      email: "demo@hyperprofile.local",
      locale: "en",
      role: "creator",
    });
  }
  logger.info("seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
