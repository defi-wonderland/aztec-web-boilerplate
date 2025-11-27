/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_AZTEC_NODE_URL?: string;
    readonly VITE_CONTRACT_ADDRESS?: string;
    readonly VITE_DRIPPER_CONTRACT_ADDRESS?: string;
    readonly VITE_TOKEN_CONTRACT_ADDRESS?: string;
    readonly VITE_DEPLOYER_ADDRESS?: string;
    readonly VITE_DEPLOYMENT_SALT?: string;
    readonly VITE_DRIPPER_DEPLOYMENT_SALT?: string;
    readonly VITE_TOKEN_DEPLOYMENT_SALT?: string;
    readonly VITE_PROVER_ENABLED?: string;
  }
}

export {};

