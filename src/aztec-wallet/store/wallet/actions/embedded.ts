import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { EMBEDDED_CONNECTOR_ID } from '../../../connectors';
import {
  createEmbeddedAccount,
  loadExistingEmbeddedAccount,
  saveAccount,
  hasSavedEmbeddedAccount,
  clearSavedAccount,
  NoSavedAccountError,
} from '../../../services/wallet';
import { WalletType } from '../../../types/aztec';
import { getNetworkStore } from '../../network';
import type { WalletConnectorId } from '../../../../types/walletConnector';
import type { SetState, GetState } from '../types';

export const createEmbeddedActions = (set: SetState, get: GetState) => ({
  connectEmbedded: async (
    connectorId: WalletConnectorId = EMBEDDED_CONNECTOR_ID
  ): Promise<AccountWithSecretKey> => {
    const connectWith = get()._connectWith;
    return connectWith(connectorId, async () => {
      set({
        status: 'connecting',
        error: null,
        pxeError: null,
      });

      const config = getNetworkStore().currentConfig;

      const result = await createEmbeddedAccount(config);

      // Save credentials
      saveAccount(result.credentials);

      if (result.deployment.deployed) {
        set({ status: 'deploying' });
      }

      set({
        account: result.account,
        walletType: WalletType.EMBEDDED,
        pxeStatus: 'ready',
      });

      return result.account;
    });
  },

  connectExistingEmbedded: async (
    connectorId: WalletConnectorId = EMBEDDED_CONNECTOR_ID
  ): Promise<AccountWithSecretKey | null> => {
    const connectWith = get()._connectWith;
    return connectWith(connectorId, async () => {
      set({
        status: 'connecting',
        error: null,
        pxeError: null,
      });

      const config = getNetworkStore().currentConfig;

      try {
        const result = await loadExistingEmbeddedAccount(config);

        set({
          account: result.account,
          walletType: WalletType.EMBEDDED,
          status: 'connected',
          pxeStatus: 'ready',
        });

        return result.account;
      } catch (error) {
        if (error instanceof NoSavedAccountError) {
          set({
            status: 'disconnected',
            pxeStatus: 'idle',
            pxeError: null,
          });
          return null;
        }
        throw error;
      }
    });
  },

  hasSavedEmbeddedAccount,
});

export { clearSavedAccount };
