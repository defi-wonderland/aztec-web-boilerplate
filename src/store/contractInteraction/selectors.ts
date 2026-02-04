import { useShallow } from 'zustand/react/shallow';
import { useFindDeployableById } from '../../hooks/useInteractionContracts';
import { createArtifactSummary } from '../../utils/contractInteraction';
import { getErrorMessage } from '../../utils/errors';
import { useContractInteractionStore } from './store';
import type { AztecNetwork } from '../../config/networks/constants';

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
      setInvokeTarget: state.setInvokeTarget,
      setDeployTarget: state.setDeployTarget,
      pushLog: state.pushLog,
      reset: state.reset,
    }))
  );

export const useDeployFlowState = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      deployableId: state.deployableId,
      constructorName: state.constructorName,
    }))
  );

export const useArtifactInput = () =>
  useContractInteractionStore((state) => state.artifactInput);

export const useParsedArtifact = () =>
  useContractInteractionStore((state) => state.parsedArtifact);

export const useSavedContracts = () =>
  useContractInteractionStore((state) => state.savedContracts);

export const useArtifactActions = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      setArtifactInput: state.setArtifactInput,
      setSavedContracts: state.setSavedContracts,
      refreshSavedContracts: state.refreshSavedContracts,
      resetArtifact: state.resetArtifact,
      setArtifactState: state.setArtifactState,
    }))
  );

/**
 * Combined selector for InvokeFlow component.
 * Returns all state needed for the invoke UI in a single hook call.
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

  const {
    address,
    artifactInput,
    savedContracts,
    isLoadingPreconfigured,
    preconfiguredId,
    parsedArtifact,
    parseError,
  } = state;

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
    address,
    artifactInput,
    savedContracts,
    isLoadingPreconfigured,
    preconfiguredId,
    hasContract,
    hasCache,
    contractName,
    artifactSummary,
    parseError: parseErrorMessage,
  };
};
