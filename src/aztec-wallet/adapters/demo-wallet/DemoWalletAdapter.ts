/**
 * DemoWalletAdapter - Browser wallet adapter for Aztec Keychain (demo-wallet).
 *
 * Implements IBrowserWalletAdapter to integrate with the aztec-wallet connector system.
 * Uses the wallet-sdk protocol: discovery → secure channel → emoji verification → connection.
 *
 * Key difference from Azguard: the demo-wallet returns a full Wallet proxy,
 * so contract interactions go through the Wallet directly rather than via executeOperations.
 */

import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { Fr } from '@aztec/aztec.js/fields';
import { CAPABILITY_VERSION } from '@aztec/aztec.js/wallet';
import type { AppCapabilities } from '@aztec/aztec.js/wallet';
import type { AztecNetwork } from '../../../config/networks/constants';
import { CHAIN_IDS } from '../../../config/networks/constants';
import { getVerificationStore } from '../../store/verification';
import { getNetworkStore } from '../../store/network';
import { NetworkService } from '../../services/aztec/network/NetworkService';
import { DemoWalletService } from './DemoWalletService';
import type {
  IBrowserWalletAdapter,
  BrowserWalletState,
  BrowserWalletOperationResult,
  BrowserWalletOperation,
} from '../../../types/browserWallet';

const APP_ID = 'aztec-web-boilerplate';

export class DemoWalletAdapter implements IBrowserWalletAdapter {
  readonly id = 'aztec-keychain';
  readonly label = 'Aztec Keychain';

  private service: DemoWalletService;
  private accountsChangedCallbacks: Array<(accounts: string[]) => void> = [];
  private disconnectedCallbacks: Array<() => void> = [];

  constructor() {
    this.service = new DemoWalletService();
  }

  async initialize(): Promise<void> {
    // No-op: demo-wallet doesn't inject globals we can detect synchronously.
    // Discovery happens during connect().
  }

  destroy(): void {
    this.service.destroy();
    this.accountsChangedCallbacks = [];
    this.disconnectedCallbacks = [];
  }

  getState(): BrowserWalletState {
    return {
      // Can't detect installation synchronously — extension doesn't inject globals
      isInstalled: true,
      status: this.service.getWallet() ? 'connected' : 'disconnected',
      accounts: [],
      selectedAccount: null,
      supportedChains: Object.values(CHAIN_IDS),
      error: null,
    };
  }

  async connect(networkName: AztecNetwork): Promise<string[]> {
    // Query the Aztec node for the real ChainInfo (l1ChainId + rollupVersion).
    // The wallet worker matches sessions by chainId-version, so these must be exact.
    const { nodeUrl } = getNetworkStore().currentConfig;
    console.log('[DemoWallet] Fetching chain info from node:', nodeUrl);

    const nodeClient = NetworkService.getNodeClient(nodeUrl);
    const nodeInfo = await nodeClient.getNodeInfo();

    const chainInfo = {
      chainId: new Fr(nodeInfo.l1ChainId),
      version: new Fr(nodeInfo.rollupVersion),
    };
    console.log('[DemoWallet] Chain info:', {
      l1ChainId: nodeInfo.l1ChainId,
      rollupVersion: nodeInfo.rollupVersion,
    });

    // Step 1: Discovery — find the wallet extension
    console.log('[DemoWallet] Step 1: Starting discovery...');
    const provider = await this.service.discover(chainInfo, APP_ID);
    console.log('[DemoWallet] Step 1: Discovery complete, provider:', provider.name);

    // Step 2: Establish secure channel (ECDH key exchange)
    console.log('[DemoWallet] Step 2: Establishing secure channel...');
    const pending = await this.service.establishSecureChannel(
      provider,
      APP_ID
    );
    console.log('[DemoWallet] Step 2: Secure channel established, verificationHash:', pending.verificationHash);

    // Step 3: Request emoji verification from the UI
    console.log('[DemoWallet] Step 3: Requesting emoji verification...');
    const verificationStore = getVerificationStore();
    const confirmed = await verificationStore.requestVerification(
      pending.verificationHash,
      provider.name,
      provider.icon
    );
    console.log('[DemoWallet] Step 3: Emoji verification result:', confirmed);

    if (!confirmed) {
      this.service.cancelConnection(pending);
      throw new Error('Emoji verification cancelled by user');
    }

    // Step 4: Confirm connection — get the Wallet proxy
    console.log('[DemoWallet] Step 4: Confirming connection...');
    const wallet = await this.service.confirmConnection(pending);
    console.log('[DemoWallet] Step 4: Connection confirmed, wallet proxy received');

    // Step 5: Request capabilities — required before the wallet responds to other RPC calls.
    // The wallet worker uses capabilities to determine what the app is allowed to do.
    console.log('[DemoWallet] Step 5: Requesting capabilities...');
    const manifest: AppCapabilities = {
      version: CAPABILITY_VERSION,
      metadata: {
        name: 'Aztec Web Boilerplate',
        version: '1.0.0',
        description: 'Aztec blockchain interaction boilerplate',
      },
      capabilities: [
        { type: 'accounts', canGet: true, canCreateAuthWit: true },
        { type: 'contracts', contracts: '*', canRegister: true, canGetMetadata: true },
        { type: 'simulation', transactions: { scope: '*' }, utilities: { scope: '*' } },
        { type: 'transaction', scope: '*' },
      ],
      behavior: { mode: 'permissive' },
    };

    const capResult = await wallet.requestCapabilities(manifest);
    console.log('[DemoWallet] Step 5: Capabilities granted:', capResult);

    // Step 6: Get accounts
    console.log('[DemoWallet] Step 6: Getting accounts...');
    const accounts = await wallet.getAccounts();
    console.log('[DemoWallet] Step 6: Accounts received:', accounts.length, accounts);
    // getAccounts() returns Aliased<AztecAddress>[] = { alias: string, item: AztecAddress }[]
    const accountAddresses = accounts.map((a) => a.item.toString());

    if (accountAddresses.length === 0) {
      throw new Error(
        'No accounts found in Aztec Keychain. ' +
        'Make sure you have created an account in the wallet app.'
      );
    }

    // Notify listeners
    for (const cb of this.accountsChangedCallbacks) {
      cb(accountAddresses);
    }

    // Listen for disconnect events
    this.service.onDisconnected(() => {
      for (const cb of this.disconnectedCallbacks) {
        cb();
      }
    });

    return accountAddresses;
  }

  async disconnect(): Promise<void> {
    await this.service.disconnect();
  }

  /**
   * Not supported for demo-wallet — interactions go through the Wallet proxy directly.
   * The hooks detect DemoWalletConnector and use getWallet() instead.
   */
  async executeOperations(
    _ops: BrowserWalletOperation[]
  ): Promise<BrowserWalletOperationResult[]> {
    throw new Error(
      'DemoWalletAdapter does not support executeOperations. ' +
        'Use the Wallet instance from DemoWalletConnector.getWallet() for contract interactions.'
    );
  }

  /**
   * Create a mock AccountWithSecretKey from the wallet's address.
   * The demo-wallet manages keys internally, so we only expose getAddress().
   */
  async toAccountWallet(accountId: string): Promise<AccountWithSecretKey> {
    const { AztecAddress } = await import('@aztec/aztec.js/addresses');
    const address = AztecAddress.fromString(accountId);
    return { getAddress: () => address } as unknown as AccountWithSecretKey;
  }

  onAccountsChanged(cb: (accounts: string[]) => void): void {
    this.accountsChangedCallbacks.push(cb);
  }

  onDisconnected(cb: () => void): void {
    this.disconnectedCallbacks.push(cb);
  }

  /**
   * Get the connected Wallet proxy for direct contract interactions.
   * This is specific to the demo-wallet adapter.
   */
  getConnectedWallet() {
    return this.service.getWallet();
  }
}

export const createDemoWalletAdapter = (): IBrowserWalletAdapter =>
  new DemoWalletAdapter();
