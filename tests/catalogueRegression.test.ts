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

function harness(songs: Song[], tab = "top", search: Record<string, string> | null = null) {
  const connection = { online: true };
  const auth: { user: { id: string } | null; isAdmin: boolean; loading: boolean; roleLoading: boolean } = {
    user: { id: "user" }, isAdmin: true, loading: false, roleLoading: false,
  };
  let downloadsChanged: () => void = () => {};
  const localSongs = { songs };
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
    useLayoutEffect(effect: () => void) { current.effects.push(effect); },
    Suspense: "suspense",
  };
  const setActiveSong = vi.fn();
  const alert = vi.fn();
  const player = {
    allSongs: songs, setAllSongs: vi.fn(), setActiveSong, isLoading: false, setIsLoading: vi.fn(),
    recentlyPlayed: [] as Song[], activeSong: null as Song | null, hasRealHistory: false,
  };
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
    if (url.startsWith("/api/data/songs?")) return songs;
    if (url.startsWith("/api/data/recently_played?")) return songs.map((song) => ({ song_id: song.id, play_count: 2 }));
    if (url.startsWith("/api/data/saved_songs?") || url.startsWith("/api/data/playlists?")) return [];
    throw new Error(`Unexpected API request: ${url}`);
  });
  const modules: Record<string, any> = {
    react: hooks,
    "react/jsx-runtime": jsxRuntime,
    "next/navigation": { useRouter: () => ({}), usePathname: () => "/songs", useSearchParams: () => new URLSearchParams(search ?? { tab }) },
    "next/link": { default: "a" },
    "lucide-react": new Proxy({}, { get: (_, name) => `icon:${String(name)}` }),
    "@/lib/newSongs": newSongs,
    "@/lib/songGrouping": songGrouping,
    "@/lib/apiFetch": { apiFetch },
    "@/lib/audioUrl": { getAudioPublicUrl: vi.fn() },
    "@/lib/audioHealth": { summarizeHealth: () => ({}), verifyAudioUrl: vi.fn() },
    "@/lib/prefetchAudio": { prefetchSongAudio: vi.fn() },
    "@/lib/useOnlineStatus": { useOnlineStatus: () => connection.online },
    "@/lib/downloadManager": {
      getDownloadedSongs: () => localSongs.songs,
      getStorageEstimate: async () => null,
      removeDownload: vi.fn(),
      onDownloadsChanged: (listener: () => void) => { downloadsChanged = listener; return () => {}; },
      getActiveDownloads: () => [],
      onDownloadsProgress: () => () => {},
      stageClearDownloads: () => {
        const snapshot = { id: "clear-1", expiresAt: Date.now() + 8000, songs: localSongs.songs };
        localSongs.songs = [];
        return snapshot;
      },
      commitClearDownloads: async () => {},
      undoClearDownloads: (snapshot: { songs: Song[] }) => { localSongs.songs = snapshot.songs; return true; },
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
        if (id.endsWith("/context/AuthContext")) return { useAuth: () => auth };
        if (id.endsWith("/SongAvatar")) return { default: "avatar", initialLetter: (title: string) => title[0], hashStr: (value: string) => [...value].reduce((hash, char) => hash * 31 + char.charCodeAt(0) | 0, 0) };
        if (id.includes("/components/")) return { default: id, PageSkeleton: "skeleton" };
        if (id in modules) return modules[id];
        throw new Error(`Unexpected import: ${id}`);
      },
      fetch,
      alert,
      window: { addEventListener: vi.fn(), removeEventListener: vi.fn(), matchMedia: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }), history: { state: null, replaceState: vi.fn() }, location: { pathname: "/library", search: "" } },
      document: { getElementById: () => null },
      setInterval: () => 0,
      clearInterval: () => {},
      URLSearchParams,
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
  return { load, mount, player, setActiveSong, fetch, alert, auth, connection, apiFetch, localSongs, downloadsChanged: () => downloadsChanged() };
}

describe("homepage navigation and recovery", () => {
  it("does not present seeded suggestions as listening history", () => {
    const h = harness([fixture("one"), fixture("two")]);
    h.player.recentlyPlayed = h.player.allSongs;
    const page = h.mount(h.load("app/page.js"));
    expect(nodes(page.tree).some((node) => node.props.id === "recently-played")).toBe(false);
    expect(nodes(page.tree).some((node) => node.props.id === "suggested-starters")).toBe(true);
    expect(nodes(page.tree).some((node) => node.props.href === "#recently-played")).toBe(false);
    button(page.tree, "Shuffle All").props.onClick();
    const [song, queue] = h.setActiveSong.mock.calls[0];
    expect(queue.map((item: Song) => item.id).sort()).toEqual(["one", "two"]);
    expect(song).toBe(queue[0]);
  });

  it("puts real history first and plays its own queue", () => {
    const h = harness([fixture("one"), fixture("two")]);
    h.player.recentlyPlayed = [h.player.allSongs[1]];
    h.player.hasRealHistory = true;
    const page = h.mount(h.load("app/page.js"));
    const shelves = nodes(page.tree).filter((node) => node.props.items);
    expect(shelves[0].props.id).toBe("recently-played");
    const history = h.mount(shelves[0].type, shelves[0].props);
    button(history.tree, " Play all").props.onClick();
    expect(h.setActiveSong).toHaveBeenCalledWith(h.player.allSongs[1], h.player.recentlyPlayed);
  });

  it("does not claim a selected track is currently playing", () => {
    const h = harness([fixture("one")]);
    h.player.activeSong = h.player.allSongs[0];
    const page = h.mount(h.load("app/page.js"));
    expect(text(page.tree)).toContain("In your player");
    expect(text(page.tree)).not.toContain("Now Playing");
  });

  it("offers retry without a contradictory empty-library message", async () => {
    const h = harness([]);
    h.apiFetch.mockRejectedValueOnce(new Error("offline"));
    const page = h.mount(h.load("app/page.js"));
    await page.startEffects();
    expect(text(page.tree)).toContain("Songs could not be loaded");
    expect(text(page.tree)).not.toContain("Your library is empty");
    button(page.tree, "Try again").props.onClick();
    page.render();
    await page.startEffects();
    expect(h.apiFetch).toHaveBeenCalledTimes(2);
    expect(text(page.tree)).not.toContain("Songs could not be loaded");
    expect(text(page.tree)).toContain("Your library is empty");
  });

  it("disables empty shuffle and routes admin uploads to the uploader", () => {
    const h = harness([]);
    const page = h.mount(h.load("app/page.js"));
    expect(button(page.tree, "Shuffle All").props.disabled).toBe(true);
    expect(find(page.tree, (node) => node.props.href === "/upload")).toBeDefined();
    const shelves = nodes(page.tree).filter((node) => node.props.items);
    for (const shelf of shelves) expect(h.mount(shelf.type, shelf.props).tree).toBeNull();
  });

  it("filters only curated tracks and retains a recoverable empty state", () => {
    const h = harness([fixture("one")]);
    const page = h.mount(h.load("app/page.js"));
    button(page.tree, "Short").props.onClick();
    page.render();
    expect(text(page.tree)).toContain("No songs match this filter");
    expect(button(page.tree, "Short").props["aria-pressed"]).toBe(true);
    button(page.tree, "All").props.onClick();
    page.render();
    expect(text(page.tree)).not.toContain("No songs match this filter");
    expect(button(page.tree, "All").props["aria-pressed"]).toBe(true);
  });
});

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

describe("admin publication controls", () => {
  const tracks = [
    { ...fixture("pending", "Pending track"), status: "pending" },
    { ...fixture("public", "Public track"), status: "approved" },
    { ...fixture("rejected", "Rejected track"), status: "rejected" },
  ];

  it("shows statuses and filters pending tracks without losing manual approval", async () => {
    const h = harness(tracks);
    const page = h.mount(h.load("app/admin/page.js"));
    await page.startEffects();
    expect(nodes(page.tree).filter((node) => node.props["aria-label"]?.startsWith("Approve "))).toHaveLength(2);
    change(find(page.tree, (node) => node.props["aria-label"] === "Filter by publication status"), "pending");
    page.render();
    expect(checkboxes(page.tree).map((node) => node.props["aria-label"])).toEqual(["Select Pending track", "Select Pending track"]);
    find(page.tree, (node) => node.props["aria-label"] === "Approve Pending track").props.onClick();
    page.render();
    const editor = find(page.tree, (node) => "approveOnOpen" in node.props);
    expect(editor.props.approveOnOpen).toBe(true);
    expect(editor.props.song.status).toBe("pending");
    editor.props.onSuccess({ ...tracks[0], status: "approved" });
    page.render();
    expect(text(page.tree)).toContain("No matching tracks found");
    change(find(page.tree, (node) => node.props["aria-label"] === "Filter by publication status"), "approved");
    page.render();
    expect(checkboxes(page.tree)).toHaveLength(4);
  });

  it("opens approval preselected but requires rights confirmation before saving", async () => {
    const h = harness([]);
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    h.fetch.mockImplementation(async () => ({ ok: true, json: async () => ({ song: { ...tracks[0], status: "approved" } }) }));
    const editor = h.mount(h.load("app/components/EditModal.jsx"), { isOpen: true, song: tracks[0], approveOnOpen: true, onSuccess, onClose });
    await editor.startEffects();
    expect(find(editor.tree, (node) => node.props.id === "edit-publication-status").props.value).toBe("approved");
    expect(text(editor.tree)).toContain("Approve & publish");
    await find(editor.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    expect(h.alert).toHaveBeenCalledOnce();
    expect(h.fetch).not.toHaveBeenCalled();
    const attestation = find(editor.tree, (node) => node.type === "label" && text(node).includes("I confirm Luumbo owns"));
    find(attestation, (node) => node.type === "input").props.onChange({ target: { checked: true } });
    editor.render();
    await find(editor.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    expect(JSON.parse(h.fetch.mock.calls[0][1].body).status).toBe("approved");
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("preserves pending when opening ordinary edit details", async () => {
    const h = harness([]);
    const editor = h.mount(h.load("app/components/EditModal.jsx"), { isOpen: true, song: tracks[0] });
    await editor.startEffects();
    expect(find(editor.tree, (node) => node.props.id === "edit-publication-status").props.value).toBe("pending");
    expect(text(editor.tree)).toContain("Save Changes");
  });
});

describe("upload publication feedback", () => {
  function uploadHarness(statusOverride?: string, fail = false) {
    const h = harness([]);
    h.fetch.mockImplementation(async (url: string, options?: any) => {
      if (url === "/api/upload") return { ok: true, json: async () => ({ presignedUrl: "/test-storage", publicStorageUrl: "/audio/test.mp3" }) };
      if (url === "/api/admin/songs") return {
        ok: !fail,
        json: async () => fail ? { error: "Audio verification failed." } : { song: { status: statusOverride ?? JSON.parse(options.body).status } },
      };
      return { ok: true, json: async () => ({}) };
    });
    const page = h.mount(h.load("app/upload/page.tsx"));
    find(page.tree, (node) => node.props.type === "file").props.onChange({ target: { files: [{ name: "Track.mp3", size: 100, lastModified: 1, type: "audio/mpeg" }] } });
    page.render();
    return { h, page };
  }

  it.each(["approved", "pending"])("saves the selected %s status and reports its visibility", async (status) => {
    const { h, page } = uploadHarness();
    const select = find(page.tree, (node) => node.props.id === "upload-publication-status");
    expect(select.props.value).toBe("approved");
    change(select, status);
    page.render();
    await find(page.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    page.render();
    const request = h.fetch.mock.calls.find(([url]) => url === "/api/admin/songs");
    expect(JSON.parse(request![1].body).status).toBe(status);
    expect(text(page.tree)).toContain(status === "approved" ? "Published 1 track — now available in Songs." : "Pending review — not public");
    expect(h.fetch.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
    button(page.tree, "Start over").props.onClick();
    page.render();
    expect(find(page.tree, (node) => node.props.id === "upload-publication-status").props.value).toBe("approved");
  });

  it("reports the server's returned status rather than assuming publication", async () => {
    const { page } = uploadHarness("pending");
    await find(page.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    page.render();
    expect(text(page.tree)).toContain("Pending review — not public");
    expect(text(page.tree)).toContain("0 public, 1 not public");
  });

  it("does not claim failed saves are public and leaves them retryable", async () => {
    const { h, page } = uploadHarness(undefined, true);
    await find(page.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    page.render();
    expect(text(page.tree)).toContain("Audio verification failed.");
    expect(text(page.tree)).toContain("0 public");
    expect(button(page.tree, "Upload 1 track").props.disabled).toBe(false);
    expect(h.fetch.mock.calls.some(([url, options]) => url === "/api/admin/storage" && options?.method === "DELETE")).toBe(true);
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
  const page = h.mount(h.load("app/songs/songs-view.js"));
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
    // The New badge used to carry this proof; with one count in the title, the
    // membership is proven by the rows the New filter yields once the search
    // is gone — still all fifteen, none of them the archive track.
    change(find(page.tree, (node) => node.props.placeholder === "Search songs or artists..."), "");
    page.render();
    expect(songRows(page.tree)).toHaveLength(15);
    expect(songRows(page.tree).every((row) => row.props.isNew)).toBe(true);
  });

  it("intersects search, category and duration with global badges and the playback list", () => {
    const { h, page } = newCatalogue();
    change(find(page.tree, (node) => node.props.placeholder === "Search songs or artists..."), "shared");
    find(page.tree, (node) => node.props.label === "Praise").props.onClick();
    find(page.tree, (node) => node.props.label === "Short").props.onClick();
    page.render();
    expect(songRows(page.tree).map((row) => [row.props.song.id, row.props.isNew])).toEqual([["s0", true]]);
    button(page.tree, "Play results").props.onClick();
    expect(h.setActiveSong).toHaveBeenCalledWith(newFixtures[0], [newFixtures[0]]);
    button(page.tree, "Clear").props.onClick();
    page.render();
    // One control, one meaning: everything goes, the search included.
    expect(songRows(page.tree)).toHaveLength(newFixtures.length);
    expect(songRows(page.tree).slice(0, 4).map((row) => [row.props.song.id, row.props.isNew])).toEqual([
      ["old", false], ["s0", true], ["s15", false], ["s1", true],
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

describe("songs view from the address bar", () => {
  it("opens on the slice the URL describes", () => {
    const h = harness(newFixtures, "top", { q: "shared", time: "New", type: "Praise", duration: "Short" });
    const page = h.mount(h.load("app/songs/songs-view.js"));
    expect(songRows(page.tree).map((row) => row.props.song.id)).toEqual(["s0"]);
    expect(text(page.tree)).toContain("1 of 17 tracks");
  });

  it("falls back instead of half-applying a value no control can produce", () => {
    const h = harness(newFixtures, "top", { time: "Yesterday", sort: "plays", dir: "desc" });
    const page = h.mount(h.load("app/songs/songs-view.js"));
    // A time filter that had been accepted would make the button read "Filters (1)".
    expect(button(page.tree, "Filters")).toBeDefined();
    // A sort field that had been accepted would make the other button read "plays".
    expect(button(page.tree, "Title")).toBeDefined();
    expect(songRows(page.tree)).toHaveLength(newFixtures.length);
  });
});

describe("offline library downloads", () => {
  it.each([
    [false, false, "saved"],
    [false, true, "top"],
    [true, true, "saved"],
    [true, false, "top"],
  ])("shows local songs online=%s authLoading=%s tab=%s without remote data", async (online, loading, tab) => {
    const tracks = [fixture("cached", "Downloaded track")];
    const h = harness(tracks, tab as string);
    h.auth.user = null;
    h.auth.loading = loading as boolean;
    h.connection.online = online as boolean;
    h.player.allSongs = [];
    const wrapper = h.mount(h.load("app/library/page.js"));
    const page = h.mount(wrapper.tree.props.children.type);
    await page.startEffects();
    expect(text(page.tree)).toContain("Downloaded track");
    // Downloads sit above the tabs and never fetch, whatever the tabs show.
    if (loading || !online) expect(text(page.tree)).not.toContain("Sign in to see your library");
    else expect(text(page.tree)).toContain("Sign in to see your library");
    // Signed-out downloads never touch the private library endpoints; at most
    // the public catalogue prefetch (proven not to be waited on below).
    expect(h.apiFetch.mock.calls.every(([url]) => url.startsWith("/api/data/songs?"))).toBe(true);
    find(page.tree, node => node.props.role === "button").props.onClick();
    expect(h.setActiveSong).toHaveBeenCalledWith(tracks[0], tracks);
    h.localSongs.songs = [];
    h.downloadsChanged();
    page.render();
    expect(text(page.tree)).toContain("No downloaded songs");
    if (!online) expect(text(page.tree)).toContain("Reconnect");
  });

  it("lists local downloads without waiting on any library request", async () => {
    const h = harness([fixture("cached")], "saved");
    h.auth.user = null;
    const wrapper = h.mount(h.load("app/library/page.js"));
    const page = h.mount(wrapper.tree.props.children.type);
    await page.startEffects();
    expect(text(page.tree)).toContain("cached");
    expect(h.apiFetch).not.toHaveBeenCalled();
  });

  it("orders downloads newest-first and queues them that way from Play all", async () => {
    const older = { ...fixture("older", "Older download"), downloadedAt: "2026-11-01T00:00:00Z" };
    const newer = { ...fixture("newer", "Newer download"), downloadedAt: "2026-11-17T00:00:00Z" };
    const h = harness([older, newer], "saved");
    h.auth.user = null;
    const wrapper = h.mount(h.load("app/library/page.js"));
    const page = h.mount(wrapper.tree.props.children.type);
    await page.startEffects();
    const body = text(page.tree);
    expect(body.indexOf("Newer download")).toBeLessThan(body.indexOf("Older download"));
    button(page.tree, "Play all").props.onClick();
    expect(h.setActiveSong).toHaveBeenCalledWith(newer, [newer, older]);
  });

  it("clears downloads behind an undo toast and restores them on undo", async () => {
    const tracks = [fixture("cached", "Downloaded track")];
    const h = harness(tracks, "saved");
    h.auth.user = null;
    const wrapper = h.mount(h.load("app/library/page.js"));
    const page = h.mount(wrapper.tree.props.children.type);
    await page.startEffects();
    button(page.tree, "Clear").props.onClick();
    page.render();
    expect(text(page.tree)).toContain("No downloaded songs");
    find(page.tree, (node) => node.props.message === "1 download cleared").props.onAction();
    page.render();
    expect(text(page.tree)).toContain("Downloaded track");
    expect(nodes(page.tree).some((node) => node.props.message === "1 download cleared")).toBe(false);
  });

  it("still protects online saved songs from signed-out access", async () => {
    const h = harness([], "saved");
    h.auth.user = null;
    const wrapper = h.mount(h.load("app/library/page.js"));
    const page = h.mount(wrapper.tree.props.children.type);
    expect(text(page.tree)).toContain("Sign in to see your library");
  });
});

function keyEvent(key: string, target: any, currentTarget: any) {
  return { key, target, currentTarget, preventDefault: vi.fn(), stopPropagation: vi.fn() };
}

async function keyboardRow(kind: string) {
  const songs = [fixture("song")];
  const h = harness(songs, kind === "library downloads" ? "saved" : "top");
  // The downloads hero renders above every tab; emptying it lets the
  // "library top" case find its own tab's row instead of the hero's.
  if (kind === "library top") h.localSongs.songs = [];
  let page;
  if (kind === "SongItem") {
    page = h.mount(h.load("app/components/SongItem.jsx"), { song: songs[0], onClick: h.setActiveSong, saved: false });
  } else if (kind === "SongRow") {
    const catalogue = h.mount(h.load("app/songs/songs-view.js"));
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
  // SongRow is not in this list any more: it no longer has a row-level key
  // handler to hijack anything (see "songs row is a container, not a button").
  it.each(["SongItem", "library top", "library downloads", "downloads"])("activates only a directly focused %s", async (kind) => {
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

  it("preserves nested menu and playlist input behavior in SongItem", async () => {
    const { h, page, row } = await keyboardRow("SongItem");
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

// The songs-page row used to be one `role="button"` div holding the category chip
// and the ⋯ menu inside it — invalid, and announced as a single control whose name
// was the entire line. It is a container now, with a real button doing the playing.
const playControl = (tree: Element) =>
  find(tree, (node) => node.type === "button" && /^Play(ing)?: /.test(String(node.props["aria-label"] || "")));
const interactive = (tree: any) =>
  nodes(tree).filter((node) => node !== tree && ["button", "input", "a"].includes(node.type));

describe("songs row is a container, not a button", () => {
  it("plays through a real button and keeps nothing clickable inside it", async () => {
    const { h, page } = await keyboardRow("SongRow");
    expect(nodes(page.tree).some((node) => node.props.role === "button")).toBe(false);
    expect(interactive(playControl(page.tree))).toEqual([]);
    expect(interactive(page.tree).length).toBeGreaterThan(1);
    // The row's own tap area comes from the stretched layer, not from a click
    // handler on a div, so the whole strip still plays without a second control.
    expect(playControl(page.tree).props.className).toMatch(/after:absolute after:inset-0/);
    playControl(page.tree).props.onClick();
    expect(h.setActiveSong).toHaveBeenCalledOnce();
  });

  it("names the control after what it does, and marks the row that is playing", async () => {
    const h = harness([fixture("song")]);
    const catalogue = h.mount(h.load("app/songs/songs-view.js"));
    const row = songRows(catalogue.tree)[0];
    expect(playControl(h.mount(row.type, row.props).tree).props["aria-current"]).toBeUndefined();

    const playing = h.mount(row.type, { ...row.props, isActive: true });
    expect(playControl(playing.tree).props["aria-label"]).toBe("Playing: song");
    expect(playControl(playing.tree).props["aria-current"]).toBe("true");
  });

  it("opens the ⋯ as an expanded menu of items", async () => {
    const { page } = await keyboardRow("SongRow");
    const trigger = find(page.tree, (node) => node.type === "button" && node.props.title === "More");
    expect(trigger.props["aria-haspopup"]).toBe("menu");
    expect(trigger.props["aria-expanded"]).toBe(false);
    expect(trigger.props["aria-controls"]).toBeUndefined();

    trigger.props.onClick({ stopPropagation: vi.fn() });
    page.render();
    const open = find(page.tree, (node) => node.type === "button" && node.props.title === "More");
    expect(open.props["aria-expanded"]).toBe(true);
    expect(open.props["aria-controls"]).toBe("song-menu-song");
    const menu = find(page.tree, (node) => node.props.role === "menu");
    expect(menu.props["aria-label"]).toBe("More actions for song");
    expect(nodes(menu).filter((node) => node.props.role === "menuitem")).toHaveLength(6);
  });

  it("still creates a playlist from the row menu", async () => {
    const { h, page } = await keyboardRow("SongRow");
    find(page.tree, (node) => node.type === "button" && node.props.title === "More")
      .props.onClick({ stopPropagation: vi.fn() });
    page.render();
    button(page.tree, "Add to Playlist").props.onClick();
    page.render();
    const input = () => find(page.tree, (node) => node.props.placeholder === "New playlist...");
    change(input(), "Sunday songs");
    page.render();
    await input().props.onKeyDown({ key: "Enter", stopPropagation: vi.fn() });
    expect(h.setActiveSong).not.toHaveBeenCalled();
    expect(h.fetch).toHaveBeenCalledWith("/api/data/playlists", expect.objectContaining({
      method: "POST", body: JSON.stringify({ name: "Sunday songs", user_id: "user" }),
    }));
  });
});
