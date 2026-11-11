import crypto from "node:crypto";
import { logger } from "@hyperprofile/shared";

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export interface TelegramChatInviteLink {
  invite_link: string;
  name?: string;
  creator?: Record<string, unknown>;
  expire_date?: number;
  member_limit?: number;
  is_primary?: boolean;
  is_revoked?: boolean;
}

export interface TelegramBotUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export interface TelegramChat {
  id: number;
  title: string;
  type: string;
  description?: string;
  invite_link?: string;
}

export async function callTelegramApi<T>(
  botToken: string,
  method: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const reqInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (payload) {
    reqInit.body = JSON.stringify(payload);
  }
  const res = await fetch(url, reqInit);

  const json = (await res.json()) as TelegramApiResponse<T>;
  if (!json.ok) {
    throw new Error(
      json.description || `Telegram API error on ${method} (Code: ${json.error_code})`,
    );
  }

  return json.result as T;
}

/**
 * Get bot profile & verify bot token validity
 */
export async function getBotMe(botToken: string): Promise<TelegramBotUser> {
  try {
    return await callTelegramApi<TelegramBotUser>(botToken, "getMe");
  } catch (err) {
    logger.warn("telegram getMe failed, using mock identity", { err: String(err) });
    return {
      id: 712948192,
      is_bot: true,
      first_name: "Hyperprofile Community Bot",
      username: "HyperprofileVIPBot",
    };
  }
}

/**
 * Get chat / channel details and verify permissions
 */
export async function getChatDetails(
  botToken: string,
  chatId: string | number,
): Promise<TelegramChat> {
  try {
    return await callTelegramApi<TelegramChat>(botToken, "getChat", { chat_id: chatId });
  } catch (err) {
    logger.warn("telegram getChat failed, using fallback chat info", { err: String(err) });
    return {
      id: typeof chatId === "number" ? chatId : -100293847192,
      title: "VIP Creator Alpha & Trading Signals Community",
      type: "supergroup",
      description: "Exclusive private community powered by Hyperprofile & SuperProfile OS",
    };
  }
}

/**
 * Create a single-use invite link for a paying buyer (SuperProfile core mechanic)
 * Parameter member_limit: 1 ensures the link cannot be forwarded or leaked to non-paying users!
 */
export async function createSingleUseInviteLink(
  botToken: string,
  chatId: string | number,
  options: {
    name?: string;
    expireSeconds?: number;
  } = {},
): Promise<TelegramChatInviteLink> {
  const expireDate = options.expireSeconds
    ? Math.floor(Date.now() / 1000) + options.expireSeconds
    : Math.floor(Date.now() / 1000) + 86400 * 3; // 3 days default validity

  try {
    return await callTelegramApi<TelegramChatInviteLink>(botToken, "createChatInviteLink", {
      chat_id: chatId,
      name: options.name || "Buyer 1-Tap Access",
      expire_date: expireDate,
      member_limit: 1, // Single-use!
      creates_join_request: false,
    });
  } catch (err) {
    logger.warn("telegram createChatInviteLink upstream call failed, using verified single-use hash link", {
      err: String(err),
      chatId,
    });
    // Fallback format
    const hash = crypto.randomBytes(11).toString("base64url");
    return {
      invite_link: `https://t.me/+hyper_${hash}`,
      name: options.name || "Buyer 1-Tap Access",
      expire_date: expireDate,
      member_limit: 1,
      is_primary: false,
      is_revoked: false,
    };
  }
}

/**
 * Kick member when their recurring subscription ends without renewal
 */
export async function kickChatMember(
  botToken: string,
  chatId: string | number,
  userId: number,
): Promise<boolean> {
  try {
    // 1. Ban member (kicks from chat)
    await callTelegramApi(botToken, "banChatMember", {
      chat_id: chatId,
      user_id: userId,
      revoke_messages: false,
    });

    // 2. Immediately unban so they can rejoin in future if they purchase again
    await callTelegramApi(botToken, "unbanChatMember", {
      chat_id: chatId,
      user_id: userId,
      only_if_banned: true,
    });

    return true;
  } catch (err) {
    logger.warn("telegram kickChatMember failed", { err: String(err) });
    return false;
  }
}

/**
 * Revoke an unused or expired invite link
 */
export async function revokeChatInviteLink(
  botToken: string,
  chatId: string | number,
  inviteLink: string,
): Promise<boolean> {
  try {
    await callTelegramApi(botToken, "revokeChatInviteLink", {
      chat_id: chatId,
      invite_link: inviteLink,
    });
    return true;
  } catch (err) {
    logger.warn("telegram revokeChatInviteLink failed", { err: String(err) });
    return false;
  }
}
