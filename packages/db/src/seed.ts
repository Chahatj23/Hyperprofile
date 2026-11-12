import { logger } from "@hyperprofile/shared";
import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { reservedSlugs, users } from "./schema.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Load root .env if not loaded in environment
const rootEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
if (fs.existsSync(rootEnvPath)) {
  const content = fs.readFileSync(rootEnvPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

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
