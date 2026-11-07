// What the app knows about Stellar networks, kept in one place: names, the
// explorer for each, and whether the wallet is on the same one as the app.

import { Networks } from "@stellar/stellar-sdk";

const KNOWN: Record<string, { name: string; explorer: string | null }> = {
  [Networks.PUBLIC]: { name: "Mainnet", explorer: "public" },
  [Networks.TESTNET]: { name: "Testnet", explorer: "testnet" },
  [Networks.FUTURENET]: { name: "Futurenet", explorer: null },
};

export function networkName(passphrase: string): string {
  return KNOWN[passphrase]?.name ?? `an unknown network (${passphrase})`;
}

export const isTestnet = (passphrase: string) => passphrase === Networks.TESTNET;

function explorerUrl(passphrase: string, path: string): string | null {
  const explorer = KNOWN[passphrase]?.explorer;
  return explorer ? `https://stellar.expert/explorer/${explorer}/${path}` : null;
}

/** An explorer link for a transaction, or null if this network has none. */
export const txUrl = (passphrase: string, hash: string) => explorerUrl(passphrase, `tx/${hash}`);

/** An explorer link for a contract, or null if this network has none. */
export const contractUrl = (passphrase: string, id: string) =>
  explorerUrl(passphrase, `contract/${id}`);

/** A message naming both networks if the wallet is not on the app's, else null. */
export function networkMismatch(appPassphrase: string, walletPassphrase: string): string | null {
  if (appPassphrase === walletPassphrase) return null;
  return `This app is on ${networkName(appPassphrase)}, but your wallet is on ${networkName(walletPassphrase)}. Switch your wallet to ${networkName(appPassphrase)} before signing.`;
}
