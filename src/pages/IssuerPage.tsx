import { useState } from "react";
import type { ApiClient, IssuerInfo } from "../api/client";
import type { Config } from "../config";
import { submitPublishRoot } from "../chain/submit";

export function IssuerPage({
  config,
  api,
  address,
}: {
  config: Config;
  api: ApiClient;
  address: string | null;
}) {
  const [credential, setCredential] = useState("");
  const [commitment, setCommitment] = useState("");
  const [info, setInfo] = useState<IssuerInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "adding" | "loading" | "publishing">("idle");
  const [error, setError] = useState<string | null>(null);

  const cred = () => credential.trim();

  async function refreshInfo() {
    setBusy("loading");
    setError(null);
    try {
      setInfo(await api.issuerInfo(cred()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("idle");
    }
  }

  async function addCommitment(e: React.FormEvent) {
    e.preventDefault();
    setBusy("adding");
    setError(null);
    setMessage(null);
    try {
      const { position, count } = await api.addLeaf(cred(), commitment.trim());
      setMessage(`Added at position ${position}. Tree now has ${count} leaves.`);
      setCommitment("");
      await refreshInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("idle");
    }
  }

  async function publish() {
    if (!address) return;
    setBusy("publishing");
    setError(null);
    setTxHash(null);
    try {
      // The backend recomputes the current root; the issuer's wallet then puts
      // it on-chain. The connected address must be the registered issuer.
      const { root } = await api.publish(cred());
      const hash = await submitPublishRoot(config, address, cred(), root);
      setTxHash(hash);
      await refreshInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="page">
      <h1>Manage a credential tree</h1>
      <p className="muted">
        Add holder commitments (hashes you compute off-chain — never raw identity data), then
        publish the tree&apos;s root on-chain from the issuer wallet.
      </p>

      <form onSubmit={addCommitment} className="stack">
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
          Leaf commitment (hex)
          <input
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder="a hash you computed off-chain"
            required
          />
        </label>
        <div className="row">
          <button type="submit" disabled={busy !== "idle"}>
            {busy === "adding" ? "Adding…" : "Add commitment"}
          </button>
          <button type="button" onClick={refreshInfo} disabled={busy !== "idle" || !cred()}>
            Load tree info
          </button>
        </div>
      </form>

      {message ? <div className="result ok small">{message}</div> : null}

      {info ? (
        <div className="info">
          <div>
            <strong>{info.name}</strong>: {info.leaf_count} / {info.capacity} leaves
          </div>
          <div className="mono small">
            published root:{" "}
            {info.published_root ? `${info.published_root.slice(0, 16)}…` : "none yet"}
          </div>
        </div>
      ) : null}

      <div className="stack">
        <h2>Publish root on-chain</h2>
        {!address ? (
          <p className="muted">Connect the issuer wallet above to publish.</p>
        ) : (
          <button onClick={publish} disabled={busy !== "idle" || !cred()}>
            {busy === "publishing" ? "Publishing…" : "Publish current root"}
          </button>
        )}
        {txHash ? (
          <div className="result ok">
            Root published. Transaction: <span className="mono small">{txHash}</span>
          </div>
        ) : null}
      </div>

      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}
