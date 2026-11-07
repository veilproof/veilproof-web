// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ProverModule, randomSeed } from "../src/prover/module";
import lock from "../prover.lock.json";

// These run the real WebAssembly and the real keys from public/prover. Vectors
// come from the veilproof-commit CLI in veilproof-server: a commitment that
// differs from it would surface much later as a proof nobody can produce.
const SECRET_7 = "07".padStart(64, "0");
const COMMITMENT_7 = "2638fc9895bccfff80310d2912ac6763a6eaac711baea3b98a0bb366776c3741";
const HOLDER = "GBYNOOC3UUF2QBCNIRUEHK2J3JOCDSV2QTLG445GW5ZEENPYDSU33OFQ";

const read = (name: string) => new Uint8Array(readFileSync(`public/prover/${name}`));

describe("the WebAssembly prover", () => {
  let prover: ProverModule;

  beforeAll(async () => {
    prover = await ProverModule.load(read("veilproof_prover.wasm") as BufferSource);
  });

  it("derives the same commitment as the CLI", () => {
    expect(prover.commitment(SECRET_7)).toBe(COMMITMENT_7);
  });

  it("mints a fresh secret each time, whose commitment checks out", () => {
    const first = prover.newSecret();
    const second = prover.newSecret();
    expect(first.secret).not.toBe(second.secret);
    expect(prover.commitment(first.secret)).toBe(first.commitment);
    expect(first.secret).not.toBe(first.commitment);
  });

  it("gets its seeds from a secure source, at full length", () => {
    expect(randomSeed()).toMatch(/^[0-9a-f]{64}$/);
    expect(randomSeed()).not.toBe(randomSeed());
  });

  it("reports bad input rather than guessing", () => {
    expect(() => prover.commitment("xyz")).toThrow(/64 characters/);
    expect(() => prover.commitment("f".repeat(64))).toThrow(/not a valid field element/);
  });

  it("needs the keys before it can prove", () => {
    expect(prover.hasKeys).toBe(false);
    expect(() => prover.prove([COMMITMENT_7], SECRET_7, HOLDER)).toThrow(/not loaded/);
  });

  it("refuses keys from a different setup", async () => {
    const fresh = await ProverModule.load(read("veilproof_prover.wasm") as BufferSource);
    expect(() => fresh.loadKeys(read("pk.bin"), read("vk.bin"), "00".repeat(32))).toThrow(
      /not the expected setup/,
    );
    expect(fresh.hasKeys).toBe(false);
  });

  it("proves membership against the tree's root, only for a member", () => {
    prover.loadKeys(read("pk.bin"), read("vk.bin"), lock.vkSha256);

    const leaves = ["01".padStart(64, "0"), COMMITMENT_7];
    const proved = prover.prove(leaves, SECRET_7, HOLDER);

    expect(proved.root).toBe(prover.root(leaves));
    expect(proved.nullifier).toMatch(/^[0-9a-f]{64}$/);
    expect(proved.proof.a).toHaveLength(128);
    expect(proved.proof.b).toHaveLength(256);
    expect(proved.proof.c).toHaveLength(128);

    expect(() => prover.prove(leaves, "08".padStart(64, "0"), HOLDER)).toThrow(/not in the tree/);
  });
});
