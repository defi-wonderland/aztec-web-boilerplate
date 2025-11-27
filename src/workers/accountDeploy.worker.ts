/// <reference lib="webworker" />

import { Buffer } from 'buffer';
import {
  Fr,
  createPXEClient,
  SponsoredFeePaymentMethod,
} from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa/lazy';

import type { WorkerRequest, WorkerResponse } from './messages';

declare const self: DedicatedWorkerGlobalScope;

async function getSponsoredPFCContract() {
  const { getContractInstanceFromInstantiationParams } = await import(
    '@aztec/aztec.js'
  );
  return await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );
}

self.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as WorkerRequest;
  if (!msg || msg.type !== 'deployEcdsaAccount') return;

  try {
    const { nodeUrl, secretKey, signingKeyHex, salt } = msg.payload;
    console.log('🔧 Worker received:', {
      nodeUrl,
      secretKey: typeof secretKey,
      signingKeyHex: typeof signingKeyHex,
      salt: typeof salt,
    });

    // Connect to the PXE/node endpoint
    const pxe = createPXEClient(nodeUrl);

    await pxe.registerContract({
      instance: await getSponsoredPFCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // Ensure we have strings
    const secretKeyStr = String(secretKey);
    const saltStr = String(salt);
    const signingKeyHexStr = String(signingKeyHex);

    const secretFr = Fr.fromString(secretKeyStr);
    const saltFr = Fr.fromString(saltStr);
    const signingKey = Buffer.from(signingKeyHexStr, 'hex');

    const ecdsaAccount = await getEcdsaRAccount(
      pxe,
      secretFr,
      signingKey,
      saltFr
    );

    console.log(await pxe.getContractMetadata(ecdsaAccount.getAddress()));

    // Always register the account in the worker context to ensure proper PXE state
    try {
      await ecdsaAccount.register();
      console.log('✅ Account registered with worker PXE');
    } catch (registerError) {
      console.warn(
        '⚠️ Account registration with worker PXE failed (may already be registered)',
        registerError
      );
      // Continue with deployment even if registration fails
    }

    const deployMethod = await ecdsaAccount.getDeployMethod();
    const sponsoredPFC = await getSponsoredPFCContract();
    const paymentMethod = await ecdsaAccount.getSelfPaymentMethod(
      new SponsoredFeePaymentMethod(sponsoredPFC.address)
    );

    try {
      const provenInteraction = await deployMethod.prove({
        from: ecdsaAccount.getAddress(),
        contractAddressSalt: saltFr,
        fee: { paymentMethod },
        universalDeploy: true,
        //TODO: Review this options
        // skipClassRegistration: true,
        // skipPublicDeployment: true,
      });
      const receipt = await provenInteraction.send().wait({ timeout: 120 });

      const response: WorkerResponse = {
        type: 'deployed',
        payload: {
          status: String(receipt.status),
          txHash: receipt.txHash ? receipt.txHash.toString() : null,
        },
      };
      self.postMessage(response);
    } catch (deployError) {
      const deployMessage =
        deployError instanceof Error
          ? deployError.message
          : String(deployError);

      // Check if the error is due to account already being deployed
      if (
        deployMessage.includes('Existing nullifier') ||
        deployMessage.includes('Invalid tx: Existing nullifier')
      ) {
        // Account is already deployed, just return success
        const response: WorkerResponse = {
          type: 'deployed',
          payload: {
            status: 'success',
            txHash: null,
          },
        };
        self.postMessage(response);
      } else {
        // Re-throw other deployment errors
        throw deployError;
      }
    }
  } catch (error) {
    console.error('❌ Worker deployment error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const response: WorkerResponse = {
      type: 'error',
      error: `Worker error: ${message}`,
    };
    self.postMessage(response);
  }
});
