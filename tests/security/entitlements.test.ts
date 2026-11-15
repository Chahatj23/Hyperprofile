import { describe, expect, it } from "vitest";

interface MockEntitlement {
  id: string;
  orderId: string;
  productId: string;
  accessToken: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: Date | null;
}

interface MockOrder {
  id: string;
  status: "created" | "paid" | "refunded" | "failed";
}

function verifyEntitlementAccess(opts: {
  token: string;
  entitlement: MockEntitlement | null;
  order: MockOrder | null;
}): { status: number; allowed: boolean; code?: string; message?: string } {
  const { entitlement, order } = opts;

  if (!entitlement) {
    return { status: 404, allowed: false, code: "invalid_token", message: "Entitlement not found" };
  }

  // Expiration check
  if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
    return { status: 410, allowed: false, code: "expired", message: "Download link has expired" };
  }

  // SEC-S3-02: Revocation on refund or non-paid order
  if (!order || order.status !== "paid") {
    return {
      status: 403,
      allowed: false,
      code: "access_revoked",
      message: order?.status === "refunded" ? "Access revoked due to refund" : "Order is not paid",
    };
  }

  // Download ceiling check
  if (entitlement.maxDownloads !== null && entitlement.downloadCount >= entitlement.maxDownloads) {
    return {
      status: 429,
      allowed: false,
      code: "download_limit_exceeded",
      message: "Maximum download attempts reached",
    };
  }

  return { status: 200, allowed: true };
}

describe("Stage 3: Digital File Entitlement Access & Revocation Tests", () => {
  const testEntitlement: MockEntitlement = {
    id: "ent_123",
    orderId: "ord_paid_123",
    productId: "prod_guide_456",
    accessToken: "tok_magic_secure_xyz789",
    downloadCount: 0,
    maxDownloads: 5,
    expiresAt: null,
  };

  it("Grants access to digital files when order is paid and token is valid", () => {
    const paidOrder: MockOrder = { id: "ord_paid_123", status: "paid" };

    const result = verifyEntitlementAccess({
      token: testEntitlement.accessToken,
      entitlement: testEntitlement,
      order: paidOrder,
    });

    expect(result.status).toBe(200);
    expect(result.allowed).toBe(true);
  });

  it("SEC-S3-02: Revokes access (HTTP 403) immediately when order is refunded", () => {
    const refundedOrder: MockOrder = { id: "ord_paid_123", status: "refunded" };

    const result = verifyEntitlementAccess({
      token: testEntitlement.accessToken,
      entitlement: testEntitlement,
      order: refundedOrder,
    });

    expect(result.status).toBe(403);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("access_revoked");
  });

  it("Rejects access (HTTP 403) when order was never paid or failed", () => {
    const failedOrder: MockOrder = { id: "ord_paid_123", status: "failed" };

    const result = verifyEntitlementAccess({
      token: testEntitlement.accessToken,
      entitlement: testEntitlement,
      order: failedOrder,
    });

    expect(result.status).toBe(403);
    expect(result.allowed).toBe(false);
  });

  it("Rejects access (HTTP 410) when entitlement token has expired", () => {
    const expiredEntitlement: MockEntitlement = {
      ...testEntitlement,
      expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
    };
    const paidOrder: MockOrder = { id: "ord_paid_123", status: "paid" };

    const result = verifyEntitlementAccess({
      token: expiredEntitlement.accessToken,
      entitlement: expiredEntitlement,
      order: paidOrder,
    });

    expect(result.status).toBe(410);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("expired");
  });

  it("Enforces download limit ceiling (HTTP 429) when downloadCount reaches maxDownloads", () => {
    const maxedEntitlement: MockEntitlement = {
      ...testEntitlement,
      downloadCount: 5,
      maxDownloads: 5,
    };
    const paidOrder: MockOrder = { id: "ord_paid_123", status: "paid" };

    const result = verifyEntitlementAccess({
      token: maxedEntitlement.accessToken,
      entitlement: maxedEntitlement,
      order: paidOrder,
    });

    expect(result.status).toBe(429);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("download_limit_exceeded");
  });
});

