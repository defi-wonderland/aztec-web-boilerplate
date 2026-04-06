const CRED_ID_KEY = 'aztec-wallet:credentialId';
const PUB_KEY_KEY = 'aztec-wallet:publicKey';

export class CredentialStore {
  constructor(private storage: any = typeof localStorage !== 'undefined' ? localStorage : null) {}

  saveCredentialId(credentialId: Uint8Array): void {
    this.storage?.setItem(CRED_ID_KEY, uint8ArrayToBase64(credentialId));
  }

  getCredentialId(): Uint8Array | null {
    const stored = this.storage?.getItem(CRED_ID_KEY);
    if (!stored) return null;
    return base64ToUint8Array(stored);
  }

  savePublicKey(publicKey: Uint8Array): void {
    this.storage?.setItem(PUB_KEY_KEY, uint8ArrayToBase64(publicKey));
  }

  getPublicKey(): Uint8Array | null {
    const stored = this.storage?.getItem(PUB_KEY_KEY);
    if (!stored) return null;
    return base64ToUint8Array(stored);
  }

  clear(): void {
    this.storage?.removeItem(CRED_ID_KEY);
    this.storage?.removeItem(PUB_KEY_KEY);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
