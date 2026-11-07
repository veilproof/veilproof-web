import type { Config } from "../config";
import { contractUrl, isTestnet, networkName } from "../chain/network";

/** What this is, and how to run the whole flow with nothing but a wallet. */
export function StartPage({ config }: { config: Config }) {
  const contract = contractUrl(config.networkPassphrase, config.registryContractId);
  return (
    <div className="page">
      <h1>Prove you belong, without saying who you are</h1>
      <p>
        An issuer publishes a Merkle root over a set of members. A member proves they are in that
        set with a zero-knowledge proof, which a Soroban contract checks on-chain. Anyone can then
        read <code>is_verified</code> for that address, and nobody learns which member it was.
      </p>
      <p className="muted">
        Proofs are generated in your browser. This site is static files with no backend: it talks to
        your wallet, to Soroban RPC, and to friendbot if you ask it for test XLM.
      </p>

      <h2>Try it yourself</h2>
      <ol className="stack steps">
        <li>
          Install the <a href="https://varialwallet.com">Varial</a> browser extension (formerly
          Freighter) and switch it to {networkName(config.networkPassphrase)}. Then{" "}
          <strong>Connect wallet</strong> and pick <strong>Freighter</strong> in the list, which is
          still its name there.
          {isTestnet(config.networkPassphrase) ? (
            <>
              {" "}
              Then press <strong>Get test XLM</strong>, which is free and has no value.
            </>
          ) : null}
        </li>
        <li>
          On <strong>Prove</strong>, generate a secret and commitment. Keep the secret, and copy the
          commitment.
        </li>
        <li>
          On <strong>Issue</strong>, open a credential under a new name and claim it. Add your
          commitment, then publish the root. You are playing the issuer here too, which a real
          deployment would not let you do.
        </li>
        <li>
          Back on <strong>Prove</strong>, enter that name and use the copy in this browser. Paste
          your secret, generate the proof, and submit it.
        </li>
        <li>
          On <strong>Lookup</strong>, check your address. It now reads as verified, straight from
          the contract.
        </li>
      </ol>

      <p className="muted small">
        Registry:{" "}
        {contract ? (
          <a href={contract} className="mono" target="_blank" rel="noreferrer">
            {config.registryContractId}
          </a>
        ) : (
          <span className="mono">{config.registryContractId}</span>
        )}{" "}
        on {networkName(config.networkPassphrase)}. Source:{" "}
        <a href="https://github.com/veilproof">github.com/veilproof</a>.
      </p>
    </div>
  );
}
