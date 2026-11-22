import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
  API_PORT: z.coerce.number().default(Number(process.env.PORT) || 4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, "TOKEN_ENCRYPTION_KEY must be 32 bytes hex (64 chars)"),
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_LOGIN_CONFIG_ID: z.string().min(1),
  META_REDIRECT_URI: z.string().url(),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  META_BUSINESS_PORTFOLIO_ID: z.string().optional(),
  /** Hub verify token for Instagram webhook GET handshake (not the app secret). */
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(8),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().optional(),
  BREVO_SENDER_NAME: z.string().optional(),
  BREVO_SMTP_KEY: z.string().optional(),
  BREVO_SMTP_USER: z.string().optional(),
  /** Zero-Cost Architecture: Cron Secret for Cloudflare Cron Triggers to /v1/jobs/* */
  CRON_SECRET: z.string().min(16).optional(),
  /** Background pollers enable flag: false by default in production to allow Neon Postgres sleep */
  ENABLE_BACKGROUND_POLLERS: z.string().optional(),
  /** Zero-Cost Launch Kill Switches */
  PAUSE_AUTODM: z.string().optional(),
  PAUSE_SIGNUPS: z.string().optional(),
  PAUSE_CHECKOUT: z.string().optional(),
  /** Cloudflare Edge Cache Purge */
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  /** Nightly Encrypted Backups (Cloudflare R2) */
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      cleaned[key] = value.trim().replace(/^["']|["']$/g, "");
    } else {
      cleaned[key] = value;
    }
  }
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return parsed.data;
}
