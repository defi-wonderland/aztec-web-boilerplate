import { Fr } from '@aztec/foundation/curves/bn254';
import { Ecdsa } from '@aztec/foundation/crypto/ecdsa';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';

// TIER-2-UPGRADE: Replace EcdsaRAccountContract with PasskeyAccountContract.
// PasskeyAccountContract verifies WebAuthn envelope in Noir circuits.
// The witness provider changes from software p256.sign() to WebAuthn
// signature + authenticatorData + clientDataJSON from the popup.

export function createSigningKeyBuffer(signingKey: Uint8Array): Buffer {
  return Buffer.from(signingKey);
}

export async function getPublicKeyArgs(signingKey: Uint8Array): Promise<{ x: Buffer; y: Buffer }> {
  const ecdsa = new Ecdsa('secp256r1');
  const pubKey = await ecdsa.computePublicKey(Buffer.from(signingKey));
  return {
    x: Buffer.from(pubKey.subarray(0, 32)),
    y: Buffer.from(pubKey.subarray(32, 64)),
  };
}

// TIER-2-UPGRADE: Remove signingKey parameter. Tier 2 gets witness from popup.
export function createAccountContract(signingKey: Uint8Array): EcdsaRAccountContract {
  return new EcdsaRAccountContract(createSigningKeyBuffer(signingKey));
}
