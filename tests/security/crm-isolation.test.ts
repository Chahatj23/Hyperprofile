import { describe, expect, it } from "vitest";

interface MockBuyer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockOrder {
  id: string;
  creatorId: string;
  productId: string;
  buyerId: string;
  netAmountPaise: number;
  status: "created" | "paid" | "failed";
}

// Logic representation of secure multi-tenant CRM leads aggregation
function filterLeadsForCreator(opts: {
  creatorId: string;
  allBuyers: MockBuyer[];
  allOrders: MockOrder[];
  search?: string;
}) {
  const { creatorId, allBuyers, allOrders, search } = opts;

  // STRICT DEFENSIVE FILTER: Only consider orders belonging to this creator
  const creatorOrders = allOrders.filter((o) => o.creatorId === creatorId && o.status === "paid");
  const creatorBuyerIds = new Set(creatorOrders.map((o) => o.buyerId));

  // Only consider buyers who placed an order with this creator
  const creatorBuyers = allBuyers.filter((b) => creatorBuyerIds.has(b.id));

  // Build leads
  const leads = creatorBuyers.map((b) => {
    const buyerOrders = creatorOrders.filter((o) => o.buyerId === b.id);
    const totalSpentPaise = buyerOrders.reduce((sum, o) => sum + o.netAmountPaise, 0);
    return {
      id: b.id,
      name: b.name,
      email: b.email,
      phone: b.phone,
      totalSpentPaise,
      ordersCount: buyerOrders.length,
    };
  });

  if (search) {
    const q = search.toLowerCase();
    return leads.filter((l) => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q));
  }

  return leads;
}

describe("CRM Multi-Tenant Isolation & PII Protection Tests", () => {
  const creatorA = "creator_uuid_AAAA";
  const creatorB = "creator_uuid_BBBB";

  const buyerA: MockBuyer = {
    id: "buyer_111",
    email: "customer_a@gmail.com",
    name: "Customer A",
    phone: "+919876543210",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const buyerB: MockBuyer = {
    id: "buyer_222",
    email: "secret_vip_b@gmail.com",
    name: "VIP Buyer B",
    phone: "+919123456789",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const allBuyers = [buyerA, buyerB];

  const allOrders: MockOrder[] = [
    {
      id: "ord_1",
      creatorId: creatorA,
      productId: "prod_a",
      buyerId: buyerA.id,
      netAmountPaise: 49900,
      status: "paid",
    },
    {
      id: "ord_2",
      creatorId: creatorB,
      productId: "prod_b",
      buyerId: buyerB.id,
      netAmountPaise: 999900,
      status: "paid",
    },
  ];

  it("SEC-S1-03: Creator A never receives Creator B's customer PII", () => {
    const leadsForA = filterLeadsForCreator({
      creatorId: creatorA,
      allBuyers,
      allOrders,
    });

    // Creator A should only see Buyer A
    expect(leadsForA).toHaveLength(1);
    expect(leadsForA[0].email).toBe("customer_a@gmail.com");

    // Must not leak buyer B's email, phone, or name
    const leakedBuyerB = leadsForA.find((l) => l.email === "secret_vip_b@gmail.com");
    expect(leakedBuyerB).toBeUndefined();
  });

  it("SEC-S1-03: Creator B never receives Creator A's customer PII", () => {
    const leadsForB = filterLeadsForCreator({
      creatorId: creatorB,
      allBuyers,
      allOrders,
    });

    expect(leadsForB).toHaveLength(1);
    expect(leadsForB[0].email).toBe("secret_vip_b@gmail.com");
    expect(leadsForB[0].phone).toBe("+919123456789");

    const leakedBuyerA = leadsForB.find((l) => l.email === "customer_a@gmail.com");
    expect(leakedBuyerA).toBeUndefined();
  });

  it("returns empty leads array without error if creator has no paid orders", () => {
    const freshCreator = "creator_uuid_NEW";
    const leads = filterLeadsForCreator({
      creatorId: freshCreator,
      allBuyers,
      allOrders,
    });
    expect(leads).toEqual([]);
  });
});

