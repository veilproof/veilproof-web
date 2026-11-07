import { useEffect, useState, type ChangeEvent } from "react";
import type { ChainReader } from "../chain/reads";
import type { Config } from "../config";
import type { Prover } from "../prover/client";
import { describeError } from "../chain/errors";
import { submitClaimCredential, submitPublishRoot } from "../chain/submit";
import { RootStatus } from "../components/RootStatus";
import { TxLink } from "../components/TxLink";
import {
  addLeaf,
  downloadTree,
  loadTree,
  parseTree,
  saveTree,
  TREE_CAPACITY,
  type TreeFile,
} from "../tree/treeFile";

type Busy = "idle" | "loading" | "claiming" | "publishing";

export function IssuerPage({
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
  const [credential, setCredential] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeFile | null>(null);
  const [localRoot, setLocalRoot] = useState<string | null>(null);
  const [chainRoot, setChainRoot] = useState<string | null>(null);
  const [issuer, setIssuer] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [commitment, setCommitment] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>("idle");
  const [error, setError] = useState<string | null>(null);

  // The root is derived from the leaves, so recompute it whenever they change.
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

  async function refreshChain(name: string) {
    const [root, owner, isOpen] = await Promise.all([
      reader.currentRoot(name),
      reader.issuerOf(name),
      reader.openRegistration(),
    ]);
    setChainRoot(root);
    setIssuer(owner);
    setOpen(isOpen);
  }

  async function load(e: React.FormEvent) {
    e.preventDefault();
    const name = credential.trim();
    setBusy("loading");
    setError(null);
    setTxHash(null);
    try {
      await refreshChain(name);
      setTree(loadTree(config.registryContractId, name));
      setLoaded(name);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy("idle");
    }
  }

  function update(next: TreeFile) {
    setTree(next);
    saveTree(next);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!tree) return;
    setError(null);
    try {
      update(addLeaf(tree, commitment));
      setCommitment("");
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !loaded) return;
    setError(null);
    try {
      const imported = parseTree(await file.text());
      if (imported.credential !== loaded) {
        throw new Error(`That tree file is for "${imported.credential}", not "${loaded}".`);
      }
      update({ ...imported, contractId: config.registryContractId });
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function submit(action: "claiming" | "publishing") {
    if (!address || !loaded) return;
    setBusy(action);
    setError(null);
    setTxHash(null);
    try {
      const hash =
        action === "claiming"
          ? await submitClaimCredential(config, address, loaded)
          : await submitPublishRoot(config, address, loaded, localRoot ?? "");
      setTxHash(hash);
      await refreshChain(loaded);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy("idle");
    }
  }

  const isIssuer = issuer !== null && issuer === address;

  return (
    <div className="page">
      <h1>Manage a credential tree</h1>
      <p className="muted">
        The tree is built here in your browser, from commitments your holders give you: hashes,
        never identity data. Publishing puts only its root on-chain, signed by your wallet.
      </p>

      <form onSubmit={load} className="stack">
        <label>
          Credential
          <input
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="e.g. mycred (letters, digits, underscores)"
            pattern="[a-zA-Z0-9_]{1,32}"
            required
          />
        </label>
        <button type="submit" disabled={busy !== "idle"}>
          {busy === "loading" ? "Reading chain…" : "Open credential"}
        </button>
      </form>

      {loaded && tree ? (
        <>
          <div className="info stack">
            <div>
              <strong>{loaded}</strong>: {tree.leaves.length} / {TREE_CAPACITY} members
            </div>
            <div className="small">
              Issuer on-chain: <span className="mono">{issuer ?? "nobody yet"}</span>
            </div>
            <RootStatus localRoot={localRoot} chainRoot={chainRoot} />
          </div>

          {issuer === null ? (
            <div className="stack">
              <h2>Claim this credential</h2>
              {!open ? (
                <p className="muted">
                  This registry only accepts issuers its admin registers, so this name cannot be
                  claimed from here.
                </p>
              ) : !address ? (
                <p className="muted">Connect a wallet above to become this credential's issuer.</p>
              ) : (
                <button onClick={() => submit("claiming")} disabled={busy !== "idle"}>
                  {busy === "claiming" ? "Claiming…" : `Claim "${loaded}" as issuer`}
                </button>
              )}
            </div>
          ) : null}

          <form onSubmit={add} className="stack">
            <h2>Add a member</h2>
            <label>
              Leaf commitment (hex)
              <input
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                placeholder="the commitment a holder gave you"
                required
              />
            </label>
            <button type="submit">Add commitment</button>
          </form>

          {tree.leaves.length > 0 ? (
            <ol className="mono small leaves">
              {tree.leaves.map((leaf) => (
                <li key={leaf}>{leaf}</li>
              ))}
            </ol>
          ) : null}

          <div className="stack">
            <h2>Share the tree</h2>
            <p className="muted small">
              Holders need this file to prove membership. It holds commitments only, but it does
              show how many members the set has. Keep your own copy too: the copy in this browser is
              lost if site data is cleared, and a published root is useless without its leaves.
            </p>
            <div className="row">
              <button type="button" onClick={() => downloadTree(tree)}>
                Download tree file
              </button>
              <label className="file">
                Import a tree file
                <input type="file" accept=".json,application/json" onChange={importFile} />
              </label>
            </div>
          </div>

          <div className="stack">
            <h2>Publish root on-chain</h2>
            {!address ? (
              <p className="muted">Connect the issuer wallet above to publish.</p>
            ) : issuer !== null && !isIssuer ? (
              <p className="muted">
                The connected wallet is not this credential's issuer, so it cannot publish.
              </p>
            ) : (
              <button
                onClick={() => submit("publishing")}
                disabled={busy !== "idle" || !localRoot || !isIssuer || localRoot === chainRoot}
              >
                {busy === "publishing" ? "Publishing…" : "Publish current root"}
              </button>
            )}
          </div>

          {txHash ? (
            <div className="result ok">
              Done. Transaction:
              <TxLink hash={txHash} networkPassphrase={config.networkPassphrase} />
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}
