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

export function loadStoredActivities(): ActivityItem[] {
  try {
    const file = resolveActivityFile();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, "utf8");
      return JSON.parse(data);
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

const DEFAULT_COVER =
  "https://scontent.cdninstagram.com/v/t51.82787-15/902591685_18018037013782610_3825906834077676673_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=cIslFHlfRXYQ7kNvwG7THzu&_nc_oc=Ado8JQLtL-9kSJ_uzsjYIsCrfBod1wSvjJlcuIS65lmmxw3bfCrN2yNDnNzRcOVQl5II1X174y_ptxu_KjzjBGNY&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&edm=AFF3FJ0EAAAA&_nc_gid=fyYPK9HgWZG2H34RI1UEFQ&oh=00_AQREFB_QCZeM8xTlqv-Fjz0GXoX2bN3faBsw0M-4RDIUGg&oe=6AF9C2D4";
const DEFAULT_CAPTION =
  "Jai Jinendra 🙏 Jab baat jeevan saathi chunne ki aati hai, tab sanskaar aur values sabse pehle aate hain. Jinbandhan par aapko milte hain verified Jain profiles...";

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
    mediaThumbnail: item.mediaThumbnail || DEFAULT_COVER,
    mediaCaption: item.mediaCaption || DEFAULT_CAPTION,
    id: item.id || `act_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
    timestamp: item.timestamp || new Date().toISOString(),
  };

  activities.unshift(entry);
  saveStoredActivities(activities);
  return entry;
}
