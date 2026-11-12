import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
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
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return parsed.data;
}
