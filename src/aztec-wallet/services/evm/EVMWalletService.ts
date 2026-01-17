/**
 * EVMWalletService - Core service for EVM wallet management using viem
 *
 * Supports EIP-6963 for multi-wallet discovery.
 */

import {
  createWalletClient,
  custom,
  type WalletClient,
  type Hex,
  Account,
} from 'viem';
import type { EIP1193Provider } from '../../../types/evm';

export type EVMWalletListener = () => void;

export interface EVMWalletState {
  address: Hex | null;
  isConnected: boolean;
  chainId: number | null;
  connectedRdns: string | null;
}

export class EVMWalletService {
  private walletClient: WalletClient | null = null;
  private address: Hex | null = null;
  private chainId: number | null = null;
  private connectedRdns: string | null = null;
  private listeners: Set<EVMWalletListener> = new Set();
  private isListeningToEvents = false;
  private currentProvider: EIP1193Provider | null = null;

  isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  isConnected(): boolean {
    return this.address !== null && this.walletClient !== null;
  }

  getState(): EVMWalletState {
    return {
      address: this.address,
      isConnected: this.isConnected(),
      chainId: this.chainId,
      connectedRdns: this.connectedRdns,
    };
  }

  getConnectedRdns(): string | null {
    return this.connectedRdns;
  }

  getAddress(): Hex | null {
    return this.address;
  }

  getWalletClient(): WalletClient | null {
    return this.walletClient;
  }

  /**
   * Connect to a wallet provider
   * @param provider - Specific EIP-1193 provider (from EIP-6963) or uses window.ethereum
   * @param rdns - Optional rdns identifier for the connected wallet (for multi-wallet tracking)
   */
  async connect(provider?: EIP1193Provider, rdns?: string): Promise<Hex> {
    // Disconnect any previous connection first
    if (this.currentProvider) {
      this.disconnect();
    }

    const ethereum = provider ?? window.ethereum;

    if (!ethereum) {
      throw new Error('No wallet provider found');
    }

    try {
      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
      })) as Hex[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      const address = accounts[0];

      const chainIdHex = (await ethereum.request({
        method: 'eth_chainId',
      })) as string;
      const chainId = parseInt(chainIdHex, 16);

      this.walletClient = createWalletClient({
        account: { address } as Account,
        transport: custom(ethereum),
      });

      this.address = address;
      this.chainId = chainId;
      this.currentProvider = ethereum;
      this.connectedRdns = rdns ?? null;

      this.setupEventListeners();
      this.notifyListeners();

      return address;
    } catch (error) {
      // Reset state on failure (e.g., user rejected)
      this.walletClient = null;
      this.address = null;
      this.chainId = null;
      this.currentProvider = null;
      this.connectedRdns = null;
      throw error;
    }
  }

  disconnect(): void {
    this.removeEventListeners();
    this.walletClient = null;
    this.address = null;
    this.chainId = null;
    this.currentProvider = null;
    this.connectedRdns = null;
    this.notifyListeners();
  }

  async signMessage(message: string | { raw: Uint8Array }): Promise<Hex> {
    if (!this.walletClient || !this.address) {
      throw new Error('Wallet not connected');
    }

    return this.walletClient.signMessage({
      account: this.address,
      message,
    });
  }

  subscribe(listener: EVMWalletListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  private setupEventListeners(): void {
    const provider = this.currentProvider;
    if (this.isListeningToEvents || !provider) return;

    provider.on('accountsChanged', this.handleAccountsChanged);
    provider.on('chainChanged', this.handleChainChanged);
    provider.on('disconnect', this.handleDisconnect);

    this.isListeningToEvents = true;
  }

  private removeEventListeners(): void {
    const provider = this.currentProvider;
    if (!this.isListeningToEvents || !provider) return;

    provider.removeListener('accountsChanged', this.handleAccountsChanged);
    provider.removeListener('chainChanged', this.handleChainChanged);
    provider.removeListener('disconnect', this.handleDisconnect);

    this.isListeningToEvents = false;
  }

  private handleAccountsChanged = (accounts: unknown): void => {
    const accountsArray = accounts as Hex[];

    if (!accountsArray || accountsArray.length === 0) {
      this.disconnect();
      return;
    }

    const newAddress = accountsArray[0];
    if (newAddress !== this.address) {
      this.address = newAddress;

      if (this.currentProvider) {
        this.walletClient = createWalletClient({
          account: { address: newAddress } as Account,
          transport: custom(this.currentProvider),
        });
      }

      this.notifyListeners();
    }
  };

  private handleChainChanged = (chainIdHex: unknown): void => {
    const newChainId = parseInt(chainIdHex as string, 16);

    if (newChainId !== this.chainId) {
      this.chainId = newChainId;
      this.notifyListeners();
    }
  };

  private handleDisconnect = (): void => {
    this.disconnect();
  };
}

let evmWalletServiceInstance: EVMWalletService | null = null;

export const getEVMWalletService = (): EVMWalletService => {
  if (!evmWalletServiceInstance) {
    evmWalletServiceInstance = new EVMWalletService();
  }
  return evmWalletServiceInstance;
};

export const createEVMWalletService = (): EVMWalletService => {
  return new EVMWalletService();
};
