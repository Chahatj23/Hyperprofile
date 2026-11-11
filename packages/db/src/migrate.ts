import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { logger } from "@hyperprofile/shared";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl =
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
