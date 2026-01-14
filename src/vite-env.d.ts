/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    // Network configuration
    readonly VITE_AZTEC_NODE_URL?: string;
    readonly VITE_PROVER_ENABLED?: string;

    // Embedded account credentials
    readonly VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE?: string;
    readonly VITE_EMBEDDED_ACCOUNT_SECRET_KEY?: string;
    readonly VITE_COMMON_SALT?: string;
  }
}

/**
 * Type declarations for @aztec-fee-payment module.
 */
declare module '@aztec-fee-payment/fee-payment-methods' {
  import type { FeePaymentMethod } from '@aztec/aztec.js/fee';
  import type { AztecAddress } from '@aztec/aztec.js/addresses';

  export class MeteredFeePaymentMethod implements FeePaymentMethod {
    constructor(fpcAddress: AztecAddress);
    getAsset(): Promise<AztecAddress>;
    getFeePayer(): Promise<AztecAddress>;
    getExecutionPayload(): Promise<unknown>;
    getGasSettings(): unknown;
  }

  export class MeteredExactFeePaymentMethod implements FeePaymentMethod {
    constructor(fpcAddress: AztecAddress);
    getAsset(): Promise<AztecAddress>;
    getFeePayer(): Promise<AztecAddress>;
    getExecutionPayload(): Promise<unknown>;
    getGasSettings(): unknown;
  }
}

export {};
