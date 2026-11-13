import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthComponentTree, authReact, loadAuthModule } from "./authRegressionHarness";

let params: URLSearchParams;
let tree: AuthComponentTree;
let router: any;
let fetchMock: ReturnType<typeof vi.fn>;
const auth = { user: null, loading: false, signIn: vi.fn(), signUp: vi.fn(), changePassword: vi.fn(), signOut: vi.fn() };
const { default: AuthPage } = loadAuthModule(new URL("../app/auth/page.jsx", import.meta.url), {
  react: authReact,
  "next/navigation": { useRouter: () => router, useSearchParams: () => params },
  "next/link": "a",
  "@/app/context/AuthContext": { useAuth: () => auth },
  "lucide-react": Object.fromEntries(["Mail", "Lock", "Loader", "ArrowLeft", "KeyRound", "Eye", "EyeOff", "ShieldCheck"].map((name) => [name, "svg"])),
});

const navigate = (url: string) => { params = new URL(url, "https://app.test").searchParams; };
const find = (node: any, predicate: (node: any) => boolean): any => {
  if (Array.isArray(node)) {
    for (const child of node) { const match = find(child, predicate); if (match) return match; }
  } else if (node && typeof node === "object") {
    if (predicate(node)) return node;
    return find(node.props?.children, predicate);
  }
};
const element = (predicate: (node: any) => boolean) => {
  const result = find(tree.render(), predicate);
  expect(result).toBeDefined();
  return result;
};
const field = (id: string) => element((node) => node.props?.id === id);
const fill = (id: string, value: string) => field(id).props.onChange({ target: { value } });
const html = () => renderToStaticMarkup(tree.render());

beforeEach(() => {
  navigate("/auth");
  router = { push: vi.fn(navigate), replace: vi.fn(navigate), refresh: vi.fn() };
  auth.signOut.mockReset().mockResolvedValue({ error: null });
  auth.signIn.mockReset().mockResolvedValue({ error: null });
  auth.signUp.mockReset().mockResolvedValue({ error: null });
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
  vi.stubGlobal("fetch", fetchMock);
  tree = new AuthComponentTree(AuthPage);
});
afterEach(() => {
  tree.unmount();
  vi.unstubAllGlobals();
});

describe("auth URL mode navigation", () => {
  it("Go to sign in leaves the signed-out password-change gate and renders a usable login", async () => {
    navigate("/auth?mode=update-password");
    expect(html()).toContain("Sign in to continue");
    element((node) => node.type === "button").props.onClick();
    expect(router.push).toHaveBeenCalledWith("/auth?redirectTo=/account");
    expect(html()).toContain("Welcome back. Pick up where you left off.");
    expect(html()).not.toContain("Update Password");
    expect(field("auth-email").props.type).toBe("email");
    fill("auth-email", "listener@example.test");
    fill("auth-password", "test-password");
    await element((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    expect(auth.signIn).toHaveBeenCalledWith("listener@example.test", "test-password");
    expect(router.push).toHaveBeenLastCalledWith("/account");
  });

  it("preserves local signup/login tab choices and inputs on unchanged mode/token", () => {
    fill("auth-email", "listener@example.test");
    element((node) => node.type === "button" && node.props.children === "Sign Up").props.onClick();
    expect(html()).toContain("Create Account");
    navigate("/auth?redirectTo=/library");
    expect(html()).toContain("Create Account");
    expect(field("auth-email").props.value).toBe("listener@example.test");
    element((node) => node.type === "button" && node.props.children === "Sign In" && node.props.type === "button").props.onClick();
    expect(html()).toContain("Welcome back. Pick up where you left off.");
    expect(field("auth-email").props.value).toBe("listener@example.test");
  });

  it("follows mode changes in both directions without retaining the previous form", () => {
    expect(html()).toContain("Welcome back");
    navigate("/auth?mode=signup");
    expect(html()).toContain("Create Account");
    fill("auth-first-name", "Old name");
    navigate("/auth?mode=forgot");
    expect(html()).toContain("Send Reset Link");
    navigate("/auth");
    expect(html()).toContain("Welcome back");
    expect(html()).not.toContain("Send Reset Link");
  });

  it("resets token-specific fields/errors/success and submits only the current reset token", async () => {
    navigate("/auth?mode=reset&token=first-test-token");
    fill("auth-password", "old-password");
    fill("auth-confirm-password", "mismatch");
    await element((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    expect(html()).toContain("Passwords do not match.");
    navigate("/auth?mode=reset&token=second-test-token");
    expect(html()).not.toContain("Passwords do not match.");
    expect(field("auth-password").props.value).toBe("");
    expect(field("auth-confirm-password").props.value).toBe("");
    fill("auth-password", "new-password");
    fill("auth-confirm-password", "new-password");
    await element((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "second-test-token", password: "new-password" });
    expect(html()).toContain("Password reset</h2>");
    navigate("/auth?mode=reset&token=third-test-token");
    expect(html()).toContain("Choose a New Password");
    expect(field("auth-password").props.value).toBe("");
  });

  it("moves from an incomplete reset link to a forgot-password form", () => {
    navigate("/auth?mode=reset");
    expect(html()).toContain("Reset link incomplete");
    element((node) => node.type === "button").props.onClick();
    expect(html()).toContain("Send Reset Link");
    expect(html()).not.toContain("Reset link incomplete");
  });
});
