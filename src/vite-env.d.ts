/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VEILPROOF_API_URL: string;
  readonly VEILPROOF_REGISTRY_CONTRACT_ID: string;
  readonly VEILPROOF_RPC_URL: string;
  readonly VEILPROOF_NETWORK_PASSPHRASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
