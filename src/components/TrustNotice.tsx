// The honest, precise explanation of what veilproof does and does not protect.
// This copy is the point of the app — it must never overstate the guarantee.
// It is cross-checked against veilproof-registry and veilproof-server's own
// security notes.

export function TrustBanner() {
  return (
    <div className="banner" role="note">
      <strong>Experimental &amp; unaudited.</strong> veilproof does on-chain zero-knowledge
      verification using Soroban capabilities added only recently (Protocol 25). It has not been
      audited. Do not rely on it to protect anything of value.
    </div>
  );
}

export function TrustNotice() {
  return (
    <section className="trust" aria-label="Privacy and trust model">
      <h2>What “verified” means — precisely</h2>
      <ul>
        <li>
          A <em>verified</em> status means only that this address proved it belongs to the
          issuer&apos;s set for that credential. It does <strong>not</strong> reveal which member it
          is, or any identity data.
        </li>
        <li>
          The contract never sees or stores raw identity data — only hashes (commitments and a
          nullifier). Membership is proven with a zero-knowledge proof.
        </li>
        <li>
          The issuer decides who is in the set. “Verified” is a claim about membership in that set,
          not an independent judgement about you.
        </li>
      </ul>
      <h2>Where your secret goes</h2>
      <p>
        To generate a proof, your secret is sent to the veilproof-server, which needs it to build
        the proof. The server uses it transiently and does not store it — but you are trusting it
        not to log it. Proving in your browser would remove that trust; it is not yet built. Your
        secret is never sent to the blockchain, and the app never stores it.
      </p>
    </section>
  );
}
