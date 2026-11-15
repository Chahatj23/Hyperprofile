import { describe, expect, it } from "vitest";

interface AutoDmRule {
  id: string;
  igUserId: string;
  keyword: string;
  message: string;
  link?: string | null;
  active: boolean;
}

// Logic representation of secure rule modification & deletion
function updateRuleSecure(opts: {
  callerIgUserId: string;
  ruleId: string;
  patch: Partial<AutoDmRule>;
  rulesStore: AutoDmRule[];
}): { status: number; rule?: AutoDmRule; error?: string } {
  const { callerIgUserId, ruleId, patch, rulesStore } = opts;

  const rule = rulesStore.find((r) => r.id === ruleId);
  if (!rule) {
    return { status: 404, error: "Rule not found" };
  }

  // OBJECT LEVEL AUTHORIZATION CHECK:
  if (rule.igUserId !== callerIgUserId) {
    return { status: 403, error: "Forbidden: You do not own this rule" };
  }

  Object.assign(rule, patch);
  return { status: 200, rule };
}

function deleteRuleSecure(opts: {
  callerIgUserId: string;
  ruleId: string;
  rulesStore: AutoDmRule[];
}): { status: number; success: boolean; error?: string } {
  const { callerIgUserId, ruleId, rulesStore } = opts;

  const idx = rulesStore.findIndex((r) => r.id === ruleId);
  if (idx === -1) {
    return { status: 404, success: false, error: "Rule not found" };
  }

  // OBJECT LEVEL AUTHORIZATION CHECK:
  if (rulesStore[idx].igUserId !== callerIgUserId) {
    return { status: 403, success: false, error: "Forbidden: You do not own this rule" };
  }

  rulesStore.splice(idx, 1);
  return { status: 200, success: true };
}

describe("AutoDM Rules Authorization & IDOR Protection Tests", () => {
  const igUserA = "17841400000000001";
  const igUserB = "17841400000000002";

  it("SEC-S1-04: Prevents Creator A from modifying Creator B's AutoDM rule (IDOR)", () => {
    const rules: AutoDmRule[] = [
      {
        id: "rule_victim_b",
        igUserId: igUserB,
        keyword: "PROMO",
        message: "Legitimate Creator B DM",
        link: "https://creator-b.com/ebook",
        active: true,
      },
    ];

    // Attacker Creator A attempts to hijack Rule B with a phishing link
    const result = updateRuleSecure({
      callerIgUserId: igUserA,
      ruleId: "rule_victim_b",
      patch: {
        message: "You won ₹50,000! Click here:",
        link: "https://malicious-phishing.com/drain",
      },
      rulesStore: rules,
    });

    expect(result.status).toBe(403);
    expect(result.error).toContain("Forbidden");

    // Verify Rule B is unmodified
    expect(rules[0].message).toBe("Legitimate Creator B DM");
    expect(rules[0].link).toBe("https://creator-b.com/ebook");
  });

  it("SEC-S1-04: Prevents Creator A from deleting Creator B's AutoDM rule (IDOR)", () => {
    const rules: AutoDmRule[] = [
      {
        id: "rule_victim_b",
        igUserId: igUserB,
        keyword: "FREE",
        message: "Free guide",
        active: true,
      },
    ];

    const result = deleteRuleSecure({
      callerIgUserId: igUserA,
      ruleId: "rule_victim_b",
      rulesStore: rules,
    });

    expect(result.status).toBe(403);
    expect(result.success).toBe(false);
    expect(rules).toHaveLength(1);
  });

  it("Allows legitimate owner to update their own rule", () => {
    const rules: AutoDmRule[] = [
      {
        id: "rule_owner_a",
        igUserId: igUserA,
        keyword: "COURSE",
        message: "Original message",
        active: true,
      },
    ];

    const result = updateRuleSecure({
      callerIgUserId: igUserA,
      ruleId: "rule_owner_a",
      patch: { message: "Updated message by owner" },
      rulesStore: rules,
    });

    expect(result.status).toBe(200);
    expect(rules[0].message).toBe("Updated message by owner");
  });
});

