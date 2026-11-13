import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import * as newSongs from "../lib/newSongs";
import * as songGrouping from "../lib/songGrouping";

// Isolated hooks let the real JSX run without a DOM or live services.
type Element = { type: any; key?: string; props: Record<string, any> };
type Component = (props: Record<string, any>) => Element;
const compiled = new Map<string, string>();
const fixture = (id: string, title = id, author = "Artist", date = "2026-11-10") => ({
  id, title, author, created_at: `${date}T12:00:00Z`, category: "Worship", duration: "Long",
});
type Song = ReturnType<typeof fixture>;

function nodes(tree: any): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function find(tree: Element, predicate: (node: Element) => boolean) {
  const match = nodes(tree).find(predicate);
  expect(match, "Expected a matching rendered control").toBeDefined();
  return match!;
}
const button = (tree: Element, label: string) =>
  find(tree, (node) => node.type === "button" && text(node) === label);
const change = (node: Element, value: string) => node.props.onChange({ target: { value } });
const songRows = (tree: Element) => nodes(tree).filter((node) => node.props.song && "isNew" in node.props);

function harness(songs: Song[], tab = "top") {
  let current: { cells: any[]; cursor: number; effects: (() => void)[] };
  const hooks = {
    useState(initial: any) {
      const owner = current;
      const index = owner.cursor++;
      if (!(index in owner.cells)) owner.cells[index] = typeof initial === "function" ? initial() : initial;
      return [owner.cells[index], (value: any) => {
        owner.cells[index] = typeof value === "function" ? value(owner.cells[index]) : value;
      }];
    },
    useRef(initial: any) { return hooks.useState({ current: initial })[0]; },
    useMemo(compute: () => any) { return compute(); },
    useCallback(callback: any) { return callback; },
    useEffect(effect: () => void) { current.effects.push(effect); },
    Suspense: "suspense",
  };
  const setActiveSong = vi.fn();
  const player = { allSongs: songs, setAllSongs: vi.fn(), setActiveSong, isLoading: false, setIsLoading: vi.fn() };
  const fetch = vi.fn(async (url: string, options?: any) => {
    let body: any;
    if (url === "/api/admin/songs") body = songs;
    else if (url === "/api/admin/users") body = [];
    else if (url === "/api/admin/storage/stats") body = {};
    else if (url === "/api/data/playlists" && options?.method === "POST") body = { id: "playlist" };
    else if (url === "/api/data/playlist_songs" && options?.method === "POST") body = {};
    else throw new Error(`Unexpected request: ${url}`);
    return { ok: true, json: async () => body };
  });
  const apiFetch = vi.fn(async (url: string, options?: any) => {
    if (options?.method === "POST") return (await fetch(url, options)).json();
    if (url.startsWith("/api/data/recently_played?")) return songs.map((song) => ({ song_id: song.id, play_count: 2 }));
    if (url.startsWith("/api/data/saved_songs?") || url.startsWith("/api/data/playlists?")) return [];
    throw new Error(`Unexpected API request: ${url}`);
  });
  const modules: Record<string, any> = {
    react: hooks,
    "react/jsx-runtime": jsxRuntime,
    "next/navigation": { useRouter: () => ({}), usePathname: () => "/songs", useSearchParams: () => new URLSearchParams({ tab }) },
    "next/link": { default: "a" },
    "lucide-react": new Proxy({}, { get: (_, name) => `icon:${String(name)}` }),
    "@/lib/newSongs": newSongs,
    "@/lib/songGrouping": songGrouping,
    "@/lib/apiFetch": { apiFetch },
    "@/lib/audioUrl": { getAudioPublicUrl: vi.fn() },
    "@/lib/audioHealth": { summarizeHealth: () => ({}), verifyAudioUrl: vi.fn() },
    "@/lib/prefetchAudio": { prefetchSongAudio: vi.fn() },
    "@/lib/downloadManager": {
      getDownloadedSongs: () => songs,
      getStorageEstimate: async () => null,
      removeDownload: vi.fn(),
    },
  };
  function load(relativePath: string): Component {
    const filename = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
    if (!compiled.has(filename)) {
      compiled.set(filename, ts.transpileModule(readFileSync(filename, "utf8"), {
        fileName: `${filename}.tsx`,
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText);
    }
    const exports: Record<string, any> = {};
    runInNewContext(compiled.get(filename)!, {
      exports,
      require: (id: string) => {
        if (id.endsWith("/context/PlayerContext")) return { usePlayer: () => player };
        if (id.endsWith("/context/AuthContext")) return { useAuth: () => ({ user: { id: "user" }, isAdmin: true, loading: false, roleLoading: false }) };
        if (id.includes("/components/")) return { default: id, PageSkeleton: "skeleton" };
        if (id in modules) return modules[id];
        throw new Error(`Unexpected import: ${id}`);
      },
      fetch,
      console,
      setTimeout: (callback: () => void, delay: number) => { if (delay === 0) callback(); return 0; },
      clearTimeout: () => {},
    }, { filename });
    return exports.default;
  }
  function mount(component: Component, props = {}) {
    const state = { cells: [] as any[], cursor: 0, effects: [] as (() => void)[] };
    let tree: Element;
    const render = () => {
      current = state;
      state.cursor = 0;
      state.effects = [];
      tree = component(props);
      return tree;
    };
    render();
    return {
      get tree() { return tree; },
      render,
      async startEffects() {
        for (const effect of state.effects) effect();
        await new Promise<void>((resolve) => setImmediate(resolve));
        return render();
      },
    };
  }
  return { load, mount, player, setActiveSong, fetch };
}

const adminFixtures = [
  fixture("alpha", "Alpha", "Zoe", "2026-09-12"),
  fixture("zulu", "Zulu", "Adam", "2026-11-12"),
  fixture("beta", "Beta", "Adam", "2026-10-12"),
  { ...fixture("anthem", "Anthem", "Beth", "2026-11-10"), category: "Praise" },
];
const adminGroups = (tree: Element) => nodes(tree).filter((node) =>
  node.key != null && nodes(node).some((child) => child.type === "input" && child.props.type === "checkbox")
  && nodes(node).some((child) => child.type === "div" && child.props.className?.includes("sticky"))
);
const checkboxes = (tree: Element) => nodes(tree).filter((node) => node.type === "input" && node.props.type === "checkbox");

describe("admin catalogue grouping", () => {
  it.each([
    ["title-az", ["A", "B", "Z"], ["Alpha", "Anthem", "Beta", "Zulu"]],
    ["title-za", ["Z", "B", "A"], ["Zulu", "Beta", "Anthem", "Alpha"]],
    ["author-az", ["A", "B", "Z"], ["Zulu", "Beta", "Anthem", "Alpha"]],
    ["newest", ["Nov 2026", "Oct 2026", "Sep 2026"], ["Zulu", "Anthem", "Beta", "Alpha"]],
  ])("keeps %s group order, labels, rows and bulk selection aligned", async (sort, labels, titles) => {
    const h = harness(adminFixtures);
    const page = h.mount(h.load("app/admin/page.js"));
    await page.startEffects();
    change(find(page.tree, (node) => node.props["aria-label"] === "Sort tracks"), sort as string);
    page.render();
    const groups = adminGroups(page.tree);
    expect(groups.map((group) => text(group.props.children[0]))).toEqual(labels);
    expect(groups.flatMap((group) => checkboxes(group).filter((_, index) => index % 2 === 0)
      .map((node) => node.props["aria-label"].slice(7)))).toEqual(titles);
    button(page.tree, "Select").props.onClick();
    page.render();
    expect(checkboxes(page.tree)).toHaveLength(adminFixtures.length * 2);
    expect(checkboxes(page.tree).every((node) => node.props.checked)).toBe(true);
    checkboxes(page.tree)[0].props.onChange();
    page.render();
    expect(checkboxes(page.tree).filter((node) => node.props.checked)).toHaveLength(6);
  });

  it("bulk-selects only the search/category intersection and renders empty results", async () => {
    const h = harness(adminFixtures);
    const page = h.mount(h.load("app/admin/page.js"));
    await page.startEffects();
    button(page.tree, "Worship").props.onClick();
    change(find(page.tree, (node) => node.props.placeholder === "Search tracks or artists..."), "Adam");
    page.render();
    button(page.tree, "Select").props.onClick();
    page.render();
    expect(checkboxes(page.tree).map((node) => [node.props["aria-label"], node.props.checked])).toEqual([
      ["Select Beta", true], ["Select Beta", true], ["Select Zulu", true], ["Select Zulu", true],
    ]);
    expect(text(page.tree)).toContain("2 selected");
    change(find(page.tree, (node) => node.props.placeholder === "Search tracks or artists..."), "absent");
    page.render();
    expect(checkboxes(page.tree)).toHaveLength(0);
    expect(text(page.tree)).toContain("No matching tracks found");
  });
});

const newFixtures = [
  ...Array.from({ length: 16 }, (_, index) => fixture(`s${index}`, `Track ${index}`, "Artist", `2026-11-${String(20 - index).padStart(2, "0")}`)),
  fixture("old", "Archive only", "Archive artist", "2020-01-10"),
];
newFixtures[0] = { ...newFixtures[0], title: "Shared title", category: "Praise", duration: "Short" };
newFixtures[1] = { ...newFixtures[1], title: "Shared title long", category: "Praise" };
newFixtures[15] = { ...newFixtures[15], title: "Shared title archive", category: "Praise", duration: "Short" };

function newCatalogue() {
  const h = harness(newFixtures);
  const page = h.mount(h.load("app/songs/page.js"));
  button(page.tree, "Filters").props.onClick();
  page.render();
  find(page.tree, (node) => node.props.label === "New").props.onClick();
  page.render();
  return { h, page };
}

describe("global New catalogue membership", () => {
  it.each(["Archive only", "Archive artist"])("does not promote an old search match for %s", (query) => {
    const { page } = newCatalogue();
    expect(songRows(page.tree)).toHaveLength(15);
    change(find(page.tree, (node) => node.props.placeholder === "Search songs or artists..."), query);
    page.render();
    expect(songRows(page.tree)).toHaveLength(0);
    expect(text(page.tree)).toContain("15 new");
  });

  it("intersects search, category and duration with global badges and the playback list", () => {
    const { h, page } = newCatalogue();
    change(find(page.tree, (node) => node.props.placeholder === "Search songs or artists..."), "shared");
    find(page.tree, (node) => node.props.label === "Praise").props.onClick();
    find(page.tree, (node) => node.props.label === "Short").props.onClick();
    page.render();
    expect(songRows(page.tree).map((row) => [row.props.song.id, row.props.isNew])).toEqual([["s0", true]]);
    button(page.tree, "Play All (1)").props.onClick();
    expect(h.setActiveSong).toHaveBeenCalledWith(newFixtures[0], [newFixtures[0]]);
    button(page.tree, "Reset").props.onClick();
    page.render();
    expect(songRows(page.tree).map((row) => [row.props.song.id, row.props.isNew])).toEqual([
      ["s0", true], ["s15", false], ["s1", true],
    ]);
  });

  it("updates global membership when the full catalogue changes", () => {
    const { h, page } = newCatalogue();
    const replacement = fixture("replacement", "Newest", "Artist", "2026-12-12");
    h.player.allSongs = [replacement, ...newFixtures];
    page.render();
    expect(songRows(page.tree)).toHaveLength(15);
    expect(songRows(page.tree).map((row) => row.props.song.id)).toContain("replacement");
    expect(songRows(page.tree).map((row) => row.props.song.id)).not.toContain("s14");
    expect(songRows(page.tree).every((row) => row.props.isNew)).toBe(true);
  });
});

function keyEvent(key: string, target: any, currentTarget: any) {
  return { key, target, currentTarget, preventDefault: vi.fn(), stopPropagation: vi.fn() };
}

async function keyboardRow(kind: string) {
  const songs = [fixture("song")];
  const h = harness(songs, kind === "library downloads" ? "downloads" : "top");
  let page;
  if (kind === "SongItem") {
    page = h.mount(h.load("app/components/SongItem.jsx"), { song: songs[0], onClick: h.setActiveSong, saved: false });
  } else if (kind === "SongRow") {
    const catalogue = h.mount(h.load("app/songs/page.js"));
    const row = songRows(catalogue.tree)[0];
    page = h.mount(row.type, row.props);
  } else if (kind.startsWith("library")) {
    const wrapper = h.mount(h.load("app/library/page.js"));
    const content = wrapper.tree.props.children;
    page = h.mount(content.type, content.props);
    await page.startEffects();
  } else {
    page = h.mount(h.load("app/downloads/page.js"));
    await page.startEffects();
  }
  const row = () => find(page.tree, (node) => node.props.role === "button" && !!node.props.onKeyDown);
  return { h, page, row };
}

describe("playable row keyboard isolation", () => {
  it.each(["SongItem", "SongRow", "library top", "library downloads", "downloads"])("activates only a directly focused %s", async (kind) => {
    const { h, row } = await keyboardRow(kind);
    for (const key of ["Enter", " "]) {
      const event = keyEvent(key, row(), row());
      row().props.onKeyDown(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }
    expect(h.setActiveSong).toHaveBeenCalledTimes(2);
    h.setActiveSong.mockClear();
    for (const key of ["Enter", " ", "Escape", "ArrowDown"]) {
      for (const target of [{ tagName: "BUTTON" }, { tagName: "INPUT" }, { tagName: "A" }, { tagName: "SPAN" }]) {
        const event = keyEvent(key, target, row());
        row().props.onKeyDown(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
      }
    }
    for (const key of ["Escape", "ArrowDown"]) {
      const event = keyEvent(key, row(), row());
      row().props.onKeyDown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(h.setActiveSong).not.toHaveBeenCalled();
  });

  it.each(["SongItem", "SongRow"])("preserves nested menu and playlist input behavior in %s", async (kind) => {
    const { h, page, row } = await keyboardRow(kind);
    const more = find(page.tree, (node) => node.type === "button" && node.props.title === "More");
    const menuEvent = keyEvent("Enter", more, row());
    row().props.onKeyDown(menuEvent);
    expect(menuEvent.preventDefault).not.toHaveBeenCalled();
    more.props.onClick(menuEvent);
    page.render();
    button(page.tree, "Add to Playlist").props.onClick();
    page.render();
    const input = () => find(page.tree, (node) => node.props.placeholder === "New playlist...");
    const space = keyEvent(" ", input(), row());
    input().props.onKeyDown(space);
    row().props.onKeyDown(space);
    expect(space.preventDefault).not.toHaveBeenCalled();
    change(input(), "Sunday songs");
    page.render();
    const enter = keyEvent("Enter", input(), row());
    await input().props.onKeyDown(enter);
    row().props.onKeyDown(enter);
    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(h.setActiveSong).not.toHaveBeenCalled();
    expect(h.fetch).toHaveBeenCalledWith("/api/data/playlists", expect.objectContaining({
      method: "POST", body: JSON.stringify({ name: "Sunday songs", user_id: "user" }),
    }));
    expect(h.fetch).toHaveBeenCalledWith("/api/data/playlist_songs", expect.objectContaining({
      method: "POST", body: JSON.stringify({ playlist_id: "playlist", song_id: "song" }),
    }));
  });
});
