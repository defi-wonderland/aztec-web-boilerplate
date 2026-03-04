import { Fr } from '@aztec/aztec.js/fields';
import type { AccountCredentials } from '../types/aztec';

const getEnv = () =>
  (
    import.meta as unknown as {
      env: Record<string, string | undefined>;
    }
  ).env;

/**
 * Normalize hex string by removing 0x prefix if present
 */
const normalizeHex = (value: string): string => {
  return value.startsWith('0x') ? value.slice(2) : value;
};

/**
 * Create account credentials from an explicit secret key.
 * SigningKey is derived as the first 32 bytes of secretKey.
 */
const createFromSecretKey = (
  secretKeyHex: string,
  salt: string
): AccountCredentials => {
  const secretKey = Fr.fromString(secretKeyHex);
  const signingKeyBuffer = Buffer.from(
    normalizeHex(secretKeyHex).slice(0, 64),
    'hex'
  );

  return {
    secretKey,
    signingKey: signingKeyBuffer,
    salt: Fr.fromString(salt),
  };
};

/**
 * Check if account credentials are configured in environment variables.
 */
export const hasConfiguredCredentials = (): boolean => {
  const env = getEnv();
  return Boolean(env.VITE_EMBEDDED_ACCOUNT_SECRET_KEY);
};

/**
 * Get account credentials from environment variables.
 *
 * Required: VITE_EMBEDDED_ACCOUNT_SECRET_KEY (the Fr hex value)
 * Optional: VITE_COMMON_SALT (defaults to '1337')
 *
 * SigningKey is automatically derived as first 32 bytes of secretKey.
 */
export const getConfiguredAccountCredentials =
  async (): Promise<AccountCredentials | null> => {
    const env = getEnv();
    const secretKey = env.VITE_EMBEDDED_ACCOUNT_SECRET_KEY;
    const salt = env.VITE_COMMON_SALT ?? '1337';

    if (!secretKey) {
      return null;
    }

    const credentials = createFromSecretKey(secretKey, salt);

    console.log('[embedded-wallet] Using configured credentials', {
      secretKey: credentials.secretKey.toString(),
      salt: credentials.salt.toString(),
      signingKey: credentials.signingKey.toString('hex'),
    });

    return credentials;
  };
