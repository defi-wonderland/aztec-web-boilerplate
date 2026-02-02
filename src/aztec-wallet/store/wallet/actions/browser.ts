import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { WalletType } from '../../../types/aztec';
import type { AztecNetwork } from '../../../../config/networks/constants';
import type { IBrowserWalletAdapter } from '../../../../types/browserWallet';
import type { WalletConnectorId } from '../../../../types/walletConnector';
import type { SetState, GetState, WalletState } from '../types';

export const createBrowserActions = (set: SetState, get: GetState) => ({
  connectBrowserWallet: async (
    adapter: IBrowserWalletAdapter,
    networkName: AztecNetwork,
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

      let accountWallet: AccountWithSecretKey | null = null;
      if (selectedAccount) {
        try {
          accountWallet = await adapter.toAccountWallet(selectedAccount);
        } catch {
          // Ignore - accountWallet stays null
        }
      }

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
