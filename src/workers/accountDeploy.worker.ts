/// <reference lib="webworker" />

import { Buffer } from 'buffer';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import {
  AccountManager,
  BaseWallet,
  type Wallet,
} from '@aztec/aztec.js/wallet';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { createPXE, getPXEConfig } from '@aztec/pxe/client/lazy';
import {
  type AccountWithSecretKey,
  type Account,
  SignerlessAccount,
} from '@aztec/aztec.js/account';
import type { PXE } from '@aztec/pxe/server';

import type { WorkerRequest, WorkerResponse } from './messages';

declare const self: DedicatedWorkerGlobalScope;

/**
 * MinimalWallet extends BaseWallet to bootstrap account creation in worker
 */
class MinimalWallet extends BaseWallet {
  private readonly addressToAccount = new Map<string, AccountWithSecretKey>();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    super(pxe as unknown as any, aztecNode);
  }

  public addAccount(account: AccountWithSecretKey) {
    this.addressToAccount.set(account.getAddress().toString(), account);
  }

  protected async getAccountFromAddress(
    address: AztecAddress
  ): Promise<Account> {
    let account: Account | undefined;
    if (address.equals(AztecAddress.ZERO)) {
      const chainInfo = await this.getChainInfo();
      account = new SignerlessAccount(chainInfo);
    } else {
      account = this.addressToAccount.get(address.toString());
    }

    if (!account)
      throw new Error(
        `Account not found in wallet for address: ${address.toString()}`
      );
    return account;
  }

  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    return Array.from(this.addressToAccount.values()).map((acc) => ({
      alias: '',
      item: acc.getAddress(),
    }));
  }
}

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
    const { nodeUrl, secretKey, signingKeyHex, salt } = msg.payload;
    console.log('🔧 Worker received:', {
      nodeUrl,
      secretKey: typeof secretKey,
      signingKeyHex: typeof signingKeyHex,
      salt: typeof salt,
    });

    // Connect to the Aztec node and create a PXE instance
    const aztecNode = createAztecNodeClient(nodeUrl);
    const config = getPXEConfig();
    config.proverEnabled = true;
    const pxe = await createPXE(aztecNode, config);

    // Create MinimalWallet for account management
    const minimalWallet = new MinimalWallet(pxe as unknown as PXE, aztecNode);

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

    // Create an ECDSA account contract
    const accountContract = new EcdsaRAccountContract(signingKey);

    // Use MinimalWallet for AccountManager
    const ecdsaAccount = await AccountManager.create(
      minimalWallet,
      secretFr,
      accountContract,
      saltFr
    );

    // Register the account
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

    console.log(await minimalWallet.getContractMetadata(ecdsaAccount.address));

    const deployMethod = await ecdsaAccount.getDeployMethod();
    const sponsoredPFC = await getSponsoredPFCContract();
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredPFC.address);

    try {
      const provenInteraction = await deployMethod.simulate({
        from: ecdsaAccount.address,
        contractAddressSalt: saltFr,
        fee: { paymentMethod },
        universalDeploy: true,
        //TODO: Review this options
        // skipClassRegistration: true,
        // skipPublicDeployment: true,
      });
      const receipt = await provenInteraction.result
        .send()
        .wait({ timeout: 120 });

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
