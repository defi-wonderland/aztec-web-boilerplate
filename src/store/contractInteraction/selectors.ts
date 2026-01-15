import { useShallow } from 'zustand/react/shallow';
import {
  findPreconfiguredContract,
  findDeployableById,
  findConstructorByName,
} from '../../hooks/useInteractionContracts';
import { useContractInteractionStore } from './store';
import type { AztecNetwork } from '../../config/networks/constants';

export const useContractMode = () =>
  useContractInteractionStore((state) => state.mode);

export const useIsDeployMode = () =>
  useContractInteractionStore((state) => state.mode === 'deploy');

export const useContractCallLogs = () =>
  useContractInteractionStore((state) => state.logs);

export const useContractTargetAddress = () =>
  useContractInteractionStore((state) => state.address);

export const useIsCustomDeployable = () =>
  useContractInteractionStore((state) => state.deployableId === null);

export const useSelectedPreconfigured = (networkName?: AztecNetwork) => {
  const preconfiguredId = useContractInteractionStore(
    (state) => state.preconfiguredId
  );
  return findPreconfiguredContract(preconfiguredId, networkName);
};

export const useSelectedDeployable = (networkName?: AztecNetwork) => {
  const deployableId = useContractInteractionStore(
    (state) => state.deployableId
  );
  return findDeployableById(deployableId, networkName);
};

export const useSelectedConstructor = (networkName?: AztecNetwork) => {
  const deployableId = useContractInteractionStore(
    (state) => state.deployableId
  );
  const constructorName = useContractInteractionStore(
    (state) => state.constructorName
  );
  return findConstructorByName(deployableId, constructorName, networkName);
};

export const useContractActions = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      setMode: state.setMode,
      setPreconfiguredId: state.setPreconfiguredId,
      setAddress: state.setAddress,
      setDeployableId: state.setDeployableId,
      setSelectedConstructor: state.setSelectedConstructor,
      pushLog: state.pushLog,
      clearLogs: state.clearLogs,
      reset: state.reset,
    }))
  );

export const useInvokeFlowState = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      preconfiguredId: state.preconfiguredId,
      address: state.address,
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

export const useParseError = () =>
  useContractInteractionStore((state) => state.parseError);

export const useSavedContracts = () =>
  useContractInteractionStore((state) => state.savedContracts);

export const useIsLoadingPreconfigured = () =>
  useContractInteractionStore((state) => state.isLoadingPreconfigured);

export const useArtifactActions = () =>
  useContractInteractionStore(
    useShallow((state) => ({
      setArtifactInput: state.setArtifactInput,
      setParsedArtifact: state.setParsedArtifact,
      setParseError: state.setParseError,
      setSavedContracts: state.setSavedContracts,
      setIsLoadingPreconfigured: state.setIsLoadingPreconfigured,
      refreshSavedContracts: state.refreshSavedContracts,
      clearArtifactState: state.clearArtifactState,
    }))
  );
