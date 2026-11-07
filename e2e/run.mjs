// Follow the Start page's own instructions in a real browser, against the real
// testnet contract, on the build served under the same subpath as GitHub Pages.
// Only the wallet is replaced: see e2e/wallet.ts.
//
//   npm run e2e
//
// The check that matters most is at the end: every request the page made is
// recorded, and the run fails if the holder's secret appears in any of them. That
// is the claim on the Prove tab, tested rather than asserted.
//
// CHROME_CHANNEL picks the installed browser (default "chrome"). SCREENSHOTS names a
// directory to refresh the README's screenshots into.

import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { Keypair } from "@stellar/stellar-sdk";
import { chromium } from "playwright-core";
import { build, preview } from "vite";

const BASE = "/veilproof-web/";
const credential = `e2e_${randomBytes(5).toString("hex")}`;
const signer = Keypair.random();

await build({ configFile: "vite.e2e.config.ts", base: BASE, logLevel: "warn" });
const server = await preview({
  configFile: "vite.e2e.config.ts",
  base: BASE,
  preview: { port: 4179, strictPort: true },
});
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? "chrome" });

const requests = [];
const problems = [];

async function shot(page, name) {
  if (process.env.SCREENSHOTS) {
    await page.screenshot({ path: join(process.env.SCREENSHOTS, `${name}.png`), fullPage: true });
  }
}

try {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  await context.addInitScript((secret) => {
    window.__E2E_SIGNER__ = secret;
  }, signer.secret());

  // Workers included: the secret is handed to one, and it does the fetching there.
  context.on("request", (request) => {
    requests.push({ url: request.url(), body: request.postData() ?? "" });
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

  const tab = (name) => page.getByRole("button", { name, exact: true }).click();
  const expectNoError = async () => {
    const shown = await page.locator(".page .error").allTextContents();
    assert.deepEqual(shown, [], "the page is showing an error");
  };

  // --- 1. Connect and fund ----------------------------------------------------
  await page.goto(`http://localhost:4179${BASE}`);
  await page.getByRole("heading", { name: /prove you belong/i }).waitFor();
  await shot(page, "start");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("button", { name: "Get test XLM" }).click();
  await page.getByRole("button", { name: "Funded" }).waitFor({ timeout: 60_000 });
  console.log(`funded ${signer.publicKey()}`);

  // --- 2. A holder mints a secret ---------------------------------------------
  await tab("Prove");
  await page.getByRole("button", { name: /generate a secret/i }).click();
  const secret = await page.locator(".secret .mono").innerText({ timeout: 30_000 });
  const commitment = await page.locator(".shareable .mono").innerText();
  assert.match(secret, /^[0-9a-f]{64}$/);
  assert.match(commitment, /^[0-9a-f]{64}$/);
  assert.notEqual(secret, commitment);
  console.log("minted a secret in the browser");

  // --- 3. An issuer claims, adds the commitment, and publishes ----------------
  await tab("Issue");
  await page.getByLabel("Credential").fill(credential);
  await page.getByRole("button", { name: "Open credential" }).click();
  const claim = page.getByRole("button", { name: `Claim "${credential}" as issuer` });
  await claim.click({ timeout: 30_000 });
  await page.getByRole("link", { name: /stellar expert/i }).waitFor({ timeout: 90_000 });
  await expectNoError();
  console.log(`claimed ${credential}`);

  await page.getByLabel(/leaf commitment/i).fill(commitment);
  await page.getByRole("button", { name: "Add commitment" }).click();
  await page.getByText(/does not match the root on-chain/).waitFor({ timeout: 30_000 });

  await page.getByRole("button", { name: "Publish current root" }).click();
  await page.getByText(/matches the root on-chain/).waitFor({ timeout: 90_000 });
  await expectNoError();
  await shot(page, "issue");
  console.log("published the root");

  // --- 4. The holder proves and submits ---------------------------------------
  await tab("Prove");
  await page.getByLabel("Credential").fill(credential);
  await page.getByRole("button", { name: /use the copy in this browser/i }).click();
  await page.getByText(/matches the root on-chain/).waitFor({ timeout: 30_000 });

  await page.getByLabel(/your secret \(hex\)/i).fill(secret);
  const started = Date.now();
  await page.getByRole("button", { name: "Generate proof" }).click();
  const submit = page.getByRole("button", { name: /submit on-chain/i });
  await submit.waitFor({ timeout: 120_000 });
  console.log(`proved in ${Date.now() - started} ms, keys included`);
  await expectNoError();

  await submit.click();
  await page.getByText(/now verified for this credential/).waitFor({ timeout: 90_000 });
  await expectNoError();
  await shot(page, "prove");
  const link = await page.getByRole("link", { name: /stellar expert/i }).getAttribute("href");
  console.log(`verified: ${link}`);

  // --- 5. Anyone can read it, straight from the contract ----------------------
  await tab("Lookup");
  await page.getByLabel("Address").fill(signer.publicKey());
  await page.getByLabel("Credential").fill(credential);
  await page.getByRole("button", { name: /check on-chain/i }).click();
  await page.getByText("✓ Verified").waitFor({ timeout: 30_000 });
  await page.getByText(/anyone can claim a credential name/).waitFor();
  await shot(page, "lookup");
  console.log("lookup reads verified");

  // --- 6. A replay is explained, not just refused -----------------------------
  await tab("Prove");
  await page.getByLabel("Credential").fill(credential);
  await page.getByRole("button", { name: /use the copy in this browser/i }).click();
  await page.getByText(/matches the root on-chain/).waitFor({ timeout: 30_000 });
  await page.getByLabel(/your secret \(hex\)/i).fill(secret);
  await page.getByRole("button", { name: "Generate proof" }).click();
  const again = page.getByRole("button", { name: /submit on-chain/i });
  await again.waitFor({ timeout: 120_000 });
  await again.click();
  await page.getByText(/already been used/).waitFor({ timeout: 60_000 });
  console.log("a replay is refused, with an explanation");

  // --- The claim on the Prove tab ---------------------------------------------
  const leaked = requests.filter(({ url, body }) => url.includes(secret) || body.includes(secret));
  assert.deepEqual(leaked, [], "the secret appeared in a network request");

  const hosts = [...new Set(requests.map(({ url }) => new URL(url).host))].sort();
  console.log(`${requests.length} requests, none containing the secret, to: ${hosts.join(", ")}`);
  const expected = ["friendbot.stellar.org", "localhost:4179", "soroban-testnet.stellar.org"];
  assert.deepEqual(hosts, expected, "the page talked to a host it should not need");

  assert.deepEqual(problems, []);
  console.log("end to end: ok");
} finally {
  await browser.close();
  await server.close();
}
