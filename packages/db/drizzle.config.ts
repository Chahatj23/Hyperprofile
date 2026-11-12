import { defineConfig } from "drizzle-kit";
import path from "node:path";
import fs from "node:fs";

// Read root .env
const envPath = path.resolve(__dirname, "../../.env");
let dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    if (line.startsWith("DATABASE_URL_UNPOOLED=")) {
      dbUrl = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      break;
    } else if (line.startsWith("DATABASE_URL=")) {
      dbUrl = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl ?? "postgres://hyperprofile:hyperprofile@localhost:5432/hyperprofile",
  },
});
