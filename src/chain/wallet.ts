// Wallet connection via Stellar Wallets Kit (Freighter, xBull, and others
// through one interface). The kit is a static singleton in this version, so
// this module wraps it in a few plain functions the UI calls.

import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { networkMismatch } from "./network";

let initialized = false;

function ensureInit(networkPassphrase: string): void {
  if (initialized) return;
  StellarWalletsKit.init({
    // The Networks enum values are the passphrases themselves.
    network: networkPassphrase as Networks,
    modules: [new FreighterModule(), new xBullModule()],
  });
  initialized = true;
}

/** Open the wallet picker, connect, and return the selected address. */
export async function connectWallet(networkPassphrase: string): Promise<string> {
  ensureInit(networkPassphrase);
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

/** The already-connected address, or null. */
export async function currentAddress(networkPassphrase: string): Promise<string | null> {
  ensureInit(networkPassphrase);
  try {
    const { address } = await StellarWalletsKit.getAddress();
    return address || null;
  } catch {
    return null;
  }
}

/**
 * A warning if the wallet is on another network than the app, else null. This
 * asks the wallet what it is actually on, which can differ from what the kit was
 * initialized with. Not every wallet can say, and those get no warning.
 */
export async function walletNetworkWarning(networkPassphrase: string): Promise<string | null> {
  ensureInit(networkPassphrase);
  try {
    const wallet = await StellarWalletsKit.getNetwork();
    return networkMismatch(networkPassphrase, wallet.networkPassphrase);
  } catch {
    return null;
  }
}

/** Sign a transaction XDR with the connected wallet, returning the signed XDR. */
export async function signTransaction(
  xdrString: string,
  address: string,
  networkPassphrase: string,
): Promise<string> {
  ensureInit(networkPassphrase);
  // The last point this can be caught. After signing it would surface as
  // whatever the network says about a transaction meant for somewhere else.
  const warning = await walletNetworkWarning(networkPassphrase);
  if (warning) throw new Error(warning);
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdrString, {
    address,
    networkPassphrase,
  });
  return signedTxXdr;
}

export async function disconnectWallet(): Promise<void> {
  await StellarWalletsKit.disconnect();
}
