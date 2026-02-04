import { useCallback, useEffect, useMemo, useRef } from 'react';
import { readFieldCompressedString } from '@aztec/aztec.js/utils';
import {
  PRECONFIGURED_CONTRACTS,
  type PreconfiguredContract,
} from '../../config/preconfiguredContracts';
import {
  useContractTargetAddress,
  useContractActions,
  useFormValues,
  useFormActions,
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
  deleteArtifact,
  getCacheStatusMessage,
  persistCachedContracts,
  removeContract,
  resolveCachedArtifact,
} from '../../utils/contractCache';
import {
  createArtifactSummary,
  formatFunctionSignature,
  formatResultData,
  loadAndPrepareArtifact,
  parseArtifactSource,
  validateAndBuildCallArgs,
} from '../../utils/contractInteraction';
import {
  ArtifactParseError,
  ArtifactFetchError,
  getErrorMessage,
} from '../../utils/errors';
import { requestPersistentStorage } from '../../utils/indexeddb';
import { safeStringify } from '../../utils/string';
import { useFunctionGroups } from '../useFunctionGroups';
import { resolvePreconfiguredArtifact } from '../useInteractionContracts';
import { useDynamicContractCaller } from './useDynamicContractCaller';
import type {
  FunctionGroup,
  InvokeStatus,
} from '../../components/contract-interaction/types';
import type { AztecNetwork } from '../../config/networks/constants';
import type { ArtifactSummary, ParsedFunction } from '../../types/artifact';
import type { CachedContract } from '../../utils/contractCache';

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
  artifactSummary: ArtifactSummary | null;
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
  const { setInvokeTarget, pushLog } = useContractActions();
  const { reset: resetFormValues } = useFormActions();

  // Artifact state from Zustand (instead of local useState)
  const savedContracts = useSavedContracts();
  const parsed = useParsedArtifact();
  const artifactInput = useArtifactInput();
  const parseError = useParseError();
  const isLoadingPreconfigured = useIsLoadingPreconfigured();

  const {
    setArtifactInput,
    setSavedContracts,
    refreshSavedContracts,
    resetArtifact,
    setArtifactState,
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

  const artifactSummary = parsed?.functions?.length
    ? createArtifactSummary(parsed)
    : null;

  const status: InvokeStatus = isSimulating
    ? 'simulating'
    : isExecuting
      ? 'executing'
      : 'idle';

  const clearContractState = useCallback(() => {
    resetArtifact();
  }, [resetArtifact]);

  const loadArtifactWithData = useCallback(
    async (
      loadAddress: string,
      loadArtifactJson: string,
      customLabel?: string
    ) => {
      requestPersistentStorage();

      const result = loadAndPrepareArtifact(loadArtifactJson, loadAddress);

      if (!result.success) {
        setArtifactState({ error: result.error });
        pushLog({
          level: 'error',
          title: 'Artifact parse failed',
          detail: getErrorMessage(result.error),
        });
        return;
      }

      const {
        parsed: parsedArtifact,
        address: resolvedAddress,
        contractLabel,
      } = result;

      setArtifactState({ parsed: parsedArtifact, error: null });
      setInvokeTarget(resolvedAddress, null);
      resetFormValues();
      pushLog({
        level: 'success',
        title: 'Artifact loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions`,
      });

      const cacheResult = await cacheAndPersistArtifact({
        address: resolvedAddress,
        artifactInput: loadArtifactJson,
        label: customLabel ?? contractLabel,
        savedContracts: getContractInteractionStore().savedContracts,
        networkName,
      });
      setSavedContracts(cacheResult.updatedContracts);

      const cacheMsg = getCacheStatusMessage(cacheResult.stored);
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
      setInvokeTarget,
      setArtifactState,
      setSavedContracts,
      resetFormValues,
      pushLog,
    ]
  );

  const handleLoadArtifact = useCallback(
    () => loadArtifactWithData(address, artifactInput),
    [address, artifactInput, loadArtifactWithData]
  );

  const handleSelectPreconfigured = useCallback(
    async (contractId: string | null) => {
      if (!contractId) {
        setInvokeTarget('', null);
        clearContractState();
        return;
      }

      const contract = PRECONFIGURED_CONTRACTS.find(
        (c): c is PreconfiguredContract => c.id === contractId
      );
      if (!contract) return;

      setInvokeTarget(contract.address, contractId);
      setArtifactState({ isLoading: true, error: null });
      resetFormValues();

      try {
        const artifactJson = await resolvePreconfiguredArtifact(contract);
        if (!artifactJson) {
          setArtifactState({
            error: new ArtifactFetchError(
              'Artifact not available for this contract'
            ),
            isLoading: false,
          });
          return;
        }
        setArtifactInput(artifactJson);
        setArtifactState({ isLoading: false });
      } catch (err) {
        const error =
          err instanceof ArtifactFetchError
            ? err
            : new ArtifactFetchError(
                err instanceof Error ? err.message : 'Failed to load artifact',
                undefined,
                undefined,
                err
              );
        setArtifactState({ error, isLoading: false });
      }
    },
    [
      setInvokeTarget,
      setArtifactState,
      setArtifactInput,
      resetFormValues,
      clearContractState,
    ]
  );

  const handleApplySaved = useCallback(
    async (contract: CachedContract) => {
      setInvokeTarget(contract.address, null);
      setArtifactInput('');
      setArtifactState({ error: null });
      resetFormValues();

      const resolved = await resolveCachedArtifact(contract);
      if (!resolved.found) {
        setArtifactState({ parsed: null });
        const detail =
          resolved.reason === 'extended_storage_unavailable'
            ? 'Cached artifact unavailable (too large / cleared); paste it to load functions.'
            : 'Artifact not cached (too large); paste it to load functions.';
        pushLog({ level: 'info', title: 'Address applied', detail });
        return;
      }

      try {
        const parsedArtifact = parseArtifactSource(resolved.artifact);
        setArtifactState({ parsed: parsedArtifact });
        setArtifactInput(resolved.artifact);
        pushLog({
          level: 'success',
          title: 'Saved contract loaded',
          detail: `Loaded ${parsedArtifact.functions.length} functions from cache`,
        });
      } catch (err) {
        const error =
          err instanceof ArtifactParseError
            ? err
            : ArtifactParseError.invalidStructure(
                err instanceof Error
                  ? err.message
                  : 'Failed to parse cached artifact'
              );
        setArtifactState({ parsed: null, error });
        pushLog({
          level: 'error',
          title: 'Cached artifact parse failed',
          detail: getErrorMessage(error),
        });
      }
    },
    [
      setInvokeTarget,
      setArtifactInput,
      setArtifactState,
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
    setInvokeTarget(latest?.address ?? '', null);
    setArtifactInput('');
    setArtifactState({ parsed: null });
    resetFormValues();
  }, [
    networkName,
    refreshSavedContracts,
    setInvokeTarget,
    setArtifactInput,
    setArtifactState,
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
    parseError: parseError ? getErrorMessage(parseError) : null,
    isLoadingPreconfigured,
    hasContract,
    hasCache,
    contractName,
    groups: grouped,
    status,
    error: callerError,
    artifactSummary,
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
