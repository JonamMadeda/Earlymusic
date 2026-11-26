import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Opening the page clears the shared badge but deliberately keeps this visit's
// "new" highlights. The action that clears them has to say so, otherwise the badge
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
    expect(source).toContain("Mark all as read");
    expect(source).not.toContain("Clear new markers");
    expect(source).toContain("markNotificationsSeen({ clearHighlights: true })");
  });

  it("keeps empty filters visible and persists the selected filter in the URL", () => {
    expect(source).toContain("disabled={disabled}");
    expect(source).not.toContain("if (count === 0 && !active) return null");
    expect(source).toContain("router.push");
    expect(source).toContain('params.set("filter", nextFilter)');
  });

  it("keeps cached announcements visible when a refresh fails", () => {
    expect(source).toContain("Showing previously loaded announcements.");
    expect(source).toContain("{visibleItems.length > 0 && (");
  });

  it("uses the shell main landmark only once", () => {
    expect(source).toContain('<section aria-labelledby="notifications-heading"');
    expect(source).not.toContain("<main");
  });
});
