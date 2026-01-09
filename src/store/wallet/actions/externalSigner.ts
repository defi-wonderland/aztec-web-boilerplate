import type { AccountWithSecretKey } from '@aztec/aztec.js/account';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { EcdsaKEthSignerAccountContract } from '../../../accounts/EcdsaKEthSignerAccountContract';
import { SharedPXEService } from '../../../services/aztec/pxe';
import { WalletType } from '../../../types/aztec';
import { getNetworkStore } from '../../network';
import type { ExternalSigner } from '../../../signers/types';
import type { SetState, GetState } from '../types';

// Track current signer for disconnect
let currentSigner: ExternalSigner | null = null;

export const createExternalSignerActions = (set: SetState, _get: GetState) => ({
  connectExternalSigner: async (
    signer: ExternalSigner
  ): Promise<AccountWithSecretKey> => {
    set({ status: 'connecting', error: null, pxeError: null });

    try {
      if (!signer.isConnected()) {
        await signer.connect();
      }

      const config = getNetworkStore().currentConfig;
      set({ pxeStatus: 'initializing', pxeError: null });
      const pxeInstance = await SharedPXEService.getInstance(
        config.nodeUrl,
        config.name
      );
      set({ pxeStatus: 'ready', pxeError: null });

      const { x, y } = await signer.getPublicKey();

      const authWitnessProvider = signer.createAuthWitnessProvider(
        {} as Parameters<typeof signer.createAuthWitnessProvider>[0]
      );

      const accountContract = new EcdsaKEthSignerAccountContract(
        x,
        y,
        authWitnessProvider
      );

      const secretKeyBuffer = await signer.deriveSecretKey();
      const secretKey = await poseidon2Hash([Fr.fromBuffer(secretKeyBuffer)]);
      const salt = Fr.fromBuffer(signer.deriveSalt());

      const wallet = pxeInstance.wallet;
      const accountManager = await AccountManager.create(
        wallet,
        secretKey,
        accountContract,
        salt
      );

      const account = await accountManager.getAccount();

      const instance = accountManager.getInstance();
      const artifact = await accountManager
        .getAccountContract()
        .getContractArtifact();
      await wallet.registerContract(
        instance,
        artifact,
        accountManager.getSecretKey()
      );

      wallet.addAccount(account);

      const accountAddress = accountManager.address;

      set({ status: 'deploying' });
      try {
        const metadata = await wallet.getContractMetadata(accountAddress);
        if (!metadata.isContractInitialized) {
          const deployMethod = await accountManager.getDeployMethod();
          const paymentMethod =
            await pxeInstance.getSponsoredFeePaymentMethod();

          await deployMethod
            .send({
              from: AztecAddress.ZERO,
              fee: { paymentMethod },
              skipClassPublication: true,
              skipInstancePublication: true,
            })
            .wait({ timeout: 120 });
        }
      } catch {
        // Don't throw - account is created, just not deployed
      }

      // Update state
      currentSigner = signer;
      set({
        account,
        walletType: WalletType.EXTERNAL_SIGNER,
        status: 'connected',
        signerType: signer.type,
        connectedRdns: signer.rdns ?? null,
      });

      return account;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      set({
        status: 'disconnected',
        error: message,
        pxeStatus: 'error',
        pxeError: message,
      });

      // Disconnect the signer so next attempt can use a different wallet
      signer.disconnect();

      throw err;
    }
  },
});

export const disconnectExternalSigner = (): void => {
  if (currentSigner) {
    currentSigner.disconnect();
    currentSigner = null;
  }
};
