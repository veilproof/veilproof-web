import { useEffect, useState, type ChangeEvent } from "react";
import type { ChainReader } from "../chain/reads";
import type { Config } from "../config";
import type { NewSecret, ProveResult, Prover } from "../prover/client";
import { describeError } from "../chain/errors";
import { submitVerifyCredential } from "../chain/submit";
import { RootStatus } from "../components/RootStatus";
import { TrustNotice } from "../components/TrustNotice";
import { TxLink } from "../components/TxLink";
import { loadTree, parseTree, type TreeFile } from "../tree/treeFile";

export function HolderPage({
  config,
  prover,
  reader,
  address,
}: {
  config: Config;
  prover: Prover;
  reader: ChainReader;
  address: string | null;
}) {
  const [minted, setMinted] = useState<NewSecret | null>(null);
  const [credential, setCredential] = useState("");
  const [secret, setSecret] = useState("");
  const [tree, setTree] = useState<TreeFile | null>(null);
  const [localRoot, setLocalRoot] = useState<string | null>(null);
  const [chainRoot, setChainRoot] = useState<string | null>(null);
  const [proof, setProof] = useState<ProveResult | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "minting" | "loading" | "proving" | "submitting">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tree || tree.leaves.length === 0) {
      setLocalRoot(null);
      return;
    }
    let current = true;
    prover
      .root(tree.leaves)
      .then((root) => {
        if (current) setLocalRoot(root);
      })
      .catch((e: unknown) => {
        if (current) setError(describeError(e));
      });
    return () => {
      current = false;
    };
  }, [tree, prover]);

  async function mint() {
    setBusy("minting");
    setError(null);
    try {
      setMinted(await prover.newSecret());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy("idle");
    }
  }

  async function applyTree(next: TreeFile) {
    setProof(null);
    setTxHash(null);
    setTree(next);
    setChainRoot(await reader.currentRoot(next.credential));
  }

  async function loadSaved() {
    setBusy("loading");
    setError(null);
    try {
      await applyTree(loadTree(config.registryContractId, credential.trim()));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy("idle");
    }
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("loading");
    setError(null);
    try {
      const imported = parseTree(await file.text());
      setCredential(imported.credential);
      await applyTree(imported);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy("idle");
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !tree) return;
    setBusy("proving");
    setError(null);
    setTxHash(null);
    try {
      setProof(await prover.prove(tree.leaves, secret.trim(), address));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy("idle");
    }
  }

  async function submit() {
    if (!address || !proof || !tree) return;
    setBusy("submitting");
    setError(null);
    try {
      const hash = await submitVerifyCredential(config, {
        holder: address,
        credential: tree.credential,
        proof: proof.proof,
        nullifier: proof.nullifier,
      });
      setTxHash(hash);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="page">
      <h1>Prove membership</h1>

      <section className="stack">
        <h2>1. Get a secret</h2>
        <p className="muted small">
          Made here in your browser. Skip this if your issuer has already added your commitment.
        </p>
        <button type="button" onClick={mint} disabled={busy !== "idle"}>
          {busy === "minting" ? "Generating…" : "Generate a secret and commitment"}
        </button>
        {minted ? (
          <div className="stack">
            <div className="secret">
              <strong>Your secret: keep this private</strong>
              <div className="mono small">{minted.secret}</div>
              <div className="small">
                Anyone holding it can prove your membership. Nobody can recover it for you, and this
                page will not remember it.
              </div>
            </div>
            <div className="shareable">
              <strong>Your commitment: give this to the issuer</strong>
              <div className="mono small">{minted.commitment}</div>
              <div className="small">A hash of your secret. It is safe to share.</div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="stack">
        <h2>2. Load the issuer's tree</h2>
        <p className="muted small">
          Your proof is built from the full list of commitments, so nobody learns which one is
          yours. Use the file your issuer gave you, or the copy in this browser if you are the
          issuer.
        </p>
        <div className="row">
          <label className="file">
            Choose a tree file
            <input type="file" accept=".json,application/json" onChange={importFile} />
          </label>
        </div>
        <label>
          Credential
          <input
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="e.g. mycred"
          />
        </label>
        <button
          type="button"
          onClick={loadSaved}
          disabled={busy !== "idle" || credential.trim() === ""}
        >
          {busy === "loading" ? "Reading chain…" : "Use the copy in this browser"}
        </button>
        {tree ? (
          <div className="info stack">
            <div>
              <strong>{tree.credential}</strong>: {tree.leaves.length}{" "}
              {tree.leaves.length === 1 ? "member" : "members"}
            </div>
            <RootStatus localRoot={localRoot} chainRoot={chainRoot} />
          </div>
        ) : null}
      </section>

      <section className="stack">
        <h2>3. Prove and submit</h2>
        {!address ? (
          <p className="muted">Connect a wallet above to prove and submit.</p>
        ) : (
          <>
            <form onSubmit={generate} className="stack">
              <label>
                Your secret (hex)
                <input
                  type="password"
                  autoComplete="off"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="the secret behind your commitment"
                  required
                />
              </label>
              <p className="muted small">
                The proof is generated in this browser, and your secret is not sent anywhere. The
                proof is bound to your connected address <code>{address.slice(0, 6)}…</code>, so it
                only works from this address.
              </p>
              <button type="submit" disabled={busy !== "idle" || !tree}>
                {busy === "proving" ? "Generating proof…" : "Generate proof"}
              </button>
            </form>

            {proof ? (
              <div className="result ok stack">
                <div>Proof generated. Public inputs:</div>
                <div className="mono small">
                  root: {proof.root.slice(0, 16)}…
                  <br />
                  nullifier: {proof.nullifier.slice(0, 16)}…
                </div>
                <button onClick={submit} disabled={busy !== "idle"}>
                  {busy === "submitting"
                    ? "Submitting on-chain…"
                    : "Submit on-chain (verify_credential)"}
                </button>
              </div>
            ) : null}

            {txHash ? (
              <div className="result ok">
                Your address is now verified for this credential. Transaction:
                <TxLink hash={txHash} networkPassphrase={config.networkPassphrase} />
                <div className="muted small">
                  Check it on the Lookup tab, which reads the chain directly.
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {error ? <div className="error">{error}</div> : null}

      <TrustNotice />
    </div>
  );
}
