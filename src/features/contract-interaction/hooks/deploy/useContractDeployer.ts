import { useCallback, useState } from 'react';
import {
  loadContractArtifact,
  type ContractArtifact,
} from '@aztec/aztec.js/abi';
import { Contract, DeployMethod } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { PublicKeys } from '@aztec/aztec.js/keys';
import { TxStatus } from '@aztec/stdlib/tx';
import { useAztecWallet, hasAppManagedPXE, WalletType } from '@aztec-wallet';
import type { SerializedArtifact } from '@contract-registry';
import { createFeePaymentMethod } from '../../../settings/services/feePayment';
import { useFeePayment } from '../../../settings/store/feePayment';
import { restoreBytecodeBuffers } from '../../../../utils/storage';
import { buildArgsFromInputs } from '../../utils';
import type {
  DeployableContract,
  ContractConstructor,
} from '../../../../utils/deployableContracts';
import type { DeployResult } from '../../components/types';

/**
 * Detect if parsed JSON is already a ContractArtifact (from registry)
 * vs a NoirCompiledContract (from local build).
 * ContractArtifact has functions with `isInitializer` boolean.
 * NoirCompiledContract has functions with `custom_attributes` array.
 */
const isRegistryArtifact = (parsed: unknown): parsed is SerializedArtifact => {
  if (!parsed || typeof parsed !== 'object') return false;
  const obj = parsed as { functions?: Array<{ isInitializer?: boolean }> };
  const firstFn = obj.functions?.[0];
  return firstFn !== undefined && typeof firstFn.isInitializer === 'boolean';
};

export interface DeployParams {
  contract: DeployableContract;
  constructor: ContractConstructor;
  args: Record<string, string>;
}

/**
 * Hook for deploying contracts to the Aztec network.
 * Handles artifact loading, argument building, and deployment transactions.
 * Uses the global fee payment method from Settings.
 *
 * @returns Object with deploy function, status, and error handling utilities.
 */
export const useContractDeployer = () => {
  const { connector, account, currentConfig, walletType, getWallet } =
    useAztecWallet();
  const { method: feePaymentMethod } = useFeePayment();
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDeploy = useCallback((): boolean => {
    if (!account) {
      return false;
    }
    return walletType !== WalletType.BROWSER_WALLET;
  }, [account, walletType]);

  const getUnsupportedMessage = useCallback((): string | null => {
    if (!connector) {
      return 'No wallet connected';
    }
    if (!account) {
      return 'No account available';
    }
    if (walletType === WalletType.BROWSER_WALLET) {
      return 'Browser wallets do not support direct deployment. Please use an Embedded wallet to deploy contracts.';
    }
    return null;
  }, [connector, account, walletType]);

  const deploy = useCallback(
    async (params: DeployParams): Promise<DeployResult> => {
      const { contract, constructor: ctor, args: formValues } = params;

      if (!connector || !account) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (walletType === WalletType.BROWSER_WALLET) {
        return {
          success: false,
          error:
            'Deployment requires an app-managed PXE wallet (Embedded or External Signer)',
        };
      }

      setIsDeploying(true);
      setError(null);

      try {
        const wallet = getWallet();
        if (!wallet) {
          throw new Error('Wallet instance not available');
        }

        if (!contract.artifactJson) {
          throw new Error('Contract artifact not available');
        }

        const parsed = JSON.parse(contract.artifactJson);
        // Registry artifacts are already ContractArtifact format but need bytecode restoration,
        // local artifacts need conversion via loadContractArtifact
        const artifact: ContractArtifact = isRegistryArtifact(parsed)
          ? restoreBytecodeBuffers(parsed)
          : loadContractArtifact(parsed);

        const { args, errors } = buildArgsFromInputs(ctor.inputs, formValues);
        if (errors.length > 0) {
          throw new Error(errors.join('; '));
        }

        // Generate a random salt for unique deployment
        const salt = Fr.random();

        const deployMethod = new DeployMethod(
          PublicKeys.default(),
          wallet,
          artifact,
          (instance, w) => Contract.at(instance.address, artifact, w),
          args,
          ctor.name
        );

        const paymentMethod = await createFeePaymentMethod(feePaymentMethod, {
          config: currentConfig?.feePaymentContracts ?? {},
          getSponsoredFeePaymentMethod: () => {
            if (!hasAppManagedPXE(connector)) {
              throw new Error('Sponsored fee payment requires app-managed PXE');
            }
            return connector.getSponsoredFeePaymentMethod();
          },
        });

        const deployed = await deployMethod.send({
          from: account.getAddress(),
          contractAddressSalt: salt,
          ...(paymentMethod ? { fee: { paymentMethod } } : {}),
          universalDeploy: true,
          skipInitialization: false,
          wait: { timeout: 900, waitForStatus: TxStatus.PROPOSED },
        });

        const deployedAddress = deployed.address.toString();

        return {
          success: true,
          address: deployedAddress,
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Deployment failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsDeploying(false);
      }
    },
    [
      connector,
      account,
      walletType,
      getWallet,
      feePaymentMethod,
      currentConfig?.feePaymentContracts,
    ]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    deploy,
    isDeploying,
    error,
    clearError,
    canDeploy,
    getUnsupportedMessage,
  };
};
