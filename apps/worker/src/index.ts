import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Redis } from "ioredis";
import { logger } from "@hyperprofile/shared";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

async function main() {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    await redis.ping();
    logger.info("worker online", { redis: "ok", queues: ["webhooks", "dm-send", "email"] });
  } catch (err) {
    logger.warn("worker started without redis (will retry in later phases)", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  setInterval(() => {
    logger.debug("worker heartbeat");
  }, 60_000);
}

main().catch((err) => {
  logger.error("worker failed", { err: String(err) });
  process.exit(1);
});
