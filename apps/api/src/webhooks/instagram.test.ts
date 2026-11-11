import { describe, expect, it } from "vitest";
import { deriveWebhookEventIds } from "./instagram.js";

describe("deriveWebhookEventIds", () => {
  it("derives one id per comment change across entries", () => {
    const raw = Buffer.from("{}");
    const ids = deriveWebhookEventIds(
      {
        object: "instagram",
        entry: [
          {
            id: "ig1",
            changes: [
              { field: "comments", value: { id: "c1" } },
              { field: "comments", value: { id: "c2" } },
            ],
          },
          {
            id: "ig2",
            changes: [{ field: "live_comments", value: { id: "c3" } }],
          },
        ],
      },
      raw,
    );
    expect(ids).toEqual(["comments:c1", "comments:c2", "live_comments:c3"]);
  });

  it("falls back to raw hash when no changes", () => {
    const raw = Buffer.from('{"object":"instagram","entry":[]}');
    const ids = deriveWebhookEventIds({ object: "instagram", entry: [] }, raw);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^raw:[a-f0-9]{32}$/);
  });
});
