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
  const artifactInput = useArtifactInput();
  const parseError = useParseError();
  const isLoadingPreconfigured = useIsLoadingPreconfigured();
  const { refreshSavedContracts } = useArtifactActions();
  const { clearLogs } = useContractActions();

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

  // Build sidebar contracts list
  const sidebarContracts: SidebarContract[] = useMemo(() => {
    const contracts: SidebarContract[] = [];

    // Add preconfigured contracts
    preconfiguredContracts.forEach((contract) => {
      contracts.push({
        id: contract.id,
        name: contract.label,
        address: contract.address,
        type: 'preconfigured',
      });
    });

    // Add saved contracts
    savedContracts.forEach((contract) => {
      // Skip if already in preconfigured
      const isPreconfigured = preconfiguredContracts.some(
        (p) => p.address.toLowerCase() === contract.address.toLowerCase()
      );
      if (!isPreconfigured) {
        contracts.push({
          id: `saved-${contract.address}`,
          name: contract.label ?? 'Custom Contract',
          address: contract.address,
          type: 'saved',
        });
      }
    });

    return contracts;
  }, [preconfiguredContracts, savedContracts]);

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

      // If it's a preconfigured contract, load it directly with artifact
      const preconfigured = preconfiguredContracts.find((c) => c.id === id);
      if (preconfigured) {
        await loadArtifactWithData(
          preconfigured.address,
          preconfigured.artifactJson,
          preconfigured.label
        );
        return;
      }

      // If it's a saved contract, load it from cache
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
      preconfiguredContracts,
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
          setSimulationResult({
            value: successLog.detail,
            type: 'unknown',
            timestamp: new Date(),
            functionName,
          });
        }
      }, 100);
    },
    [invokerSimulate, setSimulationResult]
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
      />

      {viewMode === 'setup' && (
        <ContractSetupPanel
          networkName={currentConfig?.name}
          preconfiguredContracts={preconfiguredContracts}
          artifactInput={artifactInput}
          parseError={parseError}
          isLoadingPreconfigured={isLoadingPreconfigured}
          onLoad={onLoad}
          onArtifactChange={onArtifactChange}
          onSelectPreconfigured={onSelectPreconfigured}
          onContractLoaded={handleContractLoaded}
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
