import { useState } from "react";
import { txUrl } from "../chain/network";

/** The evidence that a submission worked: an explorer link and a one-step copy. */
export function TxLink({ hash, networkPassphrase }: { hash: string; networkPassphrase: string }) {
  const [copied, setCopied] = useState(false);
  const url = txUrl(networkPassphrase, hash);

  async function copy() {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
  }

  return (
    <div className="tx">
      <span className="mono small">{hash}</span>
      <div className="row">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            View on Stellar Expert
          </a>
        ) : null}
        <button type="button" className="link" onClick={copy}>
          {copied ? "Copied" : "Copy hash"}
        </button>
      </div>
    </div>
  );
}
