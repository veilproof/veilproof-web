import { useState } from "react";
import type { ApiClient, ProveResult } from "../api/client";
import type { Config } from "../config";
import { submitVerifyCredential } from "../chain/submit";
import { TrustNotice } from "../components/TrustNotice";

export function HolderPage({
  config,
  api,
  address,
}: {
  config: Config;
  api: ApiClient;
  address: string | null;
}) {
  const [credential, setCredential] = useState("");
  const [secret, setSecret] = useState("");
  const [proof, setProof] = useState<ProveResult | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "proving" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setBusy("proving");
    setError(null);
    setTxHash(null);
    try {
      setProof(await api.prove(credential.trim(), secret.trim(), address));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("idle");
    }
  }

  async function submit() {
    if (!address || !proof) return;
    setBusy("submitting");
    setError(null);
    try {
      const hash = await submitVerifyCredential(config, {
        holder: address,
        credential: credential.trim(),
        proof: proof.proof,
        nullifier: proof.nullifier,
      });
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="page">
      <h1>Prove membership</h1>
      {!address ? (
        <p className="muted">Connect a wallet above to prove and submit.</p>
      ) : (
        <>
          <form onSubmit={generate} className="stack">
            <label>
              Credential
              <input
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="e.g. kyc"
                required
              />
            </label>
            <label>
              Your secret (hex)
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="the secret behind your leaf commitment"
                required
              />
            </label>
            <p className="muted small">
              Your secret is sent to veilproof-server to generate the proof. It is used transiently
              and not stored, but you are trusting the server not to log it. It is bound to your
              connected address <code>{address.slice(0, 6)}…</code>, so the proof only works from
              this address.
            </p>
            <button type="submit" disabled={busy !== "idle"}>
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
              Submitted. Transaction: <span className="mono small">{txHash}</span>
              <div className="muted small">
                Your address is now verified for this credential — check it on the Lookup tab, which
                reads the chain directly.
              </div>
            </div>
          ) : null}

          {error ? <div className="error">{error}</div> : null}
        </>
      )}

      <TrustNotice />
    </div>
  );
}
