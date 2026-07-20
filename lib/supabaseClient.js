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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});
