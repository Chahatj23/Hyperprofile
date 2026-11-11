import { describe, expect, it } from "vitest";
import { shouldSkipTracking } from "./links.js";

describe("shouldSkipTracking", () => {
  it("skips Amazon and Flipkart", () => {
    expect(shouldSkipTracking("https://www.amazon.in/dp/B0")).toBe(true);
    expect(shouldSkipTracking("https://amzn.to/abc")).toBe(true);
    expect(shouldSkipTracking("https://www.flipkart.com/item")).toBe(true);
  });

  it("tracks normal destinations", () => {
    expect(shouldSkipTracking("https://hyperprofile.example/guide")).toBe(false);
  });
});
