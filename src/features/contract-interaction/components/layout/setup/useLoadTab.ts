import { useCallback, useMemo, useState } from 'react';
import { useInvokeFlowData, useContractActions } from '../../../store';
import { isValidAztecAddress, toSidebarId } from '../../../utils';
import type { ArtifactInputMethod, ContractSource } from './setup-utils';
import type { PreconfiguredContract } from '../../../../../types/preconfiguredContract';

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
  // Use embedded artifactJson when available, otherwise fall back to
  // the store's artifactInput (fetched via classId from the registry)
  const preloadedArtifactFile = useMemo(() => {
    if (loadSource !== 'preconfigured' || !selectedPreconfigured) return null;
    const content = selectedPreconfigured.artifactJson ?? artifactInput;
    if (!content) return null;
    return {
      name: `${selectedPreconfigured.label.replace(/\s+/g, '-').toLowerCase()}.json`,
      size: new Blob([content]).size,
      content,
    };
  }, [loadSource, selectedPreconfigured, artifactInput]);

  // Validation
  const isValidAddress = !address || isValidAztecAddress(address);

  const canLoadContract =
    loadSource === 'custom'
      ? Boolean(address && artifactInput && isValidAddress && !parseError)
      : loadSource === 'preconfigured' &&
        Boolean(address && isValidAddress) &&
        selectedPreconfigured &&
        !isLoadingPreconfigured;

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
        setInvokeTarget('', null);
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
    if (!address) {
      pushLog({
        level: 'error',
        title: 'Missing address',
        detail: 'Cannot load contract without a valid address.',
      });
      return;
    }

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
