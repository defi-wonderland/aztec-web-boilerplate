import { WalletType } from '../../../types/aztec';
import type { WalletConnectorId } from '../../../types/walletConnector';
import type { SetState, GetState, WalletState } from '../types';

export const createBrowserActions = (set: SetState, get: GetState) => ({
  connectBrowserWallet: async (
    connectorId: WalletConnectorId
  ): Promise<void> => {
    const connectWith = get()._connectWith;
    await connectWith(connectorId, async () => {
      set({
        status: 'connecting',
        error: null,
        walletType: WalletType.BROWSER_WALLET,
        isInstalled: true,
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
