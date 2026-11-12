import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { logger } from "@hyperprofile/shared";
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

// Prefer unpooled direct connection for DDL migrations per Neon best practices
const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgres://hyperprofile:hyperprofile@localhost:5432/hyperprofile";

async function main() {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
  await migrate(db, { migrationsFolder });
  logger.info("migrations applied", { migrationsFolder });
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
