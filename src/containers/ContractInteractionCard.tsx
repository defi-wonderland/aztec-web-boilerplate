import React, { useCallback } from 'react';
import {
  DeployFlow,
  InvokeFlow,
  LogPanel,
} from '../components/contract-interaction';
import { useUniversalWallet } from '../hooks';
import { useContractDeployer, useLoadArtifact } from '../hooks/contracts';
import { useDeployableContracts } from '../hooks/useInteractionContracts';
import { useIsDeployMode, useContractActions, useFormActions } from '../store';
import { buildDeploymentLabel } from '../utils/deployableContracts';
import type {
  ContractConstructor,
  DeployableContract,
} from '../utils/deployableContracts';

export const ContractInteractionCard: React.FC = () => {
  const { isConnected, isInitialized, account, currentConfig } =
    useUniversalWallet();

  const isDeployModeRaw = useIsDeployMode();
  const deployableContracts = useDeployableContracts(currentConfig?.name);

  const isDeployMode = deployableContracts.length > 0 && isDeployModeRaw;

  const { setMode, setAddress, pushLog } = useContractActions();
  const { reset: resetFormValues } = useFormActions();

  const loadArtifactWithData = useLoadArtifact(currentConfig?.name);

  const {
    deploy,
    isDeploying,
    error: deployError,
    clearError: clearDeployError,
    canDeploy,
    getUnsupportedMessage,
  } = useContractDeployer();

  const connectedAddress = account?.getAddress().toString() ?? '';

  const handleModeChange = useCallback(
    (newMode: 'existing' | 'deploy') => {
      setMode(newMode);
      resetFormValues();
      clearDeployError();
    },
    [setMode, resetFormValues, clearDeployError]
  );

  const handleDeploy = useCallback(
    async (
      deployable: DeployableContract,
      constructor: ContractConstructor,
      deployFormValues: Record<string, string>
    ) => {
      pushLog({
        level: 'info',
        title: 'Deploying contract',
        detail: `${deployable.label} using ${constructor.label}`,
      });

      const result = await deploy({
        contract: deployable,
        constructor,
        args: deployFormValues,
      });

      if (!result.success) {
        pushLog({
          level: 'error',
          title: 'Deployment failed',
          detail: result.error ?? 'Unknown error',
        });
        return;
      }

      const deployedLabel = buildDeploymentLabel(deployable, deployFormValues);

      pushLog({
        level: 'success',
        title: 'Contract deployed',
        detail: `${deployedLabel} at ${result.address}${result.txHash ? ` | TX: ${result.txHash}` : ''}`,
      });

      setMode('existing');
      setAddress(result.address ?? '');
      resetFormValues();

      requestAnimationFrame(() => {
        void loadArtifactWithData(
          result.address ?? '',
          deployable.artifactJson,
          deployedLabel
        );
      });
    },
    [
      deploy,
      pushLog,
      setMode,
      setAddress,
      resetFormValues,
      loadArtifactWithData,
    ]
  );

  // Deployment error message (either from hook or unsupported wallet)
  const deploymentErrorMessage = deployError ?? getUnsupportedMessage();

  if (!isConnected || !isInitialized) {
    return null;
  }

  return (
    <div className="contract-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">🧰</span>
        </div>
        <div>
          <h3>Contract Interaction</h3>
          <p>
            {isDeployMode
              ? 'Deploy a new contract instance with custom constructor parameters.'
              : 'Load a contract artifact to explore callable and read-only functions, then simulate or execute with your inputs.'}
          </p>
        </div>
      </div>

      {deployableContracts.length > 0 && (
        <div className="mode-toggle-container">
          <div
            className="mode-toggle"
            role="tablist"
            aria-label="Contract mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isDeployMode}
              className={`mode-toggle-btn${!isDeployMode ? ' active' : ''}`}
              onClick={() => handleModeChange('existing')}
              disabled={isDeploying}
            >
              Invoke
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isDeployMode}
              className={`mode-toggle-btn${isDeployMode ? ' active' : ''}`}
              onClick={() => handleModeChange('deploy')}
              disabled={isDeploying}
            >
              Deploy
            </button>
          </div>
        </div>
      )}

      {isDeployMode && (
        <DeployFlow
          networkName={currentConfig?.name}
          onDeploy={handleDeploy}
          isDeploying={isDeploying}
          deploymentError={deploymentErrorMessage}
          canDeploy={canDeploy()}
        />
      )}

      {!isDeployMode && (
        <InvokeFlow
          networkName={currentConfig?.name}
          connectedAddress={connectedAddress}
        />
      )}

      <LogPanel />
    </div>
  );
};
