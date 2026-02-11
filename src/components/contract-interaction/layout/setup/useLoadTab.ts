import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInvokeFlowData, useContractActions } from '../../../../store';
import {
  isValidAztecAddress,
  toSidebarId,
} from '../../../../utils/contractInteraction';
import type { ArtifactInputMethod, ContractSource } from './setup-utils';
import type { PreconfiguredContract } from '../../../../config/preconfiguredContracts';

interface UseLoadTabOptions {
  preconfiguredContracts: PreconfiguredContract[];
  savedContracts: Array<{ address: string; label?: string }>;
  artifactInput: string;
  parseError: string | null;
  isLoadingPreconfigured: boolean;
  onLoad: () => void;
  onArtifactChange: (value: string) => void;
  onSelectPreconfigured: (id: string | null) => void;
  onContractLoaded: (contractId: string) => void;
  onSelectExisting: (contractId: string) => void;
}

export const useLoadTab = (options: UseLoadTabOptions) => {
  const {
    preconfiguredContracts,
    savedContracts,
    artifactInput,
    parseError,
    isLoadingPreconfigured,
    onLoad,
    onArtifactChange,
    onSelectPreconfigured,
    onContractLoaded,
    onSelectExisting,
  } = options;

  const [loadSource, setLoadSource] = useState<ContractSource>('custom');
  const [artifactMethod, setArtifactMethod] =
    useState<ArtifactInputMethod>(null);

  const { address, preconfiguredId } = useInvokeFlowData();
  const { setInvokeTarget, pushLog } = useContractActions();

  // Selected preconfigured contract
  const selectedPreconfigured = useMemo(
    () => preconfiguredContracts.find((c) => c.id === preconfiguredId) ?? null,
    [preconfiguredContracts, preconfiguredId]
  );

  // Build preloaded file for preconfigured contracts
  const preloadedArtifactFile = useMemo(() => {
    if (loadSource !== 'preconfigured' || !selectedPreconfigured) return null;
    const artifactJson = selectedPreconfigured.artifactJson;
    const content =
      typeof artifactJson === 'string'
        ? artifactJson
        : JSON.stringify(artifactJson, null, 2);
    return {
      name: `${selectedPreconfigured.label.replace(/\s+/g, '-').toLowerCase()}.json`,
      size: new Blob([content]).size,
      content,
    };
  }, [loadSource, selectedPreconfigured]);

  // Validation
  const isValidAddress = !address || isValidAztecAddress(address);

  const canLoadContract =
    loadSource === 'custom'
      ? Boolean(address && artifactInput && isValidAddress)
      : loadSource === 'preconfigured' &&
        selectedPreconfigured &&
        !isLoadingPreconfigured;

  // Clear address and artifact when starting with custom mode (on mount)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (loadSource === 'custom') {
        setInvokeTarget('');
        onArtifactChange('');
        onSelectPreconfigured(null);
      }
    }
  }, [loadSource, setInvokeTarget, onArtifactChange, onSelectPreconfigured]);

  // --- Handlers ---

  const handleArtifactChange = useCallback(
    (value: string) => {
      onArtifactChange(value);
    },
    [onArtifactChange]
  );

  const handleLoadSourceChange = useCallback(
    (source: ContractSource) => {
      setLoadSource(source);
      setArtifactMethod(null);
      if (source === 'custom') {
        onSelectPreconfigured(null);
        setInvokeTarget('');
        onArtifactChange('');
      } else if (preconfiguredContracts.length > 0) {
        onSelectPreconfigured(preconfiguredContracts[0].id);
      }
    },
    [
      onSelectPreconfigured,
      preconfiguredContracts,
      setInvokeTarget,
      onArtifactChange,
    ]
  );

  const handleArtifactMethodChange = useCallback(
    (method: ArtifactInputMethod) => {
      setArtifactMethod(method);
      onArtifactChange('');
    },
    [onArtifactChange]
  );

  const handleLoad = useCallback(() => {
    const normalizedAddress = address.toLowerCase();

    const existingSaved = savedContracts.find(
      (c) => c.address.toLowerCase() === normalizedAddress
    );
    if (existingSaved) {
      onSelectExisting(toSidebarId(existingSaved.address));
      pushLog({
        level: 'info',
        title: 'Contract already loaded',
        detail: `Showing existing contract: ${existingSaved.label ?? 'Custom Contract'}`,
      });
      return;
    }

    onLoad();
    onContractLoaded(toSidebarId(address));
  }, [
    address,
    savedContracts,
    onSelectExisting,
    pushLog,
    onLoad,
    onContractLoaded,
  ]);

  return {
    // Props for LoadTabContent
    source: {
      selected: loadSource,
      preconfiguredContracts,
      onChange: handleLoadSourceChange,
    },
    artifact: {
      method: artifactMethod,
      value: artifactInput,
      parseError,
      isLoadingPreconfigured,
      preloadedFile: preloadedArtifactFile,
      onMethodChange: handleArtifactMethodChange,
      onChange: handleArtifactChange,
    },
    canLoad: !!canLoadContract,
    onLoad: handleLoad,
  };
};
