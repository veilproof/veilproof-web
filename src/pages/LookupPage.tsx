import { useState } from "react";
import type { ChainReader } from "../chain/reads";

type State = "idle" | "loading" | "done" | "error";

export function LookupPage({ reader }: { reader: ChainReader }) {
  const [holder, setHolder] = useState("");
  const [credential, setCredential] = useState("");
  const [state, setState] = useState<State>("idle");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      setVerified(await reader.isVerified(holder.trim(), credential.trim()));
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  return (
    <div className="page">
      <h1>Verification lookup</h1>
      <p className="muted">
        Check whether an address is verified for a credential. This reads{" "}
        <strong>directly from the contract</strong> over RPC — not from the veilproof-server backend
        — so the answer does not depend on trusting the API.
      </p>

      <form onSubmit={check} className="stack">
        <label>
          Address
          <input
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="G… or C…"
            required
          />
        </label>
        <label>
          Credential
          <input
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="e.g. kyc"
            required
          />
        </label>
        <button type="submit" disabled={state === "loading"}>
          {state === "loading" ? "Checking chain…" : "Check on-chain status"}
        </button>
      </form>

      {state === "done" ? (
        <div className={verified ? "result ok" : "result no"}>
          {verified ? "✓ Verified" : "Not verified"}
          <div className="muted small">Read from the contract at ledger time via Soroban RPC.</div>
        </div>
      ) : null}
      {state === "error" ? <div className="error">{error}</div> : null}
    </div>
  );
}
