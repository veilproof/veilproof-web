// The WebAssembly prover from veilproof-server, wrapped in typed calls. This is
// the same circuit, Merkle tree and encoding the server uses, so nothing about
// the cryptography is reimplemented in TypeScript.

export interface EncodedProof {
  a: string;
  b: string;
  c: string;
}

export interface ProveResult {
  proof: EncodedProof;
  root: string;
  nullifier: string;
}

export interface NewSecret {
  secret: string;
  commitment: string;
}

interface ProverExports {
  memory: WebAssembly.Memory;
  vp_alloc(len: number): number;
  vp_free(ptr: number, len: number): void;
  vp_load_keys(pk: number, pkLen: number, vk: number, vkLen: number): number;
  vp_call(ptr: number, len: number): void;
  vp_result_ptr(): number;
  vp_result_len(): number;
}

/** 32 random bytes as hex, from the platform's secure source. */
export function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class ProverModule {
  private keysLoaded = false;

  private constructor(private readonly vp: ProverExports) {}

  static async load(wasm: BufferSource): Promise<ProverModule> {
    const { instance } = await WebAssembly.instantiate(wasm, {});
    return new ProverModule(instance.exports as unknown as ProverExports);
  }

  /** Copy bytes into the module's memory. The caller owns the allocation. */
  private put(data: Uint8Array): number {
    const ptr = this.vp.vp_alloc(data.length);
    new Uint8Array(this.vp.memory.buffer, ptr, data.length).set(data);
    return ptr;
  }

  private call<T>(request: object): T {
    const input = new TextEncoder().encode(JSON.stringify(request));
    const ptr = this.put(input);
    try {
      this.vp.vp_call(ptr, input.length);
    } finally {
      // The request can hold the holder's secret, so don't leave it in memory.
      new Uint8Array(this.vp.memory.buffer, ptr, input.length).fill(0);
      this.vp.vp_free(ptr, input.length);
    }
    const output = new Uint8Array(
      this.vp.memory.buffer,
      this.vp.vp_result_ptr(),
      this.vp.vp_result_len(),
    );
    const answer = JSON.parse(new TextDecoder().decode(output)) as T & { error?: string };
    if (answer.error) throw new Error(answer.error);
    return answer;
  }

  get hasKeys(): boolean {
    return this.keysLoaded;
  }

  /**
   * Load the trusted setup, refusing keys whose verifying key does not match
   * `expectedVkSha256`. Proofs from any other setup would be rejected on-chain.
   */
  loadKeys(pk: Uint8Array, vk: Uint8Array, expectedVkSha256: string): void {
    const pkPtr = this.put(pk);
    const vkPtr = this.put(vk);
    const ok = this.vp.vp_load_keys(pkPtr, pk.length, vkPtr, vk.length);
    this.vp.vp_free(pkPtr, pk.length);
    this.vp.vp_free(vkPtr, vk.length);
    if (ok !== 1) throw new Error("The proving keys could not be read.");

    const { digest } = this.call<{ digest: string }>({ op: "vk_digest" });
    if (digest !== expectedVkSha256) {
      throw new Error(`These proving keys are not the expected setup (digest ${digest}).`);
    }
    this.keysLoaded = true;
  }

  newSecret(): NewSecret {
    return this.call({ op: "new_secret", seed: randomSeed() });
  }

  commitment(secret: string): string {
    return this.call<{ commitment: string }>({ op: "commitment", secret }).commitment;
  }

  root(leaves: string[]): string {
    return this.call<{ root: string }>({ op: "root", leaves }).root;
  }

  prove(leaves: string[], secret: string, holder: string): ProveResult {
    return this.call({ op: "prove", leaves, secret, holder, seed: randomSeed() });
  }
}
