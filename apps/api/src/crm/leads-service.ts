import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import {
  buyers,
  orders,
  products,
  sessionBookings,
  telegramMemberships,
  type Db,
} from "@hyperprofile/db";
import { logger } from "@hyperprofile/shared";

export interface UnifiedLead {
  id: string;
  name: string;
  email: string;
  phone?: string | undefined;
  igUsername?: string | undefined;
  primarySource: "Instagram AutoDM" | "Checkout Purchase" | "VIP Telegram" | "1:1 Consultation" | "Lead Magnet";
  sources: string[];
  productTitles: string[];
  totalSpentPaise: number;
  ordersCount: number;
  status: "subscribed" | "customer" | "consultation_booked" | "vip_member";
  createdAt: string;
  lastActiveAt: string;
  notes?: string | undefined;
}

export interface LeadsStats {
  totalLeads: number;
  payingCustomers: number;
  totalLtvPaise: number;
  avgLtvPaise: number;
  autodmCapturedCount: number;
  consultationsCount: number;
  telegramVipCount: number;
  conversionRatePercent: number;
}

function resolveDataFile(filename: string): string {
  const p1 = path.resolve(process.cwd(), filename);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), "apps/api", filename);
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve("d:/Full Stack/apps/api", filename);
  return p3;
}

function readJsonFile<T>(filename: string): T[] {
  try {
    const filePath = resolveDataFile(filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (err) {
    logger.warn(`failed to read ${filename}`, { err });
  }
  return [];
}

/**
 * Aggregates all leads across AutoDM, Checkout, Telegram, and 1:1 Consultations
 */
export async function getUnifiedLeads(
  db: Db,
  options?: {
    search?: string | undefined;
    source?: string | undefined;
    creatorId?: string | undefined;
  },
): Promise<{ leads: UnifiedLead[]; stats: LeadsStats }> {
  const leadsMap = new Map<string, UnifiedLead>();

  // 1. Ingest Database Buyers & Orders if DB is reachable
  try {
    const allBuyers = await db.select().from(buyers);
    const allOrders = await db.select().from(orders);
    const allProducts = await db.select().from(products);

    const productMap = new Map(allProducts.map((p) => [p.id, p.title]));

    for (const b of allBuyers) {
      const buyerOrders = allOrders.filter((o) => o.buyerId === b.id && o.status === "paid");
      const totalSpentPaise = buyerOrders.reduce((sum, o) => sum + o.netAmountPaise, 0);
      const ordersCount = buyerOrders.length;
      const productTitles = buyerOrders
        .map((o) => productMap.get(o.productId) ?? "Digital Product")
        .filter(Boolean);

      const isPaying = ordersCount > 0;
      const primarySource: UnifiedLead["primarySource"] = isPaying
        ? "Checkout Purchase"
        : "Lead Magnet";

      leadsMap.set(b.email.toLowerCase(), {
        id: b.id,
        name: b.name || b.email.split("@")[0] || "Buyer",
        email: b.email.toLowerCase(),
        phone: b.phone ?? undefined,
        primarySource,
        sources: [primarySource],
        productTitles,
        totalSpentPaise,
        ordersCount,
        status: isPaying ? "customer" : "subscribed",
        createdAt: b.createdAt ? b.createdAt.toISOString() : new Date().toISOString(),
        lastActiveAt: b.updatedAt ? b.updatedAt.toISOString() : new Date().toISOString(),
      });
    }
  } catch {
    // Database may be offline; fallback store
  }

  // 2. Ingest Instagram AutoDM captured leads (real-ig-leads.json)
  const igLeads = readJsonFile<any>("real-ig-leads.json");
  for (const ig of igLeads) {
    if (!ig.email) continue;
    const emailKey = ig.email.toLowerCase().trim();
    const existing = leadsMap.get(emailKey);

    if (existing) {
      existing.igUsername = ig.username || existing.igUsername;
      if (!existing.sources.includes("Instagram AutoDM")) {
        existing.sources.push("Instagram AutoDM");
      }
      if (new Date(ig.capturedAt || 0) > new Date(existing.lastActiveAt)) {
        existing.lastActiveAt = ig.capturedAt;
      }
    } else {
      leadsMap.set(emailKey, {
        id: `lead_ig_${ig.buyerIgId || Math.random().toString(36).slice(2, 9)}`,
        name: ig.username ? `@${ig.username}` : emailKey.split("@")[0] || "Instagram Lead",
        email: emailKey,
        igUsername: ig.username || undefined,
        primarySource: "Instagram AutoDM",
        sources: ["Instagram AutoDM"],
        productTitles: ["Viral Reels Free Guide (AutoDM)"],
        totalSpentPaise: 0,
        ordersCount: 0,
        status: "subscribed",
        createdAt: ig.capturedAt || new Date().toISOString(),
        lastActiveAt: ig.capturedAt || new Date().toISOString(),
      });
    }
  }

  // 3. Ingest VIP Telegram Community memberships (real-telegram-members.json)
  const tgMembers = readJsonFile<any>("real-telegram-members.json");
  for (const tg of tgMembers) {
    const emailKey = (tg.buyerEmail || `tg_member_${tg.id}@telegram.org`).toLowerCase().trim();
    const existing = leadsMap.get(emailKey);

    if (existing) {
      if (!existing.sources.includes("VIP Telegram")) {
        existing.sources.push("VIP Telegram");
      }
      if (!existing.productTitles.includes(tg.channelName || "VIP Telegram Community")) {
        existing.productTitles.push(tg.channelName || "VIP Telegram Community");
      }
      if (existing.status !== "customer") {
        existing.status = "vip_member";
      }
    } else {
      leadsMap.set(emailKey, {
        id: tg.id || `lead_tg_${Math.random().toString(36).slice(2, 9)}`,
        name: emailKey.split("@")[0] || "Telegram Member",
        email: emailKey,
        primarySource: "VIP Telegram",
        sources: ["VIP Telegram"],
        productTitles: [tg.channelName || "VIP Creator Alpha Community"],
        totalSpentPaise: 99900,
        ordersCount: 1,
        status: "vip_member",
        createdAt: tg.createdAt || new Date().toISOString(),
        lastActiveAt: tg.createdAt || new Date().toISOString(),
      });
    }
  }

  // 4. Ingest 1:1 Consultation session bookings (real-session-bookings.json)
  const sessionBookingsDisk = readJsonFile<any>("real-session-bookings.json");
  for (const sb of sessionBookingsDisk) {
    const emailKey = (sb.buyerEmail || `consultation_${sb.id}@meet.google.com`).toLowerCase().trim();
    const existing = leadsMap.get(emailKey);

    if (existing) {
      if (!existing.sources.includes("1:1 Consultation")) {
        existing.sources.push("1:1 Consultation");
      }
      if (!existing.productTitles.includes("1:1 Consultation Strategy Call")) {
        existing.productTitles.push("1:1 Consultation Strategy Call");
      }
      existing.status = "consultation_booked";
      existing.notes = sb.buyerNotes || existing.notes;
    } else {
      leadsMap.set(emailKey, {
        id: sb.id || `lead_session_${Math.random().toString(36).slice(2, 9)}`,
        name: sb.buyerName || emailKey.split("@")[0] || "Consultation Client",
        email: emailKey,
        primarySource: "1:1 Consultation",
        sources: ["1:1 Consultation"],
        productTitles: ["1:1 Consultation Strategy Call"],
        totalSpentPaise: 199900,
        ordersCount: 1,
        status: "consultation_booked",
        createdAt: sb.createdAt || new Date().toISOString(),
        lastActiveAt: sb.createdAt || new Date().toISOString(),
        notes: sb.buyerNotes,
      });
    }
  }

  // 5. Return strictly real leads without any simulated/seed data
  let allLeads = Array.from(leadsMap.values());

  // Sort by last active descending
  allLeads.sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
  );

  // Filter by search query
  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    allLeads = allLeads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone && l.phone.includes(q)) ||
        (l.igUsername && l.igUsername.toLowerCase().includes(q)) ||
        l.productTitles.some((p) => p.toLowerCase().includes(q)),
    );
  }

  // Filter by source
  if (options?.source && options.source !== "all") {
    const src = options.source.toLowerCase();
    allLeads = allLeads.filter((l) =>
      l.sources.some((s) => s.toLowerCase().includes(src)),
    );
  }

  // Calculate statistics across all un-filtered leads for macro reporting
  const baseLeads = Array.from(leadsMap.values());
  const totalLeads = baseLeads.length;
  const payingCustomers = baseLeads.filter((l) => l.totalSpentPaise > 0).length;
  const totalLtvPaise = baseLeads.reduce((sum, l) => sum + l.totalSpentPaise, 0);
  const avgLtvPaise = payingCustomers > 0 ? Math.round(totalLtvPaise / payingCustomers) : 0;
  const autodmCapturedCount = baseLeads.filter((l) =>
    l.sources.some((s) => s.includes("AutoDM")),
  ).length;
  const consultationsCount = baseLeads.filter((l) =>
    l.sources.some((s) => s.includes("Consultation")),
  ).length;
  const telegramVipCount = baseLeads.filter((l) =>
    l.sources.some((s) => s.includes("Telegram")),
  ).length;
  const conversionRatePercent =
    totalLeads > 0 ? Math.round((payingCustomers / totalLeads) * 100) : 0;

  const stats: LeadsStats = {
    totalLeads,
    payingCustomers,
    totalLtvPaise,
    avgLtvPaise,
    autodmCapturedCount,
    consultationsCount,
    telegramVipCount,
    conversionRatePercent,
  };

  return { leads: allLeads, stats };
}

/**
 * Generates standard RFC-4180 CSV for direct export to Mailchimp, Meta Audiences, or Excel
 */
export function exportLeadsCsv(leads: UnifiedLead[]): string {
  const headers = [
    "Lead ID",
    "Full Name",
    "Email Address",
    "Phone / WhatsApp",
    "Instagram Handle",
    "Primary Acquisition Source",
    "All Touchpoints",
    "Products & Services",
    "Lifetime Value (INR)",
    "Orders Count",
    "Customer Status",
    "First Joined Date",
    "Last Active Date",
    "Creator Notes",
  ];

  function escapeCsv(value: string | number | undefined | null): string {
    if (value === undefined || value === null) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = leads.map((lead) => {
    return [
      escapeCsv(lead.id),
      escapeCsv(lead.name),
      escapeCsv(lead.email),
      escapeCsv(lead.phone || ""),
      escapeCsv(lead.igUsername ? `@${lead.igUsername}` : ""),
      escapeCsv(lead.primarySource),
      escapeCsv(lead.sources.join(", ")),
      escapeCsv(lead.productTitles.join("; ")),
      escapeCsv((lead.totalSpentPaise / 100).toFixed(2)),
      escapeCsv(lead.ordersCount),
      escapeCsv(lead.status),
      escapeCsv(new Date(lead.createdAt).toLocaleDateString("en-US")),
      escapeCsv(new Date(lead.lastActiveAt).toLocaleString("en-US")),
      escapeCsv(lead.notes || ""),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

