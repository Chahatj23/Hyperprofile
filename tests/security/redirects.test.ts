import { describe, expect, it } from "vitest";

// Logic representation of secure redirect validator
function isSafeRedirectUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);

    // 1. Enforce strict HTTP/HTTPS schemes only (prevent javascript:, data:, file:)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Prevent loopback and internal private IP address SSRF
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("169.254.")
    ) {
      return false;
    }

    // 3. Reject credentials in URL
    if (parsed.username || parsed.password) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

describe("Shortlink & Open Redirect Security Tests", () => {
  it("SEC-S1-07: Rejects dangerous schemes like javascript:, data:, and file:", () => {
    const dangerousUrls = [
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
    ];

    for (const url of dangerousUrls) {
      expect(isSafeRedirectUrl(url)).toBe(false);
    }
  });

  it("SEC-S1-07: Rejects loopback and RFC 1918 / cloud metadata internal IP addresses", () => {
    const internalTargets = [
      "http://localhost/admin",
      "http://127.0.0.1:4000/internal",
      "http://169.254.169.254/latest/meta-data/", // AWS/Cloud metadata
      "http://192.168.1.1/router",
      "http://10.0.0.5/api",
    ];

    for (const url of internalTargets) {
      expect(isSafeRedirectUrl(url)).toBe(false);
    }
  });

  it("Accepts legitimate external creator destinations", () => {
    const legitimateUrls = [
      "https://gumroad.com/l/myproduct",
      "https://topmate.io/creator/session",
      "https://youtube.com/watch?v=12345",
      "https://drive.google.com/file/d/abcdef/view",
      "https://superprofile.bio/jinbandhan",
    ];

    for (const url of legitimateUrls) {
      expect(isSafeRedirectUrl(url)).toBe(true);
    }
  });
});

