// Stands in for src/chain/wallet.ts in the end-to-end build only, signing with a
// throwaway testnet key, because a browser extension can't be driven from a test.
// vite.e2e.config.ts is the only thing that resolves to this file.

import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

declare global {
  interface Window {
    __E2E_SIGNER__: string;
  }
}

const signer = () => Keypair.fromSecret(window.__E2E_SIGNER__);

export async function connectWallet(): Promise<string> {
  return signer().publicKey();
}

export async function currentAddress(): Promise<string | null> {
  return signer().publicKey();
}

export async function walletNetworkWarning(): Promise<string | null> {
  return null;
}

export async function signTransaction(
  xdrString: string,
  _address: string,
  networkPassphrase: string,
): Promise<string> {
  const tx = TransactionBuilder.fromXDR(xdrString, networkPassphrase);
  tx.sign(signer());
  return tx.toXDR();
}

export async function disconnectWallet(): Promise<void> {}
