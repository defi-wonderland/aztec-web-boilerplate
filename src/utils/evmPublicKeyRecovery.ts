import { hashMessage, recoverPublicKey, type Hex } from 'viem';

/**
 * Recover the uncompressed public key from a signed message.
 *
 * This function uses Ethereum's ecrecover to extract the public key from a signature.
 * The public key can then be used to deploy an Aztec account contract.
 *
 * @param message - The original message that was signed
 * @param signature - The signature from personal_sign (65 bytes with v)
 * @returns Object with x and y coordinates (each 32 bytes)
 */
export async function recoverPublicKeyFromSignature(
  message: string,
  signature: Hex
): Promise<{ x: Buffer; y: Buffer }> {
  // Hash the message the same way MetaMask does for personal_sign
  const messageHash = hashMessage(message);

  // recoverPublicKey returns uncompressed public key (65 bytes: 0x04 + x[32] + y[32])
  const publicKey = await recoverPublicKey({
    hash: messageHash,
    signature,
  });

  // Remove the 0x04 prefix (indicates uncompressed format) and split into x and y
  const pubKeyHex = publicKey.slice(4); // Remove '0x04'
  const x = Buffer.from(pubKeyHex.slice(0, 64), 'hex');
  const y = Buffer.from(pubKeyHex.slice(64, 128), 'hex');

  return { x, y };
}

/**
 * Standard message for public key recovery during account setup.
 *
 * Using a deterministic message that includes the EVM address ensures:
 * 1. The same EVM address always produces the same Aztec account
 * 2. Users understand what they're signing
 *
 * @param evmAddress - The connected Ethereum address
 * @returns The message to sign
 */
export function getPublicKeyRecoveryMessage(evmAddress: Hex): string {
  return `Sign to allow creation and inspection state of your Aztec account linked to ${evmAddress}`;
}
