# Contributing to veilproof-web

Thanks for your interest. This is the human layer over veilproof's ZK
compliance-credential system. Its whole value is an honest privacy claim, so
the first rule is about copy, not code.

## Ground rules

- **Never overstate the privacy guarantee.** The UI must not claim stronger
  privacy than the system provides. In particular: the holder's secret **is**
  sent to veilproof-server to generate the proof — do not imply it stays in the
  browser. Cross-check any privacy copy against veilproof-registry and
  veilproof-server's own security notes. The `TrustNotice` tests guard this;
  keep them meaningful.
- **Keep the on-chain read independent.** The verification lookup reads state
  straight from the contract via RPC (`src/chain/reads.ts`), not through the
  backend API. Don't route it through `src/api` — the independence is the point.
- **No client-side proof generation.** Proving is veilproof-server's job; the
  web only requests proofs and submits them.

## Development

```sh
npm install
cp .env.example .env.local   # then edit
npm run dev                  # dev server
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

Client-side proving, a full design system, and multiple circuit types — one
fixed credential flow only.
