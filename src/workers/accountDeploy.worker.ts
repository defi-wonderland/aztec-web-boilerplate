/// <reference lib="webworker" />

import { Buffer } from 'buffer';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { createLogger } from '@aztec/aztec.js/log';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { createPXE, getPXEConfig } from '@aztec/pxe/client/lazy';
import type { PXE } from '@aztec/pxe/server';
import { createStore } from '@aztec/kv-store/indexeddb';
import { MinimalWallet } from '../utils/MinimalWallet';
import type { WorkerRequest, WorkerResponse } from './messages';

declare const self: DedicatedWorkerGlobalScope;

/** Maximum time to wait for account deployment transaction (in seconds) */
const DEPLOY_TIMEOUT = 120;
const pxeLogger = createLogger('pxe-worker');

const getStoreName = (networkName: string | undefined, rollupAddress: AztecAddress) =>
  networkName ? `aztec-pxe-${networkName}` : `aztec-pxe-${rollupAddress.toString()}`;

async function getSponsoredPFCContract() {
  const { getContractInstanceFromInstantiationParams } = await import(
    '@aztec/aztec.js/contracts'
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
    const { nodeUrl, secretKey, signingKeyHex, salt, networkName } = msg.payload;
    console.log('🔧 Worker received:', {
      nodeUrl,
      secretKey: typeof secretKey,
      signingKeyHex: typeof signingKeyHex,
      salt: typeof salt,
    });

    const aztecNode = createAztecNodeClient(nodeUrl);
    const config = getPXEConfig();
    config.proverEnabled = true;
    const l1Contracts = await aztecNode.getL1ContractAddresses();
    config.l1Contracts = l1Contracts;

    const storeName = getStoreName(networkName, l1Contracts.rollupAddress);
    const pxeStore = await createStore(
      storeName,
      {
        dataDirectory: 'pxe',
        dataStoreMapSizeKb: 2e10,
      },
      pxeLogger
    );

    const pxe = await createPXE(aztecNode, config, {
      store: pxeStore,
      useLogSuffix: false,
    });

    const minimalWallet = new MinimalWallet(pxe as unknown as PXE, aztecNode);

    await pxe.registerContract({
      instance: await getSponsoredPFCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    const secretKeyStr = String(secretKey);
    const saltStr = String(salt);
    const signingKeyHexStr = String(signingKeyHex);

    const secretFr = Fr.fromString(secretKeyStr);
    const saltFr = Fr.fromString(saltStr);
    const signingKey = Buffer.from(signingKeyHexStr, 'hex');

    const accountContract = new EcdsaRAccountContract(signingKey);

    const ecdsaAccount = await AccountManager.create(
      minimalWallet,
      secretFr,
      accountContract,
      saltFr
    );

    const ecdsaWallet = await ecdsaAccount.getAccount();
    const instance = ecdsaAccount.getInstance();
    const artifact = await ecdsaAccount
      .getAccountContract()
      .getContractArtifact();
    await minimalWallet.registerContract(
      instance,
      artifact,
      ecdsaAccount.getSecretKey()
    );
    minimalWallet.addAccount(ecdsaWallet);

    const metadata = await minimalWallet.getContractMetadata(
      ecdsaAccount.address
    );

    if (metadata.isContractInitialized) {
      console.log('✅ Account already deployed, skipping deployment');
      const response: WorkerResponse = {
        type: 'deployed',
        payload: {
          status: 'already_deployed',
          txHash: null,
        },
      };
      self.postMessage(response);
      return;
    }

    const deployMethod = await ecdsaAccount.getDeployMethod();
    const sponsoredPFC = await getSponsoredPFCContract();
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredPFC.address);

    const receipt = await deployMethod
      .send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        skipClassPublication: true,
        skipInstancePublication: true,
      })
      .wait({ timeout: DEPLOY_TIMEOUT });

    const response: WorkerResponse = {
      type: 'deployed',
      payload: {
        status: String(receipt.status),
        txHash: receipt.txHash ? receipt.txHash.toString() : null,
      },
    };
    self.postMessage(response);
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
