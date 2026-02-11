import { useCallback, useState } from 'react';
import {
  loadContractArtifact,
  type ContractArtifact,
} from '@aztec/aztec.js/abi';
import { Contract, DeployMethod } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { PublicKeys } from '@aztec/aztec.js/keys';
import {
  useAztecWallet,
  hasAppManagedPXE,
  isBrowserWalletConnector,
} from '../../aztec-wallet';
import { createFeePaymentMethod } from '../../services/aztec/feePayment';
import { useFeePayment } from '../../store/feePayment';
import { buildArgsFromInputs } from '../../utils/contractInteraction';
import { restoreBytecodeBuffers } from '../../utils/storage';
import type { DeployResult } from '../../components/contract-interaction/types';
import type { SerializedArtifact } from '../../types/artifactRegistry';
import type {
  DeployableContract,
  ContractConstructor,
} from '../../utils/deployableContracts';

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
  const { connector, account, currentConfig } = useAztecWallet();
  const { method: feePaymentMethod } = useFeePayment();
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDeploy = useCallback((): boolean => {
    if (!connector || !account) {
      return false;
    }
    return hasAppManagedPXE(connector);
  }, [connector, account]);

  const getUnsupportedMessage = useCallback((): string | null => {
    if (!connector) {
      return 'No wallet connected';
    }
    if (!account) {
      return 'No account available';
    }
    if (isBrowserWalletConnector(connector)) {
      return 'Browser wallets do not support direct deployment. Please use an Embedded wallet to deploy contracts.';
    }
    return null;
  }, [connector, account]);

  const deploy = useCallback(
    async (params: DeployParams): Promise<DeployResult> => {
      const { contract, constructor: ctor, args: formValues } = params;

      if (!connector || !account) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (!hasAppManagedPXE(connector)) {
        return {
          success: false,
          error:
            'Deployment requires an app-managed PXE wallet (Embedded or External Signer)',
        };
      }

      setIsDeploying(true);
      setError(null);

      try {
        const wallet = connector.getWallet();
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

        // Get fee payment method from global store (undefined if FPC disabled)
        const paymentMethod = await createFeePaymentMethod(feePaymentMethod, {
          config: currentConfig?.feePaymentContracts ?? {
            enabled: false,
            contracts: {},
          },
          getSponsoredFeePaymentMethod: () =>
            connector.getSponsoredFeePaymentMethod(),
        });

        const contract = await deployMethod.send({
          from: account.getAddress(),
          contractAddressSalt: salt,
          ...(paymentMethod ? { fee: { paymentMethod } } : {}),
          universalDeploy: true,
          skipInitialization: false,
          wait: { timeout: 900 },
        });

        const deployedAddress = contract.address.toString();

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
    [connector, account, feePaymentMethod, currentConfig?.feePaymentContracts]
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
