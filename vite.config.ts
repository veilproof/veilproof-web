/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VEILPROOF_* env vars are exposed to the client via this prefix, so the app
// never needs secrets — only public config (API URL, contract id, RPC).
export default defineConfig({
  plugins: [react()],
  envPrefix: "VEILPROOF_",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
