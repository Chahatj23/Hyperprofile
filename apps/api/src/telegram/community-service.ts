import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { buyers, creators, products, telegramMemberships, type Db } from "@hyperprofile/db";
import { logger } from "@hyperprofile/shared";
import {
  createSingleUseInviteLink,
  getBotMe,
  getChatDetails,
  kickChatMember,
  revokeChatInviteLink,
} from "./client.js";

export interface StoredTelegramMembership {
  id: string;
  creatorId: string;
  productId: string;
  buyerId: string;
  orderId: string;
  buyerEmail?: string | undefined;
  chatId: string;
  channelName: string;
  inviteLink: string;
  status: "active" | "joined" | "revoked" | "expired";
  expiresAt: string | null;
  createdAt: string;
}

const MEMBERS_FILE = path.resolve(process.cwd(), "real-telegram-members.json");

function loadStoredMembers(): StoredTelegramMembership[] {
  try {
    if (fs.existsSync(MEMBERS_FILE)) {
      return JSON.parse(fs.readFileSync(MEMBERS_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveMembersToDisk(members: StoredTelegramMembership[]) {
  try {
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2), "utf8");
  } catch (err) {
    logger.warn("failed to save telegram members to disk", { err });
  }
}

/**
 * Automates 1-click single-use Telegram community invite link generation upon verified checkout
 */
export async function provisionTelegramMembership(
  db: Db,
  input: {
    creatorId: string;
    productId: string;
    buyerId: string;
    orderId: string;
    buyerEmail?: string | undefined;
  },
): Promise<StoredTelegramMembership> {
  const { creatorId, productId, buyerId, orderId, buyerEmail } = input;

  // 1. Check if already provisioned (idempotent)
  const existingDisk = loadStoredMembers().find((m) => m.orderId === orderId);
  if (existingDisk) {
    return existingDisk;
  }

  try {
    const existingDb = (
      await db
        .select()
        .from(telegramMemberships)
        .where(eq(telegramMemberships.orderId, orderId))
        .limit(1)
    )[0];

    if (existingDb) {
      return {
        id: existingDb.id,
        creatorId: existingDb.creatorId,
        productId: existingDb.productId,
        buyerId: existingDb.buyerId,
        orderId: existingDb.orderId,
        buyerEmail,
        chatId: existingDb.chatId,
        channelName: "VIP Creator Alpha Community",
        inviteLink: existingDb.inviteLink,
        status: existingDb.status as any,
        expiresAt: existingDb.expiresAt ? existingDb.expiresAt.toISOString() : null,
        createdAt: existingDb.createdAt ? existingDb.createdAt.toISOString() : new Date().toISOString(),
      };
    }
  } catch {
    // fallback to disk logic
  }

  // 2. Fetch product config
  let product: any = null;
  try {
    product = (await db.select().from(products).where(eq(products.id, productId)).limit(1))[0];
  } catch {
    // ignore
  }

  const deliveryConfig = (product?.deliveryConfig ?? {}) as Record<string, any>;
  const botToken =
    deliveryConfig.telegramBotToken ||
    process.env.TELEGRAM_BOT_TOKEN ||
    "demo_telegram_bot_token_hyperprofile_xyz";
  const chatId = deliveryConfig.telegramChatId || "-100293847192";
  const channelName =
    deliveryConfig.telegramChannelName ||
    product?.title ||
    "VIP Creator Alpha & Trading Signals Community";
  const inviteExpirySeconds = deliveryConfig.inviteExpirySeconds || 86400 * 3; // 3 days

  // 3. Call Telegram Bot API to create 1-tap single-use invite link
  const linkRes = await createSingleUseInviteLink(botToken, chatId, {
    name: `Order ${orderId.slice(-6)} - ${buyerEmail || "Buyer"}`,
    expireSeconds: inviteExpirySeconds,
  });

  const memberId = `tg_mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const expiresAt = linkRes.expire_date
    ? new Date(linkRes.expire_date * 1000).toISOString()
    : new Date(Date.now() + inviteExpirySeconds * 1000).toISOString();

  const newMembership: StoredTelegramMembership = {
    id: memberId,
    creatorId,
    productId,
    buyerId,
    orderId,
    buyerEmail,
    chatId: String(chatId),
    channelName,
    inviteLink: linkRes.invite_link,
    status: "active",
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  // 4. Save to disk
  const allMembers = loadStoredMembers();
  allMembers.unshift(newMembership);
  saveMembersToDisk(allMembers);

  // 5. Save to database if available
  try {
    await db
      .insert(telegramMemberships)
      .values({
        creatorId,
        productId,
        buyerId,
        orderId,
        chatId: String(chatId),
        inviteLink: linkRes.invite_link,
        status: "active",
        expiresAt: new Date(expiresAt),
      })
      .onConflictDoNothing();
  } catch {
    // ignore offline db
  }

  logger.info("telegram community single-use invite link provisioned", {
    orderId,
    inviteLink: linkRes.invite_link,
    chatId,
  });

  return newMembership;
}

/**
 * Get Telegram Membership by Order ID or Entitlement
 */
export async function getTelegramMembershipByOrder(
  db: Db,
  orderId: string,
): Promise<StoredTelegramMembership | null> {
  const disk = loadStoredMembers().find((m) => m.orderId === orderId);
  if (disk) return disk;

  try {
    const row = (
      await db
        .select()
        .from(telegramMemberships)
        .where(eq(telegramMemberships.orderId, orderId))
        .limit(1)
    )[0];

    if (row) {
      return {
        id: row.id,
        creatorId: row.creatorId,
        productId: row.productId,
        buyerId: row.buyerId,
        orderId: row.orderId,
        chatId: row.chatId,
        channelName: "VIP Creator Alpha Community",
        inviteLink: row.inviteLink,
        status: row.status as any,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * List all community members for creator dashboard
 */
export async function listCreatorTelegramMembers(
  db: Db,
  creatorId?: string,
): Promise<StoredTelegramMembership[]> {
  const disk = loadStoredMembers();
  if (disk.length > 0) return disk;

  try {
    const rows = await db.select().from(telegramMemberships);
    return rows.map((r) => ({
      id: r.id,
      creatorId: r.creatorId,
      productId: r.productId,
      buyerId: r.buyerId,
      orderId: r.orderId,
      chatId: r.chatId,
      channelName: "VIP Creator Alpha Community",
      inviteLink: r.inviteLink,
      status: r.status as any,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Revoke buyer's Telegram community membership (subscription cancellation / refund)
 */
export async function revokeTelegramMembership(
  db: Db,
  membershipId: string,
): Promise<{ success: boolean; membership?: StoredTelegramMembership }> {
  const members = loadStoredMembers();
  const idx = members.findIndex((m) => m.id === membershipId);
  if (idx >= 0) {
    const target = members[idx]!;
    target.status = "revoked";
    saveMembersToDisk(members);

    try {
      await db
        .update(telegramMemberships)
        .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(telegramMemberships.id, membershipId));
    } catch {
      // ignore
    }

    return { success: true, membership: target };
  }

  return { success: false };
}
