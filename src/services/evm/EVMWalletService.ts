/**
 * EVMWalletService - Core service for EVM wallet management using viem
 */

import {
  createWalletClient,
  custom,
  type WalletClient,
  type Hex,
  Account,
} from 'viem';
import { mainnet } from 'viem/chains';

export type EVMWalletListener = () => void;

export interface EVMWalletState {
  address: Hex | null;
  isConnected: boolean;
  chainId: number | null;
}

/**
 * EVMWalletService manages EVM wallet connections using viem directly.
 *
 * Features:
 * - Connect/disconnect to injected wallets (MetaMask, Rabby, etc.)
 * - Track connection state with subscriber pattern
 * - Provide WalletClient for signing operations
 * - Handle account and chain change events
 */
export class EVMWalletService {
  private walletClient: WalletClient | null = null;
  private address: Hex | null = null;
  private chainId: number | null = null;
  private listeners: Set<EVMWalletListener> = new Set();
  private isListeningToEvents = false;

  //TODO: Investigate if we could provide a better way to check if a wallet is available
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
    };
  }

  getAddress(): Hex | null {
    return this.address;
  }

  getWalletClient(): WalletClient | null {
    return this.walletClient;
  }

  /**
   * Connect to the injected wallet provider
   * @returns The connected address
   * @throws Error if no provider available or user rejects
   */
  async connect(): Promise<Hex> {
    if (!this.isAvailable()) {
      throw new Error('No injected wallet provider found');
    }

    const ethereum = window.ethereum!;

    // Request accounts (triggers wallet popup if not connected)
    const accounts = (await ethereum.request({
      method: 'eth_requestAccounts',
    })) as Hex[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    const address = accounts[0];

    // Get current chain ID
    const chainIdHex = (await ethereum.request({
      method: 'eth_chainId',
    })) as string;
    const chainId = parseInt(chainIdHex, 16);

    // Create viem wallet client
    this.walletClient = createWalletClient({
      account: { address } as Account,
      transport: custom(ethereum),
    });

    this.address = address;
    this.chainId = chainId;

    this.setupEventListeners();
    this.notifyListeners();

    return address;
  }

  disconnect(): void {
    this.walletClient = null;
    this.address = null;
    this.chainId = null;
    this.removeEventListeners();
    this.notifyListeners();
  }

  /**
   * Sign a message using the connected wallet
   * @param message - The message to sign (string or raw bytes)
   * @returns The signature
   */
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
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  private setupEventListeners(): void {
    if (this.isListeningToEvents || !window.ethereum) return;

    window.ethereum.on('accountsChanged', this.handleAccountsChanged);
    window.ethereum.on('chainChanged', this.handleChainChanged);
    window.ethereum.on('disconnect', this.handleDisconnect);

    this.isListeningToEvents = true;
  }

  private removeEventListeners(): void {
    if (!this.isListeningToEvents || !window.ethereum) return;

    window.ethereum.removeListener(
      'accountsChanged',
      this.handleAccountsChanged
    );
    window.ethereum.removeListener('chainChanged', this.handleChainChanged);
    window.ethereum.removeListener('disconnect', this.handleDisconnect);

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

      if (window.ethereum) {
        this.walletClient = createWalletClient({
          account: { address: newAddress } as Account,
          chain: mainnet,
          transport: custom(window.ethereum),
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
