import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  phone: text("phone"),
  locale: text("locale").notNull().default("en"),
  role: text("role").notNull().default("creator"),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_uidx").on(t.email)]);

export const creators = pgTable("creators", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  slug: text("slug").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  theme: jsonb("theme").$type<Record<string, unknown>>().notNull().default({}),
  plan: text("plan").notNull().default("free"),
  kycStatus: text("kyc_status").notNull().default("none"),
  ...timestamps,
}, (t) => [uniqueIndex("creators_slug_uidx").on(t.slug)]);

export const igAccounts = pgTable("ig_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").references(() => creators.id),
  igUserId: text("ig_user_id").notNull(),
  username: text("username").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }),
  reauthRequiredAt: timestamp("reauth_required_at", { withTimezone: true }),
  scopes: text("scopes").array(),
  rawProfile: jsonb("raw_profile").$type<Record<string, unknown>>(),
  ...timestamps,
}, (t) => [uniqueIndex("ig_accounts_ig_user_uidx").on(t.igUserId)]);

export const webhookInbox = pgTable("webhook_inbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  rawBody: text("raw_body").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
}, (t) => [uniqueIndex("webhook_inbox_provider_event_uidx").on(t.provider, t.eventId)]);

/** AutoDM: keyword → private-reply rules (from reference/ig-autodm). */
export const automationRules = pgTable("automation_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  igUserId: text("ig_user_id").notNull(),
  keyword: text("keyword").notNull().default(""),
  mediaId: text("media_id"),
  message: text("message").notNull(),
  link: text("link"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

/**
 * One private reply per comment — enforced by comment_id primary key.
 * Claim: INSERT … ON CONFLICT DO NOTHING RETURNING comment_id.
 */
export const automationEvents = pgTable(
  "automation_events",
  {
    commentId: text("comment_id").primaryKey(),
    igUserId: text("ig_user_id").notNull(),
    ruleId: uuid("rule_id").references(() => automationRules.id),
    status: text("status").notNull(),
    reason: text("reason"),
    messageId: text("message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("automation_events_ig_created_idx").on(t.igUserId, t.createdAt)],
);

/** Destination map for AutoDM short links. */
export const trackedLinks = pgTable("tracked_links", {
  shortId: text("short_id").primaryKey(),
  targetUrl: text("target_url").notNull(),
  igUserId: text("ig_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** First-party click tracking for AutoDM links. */
export const linkClicks = pgTable("link_clicks", {
  id: uuid("id").defaultRandom().primaryKey(),
  shortId: text("short_id").notNull(),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  before: jsonb("before").$type<Record<string, unknown> | null>(),
  after: jsonb("after").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reservedSlugs = pgTable("reserved_slugs", {
  slug: text("slug").primaryKey(),
  reason: text("reason").notNull(),
});

export const schemaVersionHint = pgTable("_phase0_health", {
  id: integer("id").primaryKey().default(1),
  ok: boolean("ok").notNull().default(true),
});

/** Block structure for page builder */
export type BlockType =
  | "link"
  | "social"
  | "product"
  | "lead_form"
  | "embed"
  | "text"
  | "divider";

export interface PageBlock {
  id: string;
  type: BlockType;
  title?: string;
  subtitle?: string;
  url?: string;
  productId?: string;
  content?: string;
  icon?: string;
  config?: Record<string, unknown>;
  order: number;
}

export interface PageTheme {
  themeName?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonStyle?: "rounded" | "pill" | "sharp";
  fontFamily?: string;
  darkMode?: boolean;
}

export interface PageVersion {
  title?: string;
  bio?: string;
  avatarUrl?: string;
  theme?: PageTheme;
  blocks: PageBlock[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").notNull().references(() => creators.id),
    publishedVersion: jsonb("published_version").$type<PageVersion>(),
    draftVersion: jsonb("draft_version").$type<PageVersion>().notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("pages_creator_uidx").on(t.creatorId)],
);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").notNull().references(() => creators.id),
  type: text("type").notNull(), // 'digital_file' | 'link_gate' | 'session' | 'lead_magnet'
  title: text("title").notNull(),
  description: text("description"),
  pricePaise: integer("price_paise").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  gstRate: integer("gst_rate").notNull().default(0), // percentage: 0 or 18
  status: text("status").notNull().default("active"), // 'active' | 'draft' | 'archived'
  deliveryConfig: jsonb("delivery_config").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export const offers = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").notNull().references(() => creators.id),
  productId: uuid("product_id").references(() => products.id),
  code: text("code").notNull(),
  discountType: text("discount_type").notNull().default("percent"), // 'percent' | 'flat'
  discountValue: integer("discount_value").notNull(), // percent value or paise
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").notNull().default(0),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const buyers = pgTable(
  "buyers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    phone: text("phone"),
    name: text("name"),
    ...timestamps,
  },
  (t) => [uniqueIndex("buyers_email_uidx").on(t.email)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").notNull().references(() => creators.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    buyerId: uuid("buyer_id").notNull().references(() => buyers.id),
    amountPaise: integer("amount_paise").notNull(),
    discountPaise: integer("discount_paise").notNull().default(0),
    gstPaise: integer("gst_paise").notNull().default(0),
    netAmountPaise: integer("net_amount_paise").notNull(),
    status: text("status").notNull().default("created"), // 'created' | 'paid' | 'refunded' | 'failed'
    gatewayOrderId: text("gateway_order_id"),
    receipt: text("receipt").notNull(),
    currency: text("currency").notNull().default("INR"),
    offerId: uuid("offer_id").references(() => offers.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_receipt_uidx").on(t.receipt),
    uniqueIndex("orders_gateway_order_uidx").on(t.gatewayOrderId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    gatewayPaymentId: text("gateway_payment_id").notNull(),
    method: text("method").notNull().default("upi"),
    status: text("status").notNull().default("captured"),
    feePaise: integer("fee_paise").notNull().default(0),
    gstOnFeePaise: integer("gst_on_fee_paise").notNull().default(0),
    rawResponse: jsonb("raw_response").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [uniqueIndex("payments_gateway_payment_uidx").on(t.gatewayPaymentId)],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    account: text("account").notNull(), // 'buyer' | 'gateway_fee' | 'gateway_fee_gst' | 'platform_fee' | 'creator_payable' | 'refund'
    amountPaise: integer("amount_paise").notNull(),
    direction: text("direction").notNull(), // 'credit' | 'debit'
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ledger_idempotency_uidx").on(t.idempotencyKey)],
);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").notNull().references(() => creators.id),
    gatewayTransferId: text("gateway_transfer_id").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    status: text("status").notNull().default("pending"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("payouts_transfer_uidx").on(t.gatewayTransferId)],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buyerId: uuid("buyer_id").notNull().references(() => buyers.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    accessToken: text("access_token").notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    maxDownloads: integer("max_downloads"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("entitlements_access_token_uidx").on(t.accessToken),
    uniqueIndex("entitlements_order_uidx").on(t.orderId),
  ],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").notNull().references(() => creators.id),
  plan: text("plan").notNull().default("free"), // 'free' | 'creator' | 'studio'
  gatewaySubscriptionId: text("gateway_subscription_id"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  ...timestamps,
});

export const telegramMemberships = pgTable(
  "telegram_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").notNull().references(() => creators.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    buyerId: uuid("buyer_id").notNull().references(() => buyers.id),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    chatId: text("chat_id").notNull(),
    inviteLink: text("invite_link").notNull(),
    status: text("status").notNull().default("active"), // 'active' | 'joined' | 'revoked' | 'expired'
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("telegram_memberships_buyer_idx").on(t.buyerId),
    index("telegram_memberships_order_idx").on(t.orderId),
  ],
);

export const sessionBookings = pgTable(
  "session_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").notNull().references(() => creators.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    buyerId: uuid("buyer_id").notNull().references(() => buyers.id),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    bookingDate: text("booking_date").notNull(),
    timeSlot: text("time_slot").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(45),
    meetingUrl: text("meeting_url").notNull(),
    status: text("status").notNull().default("confirmed"), // 'confirmed' | 'rescheduled' | 'completed' | 'cancelled'
    buyerNotes: text("buyer_notes"),
    calendarEventUrl: text("calendar_event_url"),
    ...timestamps,
  },
  (t) => [
    index("session_bookings_buyer_idx").on(t.buyerId),
    index("session_bookings_order_idx").on(t.orderId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.id),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    invoiceNumber: text("invoice_number").notNull(),
    pdfKey: text("pdf_key"),
    htmlContent: text("html_content"),
    amountPaise: integer("amount_paise").notNull(),
    gstBreakdown: jsonb("gst_breakdown").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("invoices_number_uidx").on(t.invoiceNumber),
    uniqueIndex("invoices_order_uidx").on(t.orderId),
  ],
);

export const consents = pgTable("consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(), // 'buyer' | 'user'
  entityId: text("entity_id").notNull(),
  purpose: text("purpose").notNull(),
  version: text("version").notNull().default("1.0"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deletionRequests = pgTable("deletion_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const pageEvents = pgTable(
  "page_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").notNull().references(() => creators.id),
    eventType: text("event_type").notNull(), // 'page_view' | 'link_click' | 'lead_submit' | 'checkout_init' | 'purchase'
    visitorId: text("visitor_id").notNull(),
    referrer: text("referrer"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("page_events_creator_created_idx").on(t.creatorId, t.createdAt)],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});
