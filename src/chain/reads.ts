// Direct, read-only queries against the veilproof-registry contract via Soroban
// RPC. This path is deliberately independent of veilproof-server: the
// verification lookup reads state straight from the chain, so a user is not
// trusting the backend's cache for the answer that matters.

import {
  Account,
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
  BASE_FEE,
} from "@stellar/stellar-sdk";

import type { Config } from "../config";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ChainReader {
  /** On-chain `is_verified(holder, credential)`. */
  isVerified(holder: string, credential: string): Promise<boolean>;
  /** On-chain `current_root(credential)` as hex, or null if none published. */
  currentRoot(credential: string): Promise<string | null>;
}

export function makeChainReader(cfg: Config): ChainReader {
  const server = new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith("http://") });
  const contract = new Contract(cfg.registryContractId);

  // A throwaway source account: a read-only simulation never touches it on
  // chain, so it need not exist or be funded.
  const dummySource = () => new Account(Keypair.random().publicKey(), "0");

  async function simulateRead(method: string, args: xdr.ScVal[]): Promise<xdr.ScVal | undefined> {
    const tx = new TransactionBuilder(dummySource(), {
      fee: BASE_FEE,
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`on-chain read failed: ${sim.error}`);
    }
    return sim.result?.retval;
  }

  return {
    async isVerified(holder, credential) {
      const retval = await simulateRead("is_verified", [
        new Address(holder).toScVal(),
        nativeToScVal(credential, { type: "symbol" }),
      ]);
      return retval ? Boolean(scValToNative(retval)) : false;
    },

    async currentRoot(credential) {
      const retval = await simulateRead("current_root", [
        nativeToScVal(credential, { type: "symbol" }),
      ]);
      if (!retval) return null;
      const value = scValToNative(retval) as Uint8Array | null;
      return value ? bytesToHex(value) : null;
    },
  };
}
