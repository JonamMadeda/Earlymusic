function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth-token");
}

export async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    if (res.status === 401 && typeof window !== "undefined") {
      // Token expired/revoked: let the AuthProvider sign out globally so
      // the app never sits half-logged-in with failing requests.
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    const err = new Error(error.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
