import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../../../types/aztec';
import type { IBrowserWalletAdapter } from '../../../types/browserWallet';
import type { WalletConnectorId } from '../../../types/walletConnector';
import type { SetState, GetState, WalletState } from '../types';

// Track current adapter and account wallet for the browser wallet
let currentAdapter: IBrowserWalletAdapter | null = null;
let currentAccountWallet: AccountWithSecretKey | null = null;

export const createBrowserActions = (set: SetState, get: GetState) => ({
  connectBrowserWallet: async (
    adapter: IBrowserWalletAdapter,
    networkName: string,
    connectorId: WalletConnectorId
  ): Promise<void> => {
    const connectWith = get()._connectWith;
    await connectWith(connectorId, async () => {
      set({
        status: 'connecting',
        error: null,
      });

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
        caipAccount: selectedAccount,
        caipAccounts: accounts,
        supportedChains: state.supportedChains,
        isInstalled: state.isInstalled,
      });
    });
  },

  setBrowserWalletState: (
    state: Partial<
      Pick<
        WalletState,
        | 'account'
        | 'caipAccount'
        | 'caipAccounts'
        | 'supportedChains'
        | 'isInstalled'
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
