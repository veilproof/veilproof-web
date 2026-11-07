// The app's interface to the prover worker. Pages take a `Prover`, so they can be
// tested without one, and nothing here ever sends a secret off this machine.

import type { NewSecret, ProveResult } from "./module";

export type { EncodedProof, NewSecret, ProveResult } from "./module";

export type ProverRequest =
  | { op: "newSecret" }
  | { op: "commitment"; secret: string }
  | { op: "root"; leaves: string[] }
  | { op: "prove"; leaves: string[]; secret: string; holder: string };

export type ProverResponse = { id: number; result?: unknown; error?: string };

export interface Prover {
  /** Mint a secret and its commitment, locally. */
  newSecret(): Promise<NewSecret>;
  /** The commitment for a secret the holder already has. */
  commitment(secret: string): Promise<string>;
  /** The Merkle root of a list of leaf commitments. */
  root(leaves: string[]): Promise<string>;
  /** A membership proof bound to `holder`. Slow the first time: it loads the keys. */
  prove(leaves: string[], secret: string, holder: string): Promise<ProveResult>;
}

export function makeProver(): Prover {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
  let nextId = 0;

  worker.onmessage = ({ data }: MessageEvent<ProverResponse>) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.error) call.reject(new Error(data.error));
    else call.resolve(data.result);
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "The prover failed to start.");
    for (const call of pending.values()) call.reject(error);
    pending.clear();
  };

  function send<T>(request: ProverRequest): Promise<T> {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ id, request });
    });
  }

  return {
    newSecret: () => send({ op: "newSecret" }),
    commitment: (secret) => send({ op: "commitment", secret }),
    root: (leaves) => send({ op: "root", leaves }),
    prove: (leaves, secret, holder) => send({ op: "prove", leaves, secret, holder }),
  };
}
