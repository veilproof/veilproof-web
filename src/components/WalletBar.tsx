import { useEffect, useState } from "react";
import { fundTestnetAccount } from "../chain/friendbot";
import { isTestnet } from "../chain/network";
import { connectWallet, disconnectWallet, walletNetworkWarning } from "../chain/wallet";

function short(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function WalletBar({
  networkPassphrase,
  address,
  onChange,
}: {
  networkPassphrase: string;
  address: string | null;
  onChange: (address: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [funding, setFunding] = useState<"idle" | "funding" | "funded">("idle");

  // Visible before the user attempts to sign, not only as a failure afterwards.
  useEffect(() => {
    if (!address) {
      setWarning(null);
      return;
    }
    let current = true;
    void walletNetworkWarning(networkPassphrase).then((w) => {
      if (current) setWarning(w);
    });
    return () => {
      current = false;
    };
  }, [address, networkPassphrase]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      onChange(await connectWallet(networkPassphrase));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect a wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await disconnectWallet();
    setFunding("idle");
    onChange(null);
  }

  async function fund() {
    if (!address) return;
    setFunding("funding");
    setError(null);
    try {
      await fundTestnetAccount(address);
      setFunding("funded");
    } catch (e) {
      setFunding("idle");
      setError(e instanceof Error ? e.message : "Could not fund the account.");
    }
  }

  return (
    <div className="wallet-bar">
      {address ? (
        <>
          <span className="addr" title={address}>
            {short(address)}
          </span>
          {isTestnet(networkPassphrase) ? (
            <button onClick={fund} disabled={funding !== "idle"}>
              {funding === "funding"
                ? "Funding…"
                : funding === "funded"
                  ? "Funded"
                  : "Get test XLM"}
            </button>
          ) : null}
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button className="primary" onClick={connect} disabled={busy}>
          {busy ? "Connecting…" : "Connect wallet"}
        </button>
      )}
      {warning ? (
        <span className="error" role="alert">
          {warning}
        </span>
      ) : null}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
