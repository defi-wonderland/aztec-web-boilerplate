import { useCallback, useEffect, useMemo, useRef } from 'react';
import { readFieldCompressedString } from '@aztec/aztec.js/utils';
import { PRECONFIGURED_CONTRACTS } from '../../config/preconfiguredContracts';
import {
  useContractTargetAddress,
  useContractActions,
  useFormValues,
  useFormActions,
  // New artifact selectors from Zustand
  useArtifactInput,
  useParsedArtifact,
  useParseError,
  useSavedContracts,
  useIsLoadingPreconfigured,
  useArtifactActions,
  getContractInteractionStore,
} from '../../store';
import {
  cacheAndPersistArtifact,
  clearArtifactsDb,
  clearCachedContract,
  constants,
  deleteArtifact,
  getCacheStatusMessage,
  persistCachedContracts,
  removeContract,
  resolveCachedArtifact,
} from '../../utils/contractCache';
import {
  formatFunctionSignature,
  formatResultData,
  loadAndPrepareArtifact,
  parseArtifactSource,
  validateAndBuildCallArgs,
  type ParsedFunction,
} from '../../utils/contractInteraction';
import { safeStringify } from '../../utils/string';
import { useFunctionGroups } from '../useFunctionGroups';
import { useDynamicContractCaller } from './useDynamicContractCaller';
import type {
  FunctionGroup,
  InvokeStatus,
} from '../../components/contract-interaction/types';
import type { AztecNetwork } from '../../config/networks/constants';
import type { CachedContract } from '../../utils/contractCache';

const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) return;
  const alreadyPersisted = await navigator.storage.persisted();
  if (!alreadyPersisted) {
    await navigator.storage.persist();
  }
};

export interface UseContractInvokerOptions {
  networkName?: AztecNetwork;
  filter?: string;
}

export interface UseContractInvokerReturn {
  savedContracts: CachedContract[];
  artifactInput: string;
  parseError: string | null;
  isLoadingPreconfigured: boolean;
  hasContract: boolean;
  hasCache: boolean;
  contractName: string | undefined;
  groups: FunctionGroup[];
  status: InvokeStatus;
  error: string | null;
  onLoad: () => Promise<void>;
  onSimulate: (functionName: string) => Promise<void>;
  onExecute: (functionName: string) => Promise<void>;
  onApplySaved: (contract: CachedContract) => Promise<void>;
  onDeleteSaved: (address: string) => Promise<void>;
  onClearCache: () => void;
  onArtifactChange: (value: string) => void;
  onSelectPreconfigured: (id: string | null) => void;
  loadArtifactWithData: (
    address: string,
    artifactJson: string,
    customLabel?: string
  ) => Promise<void>;
}

export const useContractInvoker = (
  options: UseContractInvokerOptions = {}
): UseContractInvokerReturn => {
  const { networkName, filter = '' } = options;

  // Read from Zustand store
  const address = useContractTargetAddress();
  const formValues = useFormValues();
  const { setAddress, setPreconfiguredId, pushLog } = useContractActions();
  const { reset: resetFormValues } = useFormActions();

  // Artifact state from Zustand (instead of local useState)
  const savedContracts = useSavedContracts();
  const parsed = useParsedArtifact();
  const artifactInput = useArtifactInput();
  const parseError = useParseError();
  const isLoadingPreconfigured = useIsLoadingPreconfigured();

  const {
    setArtifactInput,
    setParsedArtifact,
    setParseError,
    setSavedContracts,
    setIsLoadingPreconfigured,
    refreshSavedContracts,
    clearArtifactState,
  } = useArtifactActions();

  const hasAutoLoadedRef = useRef(false);

  const {
    simulate,
    execute,
    isExecuting,
    isSimulating,
    error: callerError,
  } = useDynamicContractCaller(parsed?.artifact);

  const hasCache = savedContracts.length > 0;
  const hasContract = (parsed?.functions?.length ?? 0) > 0;

  const parsedFunctions = useMemo<ParsedFunction[]>(() => {
    if (!parsed) return [];
    return parsed.functions.map((fn) => ({
      ...fn,
      signature: formatFunctionSignature(fn),
    }));
  }, [parsed]);

  const { grouped } = useFunctionGroups(parsedFunctions, filter);

  const contractName = useMemo(() => {
    const parsedName = (parsed?.compiled as { name?: string } | undefined)
      ?.name;
    if (parsedName) return parsedName;
    return savedContracts.find(
      (c) => c.address.trim().toLowerCase() === address.trim().toLowerCase()
    )?.label;
  }, [parsed, savedContracts, address]);

  const status: InvokeStatus = isSimulating
    ? 'simulating'
    : isExecuting
      ? 'executing'
      : 'idle';

  const clearContractState = useCallback(() => {
    clearArtifactState();
  }, [clearArtifactState]);

  const loadArtifactWithData = useCallback(
    async (
      loadAddress: string,
      loadArtifactJson: string,
      customLabel?: string
    ) => {
      requestPersistentStorage();

      const result = loadAndPrepareArtifact(
        loadArtifactJson,
        loadAddress,
        constants.MAX_CACHE_CHARS
      );

      if (!result.success) {
        setParseError(result.error ?? 'Parse failed');
        pushLog({
          level: 'error',
          title: 'Artifact parse failed',
          detail: result.error ?? 'Unknown error',
        });
        return;
      }

      const {
        parsed: parsedArtifact,
        address: resolvedAddress,
        contractLabel,
        shouldCacheInline,
      } = result;

      setParsedArtifact(parsedArtifact);
      setAddress(resolvedAddress);
      setPreconfiguredId(null);
      setParseError(null);
      pushLog({
        level: 'success',
        title: 'Artifact loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions`,
      });

      const cacheResult = await cacheAndPersistArtifact({
        address: resolvedAddress,
        artifactInput: loadArtifactJson,
        label: customLabel ?? contractLabel,
        shouldCacheInline,
        savedContracts: getContractInteractionStore().savedContracts,
        networkName,
      });
      setSavedContracts(cacheResult.updatedContracts);

      const cacheMsg = getCacheStatusMessage(cacheResult, shouldCacheInline);
      if (cacheMsg) {
        pushLog({
          level: 'info',
          title: 'Cached address only',
          detail: cacheMsg,
        });
      }
    },
    [
      networkName,
      setAddress,
      setPreconfiguredId,
      setParsedArtifact,
      setParseError,
      setSavedContracts,
      pushLog,
    ]
  );

  const handleLoadArtifact = useCallback(
    () => loadArtifactWithData(address, artifactInput),
    [address, artifactInput, loadArtifactWithData]
  );

  const handleSelectPreconfigured = useCallback(
    (contractId: string | null) => {
      if (!contractId) {
        setPreconfiguredId(null);
        clearContractState();
        return;
      }

      const contract = PRECONFIGURED_CONTRACTS.find((c) => c.id === contractId);
      if (!contract) return;

      setPreconfiguredId(contractId);
      setAddress(contract.address);
      setIsLoadingPreconfigured(true);
      setParseError(null);
      resetFormValues();

      requestAnimationFrame(() => {
        setTimeout(() => {
          setArtifactInput(contract.artifactJson);
          setIsLoadingPreconfigured(false);
        }, 50);
      });
    },
    [
      setPreconfiguredId,
      setAddress,
      setIsLoadingPreconfigured,
      setParseError,
      setArtifactInput,
      resetFormValues,
      clearContractState,
    ]
  );

  const handleApplySaved = useCallback(
    async (contract: CachedContract) => {
      setAddress(contract.address);
      setArtifactInput(contract.artifact ?? '');
      setPreconfiguredId(null);
      setParseError(null);
      resetFormValues();

      const resolved = await resolveCachedArtifact(contract);
      if (!resolved.found) {
        setParsedArtifact(null);
        const detail =
          resolved.reason === 'extended_storage_unavailable'
            ? 'Cached artifact unavailable (too large / cleared); paste it to load functions.'
            : 'Artifact not cached (too large); paste it to load functions.';
        pushLog({ level: 'info', title: 'Address applied', detail });
        return;
      }

      try {
        const parsedArtifact = parseArtifactSource(resolved.artifact);
        setParsedArtifact(parsedArtifact);
        pushLog({
          level: 'success',
          title: 'Saved contract loaded',
          detail: `Loaded ${parsedArtifact.functions.length} functions from cache`,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to parse cached artifact';
        setParsedArtifact(null);
        setParseError(message);
        pushLog({
          level: 'error',
          title: 'Cached artifact parse failed',
          detail: message,
        });
      }
    },
    [
      setAddress,
      setArtifactInput,
      setPreconfiguredId,
      setParseError,
      setParsedArtifact,
      resetFormValues,
      pushLog,
    ]
  );

  const handleDeleteSaved = useCallback(
    async (targetAddress: string) => {
      const currentContracts = getContractInteractionStore().savedContracts;
      const target = currentContracts.find(
        (c) => c.address.toLowerCase() === targetAddress.toLowerCase()
      );
      if (target?.artifactKey) await deleteArtifact(target.artifactKey);

      const next = removeContract(currentContracts, targetAddress);
      setSavedContracts(next);
      persistCachedContracts(next, networkName);

      if (address.toLowerCase() === targetAddress.toLowerCase()) {
        clearContractState();
      }
      pushLog({
        level: 'info',
        title: 'Saved contract removed',
        detail: targetAddress,
      });
    },
    [address, networkName, setSavedContracts, clearContractState, pushLog]
  );

  const handleClearCache = useCallback(() => {
    clearCachedContract(networkName);
    clearArtifactsDb();
    setSavedContracts([]);
    clearContractState();
    pushLog({ level: 'info', title: 'Cleared' });
  }, [networkName, setSavedContracts, clearContractState, pushLog]);

  const callFunction = useCallback(
    async (mode: 'simulate' | 'execute', functionName: string) => {
      if (!parsed) {
        pushLog({
          level: 'error',
          title: 'Missing artifact',
          detail: 'Load an artifact first',
        });
        return;
      }

      const selectedFn = grouped
        .flatMap((g) => g.items)
        .find((fn) => fn.name === functionName);
      if (!selectedFn) {
        pushLog({
          level: 'error',
          title: 'Function not found',
          detail: `No function named "${functionName}" in artifact`,
        });
        return;
      }

      const validation = validateAndBuildCallArgs(
        address,
        selectedFn,
        formValues
      );
      if (!validation.valid) {
        pushLog({
          level: 'error',
          title: 'Validation failed',
          detail: validation.error ?? 'Invalid args',
        });
        return;
      }

      const isSimulate = mode === 'simulate';
      const actionLabel = isSimulate ? 'Simulating' : 'Executing';
      pushLog({
        level: 'info',
        title: `${actionLabel} ${selectedFn.name}`,
        detail: `Args: ${safeStringify(validation.args)}`,
      });

      const caller = isSimulate ? simulate : execute;
      const result = await caller({
        address,
        functionName: selectedFn.name,
        args: validation.args,
      });

      if (!result.success) {
        pushLog({
          level: 'error',
          title: `${isSimulate ? 'Simulation' : 'Execution'} failed`,
          detail: result.error ?? 'Unknown error',
        });
        return;
      }

      pushLog({
        level: 'success',
        title: `${isSimulate ? 'Simulation' : 'Execution'} complete`,
        detail: safeStringify(
          formatResultData(
            result.data ?? result.txHash,
            readFieldCompressedString
          )
        ),
      });
    },
    [parsed, address, formValues, grouped, simulate, execute, pushLog]
  );

  const handleSimulate = useCallback(
    (functionName: string) => callFunction('simulate', functionName),
    [callFunction]
  );
  const handleExecute = useCallback(
    (functionName: string) => callFunction('execute', functionName),
    [callFunction]
  );

  // Initialize saved contracts on mount or network change
  useEffect(() => {
    hasAutoLoadedRef.current = false;
    refreshSavedContracts(networkName);
    const cachedList = getContractInteractionStore().savedContracts;
    const latest = cachedList[0];

    // Reset specific state (not full store to preserve logs)
    setPreconfiguredId(null);
    setAddress(latest?.address ?? '');
    setArtifactInput(latest?.artifact ?? '');
    setParsedArtifact(null);
    resetFormValues();
  }, [
    networkName,
    refreshSavedContracts,
    setAddress,
    setArtifactInput,
    setParsedArtifact,
    setPreconfiguredId,
    resetFormValues,
  ]);

  // Auto-load the first saved contract
  useEffect(() => {
    if (hasAutoLoadedRef.current || parsed || savedContracts.length === 0)
      return;
    hasAutoLoadedRef.current = true;
    void handleApplySaved(savedContracts[0]);
  }, [parsed, savedContracts, handleApplySaved]);

  return {
    savedContracts,
    artifactInput,
    parseError,
    isLoadingPreconfigured,
    hasContract,
    hasCache,
    contractName,
    groups: grouped,
    status,
    error: callerError,
    onLoad: handleLoadArtifact,
    onSimulate: handleSimulate,
    onExecute: handleExecute,
    onApplySaved: handleApplySaved,
    onDeleteSaved: handleDeleteSaved,
    onClearCache: handleClearCache,
    onArtifactChange: setArtifactInput,
    onSelectPreconfigured: handleSelectPreconfigured,
    loadArtifactWithData,
  };
};
