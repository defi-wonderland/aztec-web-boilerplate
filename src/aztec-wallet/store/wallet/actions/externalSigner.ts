import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { createExternalSignerAccount } from '../../../services/wallet';
import { WalletType } from '../../../types/aztec';
import { getNetworkStore } from '../../network';
import type { WalletConnectorId } from '../../../../types/walletConnector';
import type { ExternalSigner } from '../../../signers/types';
import type { SetState, GetState } from '../types';

export const createExternalSignerActions = (set: SetState, get: GetState) => ({
  connectExternalSigner: async (
    signer: ExternalSigner,
    connectorId?: WalletConnectorId
  ): Promise<AccountWithSecretKey> => {
    const connectWith = get()._connectWith;
    return connectWith(connectorId ?? signer.rdns ?? 'external', async () => {
      set({
        status: 'connecting',
        error: null,
        pxeError: null,
      });

      const config = getNetworkStore().currentConfig;

      const result = await createExternalSignerAccount(signer, config);

      if (result.deployment.deployed) {
        set({ status: 'deploying' });
      }

      set({
        account: result.account,
        walletType: WalletType.EXTERNAL_SIGNER,
        signerType: result.signerType,
        connectedRdns: result.rdns,
        pxeStatus: 'ready',
      });

      return result.account;
    });
  },
});
