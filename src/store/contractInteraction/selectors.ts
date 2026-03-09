import { useShallow } from 'zustand/react/shallow';
import { useFindDeployableById } from '../../hooks/useInteractionContracts';
import { createArtifactSummary } from '../../utils/contractInteraction';
import { getErrorMessage } from '../../utils/errors';
import { useContractInteractionStore } from './store';
import type { AztecNetwork } from '../../types/network';

export const useIsDeployMode = () =>
  useContractInteractionStore((state) => state.mode === 'deploy');

export const useContractCallLogs = () =>
  useContractInteractionStore((state) => state.logs);

export const useContractTargetAddress = () =>
  useContractInteractionStore((state) => state.address);

export const useIsCustomDeployable = () =>
  useContractInteractionStore((state) => state.deployableId === null);

export const useSelectedDeployable = (networkName?: AztecNetwork) => {
  const deployableId = useContractInteractionStore(
    (state) => state.deployableId
  );
  return useFindDeployableById(deployableId, networkName);
};

export const useContractActions = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      setMode: state.setMode,
      setAddress: state.setAddress,
      setInvokeTarget: state.setInvokeTarget,
      setDeployTarget: state.setDeployTarget,
      pushLog: state.pushLog,
      clearLogs: state.clearLogs,
      reset: state.reset,
      setSelectedConstructor: state.setSelectedConstructor,
    }))
  );

export const useDeployFlowState = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      deployableId: state.deployableId,
      constructorName: state.constructorName,
    }))
  );

export const useArtifactActions = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      setArtifactInput: state.setArtifactInput,
      setSavedContracts: state.setSavedContracts,
      refreshSavedContracts: state.refreshSavedContracts,
      deleteSavedContract: state.deleteSavedContract,
      resetArtifact: state.resetArtifact,
      setArtifactState: state.setArtifactState,
    }))
  );

// UI Layout selectors
export const useViewMode = () =>
  useContractInteractionStore((state) => state.viewMode);

export const useSidebarSelectedId = () =>
  useContractInteractionStore((state) => state.sidebarSelectedId);

export const useLayoutActions = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      setViewMode: state.setViewMode,
      setSidebarSelectedId: state.setSidebarSelectedId,
    }))
  );

// Explorer selectors
export const useSelectedFunctionName = () =>
  useContractInteractionStore((state) => state.selectedFunctionName);

export const useFunctionFilter = () =>
  useContractInteractionStore((state) => state.functionFilter);

export const useSimulationResult = () =>
  useContractInteractionStore((state) => state.simulationResult);

export const useExplorerActions = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      setSelectedFunctionName: state.setSelectedFunctionName,
      setFunctionFilter: state.setFunctionFilter,
      setSimulationResult: state.setSimulationResult,
    }))
  );

/**
 * Combined selector for all invoke-related state.
 * Returns raw store values plus derived helpers.
 */
export const useInvokeFlowData = () => {
  const state = useContractInteractionStore(
    useShallow((s) => ({
      address: s.address,
      artifactInput: s.artifactInput,
      savedContracts: s.savedContracts,
      isLoadingPreconfigured: s.isLoadingPreconfigured,
      preconfiguredId: s.preconfiguredId,
      parsedArtifact: s.parsedArtifact,
      parseError: s.parseError,
    }))
  );

  const { address, savedContracts, parsedArtifact, parseError } = state;

  // Derived values
  const hasContract = (parsedArtifact?.functions?.length ?? 0) > 0;
  const hasCache = savedContracts.length > 0;

  const contractName = (() => {
    const parsedName = (
      parsedArtifact?.compiled as { name?: string } | undefined
    )?.name;
    if (parsedName) return parsedName;
    return savedContracts.find(
      (c) => c.address.trim().toLowerCase() === address.trim().toLowerCase()
    )?.label;
  })();

  const artifactSummary = parsedArtifact?.functions?.length
    ? createArtifactSummary(parsedArtifact)
    : null;

  const parseErrorMessage = parseError ? getErrorMessage(parseError) : null;

  return {
    address: state.address,
    artifactInput: state.artifactInput,
    savedContracts: state.savedContracts,
    isLoadingPreconfigured: state.isLoadingPreconfigured,
    preconfiguredId: state.preconfiguredId,
    parsedArtifact: state.parsedArtifact,
    parseError: state.parseError,
    hasContract,
    hasCache,
    contractName,
    artifactSummary,
    parseErrorMessage,
  };
};
