import React, { useCallback, useEffect, useMemo } from 'react';
import { useAztecWallet } from '../../../aztec-wallet';
import { useContractInvoker } from '../../../hooks/contracts';
import { usePreconfiguredContracts } from '../../../hooks/useInteractionContracts';
import {
  useViewMode,
  useSidebarSelectedId,
  useLayoutActions,
  useContractCallLogs,
  useSavedContracts,
  useParsedArtifact,
  useArtifactInput,
  useParseError,
  useIsLoadingPreconfigured,
  useArtifactActions,
  useSelectedFunctionName,
  useFunctionFilter,
  useSimulationResult,
  useExplorerActions,
  useContractActions,
  getContractInteractionStore,
} from '../../../store';
import { cn } from '../../../utils';
import { resolveCachedArtifact } from '../../../utils/contractCache';
import { formatParsedType } from '../../../utils/contractInteraction';
import ContractExplorerPanel from './ContractExplorerPanel';
import ContractSetupPanel from './ContractSetupPanel';
import ContractSidebar from './ContractSidebar';
import type { SidebarContract } from './ContractSidebar';

const styles = {
  layout: cn('flex w-full h-[calc(100vh-72px)]', 'bg-surface-secondary'),
} as const;

export const ContractLayout: React.FC = () => {
  const { isConnected, isPXEInitialized, account, currentConfig } =
    useAztecWallet();

  const viewMode = useViewMode();
  const sidebarSelectedId = useSidebarSelectedId();
  const { setViewMode, setSidebarSelectedId } = useLayoutActions();
  const logs = useContractCallLogs();
  const savedContracts = useSavedContracts();
  const parsedArtifact = useParsedArtifact();
  const artifactInput = useArtifactInput();
  const parseError = useParseError();
  const isLoadingPreconfigured = useIsLoadingPreconfigured();
  const { refreshSavedContracts, deleteSavedContract } = useArtifactActions();
  const { clearLogs, pushLog } = useContractActions();

  // Explorer state
  const selectedFunctionName = useSelectedFunctionName();
  const functionFilter = useFunctionFilter();
  const simulationResult = useSimulationResult();
  const { setSelectedFunctionName, setFunctionFilter, setSimulationResult } =
    useExplorerActions();

  const preconfiguredContracts = usePreconfiguredContracts(currentConfig?.name);
  const connectedAddress = account?.getAddress().toString() ?? '';

  const {
    onLoad,
    onArtifactChange,
    onSelectPreconfigured,
    loadArtifactWithData,
    groups,
    contractName,
    hasContract: _hasContract,
    status,
    error,
    onSimulate: invokerSimulate,
    onExecute: invokerExecute,
  } = useContractInvoker({
    networkName: currentConfig?.name,
    filter: functionFilter,
  });

  // Refresh saved contracts on mount
  useEffect(() => {
    refreshSavedContracts(currentConfig?.name);
  }, [currentConfig?.name, refreshSavedContracts]);

  // Auto-load artifact when we have a selected contract but no parsed artifact
  // This handles the case when page is refreshed or state is restored without artifact
  useEffect(() => {
    let cancelled = false;

    const autoLoadArtifact = async () => {
      // Only auto-load if we're in explorer mode with a selected contract but no artifact
      if (
        viewMode !== 'explorer' ||
        !sidebarSelectedId ||
        parsedArtifact !== null ||
        savedContracts.length === 0
      ) {
        return;
      }

      // Extract address from sidebar ID (format: saved-${address})
      if (!sidebarSelectedId.startsWith('saved-')) return;

      const address = sidebarSelectedId.replace('saved-', '');
      const savedContract = savedContracts.find(
        (c) => c.address.toLowerCase() === address.toLowerCase()
      );

      if (!savedContract) {
        // Contract not found in saved list, go back to setup
        setViewMode('setup');
        setSidebarSelectedId(null);
        return;
      }

      // Load artifact from cache
      const result = await resolveCachedArtifact(savedContract);

      // Check if cancelled during async operation
      if (cancelled) return;

      if (result.found) {
        await loadArtifactWithData(
          savedContract.address,
          result.artifact,
          savedContract.label
        );
      } else {
        // Artifact not found in cache, go back to setup
        // User will need to re-load the artifact
        pushLog({
          level: 'info',
          title: 'Artifact not cached',
          detail: `Artifact for ${savedContract.label ?? savedContract.address} was not found in cache. Please reload it.`,
        });
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
    savedContracts,
    loadArtifactWithData,
    setViewMode,
    setSidebarSelectedId,
    pushLog,
  ]);

  // Build sidebar contracts list - only saved contracts, not preconfigured
  // Preconfigured contracts are available in "Select Contract Source" options
  const sidebarContracts: SidebarContract[] = useMemo(() => {
    return savedContracts.map((contract) => ({
      id: `saved-${contract.address}`,
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

      // All sidebar contracts are saved contracts (format: saved-${address})
      if (id.startsWith('saved-')) {
        const address = id.replace('saved-', '');
        const savedContract = savedContracts.find(
          (c) => c.address.toLowerCase() === address.toLowerCase()
        );
        if (savedContract) {
          const result = await resolveCachedArtifact(savedContract);
          if (result.found) {
            await loadArtifactWithData(
              savedContract.address,
              result.artifact,
              savedContract.label
            );
          }
        }
      }
    },
    [
      setSidebarSelectedId,
      setViewMode,
      setSelectedFunctionName,
      loadArtifactWithData,
      savedContracts,
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

  const handleSelectFunction = useCallback(
    (name: string) => {
      setSelectedFunctionName(name);
    },
    [setSelectedFunctionName]
  );

  const handleFilterChange = useCallback(
    (filter: string) => {
      setFunctionFilter(filter);
    },
    [setFunctionFilter]
  );

  const handleDeleteContract = useCallback(
    async (contract: SidebarContract) => {
      await deleteSavedContract(contract.address, currentConfig?.name);

      pushLog({
        level: 'success',
        title: 'Contract removed',
        detail: `${contract.name} has been removed from your saved contracts.`,
      });

      // If the deleted contract was selected, go back to setup
      if (sidebarSelectedId === contract.id) {
        setSidebarSelectedId(null);
        setViewMode('setup');
      }
    },
    [
      deleteSavedContract,
      currentConfig?.name,
      sidebarSelectedId,
      setSidebarSelectedId,
      setViewMode,
      pushLog,
    ]
  );

  // Wrap simulate to capture result
  const handleSimulate = useCallback(
    async (functionName: string) => {
      await invokerSimulate(functionName);
      // After simulation, check the latest log for the result
      // The result will be captured from the log detail
      // Use a small timeout to allow the store to update
      setTimeout(() => {
        const store = getContractInteractionStore();
        const latestLogs = store.logs;
        const successLog = latestLogs.find(
          (log) => log.level === 'success' && log.title.includes('Simulation')
        );
        if (successLog?.detail) {
          // Find the function to get its return type
          const selectedFn = groups
            .flatMap((g) => g.items)
            .find((fn) => fn.name === functionName);
          const returnType = selectedFn?.output
            ? formatParsedType(selectedFn.output)
            : 'void';

          setSimulationResult({
            value: successLog.detail,
            type: returnType,
            timestamp: new Date(),
            functionName,
          });
        }
      }, 100);
    },
    [invokerSimulate, setSimulationResult, groups]
  );

  const handleExecute = useCallback(
    async (functionName: string) => {
      await invokerExecute(functionName);
    },
    [invokerExecute]
  );

  const handleClearLogs = useCallback(() => {
    clearLogs();
    setSimulationResult(null);
  }, [clearLogs, setSimulationResult]);

  // Don't render if not connected
  if (!isConnected || !isPXEInitialized) {
    return null;
  }

  const isSetupSelected = viewMode === 'setup';

  return (
    <div className={styles.layout}>
      <ContractSidebar
        contracts={sidebarContracts}
        selectedContractId={sidebarSelectedId}
        selectedContract={selectedContract}
        isSetupSelected={isSetupSelected}
        functionGroups={groups}
        selectedFunctionName={selectedFunctionName}
        functionFilter={functionFilter}
        onBack={handleBack}
        onAddContract={handleAddContract}
        onSelectContract={handleSelectContract}
        onSelectFunction={handleSelectFunction}
        onFilterChange={handleFilterChange}
        onDeleteContract={handleDeleteContract}
      />

      {viewMode === 'setup' && (
        <ContractSetupPanel
          networkName={currentConfig?.name}
          preconfiguredContracts={preconfiguredContracts}
          savedContracts={savedContracts}
          artifactInput={artifactInput}
          parseError={parseError}
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
          networkName={currentConfig?.name}
          connectedAddress={connectedAddress}
          contractName={contractName}
          groups={groups}
          selectedFunctionName={selectedFunctionName}
          simulationResult={simulationResult}
          logs={logs}
          status={status}
          error={error}
          onSimulate={handleSimulate}
          onExecute={handleExecute}
          onClearLogs={handleClearLogs}
        />
      )}
    </div>
  );
};

export default ContractLayout;
