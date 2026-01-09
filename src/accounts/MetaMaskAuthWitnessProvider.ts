import type { AuthWitnessProvider } from '@aztec/aztec.js/account';
import { Fr } from '@aztec/aztec.js/fields';
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import type { Hex, WalletClient } from 'viem';

/**
 * AuthWitnessProvider that uses MetaMask's personal_sign for creating auth witnesses.
 *
 * When createAuthWit is called:
 * 1. Converts the messageHash (Fr) to raw bytes (32 bytes)
 * 2. Calls MetaMask signMessage with those raw bytes
 * 3. MetaMask internally computes: keccak256("\x19Ethereum Signed Message:\n32" + messageHash)
 * 4. MetaMask signs with the user's private key
 * 5. Returns the signature as the auth witness (r[32] + s[32])
 *
 * The corresponding Noir contract (EcdsaKEthSignerAccount) reconstructs the same
 * Ethereum-prefixed hash and verifies the signature.
 */
export class MetaMaskAuthWitnessProvider implements AuthWitnessProvider {
  private readonly walletClient: WalletClient;
  private readonly account: Hex;

  /**
   * Creates a new MetaMaskAuthWitnessProvider.
   *
   * @param walletClient - Viem wallet client connected to MetaMask
   * @param account - The connected Ethereum address (used for signing)
   */
  constructor(walletClient: WalletClient, account: Hex) {
    this.walletClient = walletClient;
    this.account = account;
  }

  /**
   * Create an auth witness by signing with MetaMask.
   *
   * @param messageHash - The outer_hash from Aztec (Poseidon hash of the action)
   * @returns AuthWitness containing the signature fields (r and s as Fr array)
   */
  async createAuthWit(messageHash: Fr): Promise<AuthWitness> {
    // Convert Fr to 32-byte buffer for MetaMask
    const messageBytes = messageHash.toBuffer();

    // Call MetaMask signMessage with raw bytes
    // MetaMask will prepend "\x19Ethereum Signed Message:\n32" automatically
    const signature = await this.walletClient.signMessage({
      account: this.account,
      message: { raw: messageBytes },
    });

    // Parse the signature (65 bytes: r[32] + s[32] + v[1])
    // Remove 0x prefix, split into r, s (we don't need v for the witness)
    const sigHex = signature.slice(2);
    const r = Buffer.from(sigHex.slice(0, 64), 'hex');
    const s = Buffer.from(sigHex.slice(64, 128), 'hex');

    // Convert signature bytes to Field array (64 fields, one per byte)
    // This matches how the Noir contract reads the auth witness
    const witnessFields: Fr[] = [];
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(r[i]));
    }
    for (let i = 0; i < 32; i++) {
      witnessFields.push(new Fr(s[i]));
    }

    return new AuthWitness(messageHash, witnessFields);
  }
}
