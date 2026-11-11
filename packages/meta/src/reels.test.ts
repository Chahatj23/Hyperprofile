import { describe, expect, it, vi } from "vitest";
import { fetchIgReels } from "./insights.js";

describe("fetchIgReels", () => {
  it("fetches reels with product type, thumbnails, and engagement stats", async () => {
    const mockResponse = {
      data: [
        {
          id: "17984123849102",
          caption: "3 Daily Habits That Built My 6-Figure Creator Business",
          media_type: "VIDEO",
          media_product_type: "REELS",
          media_url: "https://cdn.instagram.com/reel1.mp4",
          thumbnail_url: "https://cdn.instagram.com/thumb1.jpg",
          permalink: "https://www.instagram.com/reel/C8qL9X0vM1Z/",
          timestamp: "2026-11-09T10:00:00Z",
          like_count: 842,
          comments_count: 126,
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    try {
      const reels = await fetchIgReels("17841453478293915", "test-token");
      expect(reels).toHaveLength(1);
      expect(reels[0]?.id).toBe("17984123849102");
      expect(reels[0]?.mediaType).toBe("VIDEO");
      expect(reels[0]?.mediaProductType).toBe("REELS");
      expect(reels[0]?.thumbnailUrl).toBe("https://cdn.instagram.com/thumb1.jpg");
      expect(reels[0]?.likeCount).toBe(842);
      expect(reels[0]?.commentsCount).toBe(126);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

