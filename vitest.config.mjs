import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The app imports modules through the "@/..." tsconfig alias. Vitest does not
// pick that up on its own, so resolve it here to let tests import the same
// server-only modules the API routes use.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
