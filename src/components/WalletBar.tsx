import { useState } from "react";
import { connectWallet, disconnectWallet } from "../chain/wallet";

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
    onChange(null);
  }

  return (
    <div className="wallet-bar">
      {address ? (
        <>
          <span className="addr" title={address}>
            {short(address)}
          </span>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={connect} disabled={busy}>
          {busy ? "Connecting…" : "Connect wallet"}
        </button>
      )}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
