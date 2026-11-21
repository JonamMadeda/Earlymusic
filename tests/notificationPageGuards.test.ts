import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Opening the page clears the shared badge but deliberately keeps this visit's
// "new" markers. The action that clears them has to say so, otherwise the badge
// and the button look like they do the same thing.
const source = readFileSync(
  new URL("../app/notifications/page.js", import.meta.url),
  "utf8"
);

describe("notification read-state wording", () => {
  it("labels the visit markers as new, not unread", () => {
    expect(source).toContain("{unreadCount} new");
    expect(source).not.toContain("{unreadCount} unread");
  });

  it("names the action after what it actually clears", () => {
    expect(source).toContain("Clear new markers");
    expect(source).not.toContain("Mark all read");
    expect(source).toContain("markNotificationsSeen({ clearHighlights: true })");
  });
});
