import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const requestTimeoutMs = 10_000;

const fetchWithTimeout = async (input, init = {}) => {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  const timeout = setTimeout(abortRequest, requestTimeoutMs);

  init.signal?.addEventListener("abort", abortRequest, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortRequest);
  }
};

// Prevent Navigator LockManager timeout in dev (HMR / multiple tabs)
// Supabase uses navigator.locks for auth token refresh; fallback to no-op lock avoids
// "Acquiring an exclusive Navigator LockManager lock ... immediately failed"
const noOpLock = async (_name, _acquireTimeout, fn) => await fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: noOpLock,
  },
  global: { fetch: fetchWithTimeout },
});
