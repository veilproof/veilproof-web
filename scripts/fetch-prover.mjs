// Put the prover and the trusted-setup keys into public/prover, each checked
// against the SHA-256 pinned in prover.lock.json. They are served as static files
// next to the app, so proving needs nothing but this site once it has loaded.
//
// To try a prover built locally, point VEILPROOF_PROVER_WASM at the file. That
// skips its pin, and only its pin.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/prover");
const { assets } = JSON.parse(readFileSync(join(root, "prover.lock.json"), "utf8"));

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

mkdirSync(out, { recursive: true });

for (const [name, { url, sha256: expected }] of Object.entries(assets)) {
  const path = join(out, name);

  if (name.endsWith(".wasm") && process.env.VEILPROOF_PROVER_WASM) {
    copyFileSync(process.env.VEILPROOF_PROVER_WASM, path);
    console.warn(`${name}: using ${process.env.VEILPROOF_PROVER_WASM}, not the pinned release`);
    continue;
  }

  if (existsSync(path) && sha256(readFileSync(path)) === expected) continue;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not fetch ${url}: HTTP ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  const actual = sha256(data);
  if (actual !== expected) {
    throw new Error(`${name} does not match its pin: expected ${expected}, got ${actual}`);
  }
  writeFileSync(path, data);
  console.log(`${name}: ${actual}`);
}
