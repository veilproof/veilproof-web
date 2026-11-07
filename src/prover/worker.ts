// Runs the prover off the main thread, since a proof holds the CPU for seconds.
// Its only network traffic is fetching its own static files from this site.

import { ProverModule } from "./module";
import type { ProverRequest, ProverResponse } from "./client";

const asset = (name: string) => `${import.meta.env.BASE_URL}prover/${name}`;

async function fetchBytes(name: string): Promise<Uint8Array> {
  const res = await fetch(asset(name));
  if (!res.ok) throw new Error(`Could not load ${name} (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

let loading: Promise<ProverModule> | null = null;

function moduleOnce(): Promise<ProverModule> {
  loading ??= fetchBytes("veilproof_prover.wasm").then((wasm) =>
    ProverModule.load(wasm as BufferSource),
  );
  return loading;
}

/** The keys are only needed to prove, so holders pay for them only then. */
async function withKeys(): Promise<ProverModule> {
  const prover = await moduleOnce();
  if (!prover.hasKeys) {
    const [pk, vk] = await Promise.all([fetchBytes("pk.bin"), fetchBytes("vk.bin")]);
    prover.loadKeys(pk, vk, import.meta.env.VEILPROOF_VK_SHA256);
  }
  return prover;
}

async function answer(request: ProverRequest): Promise<unknown> {
  switch (request.op) {
    case "newSecret":
      return (await moduleOnce()).newSecret();
    case "commitment":
      return (await moduleOnce()).commitment(request.secret);
    case "root":
      return (await moduleOnce()).root(request.leaves);
    case "prove":
      return (await withKeys()).prove(request.leaves, request.secret, request.holder);
  }
}

self.onmessage = async ({ data }: MessageEvent<{ id: number; request: ProverRequest }>) => {
  let response: ProverResponse;
  try {
    response = { id: data.id, result: await answer(data.request) };
  } catch (e) {
    response = { id: data.id, error: e instanceof Error ? e.message : String(e) };
  }
  self.postMessage(response);
};
