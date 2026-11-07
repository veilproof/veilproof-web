// Public configuration, read from VEILPROOF_* env vars at build time. None of
// these are secrets — the app only ever holds public endpoints and ids.

export interface Config {
  registryContractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  /** The circuit a self-service credential is bound to. */
  circuit: string;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    // Surfaced early and loudly rather than failing deep in a request.
    throw new Error(`Missing required env var ${name} (see .env.example)`);
  }
  return value;
}

export function loadConfig(env: ImportMetaEnv = import.meta.env): Config {
  return {
    registryContractId: required(
      "VEILPROOF_REGISTRY_CONTRACT_ID",
      env.VEILPROOF_REGISTRY_CONTRACT_ID,
    ),
    rpcUrl: required("VEILPROOF_RPC_URL", env.VEILPROOF_RPC_URL),
    networkPassphrase: required("VEILPROOF_NETWORK_PASSPHRASE", env.VEILPROOF_NETWORK_PASSPHRASE),
    circuit: env.VEILPROOF_CIRCUIT || "membership",
  };
}
