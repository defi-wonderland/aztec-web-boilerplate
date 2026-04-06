/** Relying Party ID for WebAuthn — broadest registrable domain. Permanent decision. */
export const RP_ID = 'aztec.network';
export const RP_NAME = 'Aztec Wallet';

/** HKDF info strings — each produces a cryptographically independent key from the same PRF output. */
export const HKDF_INFO_MASTER_SECRET = 'aztec-wallet/v1/master-secret';
// TIER-2-UPGRADE: Remove HKDF_INFO_SIGNING_KEY. Tier 2 uses hardware-bound WebAuthn signing.
export const HKDF_INFO_SIGNING_KEY = 'aztec-wallet/v1/p256-signing-key';
export const HKDF_INFO_ENCRYPTION_KEY = 'aztec-wallet/v1/indexeddb-encryption';
export const HKDF_INFO_ACCOUNT_SALT = 'aztec-wallet/v1/account-salt';

/** PRF salt used during credentials.get() to derive the master key material. */
export const PRF_SALT = 'aztec-wallet/v1/master-key';

/** Account index — v1 supports only a single account. */
export const ACCOUNT_INDEX = 0;

/** PRF salt template for user.id in credentials.create(). */
export const USER_ID_SALT_PREFIX = 'aztec-wallet/v1/account/';

/** Store names routed to ephemeral (RAM) storage in CompositeKVStore. */
export const EPHEMERAL_STORE_NAMES = new Set([
  'key_store',
  'complete_addresses',
  'complete_address_index',
]);

/** Encrypted channel protocol version. */
export const CHANNEL_VERSION = 1 as const;

/** Default wallet host URL. */
export const DEFAULT_WALLET_HOST = 'https://wallet.aztec.network';

/** Default Aztec node URLs per network. */
export const NETWORK_URLS: Record<string, string> = {
  sandbox: 'http://localhost:8080',
  devnet: 'https://devnet.aztec-labs.com/',
};
