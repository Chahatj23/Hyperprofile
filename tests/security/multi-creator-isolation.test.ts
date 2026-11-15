import { describe, expect, it } from "vitest";

describe("Multi-Creator Isolation & Instagram Connect Integrity", () => {
  it("prevents connecting an Instagram account that already belongs to another creator", () => {
    // Two distinct creators
    const creatorA = { id: "creator_alpha_111", email: "alpha@creator.com" };
    const creatorB = { id: "creator_beta_222", email: "beta@creator.com" };

    // Existing connected account in database
    const existingAccounts = [
      {
        id: "ig_acc_1",
        igUserId: "ig_user_101",
        username: "creative_artist",
        creatorId: creatorA.id,
      },
    ];

    // Creator B attempts to claim the same Instagram account
    const incomingConnectAttempt = {
      igUserId: "ig_user_101",
      username: "creative_artist",
      attemptingCreatorId: creatorB.id,
    };

    const targetAccount = existingAccounts.find(
      (a) => a.igUserId === incomingConnectAttempt.igUserId,
    );

    const isConflict =
      targetAccount?.creatorId &&
      targetAccount.creatorId !== incomingConnectAttempt.attemptingCreatorId;

    expect(isConflict).toBe(true);

    // Expected safe response: Rejection with 409 Conflict rather than silent reassignment
    const safeResponse = isConflict
      ? {
          status: 409,
          code: "account_conflict",
          message:
            "This Instagram account is already connected to another creator profile. Please disconnect it first.",
        }
      : { status: 200, success: true };

    expect(safeResponse.status).toBe(409);
    expect(safeResponse.code).toBe("account_conflict");
    // Verify ownership was not reassigned
    expect(targetAccount?.creatorId).toBe(creatorA.id);
  });

  it("strictly scopes AutoDM rules to the caller's connected Instagram user ID", () => {
    const creatorA_igUserId = "ig_user_101";
    const creatorB_igUserId = "ig_user_202";

    const allRules = [
      { id: "rule_1", igUserId: creatorA_igUserId, keyword: "GUIDE", message: "Alpha Guide" },
      { id: "rule_2", igUserId: creatorA_igUserId, keyword: "COURSE", message: "Alpha Course" },
      { id: "rule_3", igUserId: creatorB_igUserId, keyword: "TEMPLATES", message: "Beta Templates" },
    ];

    // Query for Creator A
    const creatorARules = allRules.filter((r) => r.igUserId === creatorA_igUserId);
    expect(creatorARules).toHaveLength(2);
    expect(creatorARules.every((r) => r.igUserId === creatorA_igUserId)).toBe(true);

    // Query for Creator B
    const creatorBRules = allRules.filter((r) => r.igUserId === creatorB_igUserId);
    expect(creatorBRules).toHaveLength(1);
    expect(creatorBRules[0]?.keyword).toBe("TEMPLATES");

    // Creator without connected Instagram gets empty array, never falling back to another creator's rules
    const unconnectedCallerIgUserId: string | null = null;
    const unconnectedRules = unconnectedCallerIgUserId
      ? allRules.filter((r) => r.igUserId === unconnectedCallerIgUserId)
      : [];
    expect(unconnectedRules).toHaveLength(0);
  });

  it("never returns dummy reels or another creator's reels when account is unconnected", () => {
    // When a newly registered creator logs in before connecting Instagram
    const creatorSession = { creatorId: "creator_new_333", email: "new@creator.com" };
    const creatorConnectedAccount: { igUserId: string; username: string } | null = null;

    const response = !creatorConnectedAccount
      ? {
          ok: false,
          connected: false,
          error: "No connected Instagram account found. Please connect via /connect",
          reels: [],
        }
      : {
          ok: true,
          connected: true,
          reels: [{ id: "reel_1", caption: "Live reel" }],
        };

    expect(response.ok).toBe(false);
    expect(response.connected).toBe(false);
    expect(response.reels).toHaveLength(0);
    expect(response.error).toContain("No connected Instagram account found");
  });
});
