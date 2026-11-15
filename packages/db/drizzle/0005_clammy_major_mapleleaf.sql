CREATE TABLE "session_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"booking_date" text NOT NULL,
	"time_slot" text NOT NULL,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"meeting_url" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"buyer_notes" text,
	"calendar_event_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"invite_link" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_memberships" ADD CONSTRAINT "telegram_memberships_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_memberships" ADD CONSTRAINT "telegram_memberships_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_memberships" ADD CONSTRAINT "telegram_memberships_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_memberships" ADD CONSTRAINT "telegram_memberships_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_bookings_buyer_idx" ON "session_bookings" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "session_bookings_order_idx" ON "session_bookings" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "telegram_memberships_buyer_idx" ON "telegram_memberships" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "telegram_memberships_order_idx" ON "telegram_memberships" USING btree ("order_id");