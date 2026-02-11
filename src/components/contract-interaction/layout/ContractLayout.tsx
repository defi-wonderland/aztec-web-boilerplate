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
} from '../../../store';
import { cn } from '../../../utils';
import {
  formatParsedType,
  toSidebarId,
  fromSidebarId,
} from '../../../utils/contractInteraction';
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

  const preconfiguredContracts = usePreconfiguredContracts(currentConfig?.name);
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
    networkName: currentConfig?.name,
    filter: functionFilter,
  });

  const loadArtifactWithData = useLoadArtifact(currentConfig?.name);

  // Refresh saved contracts on mount
  useEffect(() => {
    refreshSavedContracts(currentConfig?.name);
  }, [currentConfig?.name, refreshSavedContracts]);

  // Auto-load artifact when we have a selected contract but no parsed artifact
  useEffect(() => {
    let cancelled = false;

    const autoLoadArtifact = async () => {
      if (
        viewMode !== 'explorer' ||
        !sidebarSelectedId ||
        parsedArtifact !== null ||
        savedContracts.length === 0
      ) {
        return;
      }

      const address = fromSidebarId(sidebarSelectedId);
      if (!address) return;
      const savedContract = savedContracts.find(
        (c) => c.address.toLowerCase() === address.toLowerCase()
      );

      if (!savedContract) {
        setViewMode('setup');
        setSidebarSelectedId(null);
        return;
      }

      const storage = getArtifactStorageService();
      const artifact = savedContract.artifactKey
        ? await storage.get(savedContract.artifactKey)
        : null;

      if (cancelled) return;

      if (artifact) {
        await loadArtifactWithData(
          savedContract.address,
          artifact,
          savedContract.label
        );
      } else {
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

      const address = fromSidebarId(id);
      if (address) {
        const savedContract = savedContracts.find(
          (c) => c.address.toLowerCase() === address.toLowerCase()
        );
        if (savedContract) {
          const storage = getArtifactStorageService();
          const artifact = savedContract.artifactKey
            ? await storage.get(savedContract.artifactKey)
            : null;
          if (artifact) {
            await loadArtifactWithData(
              savedContract.address,
              artifact,
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

  const handleDeleteContract = useCallback(
    async (contract: SidebarContract) => {
      await deleteSavedContract(contract.address, currentConfig?.name);

      pushLog({
        level: 'success',
        title: 'Contract removed',
        detail: `${contract.name} has been removed from your saved contracts.`,
      });

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
          timestamp: new Date(),
          functionName,
        });
      }
    },
    [invokerSimulate, setSimulationResult, groups]
  );

  const handleExecute = useCallback(
    async (functionName: string) => {
      await invokerExecute(functionName);
    },
    [invokerExecute]
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
          networkName={currentConfig?.name}
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

export default ContractLayout;
