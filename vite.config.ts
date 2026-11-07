/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VEILPROOF_* env vars are exposed to the client via this prefix, so the app
// never needs secrets — only public config (API URL, contract id, RPC).
export default defineConfig({
  plugins: [react()],
  envPrefix: "VEILPROOF_",
  // GitHub Pages serves a project site from a subpath, set by the deploy workflow.
  base: process.env.VEILPROOF_BASE ?? "/",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
