/**
 * Environment variable access utility.
 * Provides type-safe access to Vite environment variables with parsed values.
 */

interface RawEnv {
  readonly VITE_AZTEC_NODE_URL?: string;
  readonly VITE_PROVER_ENABLED?: string;
  readonly VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE?: string;
  readonly VITE_EMBEDDED_ACCOUNT_SECRET_KEY?: string;
  readonly VITE_COMMON_SALT?: string;
}

export interface AppEnv {
  readonly aztecNodeUrl?: string;
  readonly proverEnabled: boolean;
  readonly embeddedAccountSecretPhrase?: string;
  readonly embeddedAccountSecretKey?: string;
  readonly commonSalt?: string;
}

const getRawEnv = (): RawEnv => (import.meta as unknown as { env: RawEnv }).env;

export const getEnv = (): AppEnv => {
  const raw = getRawEnv();

  return {
    aztecNodeUrl: raw.VITE_AZTEC_NODE_URL,
    proverEnabled: raw.VITE_PROVER_ENABLED === 'true',
    embeddedAccountSecretPhrase: raw.VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE,
    embeddedAccountSecretKey: raw.VITE_EMBEDDED_ACCOUNT_SECRET_KEY,
    commonSalt: raw.VITE_COMMON_SALT,
  };
};
