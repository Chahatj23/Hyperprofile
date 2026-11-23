import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(databaseUrl: string) {
  const cleanUrl = databaseUrl.trim().replace(/^["']|["']$/g, "");
  const isSsl = cleanUrl.includes("sslmode=require") || cleanUrl.includes("neon.tech");
  const client = postgres(cleanUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(isSsl ? { ssl: "require" } : {}),
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
