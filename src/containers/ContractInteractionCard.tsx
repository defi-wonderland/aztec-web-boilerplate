import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUniversalWallet } from '../hooks';
import { useDynamicContractCaller } from '../hooks/contracts/useDynamicContractCaller';
import { useForm } from '../hooks/useForm';
import ArtifactLoader from '../components/contract-interaction/ArtifactLoader';
import FunctionForm from '../components/contract-interaction/FunctionForm';
import FunctionList from '../components/contract-interaction/FunctionList';
import LogPanel from '../components/contract-interaction/LogPanel';
import type { CachedContract, LogEntry } from '../components/contract-interaction/types';
import { useFunctionGroups } from '../hooks/useFunctionGroups';
import {
  analyzeFunctionCapabilities,
  formatFunctionSignature,
  isValidAztecAddress,
  loadAndPrepareArtifact,
  parseArtifactSource,
  validateAndBuildCallArgs,
  type ParsedArtifact,
  type ParsedFunction,
} from '../utils/contractInteraction';
import {
  cacheAndPersistArtifact,
  clearArtifactsDb,
  clearCachedContract,
  constants,
  deleteArtifact,
  getCacheStatusMessage,
  loadCachedContracts,
  persistCachedContracts,
  removeContract,
  resolveCachedArtifact,
} from '../utils/contractCache';
import { PRECONFIGURED_CONTRACTS } from '../config/preconfiguredContracts';

type ArtifactLoaderState = {
  address: string;
  artifactInput: string;
  parseError: string | null;
  selectedPreconfiguredId: string | null;
  isLoadingPreconfigured: boolean;
};

type FunctionExecutorState = {
  selectedFnName: string | null;
  formValues: Record<string, string>;
  filter: string;
};

const INITIAL_ARTIFACT_LOADER: ArtifactLoaderState = {
  address: '',
  artifactInput: '',
  parseError: null,
  selectedPreconfiguredId: null,
  isLoadingPreconfigured: false,
};

const INITIAL_FUNCTION_EXECUTOR: FunctionExecutorState = {
  selectedFnName: null,
  formValues: {},
  filter: '',
};

const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) return;
  const alreadyPersisted = await navigator.storage.persisted();
  if (!alreadyPersisted) {
    await navigator.storage.persist();
  }
};

const safeStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));

export const ContractInteractionCard: React.FC = () => {
  const { isConnected, isInitialized, account, currentConfig } = useUniversalWallet();
  
  const { state: artifact, update: updateArtifact, reset: resetArtifact, setState: setArtifact } = useForm(INITIAL_ARTIFACT_LOADER);
  const { state: executor, update: updateExecutor, reset: resetExecutor } = useForm(INITIAL_FUNCTION_EXECUTOR);
  
  const [savedContracts, setSavedContracts] = useState<CachedContract[]>([]);
  const [parsed, setParsed] = useState<ParsedArtifact | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasAutoLoadedRef = useRef(false);

  const hasCache = savedContracts.length > 0;

  const pushLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLogs((prev) => [{ ...entry, id: `${Date.now()}-${prev.length}` }, ...prev.slice(0, 49)]);
  }, []);

  const handleValueChange = useCallback((path: string, value: string) => {
    updateExecutor({ formValues: { ...executor.formValues, [path]: value } });
  }, [executor.formValues, updateExecutor]);

  const {
    simulate,
    execute,
    isExecuting,
    isSimulating,
    error: callerError,
  } = useDynamicContractCaller(parsed?.artifact);

  const parsedFunctions = useMemo<ParsedFunction[]>(() => {
    if (!parsed) return [];
    return parsed.functions.map((fn) => ({
      ...fn,
      signature: formatFunctionSignature(fn),
    }));
  }, [parsed]);

  const { filteredFunctions, grouped } = useFunctionGroups(parsedFunctions, executor.filter);

  const selectedFn =
    filteredFunctions.find((fn) => fn.name === executor.selectedFnName) ?? filteredFunctions[0] ?? null;

  const handleApplyPreconfigured = (contractId: string | null) => {
    if (!contractId) {
      resetArtifact();
      setParsed(null);
      resetExecutor();
      return;
    }
    
    const contract = PRECONFIGURED_CONTRACTS.find((c) => c.id === contractId);
    if (!contract) return;
    
    updateArtifact({
      selectedPreconfiguredId: contractId,
      isLoadingPreconfigured: true,
      address: contract.address,
      parseError: null,
    });
    resetExecutor();
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        updateArtifact({ artifactInput: contract.artifactJson, isLoadingPreconfigured: false });
      }, 50);
    });
  };

  useEffect(() => {
    hasAutoLoadedRef.current = false;
    const cachedList = loadCachedContracts(currentConfig?.name);
    setSavedContracts(cachedList);
    
    const latest = cachedList[0];
    setArtifact({
      address: latest?.address ?? '',
      artifactInput: latest?.artifact ?? '',
      parseError: null,
      selectedPreconfiguredId: null,
      isLoadingPreconfigured: false,
    });
    setParsed(null);
    resetExecutor();
  }, [currentConfig?.name]);

  useEffect(() => {
    if (hasAutoLoadedRef.current) return;
    if (parsed) return;
    if (savedContracts.length === 0) return;
    hasAutoLoadedRef.current = true;
    void handleApplySaved(savedContracts[0]);
  }, [parsed, savedContracts]);

  useEffect(() => {
    if (filteredFunctions.length > 0 && !executor.selectedFnName) {
      updateExecutor({ selectedFnName: filteredFunctions[0].name });
    }
  }, [filteredFunctions, executor.selectedFnName]);

  const handleLoadArtifact = async () => {
    requestPersistentStorage();

    const result = loadAndPrepareArtifact(artifact.artifactInput, artifact.address, constants.MAX_CACHE_CHARS);
    if (!result.success) {
      updateArtifact({ parseError: result.error });
      pushLog({ level: 'error', title: 'Artifact parse failed', detail: result.error });
      return;
    }

    const { parsed: parsedArtifact, address, contractLabel, shouldCacheInline, firstFunctionName } = result;
    setParsed(parsedArtifact);
    updateArtifact({ parseError: null, address });
    updateExecutor({ selectedFnName: firstFunctionName });
    pushLog({ level: 'success', title: 'Artifact loaded', detail: `Loaded ${parsedArtifact.functions.length} functions` });

    const cacheResult = await cacheAndPersistArtifact({
      address,
      artifactInput: artifact.artifactInput,
      label: contractLabel,
      shouldCacheInline,
      savedContracts,
      networkName: currentConfig?.name,
    });
    setSavedContracts(cacheResult.updatedContracts);

    const cacheMsg = getCacheStatusMessage(cacheResult, shouldCacheInline);
    if (cacheMsg) pushLog({ level: 'info', title: 'Cached address only', detail: cacheMsg });
  };

  const handleClearCache = () => {
    clearCachedContract(currentConfig?.name);
    clearArtifactsDb();
    setSavedContracts([]);
    resetArtifact();
    setParsed(null);
    resetExecutor();
    pushLog({ level: 'info', title: 'Cleared' });
  };

  const handleApplySaved = async (contract: CachedContract) => {
    updateArtifact({
      address: contract.address,
      artifactInput: contract.artifact ?? '',
      parseError: null,
    });
    resetExecutor();

    const resolved = await resolveCachedArtifact(contract);
    if (!resolved.found) {
      setParsed(null);
      const detail = resolved.reason === 'extended_storage_unavailable'
        ? 'Cached artifact unavailable (too large / cleared); paste it to load functions.'
        : 'Artifact not cached (too large); paste it to load functions.';
      pushLog({ level: 'info', title: 'Address applied', detail });
      return;
    }

    try {
      const parsedArtifact = parseArtifactSource(resolved.artifact);
      setParsed(parsedArtifact);
      updateExecutor({ selectedFnName: parsedArtifact.functions[0]?.name ?? null });
      pushLog({
        level: 'success',
        title: 'Saved contract loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions from cache`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse cached artifact';
      setParsed(null);
      updateArtifact({ parseError: message });
      pushLog({ level: 'error', title: 'Cached artifact parse failed', detail: message });
    }
  };

  const handleDeleteSaved = async (targetAddress: string) => {
    const target = savedContracts.find(
      (c) => c.address.toLowerCase() === targetAddress.toLowerCase()
    );
    if (target?.artifactKey) {
      await deleteArtifact(target.artifactKey);
    }
    const next = removeContract(savedContracts, targetAddress);
    setSavedContracts(next);
    persistCachedContracts(next, currentConfig?.name);
    
    // If deleting the currently active contract, reset the form state
    const isActiveContract = artifact.address.toLowerCase() === targetAddress.toLowerCase();
    if (isActiveContract) {
      resetArtifact();
      setParsed(null);
      resetExecutor();
    }
    
    pushLog({ level: 'info', title: 'Saved contract removed', detail: targetAddress });
  };

  const handleCall = async (mode: 'simulate' | 'execute') => {
    if (!parsed) {
      pushLog({ level: 'error', title: 'Missing artifact', detail: 'Load an artifact first' });
      return;
    }

    const validation = validateAndBuildCallArgs(artifact.address, selectedFn, executor.formValues);
    if (!validation.valid) {
      pushLog({ level: 'error', title: 'Validation failed', detail: validation.error });
      return;
    }

    const fnName = selectedFn!.name;
    pushLog({
      level: 'info',
      title: `${mode === 'simulate' ? 'Simulating' : 'Executing'} ${fnName}`,
      detail: `Args: ${safeStringify(validation.args)}`,
    });

    const caller = mode === 'simulate' ? simulate : execute;
    const result = await caller({
      address: artifact.address,
      functionName: fnName,
      args: validation.args,
    });

    if (!result.success) {
      pushLog({
        level: 'error',
        title: `${mode === 'simulate' ? 'Simulation' : 'Execution'} failed`,
        detail: result.error ?? 'Unknown error',
      });
      return;
    }

    pushLog({
      level: 'success',
      title: `${mode === 'simulate' ? 'Simulation' : 'Execution'} complete`,
      detail: safeStringify(result.data ?? result.txHash),
    });
  };

  const isBusy = isExecuting || isSimulating;
  const contractName =
    (parsed?.compiled as { name?: string } | undefined)?.name ??
    savedContracts.find(
      (contract) => contract.address.trim().toLowerCase() === artifact.address.trim().toLowerCase()
    )?.label ??
    null;
  const hasContract = (parsed?.functions?.length ?? 0) > 0;

  const capabilities = analyzeFunctionCapabilities(
    selectedFn?.attributes ?? [],
    selectedFn?.inputs
  );
  const ownerInput = selectedFn?.inputs.find((input) => input.path === 'owner');
  const connectedAddress = account?.getAddress().toString() ?? '';
  const ownerValue = ownerInput ? executor.formValues[ownerInput.path] ?? '' : '';
  const ownerMismatchWarning =
    capabilities.isPrivate &&
    ownerInput &&
    ownerValue &&
    connectedAddress &&
    ownerValue.toLowerCase() !== connectedAddress.toLowerCase();

  const simulateDisabled = !selectedFn || isBusy || !capabilities.canSimulate;
  const executeDisabled = !selectedFn || isBusy || !capabilities.isExecutable;

  if (!isConnected || !isInitialized) {
    return null;
  }

  return (
    <div className="contract-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">🧰</span>
        </div>
        <div>
          <h3>Contract Interaction</h3>
          <p>
            Load a contract artifact to explore callable and read-only functions, then simulate or
            execute with your inputs.
          </p>
        </div>
      </div>

      <div className="contract-grid">
        <ArtifactLoader
          address={artifact.address}
          artifactInput={artifact.artifactInput}
          onAddressChange={(v) => updateArtifact({ address: v })}
          onArtifactChange={(v) => updateArtifact({ artifactInput: v })}
          onLoad={handleLoadArtifact}
          onClear={handleClearCache}
          hasCache={hasCache}
          savedContracts={savedContracts}
          onApplySaved={handleApplySaved}
          onDeleteSaved={handleDeleteSaved}
          error={artifact.parseError}
          isValidAddress={!artifact.address || isValidAztecAddress(artifact.address)}
          activeAddress={artifact.address}
          preconfigured={PRECONFIGURED_CONTRACTS.filter(
            (c) => !c.network || c.network === currentConfig?.name
          )}
          selectedPreconfiguredId={artifact.selectedPreconfiguredId}
          onApplyPreconfigured={handleApplyPreconfigured}
          isLoadingPreconfigured={artifact.isLoadingPreconfigured}
        />
        <FunctionList
          groups={grouped}
          selected={selectedFn?.name ?? null}
          onSelect={(name) => updateExecutor({ selectedFnName: name })}
          filter={executor.filter}
          onFilterChange={(v) => updateExecutor({ filter: v })}
          contractName={contractName ?? undefined}
          hasContract={hasContract}
        />
      </div>

      {selectedFn && (
        <FunctionForm
          fn={selectedFn}
          values={executor.formValues}
          onChange={handleValueChange}
          disabled={isBusy}
        />
      )}

      {selectedFn && capabilities.isPrivate && (
        <div className="input-hint" role="status">
          This is a private function. Results can only be proven by the note owner; querying other
          addresses will likely return 0 or fail.
        </div>
      )}

      {ownerMismatchWarning && (
        <div className="input-hint error" role="alert">
          Owner differs from the connected wallet; private balances for other addresses will usually
          appear as 0.
        </div>
      )}

      <div className="action-row">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={simulateDisabled}
          onClick={() => handleCall('simulate')}
        >
          {isSimulating ? 'Simulating...' : 'Simulate'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={executeDisabled}
          onClick={() => handleCall('execute')}
        >
          {isExecuting ? 'Executing...' : 'Execute'}
        </button>
        {callerError && (
          <span className="input-hint error" role="alert">
            {callerError}
          </span>
        )}
      </div>

      <LogPanel logs={logs} />
    </div>
  );
};
