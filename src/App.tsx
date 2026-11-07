import { useMemo, useState } from "react";
import { loadConfig } from "./config";
import { makeChainReader } from "./chain/reads";
import { makeProver } from "./prover/client";
import { WalletBar } from "./components/WalletBar";
import { TrustBanner } from "./components/TrustNotice";
import { StartPage } from "./pages/StartPage";
import { LookupPage } from "./pages/LookupPage";
import { HolderPage } from "./pages/HolderPage";
import { IssuerPage } from "./pages/IssuerPage";

type Tab = "start" | "lookup" | "holder" | "issuer";

export function App() {
  const { config, configError } = useMemo(() => {
    try {
      return { config: loadConfig(), configError: null as string | null };
    } catch (e) {
      return { config: null, configError: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  const [tab, setTab] = useState<Tab>("start");
  const [address, setAddress] = useState<string | null>(null);

  const prover = useMemo(() => (config ? makeProver() : null), [config]);
  const reader = useMemo(() => (config ? makeChainReader(config) : null), [config]);

  if (!config || !prover || !reader) {
    return (
      <main className="app">
        <h1>veilproof</h1>
        <div className="error">Configuration error: {configError}</div>
        <p className="muted">See .env.example and set the VEILPROOF_* variables.</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <span className="logo">veilproof</span>
          <span className="muted small"> · ZK compliance credentials on Soroban</span>
        </div>
        <WalletBar
          networkPassphrase={config.networkPassphrase}
          address={address}
          onChange={setAddress}
        />
      </header>

      <TrustBanner />

      <nav className="tabs">
        <button className={tab === "start" ? "active" : ""} onClick={() => setTab("start")}>
          Start
        </button>
        <button className={tab === "lookup" ? "active" : ""} onClick={() => setTab("lookup")}>
          Lookup
        </button>
        <button className={tab === "holder" ? "active" : ""} onClick={() => setTab("holder")}>
          Prove
        </button>
        <button className={tab === "issuer" ? "active" : ""} onClick={() => setTab("issuer")}>
          Issue
        </button>
      </nav>

      {tab === "start" ? <StartPage config={config} /> : null}
      {tab === "lookup" ? <LookupPage reader={reader} /> : null}
      {tab === "holder" ? (
        <HolderPage config={config} prover={prover} reader={reader} address={address} />
      ) : null}
      {tab === "issuer" ? (
        <IssuerPage config={config} prover={prover} reader={reader} address={address} />
      ) : null}

      <footer className="muted small">
        Unaudited, experimental. Proofs are generated in your browser, and reads come straight from
        the contract. There is no backend.
      </footer>
    </main>
  );
}
