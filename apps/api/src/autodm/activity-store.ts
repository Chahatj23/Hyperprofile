import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { logger } from "@hyperprofile/shared";

export interface ActivityItem {
  id: string;
  type: "comment" | "like" | "autodm" | "follower" | "order" | "engagement" | "profile";
  title: string;
  description: string;
  timestamp: string;
  status: "verified" | "delivered" | "active" | "info";
  badge: string;
  actor?: string | undefined;
  mediaThumbnail?: string | undefined;
  mediaCaption?: string | undefined;
  meta?: Record<string, unknown> | undefined;
}

function resolveActivityFile(): string {
  const p1 = path.resolve(process.cwd(), "real-ig-activity.json");
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "apps", "api", "real-ig-activity.json");
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve(process.cwd(), "..", "..", "real-ig-activity.json");
  if (fs.existsSync(p3)) return p3;
  return p1;
}

export function loadStoredActivities(igUserId?: string): ActivityItem[] {
  try {
    const file = resolveActivityFile();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, "utf8");
      const list: ActivityItem[] = JSON.parse(data);
      if (igUserId) {
        return list.filter(
          (a) =>
            (a.meta?.igUserId && a.meta.igUserId === igUserId) ||
            (a.meta?.owner_id && a.meta.owner_id === igUserId),
        );
      }
      return list;
    }
  } catch (err) {
    logger.warn("failed to read activity file", { err: String(err) });
  }
  return [];
}

export function saveStoredActivities(activities: ActivityItem[]): void {
  try {
    const file = resolveActivityFile();
    fs.writeFileSync(file, JSON.stringify(activities.slice(0, 200), null, 2), "utf8");
  } catch (err) {
    logger.warn("failed to save activity file", { err: String(err) });
  }
}

export function recordActivity(
  item: Omit<ActivityItem, "id" | "timestamp"> & { id?: string; timestamp?: string },
): ActivityItem {
  const activities = loadStoredActivities();
  const commentId = (item.meta?.commentId as string) || (item.meta?.comment_id as string);
  if (commentId) {
    const existing = activities.find(
      (a) =>
        a.type === item.type &&
        ((a.meta?.commentId as string) === commentId || (a.meta?.comment_id as string) === commentId),
    );
    if (existing) {
      return existing;
    }
  }

  const entry: ActivityItem = {
    ...item,
    mediaThumbnail: item.mediaThumbnail,
    mediaCaption: item.mediaCaption,
    id: item.id || `act_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
    timestamp: item.timestamp || new Date().toISOString(),
  };

  activities.unshift(entry);
  saveStoredActivities(activities);
  return entry;
}
