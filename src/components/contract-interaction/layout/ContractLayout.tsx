import React, { useCallback, useEffect, useMemo } from 'react';
import { useAztecWallet } from '../../../aztec-wallet';
import { useContractInvoker, useLoadArtifact } from '../../../hooks/contracts';
import { usePreconfiguredContracts } from '../../../hooks/useInteractionContracts';
import { getArtifactStorageService } from '../../../services/storage';
import {
  useViewMode,
  useSidebarSelectedId,
  useLayoutActions,
  useInvokeFlowData,
  useArtifactActions,
  useFunctionFilter,
  useExplorerActions,
  useContractActions,
  getContractInteractionStore,
} from '../../../store';
import { cn } from '../../../utils';
import {
  formatParsedType,
  toSidebarId,
  fromSidebarId,
} from '../../../utils/contractInteraction';
import { ContractExplorerPanel } from './ContractExplorerPanel';
import { ContractSetupPanel } from './ContractSetupPanel';
import { ContractSidebar } from './ContractSidebar';
import type { SidebarContract } from './ContractSidebar';

const styles = {
  layout: cn('flex w-full h-[calc(100vh-72px)]', 'bg-surface-secondary'),
} as const;

export const ContractLayout: React.FC = () => {
  const { isConnected, isPXEInitialized, account, currentConfig } =
    useAztecWallet();
  const networkName = currentConfig?.name;

  const viewMode = useViewMode();
  const sidebarSelectedId = useSidebarSelectedId();
  const { setViewMode, setSidebarSelectedId } = useLayoutActions();
  const {
    savedContracts,
    parsedArtifact,
    artifactInput,
    parseErrorMessage,
    isLoadingPreconfigured,
  } = useInvokeFlowData();
  const { refreshSavedContracts, deleteSavedContract } = useArtifactActions();
  const { pushLog } = useContractActions();
  const functionFilter = useFunctionFilter();
  const { setSelectedFunctionName, setSimulationResult } = useExplorerActions();

  const preconfiguredContracts = usePreconfiguredContracts(networkName);
  const connectedAddress = account?.getAddress().toString() ?? '';

  const {
    onLoad,
    onArtifactChange,
    onSelectPreconfigured,
    groups,
    status,
    onSimulate: invokerSimulate,
    onExecute: invokerExecute,
  } = useContractInvoker({
    networkName: networkName,
    filter: functionFilter,
  });

  const loadArtifactWithData = useLoadArtifact(networkName);

  const loadSavedContractArtifact = useCallback(
    async (sidebarId: string): Promise<boolean> => {
      const address = fromSidebarId(sidebarId);
      if (!address) return false;

      // Read savedContracts from the store snapshot to avoid closing over
      // the array reference, which would recreate this callback (and the
      // auto-load effect) every time the list changes.
      const currentSavedContracts =
        getContractInteractionStore().savedContracts;
      const savedContract = currentSavedContracts.find(
        (c) => c.address.toLowerCase() === address.toLowerCase()
      );
      if (!savedContract) return false;

      const storage = getArtifactStorageService();
      const artifact = savedContract.artifactKey
        ? await storage.get(savedContract.artifactKey)
        : null;

      if (artifact) {
        try {
          await loadArtifactWithData(
            savedContract.address,
            artifact,
            savedContract.label
          );
          return true;
        } catch (err) {
          pushLog({
            level: 'error',
            title: 'Failed to load cached artifact',
            detail:
              err instanceof Error ? err.message : 'Artifact data is corrupt',
          });
          return false;
        }
      }

      pushLog({
        level: 'info',
        title: 'Artifact not cached',
        detail: `Artifact for ${savedContract.label ?? savedContract.address} was not found in cache. Please reload it.`,
      });
      return false;
    },
    [loadArtifactWithData, pushLog]
  );

  // Refresh saved contracts on mount
  useEffect(() => {
    refreshSavedContracts(networkName);
  }, [networkName, refreshSavedContracts]);

  // Auto-load artifact when we have a selected contract but no parsed artifact
  useEffect(() => {
    let cancelled = false;

    const autoLoadArtifact = async () => {
      const hasSavedContracts =
        getContractInteractionStore().savedContracts.length > 0;

      if (
        viewMode !== 'explorer' ||
        !sidebarSelectedId ||
        parsedArtifact !== null ||
        !hasSavedContracts
      ) {
        return;
      }

      if (cancelled) return;

      const loaded = await loadSavedContractArtifact(sidebarSelectedId);

      if (cancelled) return;

      if (!loaded) {
        setViewMode('setup');
        setSidebarSelectedId(null);
      }
    };

    autoLoadArtifact();

    return () => {
      cancelled = true;
    };
  }, [
    viewMode,
    sidebarSelectedId,
    parsedArtifact,
    loadSavedContractArtifact,
    setViewMode,
    setSidebarSelectedId,
  ]);

  // Build sidebar contracts list
  const sidebarContracts: SidebarContract[] = useMemo(() => {
    return savedContracts.map((contract) => ({
      id: toSidebarId(contract.address),
      name: contract.label ?? 'Custom Contract',
      address: contract.address,
      type: 'saved' as const,
    }));
  }, [savedContracts]);

  // Get currently selected contract
  const selectedContract = useMemo(() => {
    if (!sidebarSelectedId) return null;
    return sidebarContracts.find((c) => c.id === sidebarSelectedId) ?? null;
  }, [sidebarContracts, sidebarSelectedId]);

  // Handlers
  const handleSelectContract = useCallback(
    async (id: string) => {
      setSidebarSelectedId(id);
      setViewMode('explorer');
      setSelectedFunctionName(null);

      try {
        await loadSavedContractArtifact(id);
      } catch (err) {
        pushLog({
          level: 'error',
          title: 'Failed to load contract',
          detail:
            err instanceof Error ? err.message : 'An unexpected error occurred',
        });
        setViewMode('setup');
        setSidebarSelectedId(null);
      }
    },
    [
      setSidebarSelectedId,
      setViewMode,
      setSelectedFunctionName,
      loadSavedContractArtifact,
      pushLog,
    ]
  );

  const handleBack = useCallback(() => {
    setViewMode('setup');
    setSidebarSelectedId(null);
    setSelectedFunctionName(null);
  }, [setViewMode, setSidebarSelectedId, setSelectedFunctionName]);

  const handleAddContract = useCallback(() => {
    setSidebarSelectedId(null);
    setViewMode('setup');
    setSelectedFunctionName(null);
  }, [setSidebarSelectedId, setViewMode, setSelectedFunctionName]);

  const handleContractLoaded = useCallback(
    (contractId: string) => {
      setSidebarSelectedId(contractId);
      setViewMode('explorer');
      setSelectedFunctionName(null);
    },
    [setSidebarSelectedId, setViewMode, setSelectedFunctionName]
  );

  const handleDeleteContract = useCallback(
    async (contract: SidebarContract) => {
      try {
        await deleteSavedContract(contract.address, networkName);

        pushLog({
          level: 'success',
          title: 'Contract removed',
          detail: `${contract.name} has been removed from your saved contracts.`,
        });

        if (sidebarSelectedId === contract.id) {
          setSidebarSelectedId(null);
          setViewMode('setup');
        }
      } catch (err) {
        pushLog({
          level: 'error',
          title: 'Failed to delete contract',
          detail:
            err instanceof Error ? err.message : 'An unexpected error occurred',
        });
      }
    },
    [
      deleteSavedContract,
      networkName,
      sidebarSelectedId,
      setSidebarSelectedId,
      setViewMode,
      pushLog,
    ]
  );

  // Wrap simulate to capture result
  const handleSimulate = useCallback(
    async (functionName: string) => {
      try {
        const result = await invokerSimulate(functionName);
        if (result) {
          const selectedFn = groups
            .flatMap((g) => g.items)
            .find((fn) => fn.name === functionName);
          const returnType = selectedFn?.output
            ? formatParsedType(selectedFn.output)
            : 'void';

          setSimulationResult({
            value: result,
            type: returnType,
            timestamp: Date.now(),
            functionName,
          });
        }
      } catch (err) {
        pushLog({
          level: 'error',
          title: 'Simulation failed',
          detail:
            err instanceof Error ? err.message : 'An unexpected error occurred',
        });
      }
    },
    [invokerSimulate, setSimulationResult, groups, pushLog]
  );

  const handleExecute = useCallback(
    async (functionName: string) => {
      try {
        await invokerExecute(functionName);
      } catch (err) {
        pushLog({
          level: 'error',
          title: 'Execution failed',
          detail:
            err instanceof Error ? err.message : 'An unexpected error occurred',
        });
      }
    },
    [invokerExecute, pushLog]
  );

  // Don't render if not connected
  if (!isConnected || !isPXEInitialized) {
    return null;
  }

  return (
    <div className={styles.layout}>
      <ContractSidebar
        contracts={sidebarContracts}
        selectedContract={selectedContract}
        functionGroups={groups}
        onBack={handleBack}
        onAddContract={handleAddContract}
        onSelectContract={handleSelectContract}
        onDeleteContract={handleDeleteContract}
      />

      {viewMode === 'setup' && (
        <ContractSetupPanel
          networkName={networkName}
          preconfiguredContracts={preconfiguredContracts}
          savedContracts={savedContracts}
          artifactInput={artifactInput}
          parseError={parseErrorMessage}
          isLoadingPreconfigured={isLoadingPreconfigured}
          onLoad={onLoad}
          onArtifactChange={onArtifactChange}
          onSelectPreconfigured={onSelectPreconfigured}
          onContractLoaded={handleContractLoaded}
          onSelectExisting={handleSelectContract}
        />
      )}

      {viewMode === 'explorer' && (
        <ContractExplorerPanel
          connectedAddress={connectedAddress}
          groups={groups}
          status={status}
          onSimulate={handleSimulate}
          onExecute={handleExecute}
        />
      )}
    </div>
  );
};
