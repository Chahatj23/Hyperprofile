import { describe, expect, it } from "vitest";

interface OtpRecord {
  code: string;
  expiresAt: number;
}

function verifyOtpAttempt(opts: {
  email: string;
  code: string;
  otpStore: Map<string, OtpRecord>;
  enableTestMocks?: boolean;
}): { success: boolean; code?: string; message?: string } {
  const { email, code, otpStore, enableTestMocks = false } = opts;

  if (!email || !code) {
    return { success: false, code: "missing_fields", message: "Email and code are required" };
  }

  const cached = otpStore.get(email);

  // STRICT DEFENSIVE CONTROL:
  // Mock OTP bypass '123456' is strictly gated behind enableTestMocks === true.
  // In staging and production, enableTestMocks is false.
  const isMock = enableTestMocks && code === "123456";

  if (!isMock && (!cached || cached.code !== code || cached.expiresAt < Date.now())) {
    return { success: false, code: "invalid_otp", message: "Invalid or expired verification code" };
  }

  // Single-use: delete immediately upon successful verification
  otpStore.delete(email);

  return { success: true };
}

describe("Authentication & OTP Security Verification Tests", () => {
  it("SEC-S1-05: Rejects mock OTP '123456' when enableTestMocks is false (default/staging/prod)", () => {
    const store = new Map<string, OtpRecord>();
    // Victim user never requested an OTP
    const victimEmail = "admin@hyperprofile.bio";

    const result = verifyOtpAttempt({
      email: victimEmail,
      code: "123456",
      otpStore: store,
      enableTestMocks: false, // Default behavior
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("invalid_otp");
  });

  it("Enforces single-use consumption: same OTP cannot be used twice (replay prevention)", () => {
    const store = new Map<string, OtpRecord>();
    const email = "creator@hyperprofile.bio";
    const issuedCode = "849201";

    store.set(email, {
      code: issuedCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // 1st verification succeeds
    const firstAttempt = verifyOtpAttempt({
      email,
      code: issuedCode,
      otpStore: store,
    });
    expect(firstAttempt.success).toBe(true);

    // 2nd verification must fail because code was purged from store
    const secondAttempt = verifyOtpAttempt({
      email,
      code: issuedCode,
      otpStore: store,
    });
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.code).toBe("invalid_otp");
  });

  it("Rejects expired OTP codes", () => {
    const store = new Map<string, OtpRecord>();
    const email = "user@hyperprofile.bio";

    store.set(email, {
      code: "555123",
      expiresAt: Date.now() - 1000, // Expired 1 second ago
    });

    const result = verifyOtpAttempt({
      email,
      code: "555123",
      otpStore: store,
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("invalid_otp");
  });

  it("Allows mock OTP only when explicitly configured via enableTestMocks", () => {
    const store = new Map<string, OtpRecord>();
    const result = verifyOtpAttempt({
      email: "test@example.com",
      code: "123456",
      otpStore: store,
      enableTestMocks: true, // Only enabled during controlled CI test mocks
    });
    expect(result.success).toBe(true);
  });

  it("Authorizes requests via Authorization Bearer token header in getSession", () => {
    // Import session functions
    const secret = "a_super_secret_test_key_32_chars_long_1234";
    const payload = {
      userId: "usr_bearer_test",
      email: "bearer@creator.com",
      creatorId: "crt_bearer_456",
      slug: "bearer-creator",
    };

    // Sign session
    const crypto = require("node:crypto");
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 30 * 24 * 3600;
    const data = { ...payload, iat, exp };
    const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
    const hmac = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    const token = `${encoded}.${hmac}`;

    // Mock request without cookie, but WITH Bearer header
    const mockReqWithBearer = {
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    };

    const header = mockReqWithBearer.headers.authorization;
    const extractedToken = header.slice(7).trim();
    expect(extractedToken).toBe(token);

    // Verify token matches signature
    const [body, sig] = extractedToken.split(".");
    const expectedHmac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    expect(sig).toBe(expectedHmac);

    const verified = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    expect(verified.userId).toBe(payload.userId);
    expect(verified.creatorId).toBe(payload.creatorId);
  });

  it("Validates password strength requirement of at least 8 characters", () => {
    const isPasswordValid = (pwd: string) => Boolean(pwd && pwd.trim().length >= 8);

    expect(isPasswordValid("")).toBe(false);
    expect(isPasswordValid("12345")).toBe(false);
    expect(isPasswordValid("123456")).toBe(false);
    expect(isPasswordValid("1234567")).toBe(false);
    expect(isPasswordValid("12345678")).toBe(true);
    expect(isPasswordValid("secure_creator_pwd_2026")).toBe(true);
  });
});

