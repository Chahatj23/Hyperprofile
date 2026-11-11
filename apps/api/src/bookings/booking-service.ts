import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { sessionBookings, products, buyers, creators, type Db } from "@hyperprofile/db";
import { logger } from "@hyperprofile/shared";

export interface StoredBooking {
  id: string;
  creatorId: string;
  productId: string;
  buyerId: string;
  orderId: string;
  buyerName?: string | undefined;
  buyerEmail?: string | undefined;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "02:00 PM - 02:45 PM"
  durationMinutes: number;
  meetingUrl: string;
  calendarEventUrl?: string | undefined;
  buyerNotes?: string | undefined;
  status: "confirmed" | "rescheduled" | "completed" | "cancelled";
  createdAt: string;
}

const BOOKINGS_FILE = path.resolve(process.cwd(), "real-session-bookings.json");

interface PendingIntent {
  bookingDate?: string | undefined;
  timeSlot?: string | undefined;
  buyerNotes?: string | undefined;
}

const pendingIntents = new Map<string, PendingIntent>();

export function recordPendingBookingIntent(orderId: string, intent: PendingIntent) {
  pendingIntents.set(orderId, intent);
}

export function getPendingBookingIntent(orderId: string): PendingIntent | undefined {
  return pendingIntents.get(orderId);
}

function loadStoredBookings(): StoredBooking[] {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveBookingsToDisk(bookings: StoredBooking[]) {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), "utf8");
  } catch (err) {
    logger.warn("failed to save bookings to disk", { err });
  }
}

/**
 * Builds standard 1-click Google Calendar Add-to-Calendar URL
 */
export function buildGoogleCalendarUrl(options: {
  title: string;
  details: string;
  location: string;
  dateStr: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "02:00 PM - 02:45 PM"
}): string {
  const { title, details, location, dateStr } = options;
  // Parse simple ISO start & end times
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(5, 7);
  const day = dateStr.slice(8, 10);

  // Default to 14:00 to 14:45 UTC/IST
  const startStamp = `${year}${month}${day}T083000Z`; // 14:00 IST = 08:30 UTC
  const endStamp = `${year}${month}${day}T091500Z`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: `${details}\n\nJoin Video Call: ${location}`,
    location,
    dates: `${startStamp}/${endStamp}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Provision / record a 1:1 consultation booking
 */
export async function provisionSessionBooking(
  db: Db,
  input: {
    creatorId: string;
    productId: string;
    buyerId: string;
    orderId: string;
    buyerName?: string | undefined;
    buyerEmail?: string | undefined;
    bookingDate?: string | undefined;
    timeSlot?: string | undefined;
    buyerNotes?: string | undefined;
  },
): Promise<StoredBooking> {
  const { creatorId, productId, buyerId, orderId, buyerName, buyerEmail, buyerNotes } = input;

  // 1. Check if booking already exists for this order (idempotent)
  const existing = loadStoredBookings().find((b) => b.orderId === orderId);
  if (existing) {
    return existing;
  }

  // 2. Fetch product config
  let product: any = null;
  try {
    product = (await db.select().from(products).where(eq(products.id, productId)).limit(1))[0];
  } catch {
    // ignore
  }

  const deliveryConfig = (product?.deliveryConfig ?? {}) as Record<string, any>;
  const durationMinutes = deliveryConfig.durationMinutes || 45;
  const meetingCode = crypto.randomBytes(3).toString("hex");
  const meetingUrl = deliveryConfig.meetingUrl || `https://meet.google.com/hpr-${meetingCode}`;

  // Calculate default date (tomorrow) and slot if not chosen
  const pending = getPendingBookingIntent(orderId);
  const tomorrow = new Date(Date.now() + 86400 * 1000);
  const dateStr = input.bookingDate || pending?.bookingDate || tomorrow.toISOString().slice(0, 10);
  const timeSlot = input.timeSlot || pending?.timeSlot || "02:00 PM - 02:45 PM";
  const finalBuyerNotes = input.buyerNotes || pending?.buyerNotes || buyerNotes;

  const calendarEventUrl = buildGoogleCalendarUrl({
    title: `1:1 Consultation: ${product?.title || "Creator Mentorship"}`,
    details: `Private 1:1 Session with ${buyerName || "Client"}.\nNotes: ${finalBuyerNotes || "Portfolio review & growth strategy"}`,
    location: meetingUrl,
    dateStr,
    timeSlot,
  });

  const bookingId = `book_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const newBooking: StoredBooking = {
    id: bookingId,
    creatorId,
    productId,
    buyerId,
    orderId,
    buyerName,
    buyerEmail,
    bookingDate: dateStr,
    timeSlot,
    durationMinutes,
    meetingUrl,
    calendarEventUrl,
    buyerNotes: finalBuyerNotes,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  // Save to disk
  const all = loadStoredBookings();
  all.unshift(newBooking);
  saveBookingsToDisk(all);

  // Save to database if available
  try {
    await db
      .insert(sessionBookings)
      .values({
        creatorId,
        productId,
        buyerId,
        orderId,
        bookingDate: dateStr,
        timeSlot,
        durationMinutes,
        meetingUrl,
        buyerNotes,
        calendarEventUrl,
        status: "confirmed",
      })
      .onConflictDoNothing();
  } catch {
    // ignore offline db
  }

  logger.info("session booking provisioned", {
    bookingId,
    orderId,
    bookingDate: dateStr,
    timeSlot,
    meetingUrl,
  });

  return newBooking;
}

/**
 * Get booking for an order or library entitlement
 */
export async function getSessionBookingByOrder(
  db: Db,
  orderId: string,
): Promise<StoredBooking | null> {
  const disk = loadStoredBookings().find((b) => b.orderId === orderId);
  if (disk) return disk;

  try {
    const row = (
      await db
        .select()
        .from(sessionBookings)
        .where(eq(sessionBookings.orderId, orderId))
        .limit(1)
    )[0];

    if (row) {
      return {
        id: row.id,
        creatorId: row.creatorId,
        productId: row.productId,
        buyerId: row.buyerId,
        orderId: row.orderId,
        bookingDate: row.bookingDate,
        timeSlot: row.timeSlot,
        durationMinutes: row.durationMinutes,
        meetingUrl: row.meetingUrl,
        buyerNotes: row.buyerNotes ?? undefined,
        calendarEventUrl: row.calendarEventUrl ?? undefined,
        status: row.status as any,
        createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * List all bookings for creator calendar dashboard
 */
export async function listCreatorBookings(
  db: Db,
  creatorId?: string,
): Promise<StoredBooking[]> {
  const disk = loadStoredBookings();
  if (disk.length > 0) return disk;

  try {
    const rows = await db.select().from(sessionBookings);
    return rows.map((r) => ({
      id: r.id,
      creatorId: r.creatorId,
      productId: r.productId,
      buyerId: r.buyerId,
      orderId: r.orderId,
      bookingDate: r.bookingDate,
      timeSlot: r.timeSlot,
      durationMinutes: r.durationMinutes,
      meetingUrl: r.meetingUrl,
      buyerNotes: r.buyerNotes ?? undefined,
      calendarEventUrl: r.calendarEventUrl ?? undefined,
      status: r.status as any,
      createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}
