import { useState } from "react";
import type { ChainReader } from "../chain/reads";
import { describeError } from "../chain/errors";

type State = "idle" | "loading" | "done" | "error";

export function LookupPage({ reader }: { reader: ChainReader }) {
  const [holder, setHolder] = useState("");
  const [credential, setCredential] = useState("");
  const [state, setState] = useState<State>("idle");
  const [verified, setVerified] = useState(false);
  const [issuer, setIssuer] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      const name = credential.trim();
      const [isVerified, owner, isOpen] = await Promise.all([
        reader.isVerified(holder.trim(), name),
        reader.issuerOf(name),
        reader.openRegistration(),
      ]);
      setVerified(isVerified);
      setIssuer(owner);
      setOpen(isOpen);
      setState("done");
    } catch (err) {
      setError(describeError(err));
      setState("error");
    }
  }

  return (
    <div className="page">
      <h1>Verification lookup</h1>
      <p className="muted">
        Check whether an address is verified for a credential. This reads{" "}
        <strong>directly from the contract</strong> over RPC, so the answer does not depend on
        trusting this site's operator.
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
          <div className="muted small">
            Issuer of this credential: <span className="mono">{issuer ?? "nobody"}</span>
          </div>
          {open ? (
            <div className="muted small">
              This is an open sandbox registry, where anyone can claim a credential name. Here,
              “verified” means only that this address is in the set of whoever claimed it.
            </div>
          ) : null}
        </div>
      ) : null}
      {state === "error" ? <div className="error">{error}</div> : null}
    </div>
  );
}
