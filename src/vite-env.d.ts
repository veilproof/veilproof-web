/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VEILPROOF_REGISTRY_CONTRACT_ID: string;
  readonly VEILPROOF_RPC_URL: string;
  readonly VEILPROOF_NETWORK_PASSPHRASE: string;
  readonly VEILPROOF_VK_SHA256: string;
  readonly VEILPROOF_CIRCUIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
