import { afterEach, describe, expect, it } from "vitest";
import { getAudioPublicUrl } from "../lib/audioUrl";

const originalPublic = process.env.NEXT_PUBLIC_R2PUBLICURL;
const originalPrivate = process.env.R2PUBLICURL;

afterEach(() => {
  if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_R2PUBLICURL;
  else process.env.NEXT_PUBLIC_R2PUBLICURL = originalPublic;
  if (originalPrivate === undefined) delete process.env.R2PUBLICURL;
  else process.env.R2PUBLICURL = originalPrivate;
});

describe("audio URLs", () => {
  it("keeps absolute URLs unchanged", () => {
    expect(getAudioPublicUrl("https://audio.example.com/song.mp3")).toBe(
      "https://audio.example.com/song.mp3"
    );
  });

  it("joins relative paths to the configured public origin", () => {
    process.env.NEXT_PUBLIC_R2PUBLICURL = "https://audio.example.com/";
    expect(getAudioPublicUrl("/audio/song.mp3")).toBe(
      "https://audio.example.com/audio/song.mp3"
    );
  });

  it("handles an empty path", () => {
    expect(getAudioPublicUrl("")).toBe("");
  });
});
