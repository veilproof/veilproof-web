import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import base from "./vite.config.ts";

// The production build with one difference: the wallet is a test signer. Keeping
// it behind a separate config means it cannot reach what gets deployed.
const fakeWallet = fileURLToPath(new URL("./e2e/wallet.ts", import.meta.url));

export default mergeConfig(base, {
  build: { outDir: "dist-e2e" },
  plugins: [
    {
      name: "veilproof-e2e-wallet",
      enforce: "pre",
      resolveId(source: string) {
        return /(^|\/)(chain\/)?wallet$/.test(source) ? fakeWallet : null;
      },
    },
  ],
});
