// Building, signing (via the connected wallet), and submitting the two
// on-chain writes the app performs: `verify_credential` (holder) and
// `publish_root` (issuer).
//
// Both use the connected wallet's account as the transaction source, so the
// contract's `require_auth(holder)` / `require_auth(issuer)` is satisfied by
// the source-account signature — no separate auth-entry signing needed.

import {
  Address,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
  BASE_FEE,
} from "@stellar/stellar-sdk";

import type { Config } from "../config";
import type { EncodedProof } from "../api/client";
import { signTransaction } from "./wallet";

function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean, "hex");
}

/** The Groth16 proof as a Soroban struct ScVal (map keyed a, b, c). */
function proofScVal(proof: EncodedProof): xdr.ScVal {
  const entry = (key: string, hex: string) =>
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol(key),
      val: xdr.ScVal.scvBytes(hexToBytes(hex)),
    });
  // Struct map keys must be in lexicographic order: a, b, c.
  return xdr.ScVal.scvMap([entry("a", proof.a), entry("b", proof.b), entry("c", proof.c)]);
}

async function signSendAwait(
  cfg: Config,
  server: rpc.Server,
  source: string,
  operation: xdr.Operation,
): Promise<string> {
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(120)
    .build();

  // Simulate + attach Soroban resources/auth.
  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await signTransaction(prepared.toXDR(), source, cfg.networkPassphrase);
  const signed = TransactionBuilder.fromXDR(signedXdr, cfg.networkPassphrase);

  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(`transaction submission failed: ${JSON.stringify(sent.errorResult)}`);
  }

  // Poll until the transaction lands.
  let result = await server.getTransaction(sent.hash);
  const deadline = Date.now() + 60_000;
  while (result.status === "NOT_FOUND" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await server.getTransaction(sent.hash);
  }
  if (result.status !== "SUCCESS") {
    throw new Error(`transaction did not succeed: ${result.status}`);
  }
  return sent.hash;
}

export interface VerifyCredentialArgs {
  holder: string;
  credential: string;
  proof: EncodedProof;
  nullifier: string;
}

/** Submit `verify_credential`, signed by the holder's connected wallet. */
export async function submitVerifyCredential(
  cfg: Config,
  args: VerifyCredentialArgs,
): Promise<string> {
  const server = new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith("http://") });
  const contract = new Contract(cfg.registryContractId);
  const op = contract.call(
    "verify_credential",
    new Address(args.holder).toScVal(),
    nativeToScVal(args.credential, { type: "symbol" }),
    proofScVal(args.proof),
    xdr.ScVal.scvBytes(hexToBytes(args.nullifier)),
  );
  return signSendAwait(cfg, server, args.holder, op);
}

/** Submit `publish_root`, signed by the issuer's connected wallet. */
export async function submitPublishRoot(
  cfg: Config,
  issuer: string,
  credential: string,
  rootHex: string,
): Promise<string> {
  const server = new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith("http://") });
  const contract = new Contract(cfg.registryContractId);
  const op = contract.call(
    "publish_root",
    new Address(issuer).toScVal(),
    nativeToScVal(credential, { type: "symbol" }),
    xdr.ScVal.scvBytes(hexToBytes(rootHex)),
  );
  return signSendAwait(cfg, server, issuer, op);
}
