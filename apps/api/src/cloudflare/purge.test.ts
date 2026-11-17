import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { purgeCloudflareCache } from "./purge.js";

describe("purgeCloudflareCache", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("skips purge gracefully when credentials are not configured", async () => {
    const result = await purgeCloudflareCache(["https://hyperprofile.com/creator"], {
      zoneId: undefined,
      apiToken: undefined,
    });

    expect(result).toEqual({ success: true, purgedCount: 0 });
  });

  it("skips purge when empty array is passed", async () => {
    const result = await purgeCloudflareCache([], {
      zoneId: "fake-zone-id",
      apiToken: "fake-api-token",
    });

    expect(result).toEqual({ success: true, purgedCount: 0 });
  });

  it("calls Cloudflare API successfully when configured", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: { id: "purge-1" } }),
    });
    globalThis.fetch = mockFetch;

    const urls = [
      "https://hyperprofile.com/jinbandhan",
      "https://hyperprofile.com/v1/public/pages/jinbandhan",
    ];

    const result = await purgeCloudflareCache(urls, {
      zoneId: "zone-123",
      apiToken: "token-abc",
    });

    expect(result.success).toBe(true);
    expect(result.purgedCount).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [callUrl, callOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(callUrl).toBe("https://api.cloudflare.com/client/v4/zones/zone-123/purge_cache");
    expect(callOptions.headers).toMatchObject({
      Authorization: "Bearer token-abc",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(callOptions.body as string)).toEqual({ files: urls });
  });

  it("returns error info when Cloudflare API returns failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        errors: [{ message: "Invalid URL format" }],
      }),
    });
    globalThis.fetch = mockFetch;

    const result = await purgeCloudflareCache(["bad-url"], {
      zoneId: "zone-123",
      apiToken: "token-abc",
    });

    expect(result.success).toBe(false);
    expect(result.purgedCount).toBe(0);
    expect(result.error).toBe("Invalid URL format");
  });
});
