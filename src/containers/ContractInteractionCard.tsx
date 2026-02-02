import React, { useCallback } from 'react';
import { Wrench, FileUp, Rocket } from 'lucide-react';
import { useAztecWallet } from '../aztec-wallet';
import {
  DeployFlow,
  InvokeFlow,
  LogPanel,
} from '../components/contract-interaction';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { useContractDeployer, useLoadArtifact } from '../hooks/contracts';
import { useDeployableContracts } from '../hooks/useInteractionContracts';
import {
  useIsDeployMode,
  useContractActions,
  useFormActions,
  useContractCallLogs,
} from '../store';
import { iconSize } from '../utils';
import { buildDeploymentLabel } from '../utils/deployableContracts';
import type {
  ContractConstructor,
  DeployableContract,
} from '../utils/deployableContracts';

const styles = {
  headerIcon: 'text-accent',
  cardHeader: 'flex flex-row items-start gap-3',
  tabsList: 'mb-4',
} as const;

export const ContractInteractionCard: React.FC = () => {
  const { isConnected, isPXEInitialized, account, currentConfig } =
    useAztecWallet();

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
  const logs = useContractCallLogs();

  const handleModeChange = useCallback(
    (newMode: string) => {
      setMode(newMode as 'existing' | 'deploy');
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
        loadArtifactWithData(
          result.address ?? '',
          deployable.artifactJson,
          deployedLabel
        ).catch((err) => {
          pushLog({
            level: 'error',
            title: 'Failed to load deployed contract',
            detail: err instanceof Error ? err.message : 'Unknown error',
          });
        });
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

  const deploymentErrorMessage = deployError ?? getUnsupportedMessage();

  if (!isConnected || !isPXEInitialized) {
    return null;
  }

  const currentMode = isDeployMode ? 'deploy' : 'existing';

  return (
    <Card>
      <CardHeader className={styles.cardHeader}>
        <Wrench size={iconSize('xl')} className={styles.headerIcon} />
        <div>
          <CardTitle>Contract Interaction</CardTitle>
          <CardDescription>
            {isDeployMode &&
              'Deploy a new contract instance with custom constructor parameters.'}
            {!isDeployMode &&
              'Load a contract artifact to explore callable and read-only functions, then simulate or execute with your inputs.'}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {deployableContracts.length > 0 && (
          <Tabs value={currentMode} onValueChange={handleModeChange}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="existing" disabled={isDeploying}>
                <FileUp size={iconSize()} />
                Use Contract
              </TabsTrigger>
              <TabsTrigger value="deploy" disabled={isDeploying}>
                <Rocket size={iconSize()} />
                Deploy New Contract
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing">
              <InvokeFlow
                networkName={currentConfig?.name}
                connectedAddress={connectedAddress}
              />
            </TabsContent>

            <TabsContent value="deploy">
              <DeployFlow
                networkName={currentConfig?.name}
                onDeploy={handleDeploy}
                isDeploying={isDeploying}
                deploymentError={deploymentErrorMessage}
                canDeploy={canDeploy()}
              />
            </TabsContent>
          </Tabs>
        )}

        {deployableContracts.length === 0 && (
          <InvokeFlow
            networkName={currentConfig?.name}
            connectedAddress={connectedAddress}
          />
        )}

        <LogPanel logs={logs} />
      </CardContent>
    </Card>
  );
};
