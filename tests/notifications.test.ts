import { describe, expect, it } from "vitest";
import {
  MAX_NOTIFICATIONS,
  URL_MAX_LENGTH,
  normalizeNotificationKind,
  normalizeNotificationUrl,
} from "../lib/notifications";

describe("announcements", () => {
  it("falls back to news for an unknown kind", () => {
    expect(normalizeNotificationKind("release")).toBe("release");
    expect(normalizeNotificationKind("promotional")).toBe("news");
    expect(normalizeNotificationKind(undefined)).toBe("news");
  });

  it("keeps in-app paths and https links", () => {
    expect(normalizeNotificationUrl("/songs")).toBe("/songs");
    expect(normalizeNotificationUrl(" https://luumbo.vercel.app ")).toBe(
      "https://luumbo.vercel.app"
    );
  });

  it("rejects links that are not https", () => {
    expect(normalizeNotificationUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeNotificationUrl("data:text/html,hi")).toBeNull();
    expect(normalizeNotificationUrl("http://luumbo.vercel.app")).toBeNull();
    expect(normalizeNotificationUrl("//evil.example.com")).toBeNull();
    expect(normalizeNotificationUrl("   ")).toBeNull();
  });

  it("caps length so a paste cannot bloat a row", () => {
    expect(normalizeNotificationUrl("https://e.com/" + "a".repeat(500))).toHaveLength(
      URL_MAX_LENGTH
    );
  });

  it("holds the feed threshold", () => {
    expect(MAX_NOTIFICATIONS).toBe(15);
  });
});
