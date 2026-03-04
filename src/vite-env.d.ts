/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    // Network configuration
    readonly VITE_AZTEC_NODE_URL?: string;
    readonly VITE_PROVER_ENABLED?: string;
    readonly VITE_ARTIFACT_REGISTRY_URL?: string;
    readonly VITE_EXTERNAL_TGZ_URL?: string;
    readonly VITE_FPC_ENABLED?: string;

    // Embedded account credentials
    readonly VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE?: string;
    readonly VITE_EMBEDDED_ACCOUNT_SECRET_KEY?: string;
    readonly VITE_COMMON_SALT?: string;
  }
}

export {};
