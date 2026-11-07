# Contributing to veilproof-web

Thanks for your interest. This is the human layer over veilproof's ZK
compliance-credential system. Its whole value is an honest privacy claim, so
the first rule is about copy, not code.

## Ground rules

- **Never overstate the privacy guarantee.** The UI must not claim stronger
  privacy than the system provides. In particular: the secret stays in the browser
  only as far as the code the page loaded can be trusted, so say that too.
  Cross-check any privacy copy against veilproof-registry and veilproof-server's
  own security notes. The `TrustNotice` tests guard this; keep them meaningful.
- **Never send, log, or persist the holder's secret.** It lives in component state
  and the prover worker, and nowhere else. `npm run e2e` fails if it appears in a
  network request.
- **Keep it static.** The deployed app has no backend, which is why its link keeps
  working. A feature that needs a server needs a very good reason.
- **Keep on-chain reads direct.** They go straight to the contract via RPC
  (`src/chain/reads.ts`). The independence is the point.
- **Don't reimplement the cryptography in TypeScript.** Commitments, roots, and
  proofs all come from the WebAssembly prover, so they can't drift from the circuit.

## Development

```sh
npm install
npm run dev                  # dev server, against the public testnet registry
npm test                     # Vitest
npm run lint                 # eslint + prettier --check
npm run build                # type-check + production build
```

## Pull requests

- One focused change per PR, with a clear description of why.
- Add or update tests. Component behaviour and API/chain client changes should
  come with Vitest coverage.
- `npm run lint`, `npm test`, and `npm run build` must pass.
- Keep the trust/privacy copy accurate. If you change what data flows where,
  update `TrustNotice` and its tests to match reality.

## Out of scope (MVP)

A full design system, and multiple circuit types — one fixed credential flow only.
