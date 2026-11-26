import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SongRightsNotice, { SongRightsTag } from "../app/components/SongRightsNotice";
import {
  SONG_RIGHTS_ARCHIVE_NOTICE,
  SONG_RIGHTS_LABELS,
  SONG_RIGHTS_STATUSES,
  getSongRightsLabel,
  getSongRightsStatus,
  normalizeSongRightsStatus,
} from "../lib/songRights";

const noticeHtml = (song: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(SongRightsNotice, { song }));

describe("song rights classification", () => {
  it("exposes the four listener-facing labels", () => {
    expect(SONG_RIGHTS_STATUSES).toEqual([
      "church_original", "third_party", "public_domain", "unknown",
    ]);
    expect(SONG_RIGHTS_LABELS).toEqual({
      church_original: "Luumbo Original",
      third_party: "Third-party song",
      public_domain: "Public-domain hymn",
      unknown: "Archive recording",
    });
  });

  it.each(SONG_RIGHTS_STATUSES)("normalizes and labels %s", (status) => {
    expect(normalizeSongRightsStatus(`  ${status.toUpperCase()}  `)).toBe(status);
    expect(getSongRightsStatus(status)).toBe(status);
    expect(getSongRightsLabel(status)).toBe(SONG_RIGHTS_LABELS[status]);
  });

  it.each([undefined, null, "", "owned", 7, {}])("treats %s as unclassified", (value) => {
    expect(normalizeSongRightsStatus(value)).toBeNull();
    expect(getSongRightsStatus(value)).toBe("unknown");
    expect(getSongRightsLabel(value)).toBe("Archive recording");
  });
});

describe("shared rights notice", () => {
  it("always explains archive use and links to the music-rights policy", () => {
    const html = noticeHtml({ rights_status: "unknown" });
    expect(html).toContain('aria-label="Rights and archive use"');
    expect(html).toContain("Rights &amp; archive use");
    expect(html).toContain(SONG_RIGHTS_ARCHIVE_NOTICE);
    expect(html).toContain("Archive recording");
    expect(html).toContain('href="/terms#content"');
  });

  it("renders supplied attribution and a safe licence link", () => {
    const html = noticeHtml({
      rights_status: "third_party",
      rights_note: "Used with permission.",
      copyright_holder: "Song writer",
      license_type: "Direct permission",
      license_url: "https://example.org/permission",
    });
    expect(html).toContain("Third-party song");
    expect(html).toContain("Used with permission.");
    expect(html).toContain("Song writer");
    expect(html).toContain('href="https://example.org/permission"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "//example.org/permission",
    "/relative-permission",
    "not a url",
  ])("renders the licence label without linking an unsafe URL %s", (licenseUrl) => {
    const html = noticeHtml({ license_type: "Direct permission", license_url: licenseUrl });
    expect(html).toContain("Direct permission");
    expect(html).not.toContain(`href="${licenseUrl}"`);
    expect(html).not.toContain('target="_blank"');
  });

  it("keeps a safe licence URL when no licence type was stored", () => {
    const html = noticeHtml({ license_url: "https://example.org/permission" });
    expect(html).toContain("View licence");
    expect(html).toContain('href="https://example.org/permission"');
  });

  it("formats the clearance date deterministically in UTC", () => {
    const html = noticeHtml({ rights_clearance_date: "2026-11-26" });
    expect(html).toContain("26 Nov 2026");
  });

  it("falls back to the archive label for a tag with an invalid stored status", () => {
    const html = renderToStaticMarkup(createElement(SongRightsTag, { song: { rights_status: "owned" } }));
    expect(html).toContain("Archive recording");
    expect(html).not.toContain("owned");
  });
});
