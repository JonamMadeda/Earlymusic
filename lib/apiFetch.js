// Thin authenticated fetch wrapper. Auth rides on an HttpOnly cookie, so
// there is no token to attach here — same-origin requests just work.
export async function apiFetch(path, options = {}) {
  const headers = { ...options.headers };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    const isAuthAttempt =
      path.startsWith("/api/auth/login") ||
      path.startsWith("/api/auth/register") ||
      path.startsWith("/api/auth/me");

    // Token expired/revoked: let the AuthProvider sign out globally so
    // the app never sits half-logged-in with failing requests.
    if (!isAuthAttempt && res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    const err = new Error(error.error || `HTTP ${res.status}`);
    err.status = res.status;
    if (res.headers.has("Retry-After")) {
      err.retryAfter = parseInt(res.headers.get("Retry-After") || "0", 10);
    }
    throw err;
  }
  return res.json();
}
