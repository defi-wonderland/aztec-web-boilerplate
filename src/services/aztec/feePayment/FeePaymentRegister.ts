/**
 * Fee Payment Register
 *
 * Handles registration of fee payment contracts with PXE.
 */

import { MeteredContractArtifact } from '@defi-wonderland/aztec-fee-payment/src/ts/dist/artifacts/Metered';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createLogger } from '@aztec/aztec.js/log';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import type { PXE } from '@aztec/pxe/server';
import type { FeePaymentContractsConfig } from '../../../config/networks/types';

const logger = createLogger('fee-payment-register');

interface FPCConfig {
  name: string;
  artifact: ContractArtifact;
  salt: Fr;
  deployer?: AztecAddress;
  expectedAddress?: string;
}

interface RegisteredFPC {
  name: string;
  address: AztecAddress;
}

/**
 * Register for fee payment contracts.
 * Tracks and registers all FPCs needed by the application.
 */
export class FeePaymentRegister {
  private registeredFPCs: RegisteredFPC[] = [];

  async registerAll(
    pxe: PXE,
    feePaymentConfig?: FeePaymentContractsConfig
  ): Promise<RegisteredFPC[]> {
    this.registeredFPCs = [];

    const fpcsToRegister: FPCConfig[] = [
      {
        name: 'sponsored',
        artifact: SponsoredFPCContractArtifact,
        salt: new Fr(SPONSORED_FPC_SALT),
      },
    ];

    if (feePaymentConfig?.metered?.address) {
      fpcsToRegister.push({
        name: 'metered',
        artifact: MeteredContractArtifact,
        salt: Fr.fromString(feePaymentConfig.metered.salt ?? '1337'),
        deployer: feePaymentConfig.metered.deployer
          ? AztecAddress.fromString(feePaymentConfig.metered.deployer)
          : AztecAddress.ZERO,
        expectedAddress: feePaymentConfig.metered.address,
      });
    }

    for (const fpc of fpcsToRegister) {
      await this.registerFPC(pxe, fpc);
    }

    logger.info(
      `Registered ${this.registeredFPCs.length} fee payment contract(s)`,
      this.registeredFPCs.map((fpc) => fpc.name)
    );

    return this.registeredFPCs;
  }

  getRegisteredFPCs(): RegisteredFPC[] {
    return [...this.registeredFPCs];
  }

  private async registerFPC(pxe: PXE, config: FPCConfig): Promise<void> {
    const { getContractInstanceFromInstantiationParams } = await import(
      '@aztec/aztec.js/contracts'
    );

    const instance = await getContractInstanceFromInstantiationParams(
      config.artifact,
      {
        salt: config.salt,
        deployer: config.deployer,
      }
    );

    if (config.expectedAddress) {
      const expected = AztecAddress.fromString(config.expectedAddress);
      if (!instance.address.equals(expected)) {
        logger.warn(
          `${config.name} FPC address mismatch: expected ${config.expectedAddress}, got ${instance.address.toString()}`
        );
      }
    }

    await pxe.registerContract({
      instance,
      artifact: config.artifact,
    });

    this.registeredFPCs.push({
      name: config.name,
      address: instance.address,
    });

    logger.debug(`Registered ${config.name} FPC`, {
      address: instance.address.toString(),
    });
  }
}
