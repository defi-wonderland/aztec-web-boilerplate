/**
 * EIP-6963 Multi Wallet Discovery Service
 *
 * Discovers all injected EVM wallets using the EIP-6963 standard.
 * @see https://eips.ethereum.org/EIPS/eip-6963
 */

import type {
  EIP1193Provider,
  EIP6963ProviderDetail,
  EIP6963AnnounceProviderEvent,
} from '../../../types/evm';

export type EIP6963Listener = (providers: EIP6963ProviderDetail[]) => void;

class EIP6963Service {
  private providers: Map<string, EIP6963ProviderDetail> = new Map();
  private listeners: Set<EIP6963Listener> = new Set();
  private isDiscovering = false;

  discover(): void {
    if (typeof window === 'undefined' || this.isDiscovering) return;
    this.isDiscovering = true;

    window.addEventListener(
      'eip6963:announceProvider',
      this.handleAnnouncement as EventListener
    );

    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  private handleAnnouncement = (event: EIP6963AnnounceProviderEvent): void => {
    const { info, provider } = event.detail;
    this.providers.set(info.rdns, { info, provider });
    this.notifyListeners();
  };

  getProviders(): EIP6963ProviderDetail[] {
    return Array.from(this.providers.values());
  }

  getProviderByRdns(rdns: string): EIP1193Provider | null {
    return this.providers.get(rdns)?.provider ?? null;
  }

  getProviderInfo(rdns: string): EIP6963ProviderDetail | null {
    return this.providers.get(rdns) ?? null;
  }

  isWalletAvailable(rdns: string): boolean {
    return this.providers.has(rdns);
  }

  subscribe(listener: EIP6963Listener): () => void {
    this.listeners.add(listener);
    listener(this.getProviders());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const providers = this.getProviders();
    this.listeners.forEach((listener) => listener(providers));
  }

  destroy(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener(
      'eip6963:announceProvider',
      this.handleAnnouncement as EventListener
    );
    this.providers.clear();
    this.listeners.clear();
    this.isDiscovering = false;
  }
}

let eip6963ServiceInstance: EIP6963Service | null = null;

export const getEIP6963Service = (): EIP6963Service => {
  if (!eip6963ServiceInstance) {
    eip6963ServiceInstance = new EIP6963Service();
  }
  return eip6963ServiceInstance;
};

export { EIP6963Service };
