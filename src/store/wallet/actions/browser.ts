import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../../../types/aztec';
import type { IBrowserWalletAdapter } from '../../../types/browserWallet';
import type { SetState, GetState, WalletState } from '../types';

// Track current adapter and account wallet for the browser wallet
let currentAdapter: IBrowserWalletAdapter | null = null;
let currentAccountWallet: AccountWithSecretKey | null = null;

export const createBrowserActions = (set: SetState, _get: GetState) => ({
  connectBrowserWallet: async (
    adapter: IBrowserWalletAdapter,
    networkName: string
  ): Promise<void> => {
    set({ status: 'connecting', error: null });

    try {
      const accounts = await adapter.connect(networkName);

      const selectedAccount = accounts.length > 0 ? accounts[0] : null;
      const state = adapter.getState();

      // Get account wallet if we have a selected account
      let accountWallet: AccountWithSecretKey | null = null;
      if (selectedAccount) {
        try {
          accountWallet = await adapter.toAccountWallet(selectedAccount);
        } catch {
          // Ignore - accountWallet stays null
        }
      }

      currentAdapter = adapter;
      currentAccountWallet = accountWallet;

      set({
        account: accountWallet,
        walletType: WalletType.BROWSER_WALLET,
        status: 'connected',
        caipAccount: selectedAccount,
        caipAccounts: accounts,
        supportedChains: state.supportedChains,
        isInstalled: state.isInstalled,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect browser wallet';
      set({ status: 'disconnected', error: message });
      throw err;
    }
  },

  setBrowserWalletState: (
    state: Partial<
      Pick<
        WalletState,
        'caipAccount' | 'caipAccounts' | 'supportedChains' | 'isInstalled'
      >
    >
  ) => {
    set(state);
  },
});

export const disconnectBrowserWallet = async (): Promise<void> => {
  if (currentAdapter) {
    await currentAdapter.disconnect();
    currentAdapter = null;
    currentAccountWallet = null;
  }
};

export const getCurrentAdapter = (): IBrowserWalletAdapter | null =>
  currentAdapter;

export const setCurrentAdapter = (
  adapter: IBrowserWalletAdapter | null
): void => {
  currentAdapter = adapter;
};

export const getCurrentAccountWallet = (): AccountWithSecretKey | null =>
  currentAccountWallet;

export const setCurrentAccountWallet = (
  wallet: AccountWithSecretKey | null
): void => {
  currentAccountWallet = wallet;
};
