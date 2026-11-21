import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const account = readFileSync(new URL("../app/account/page.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const library = readFileSync(new URL("../app/library/page.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("download storage indicator", () => {
  it("lives on the account page inside the library section", () => {
    const librarySection = account.slice(
      account.indexOf('<section id="library"'),
      account.indexOf("{/* Security */}")
    );

    expect(librarySection).toContain("<DownloadStorageCard />");
    expect(account).toContain("function DownloadStorageCard()");
    expect(account).toContain("getStorageEstimate()");
    expect(account).toContain("onDownloadsChanged(refresh)");
    expect(account).toContain("onDownloadsProgress(refresh)");
    expect(account).toContain("Storage almost full — remove a download to free space");
    expect(account).toContain("of ${formatBytes(storage.quota)} used");
  });

  it("is no longer rendered in the Downloads tab", () => {
    expect(library).not.toContain("getStorageEstimate");
    expect(library).not.toContain("storagePercent");
    expect(library).not.toContain("Storage almost full");
    expect(library).not.toContain('<HardDrive size={14}');
  });
});
