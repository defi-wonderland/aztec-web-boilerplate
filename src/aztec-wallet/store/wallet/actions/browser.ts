import type { SetState, GetState, WalletState } from '../types';

export const createBrowserActions = (set: SetState, _get: GetState) => ({
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
