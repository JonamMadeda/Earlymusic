import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthHookHarness, authReact, deferred, loadAuthModule } from "./authRegressionHarness";
import { clearPendingDownloadClears, stageClearDownloads, undoClearDownloads } from "../lib/downloadManager";

const { AuthProvider } = loadAuthModule(new URL("../app/context/AuthContext.js", import.meta.url), {
  react: authReact,
  "@/lib/downloadManager": { clearPendingDownloadClears },
});
// The real cleaner runs against the stubbed localStorage so sign-out tests
// exercise the actual pending-clear invalidation, not a spy.
const A = { id: "a", email: "a@example.test" };
const B = { id: "b", email: "b@example.test" };
const reply = (body: any, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const privateKeys = ["lumbo_recently_played", "lumbo_has_played", "lumbo_playback_position", "lumbo_downloaded_songs"];

let frame: AuthHookHarness;
let serverUser: typeof A | null;
let storage: Map<string, string>;
let buckets: Map<string, Map<string, string>>;
let fetchMock: ReturnType<typeof vi.fn>;
let cacheStorage: any;
let windowTarget: EventTarget;
let workerMessage: ReturnType<typeof vi.fn>;

function defaultFetch(url: string, options: any = {}) {
  if (url === "/api/auth/me") return Promise.resolve(reply({ user: serverUser }, serverUser ? 200 : 401));
  if (url === "/api/auth/login" || url === "/api/auth/register") {
    serverUser = JSON.parse(options.body).email === A.email ? A : B;
    return Promise.resolve(reply({ user: serverUser }));
  }
  if (url === "/api/auth/signout" || url === "/api/auth/signout-all") {
    serverUser = null;
    return Promise.resolve(reply({ success: true }));
  }
  if (url.startsWith("/api/admin/check-role")) return Promise.resolve(reply({ admin: url.endsWith("=a") }));
  if (url.startsWith("/api/profiles/")) return Promise.resolve(reply({ first_name: url.split("/").pop(), last_name: "Profile" }));
  throw new Error(`Unexpected auth request: ${url}`);
}

beforeEach(() => {
  serverUser = A;
  storage = new Map();
  buckets = new Map();
  cacheStorage = {
    delete: vi.fn(async (name: string) => buckets.delete(name)),
    keys: vi.fn(async () => [...buckets.keys()]),
    open: vi.fn(async (name: string) => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const entries = buckets.get(name)!;
      return {
        keys: async () => [...entries.keys()].map((url) => ({ url })),
        delete: async (request: { url: string }) => entries.delete(request.url),
      };
    }),
  };
  windowTarget = Object.assign(new EventTarget(), { caches: cacheStorage });
  workerMessage = vi.fn();
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage: workerMessage } } });
  vi.stubGlobal("caches", cacheStorage);
  vi.stubGlobal("CustomEvent", class extends Event { constructor(type: string) { super(type); } });
  vi.stubGlobal("BroadcastChannel", class { postMessage() {} close() {} });
  vi.stubGlobal("localStorage", {
    get length() { return storage.size; },
    key: (index: number) => [...storage.keys()][index] ?? null,
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  fetchMock = vi.fn(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  frame?.unmount();
  vi.unstubAllGlobals();
});

const state = () => {
  if (frame.dirty) frame.render();
  return frame.output.props.value;
};
const mount = async () => {
  frame = new AuthHookHarness(AuthProvider);
  frame.render();
  await frame.flush();
};
const signInB = async () => {
  const result = await state().signIn(B.email, "test-password");
  await frame.flush();
  expect(result.error).toBeNull();
};
const seedPrivate = (account = "a") => {
  privateKeys.forEach((key) => storage.set(key, account));
  storage.set("theme", "dark");
  buckets.set("lumbo-audio-cache-v1", new Map([["https://app.test/audio/song", account]]));
  buckets.set("app-shell", new Map([["https://app.test/api/library", account], ["https://app.test/icon.png", "public"]]));
};
const expectCleared = () => {
  expect(state().user).toBeNull();
  expect(state().profile).toBeNull();
  expect(state().isAdmin).toBe(false);
  privateKeys.forEach((key) => expect(storage.has(key)).toBe(false));
  expect(storage.get("theme")).toBe("dark");
  expect(buckets.has("lumbo-audio-cache-v1")).toBe(false);
  expect(buckets.get("app-shell")?.has("https://app.test/api/library")).toBe(false);
  expect(buckets.get("app-shell")?.get("https://app.test/icon.png")).toBe("public");
};

describe("confirmed auth invalidation", () => {
  it.each(["refresh", "global event"])("clears private history, downloads and caches on %s 401", async (source) => {
    await mount();
    seedPrivate();
    const downloadsChanged = vi.fn();
    const signedOut = vi.fn();
    windowTarget.addEventListener("downloads:changed", downloadsChanged);
    windowTarget.addEventListener("auth:signed-out", signedOut);
    serverUser = null;
    if (source === "refresh") await state().refreshUser();
    else windowTarget.dispatchEvent(new Event("auth:unauthorized"));
    await frame.flush();
    expectCleared();
    expect(state().sessionExpired).toBe(true);
    expect(downloadsChanged).toHaveBeenCalledTimes(1);
    expect(signedOut).toHaveBeenCalledTimes(1);
  });

  it("also cleans old private data when bootstrap confirms no session", async () => {
    serverUser = null;
    seedPrivate();
    await mount();
    expectCleared();
    expect(state().loading).toBe(false);
    expect(state().roleLoading).toBe(false);
    expect(state().sessionExpired).toBe(false);
  });

  it.each(["network", "server"])("preserves identity and private data on a %s refresh failure", async (failure) => {
    await mount();
    seedPrivate();
    if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("offline"));
    else fetchMock.mockResolvedValueOnce(reply({}, 503));
    expect(await state().refreshUser()).toBeNull();
    await frame.flush();
    expect(state().user).toEqual(A);
    expect(state().isAdmin).toBe(true);
    expect(storage.get("lumbo_downloaded_songs")).toBe("a");
    expect(cacheStorage.delete).not.toHaveBeenCalled();
  });

  it("does not treat an old global 401 as proof that the new session is gone", async () => {
    await mount();
    await signInB();
    seedPrivate("b");
    cacheStorage.delete.mockClear();
    windowTarget.dispatchEvent(new Event("auth:unauthorized"));
    await frame.flush();
    expect(state().user).toEqual(B);
    expect(state().sessionExpired).toBe(false);
    expect(storage.get("lumbo_downloaded_songs")).toBe("b");
    expect(cacheStorage.delete).not.toHaveBeenCalled();
  });

  it("waits for the entire old cleanup before signing in or exposing a new account", async () => {
    await mount();
    seedPrivate();
    const audioDeletion = deferred();
    const cacheEnumeration = deferred<string[]>();
    cacheStorage.delete.mockImplementationOnce(async (name: string) => {
      await audioDeletion.promise;
      return buckets.delete(name);
    });
    cacheStorage.keys.mockReturnValueOnce(cacheEnumeration.promise);
    serverUser = null;
    const invalidation = state().refreshUser();
    await frame.flush();
    const login = state().signIn(B.email, "test-password");
    await frame.flush();
    expect(state().user).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/auth/login")).toBe(false);
    audioDeletion.resolve(undefined);
    await frame.flush();
    expect(state().user).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/auth/login")).toBe(false);
    cacheEnumeration.resolve(["app-shell"]);
    await invalidation;
    expect((await login).error).toBeNull();
    await frame.flush();
    expect(state().user).toEqual(B);
    seedPrivate("b");
    await frame.flush();
    expect(storage.get("lumbo_downloaded_songs")).toBe("b");
    expect(buckets.get("app-shell")?.get("https://app.test/api/library")).toBe("b");
    expect(buckets.get("lumbo-audio-cache-v1")?.get("https://app.test/audio/song")).toBe("b");
    expect(workerMessage).not.toHaveBeenCalled();
  });

  it("keeps the existing identity/data when signout-all returns an error", async () => {
    await mount();
    seedPrivate();
    fetchMock.mockResolvedValueOnce(reply({}, 500));
    expect((await state().signOut({ everywhere: true })).error).toBeTruthy();
    expect(state().user).toEqual(A);
    expect(storage.get("lumbo_recently_played")).toBe("a");
    expect(cacheStorage.delete).not.toHaveBeenCalled();
  });

  it("treats a signout 401 as successful invalidation and cleans private data", async () => {
    await mount();
    seedPrivate();
    fetchMock.mockResolvedValueOnce(reply({}, 401));
    expect((await state().signOut()).error).toBeNull();
    await frame.flush();
    expectCleared();
  });

  it("invalidates a staged download clear on sign-out so undo cannot restore it", async () => {
    await mount();
    storage.set("lumbo_downloaded_songs", JSON.stringify([
      { id: "s1", title: "Song", author: "Artist", song_path: "/audio/s1.mp3" },
    ]));
    const snapshot = stageClearDownloads();
    expect((await state().signOut()).error).toBeNull();
    await frame.flush();
    expect(storage.has(snapshot.id)).toBe(false);
    expect(undoClearDownloads(snapshot)).toBe(false);
    expect(storage.has("lumbo_downloaded_songs")).toBe(false);
  });
});

describe("auth transition races", () => {
  it.each([200, 401])("ignores an old refresh %s after signout and a new sign-in", async (status) => {
    await mount();
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    const refresh = state().refreshUser();
    await state().signOut();
    await frame.flush();
    await signInB();
    seedPrivate("b");
    response.resolve(reply({ user: A }, status));
    expect(await refresh).toBeNull();
    await frame.flush();
    expect(state().user).toEqual(B);
    expect(state().isAdmin).toBe(false);
    expect(state().profile.first_name).toBe("b");
    expect(state().sessionExpired).toBe(false);
    expect(storage.get("lumbo_downloaded_songs")).toBe("b");
  });

  it("does not resurrect a signed-out identity when refresh JSON arrives late", async () => {
    await mount();
    const body = deferred();
    fetchMock.mockResolvedValueOnce({ ...reply({}), json: () => body.promise });
    const refresh = state().refreshUser();
    await frame.flush();
    await state().signOut();
    body.resolve({ user: A });
    expect(await refresh).toBeNull();
    await frame.flush();
    expect(state().user).toBeNull();
    expect(state().isAdmin).toBe(false);
  });

  it("does not start a refresh while signout is in flight", async () => {
    await mount();
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    const signout = state().signOut();
    const calls = fetchMock.mock.calls.length;
    expect(await state().refreshUser()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    response.resolve(reply({ success: true }));
    expect((await signout).error).toBeNull();
    expect(state().user).toBeNull();
  });

  it.each([200, 401, 503])("ignores a stale bootstrap %s after a new sign-in", async (status) => {
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    await mount();
    await signInB();
    seedPrivate("b");
    response.resolve(reply({ user: A }, status));
    await frame.flush();
    expect(state().user).toEqual(B);
    expect(state().isAdmin).toBe(false);
    expect(state().loading).toBe(false);
    expect(state().roleLoading).toBe(false);
    expect(state().authError).toBeNull();
    expect(storage.get("lumbo_downloaded_songs")).toBe("b");
  });

  it.each([200, 401])("ignores a prior account's late role %s and profile results", async (status) => {
    const role = deferred();
    const profile = deferred();
    fetchMock.mockImplementation((url, options) => {
      if (url === "/api/admin/check-role?userId=a") return role.promise;
      if (url === "/api/profiles/a") return profile.promise;
      return defaultFetch(url, options);
    });
    await mount();
    await signInB();
    const calls = fetchMock.mock.calls.length;
    role.resolve(reply({ admin: true }, status));
    profile.resolve(reply({ first_name: "Old account" }));
    await frame.flush();
    expect(state().user).toEqual(B);
    expect(state().isAdmin).toBe(false);
    expect(state().profile.first_name).toBe("b");
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it("does not commit an old profile edit after an account change", async () => {
    await mount();
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    const update = state().updateProfile({ first_name: "Old edit", last_name: "A" });
    await signInB();
    response.resolve(reply({}));
    expect((await update).error).toBeTruthy();
    expect(state().profile.first_name).toBe("b");
  });

  it("does not commit an old sign-in result after signout", async () => {
    await mount();
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    const login = state().signIn(B.email, "test-password");
    await frame.flush();
    await state().signOut();
    response.resolve(reply({ user: B }));
    expect((await login).error).toBeTruthy();
    await frame.flush();
    expect(state().user).toBeNull();
  });

  it("ignores pending bootstrap work after unmount", async () => {
    const response = deferred();
    fetchMock.mockReturnValueOnce(response.promise);
    await mount();
    frame.unmount();
    response.resolve(reply({ user: A }));
    await frame.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
