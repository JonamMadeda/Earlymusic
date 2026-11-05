import { describe, expect, it } from "vitest";
import {
  MAX_NOTIFICATIONS,
  TITLE_MAX_LENGTH,
  URL_MAX_LENGTH,
  normalizeNotificationKind,
  normalizeNotificationUrl,
  releaseAnnouncementFor,
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

  it("turns a saved track into a release announcement", () => {
    expect(releaseAnnouncementFor({ id: 12, title: " Kyrie ", author: " Taizé " })).toEqual({
      kind: "release",
      title: "Kyrie",
      body: "New from Taizé. It is in the library now.",
      url: "/share/12",
    });
  });

  it("still announces a track with no author or blank title", () => {
    expect(releaseAnnouncementFor({ id: "7", author: "Choir" })).toEqual({
      kind: "release",
      title: "New song",
      body: "New from Choir. It is in the library now.",
      url: "/share/7",
    });
    expect(releaseAnnouncementFor({ id: 7, title: "  " }).body).toBe(
      "Just added to the library."
    );
  });

  it("leaves the link off when there is nothing to point at", () => {
    expect(releaseAnnouncementFor({ title: "Silent" }).url).toBeNull();
  });

  it("keeps a long track title inside the headline cap", () => {
    expect(
      releaseAnnouncementFor({ id: 1, title: "x".repeat(400) }).title
    ).toHaveLength(TITLE_MAX_LENGTH);
  });
});
