import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUniversalWallet } from '../hooks';
import { useDynamicContractCaller } from '../hooks/contracts/useDynamicContractCaller';
import ArtifactLoader from '../components/contract-interaction/ArtifactLoader';
import FunctionForm from '../components/contract-interaction/FunctionForm';
import FunctionList from '../components/contract-interaction/FunctionList';
import LogPanel from '../components/contract-interaction/LogPanel';
import {
  type CachedContract,
  type FunctionGroup,
  type LogEntry,
} from '../components/contract-interaction/types';
import { useFunctionGroups } from '../hooks/useFunctionGroups';
import {
  buildArgsFromInputs,
  formatFunctionSignature,
  isValidAztecAddress,
  parseArtifactSource,
  type ParsedArtifact,
  type ParsedFunction,
} from '../utils/contractInteraction';
import {
  clearArtifactsDb,
  clearCachedContract,
  constants,
  deleteArtifact,
  loadArtifact,
  loadCachedContracts,
  persistCachedContracts,
  removeContract,
  storeArtifact,
  upsertContract,
} from '../utils/contractCache';
import {
  PRECONFIGURED_CONTRACTS,
  type PreconfiguredContract,
} from '../config/preconfiguredContracts';

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
  const [artifactInput, setArtifactInput] = useState('');
  const [address, setAddress] = useState('');
  const [hasCache, setHasCache] = useState(false);
  const [savedContracts, setSavedContracts] = useState<CachedContract[]>([]);
  const [parsed, setParsed] = useState<ParsedArtifact | null>(null);
  const [selectedFnName, setSelectedFnName] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasAutoLoadedRef = useRef(false);
  const [selectedPreconfiguredId, setSelectedPreconfiguredId] = useState<string | null>(null);

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

  const { filteredFunctions, grouped } = useFunctionGroups(parsedFunctions, filter);

  const selectedFn =
    filteredFunctions.find((fn) => fn.name === selectedFnName) ?? filteredFunctions[0] ?? null;

  const handleApplyPreconfigured = (contractId: string) => {
    const contract = PRECONFIGURED_CONTRACTS.find((c) => c.id === contractId);
    if (!contract) return;
    setSelectedPreconfiguredId(contractId);
    setAddress(contract.address);
    setArtifactInput(contract.artifactJson);
    setFormValues({});
    setFilter('');
    setParseError(null);
  };

  const pushLog = (entry: Omit<LogEntry, 'id'>) => {
    setLogs((prev) => [
      {
        ...entry,
        id: `${Date.now()}-${prev.length}`,
      },
      ...prev.slice(0, 49),
    ]);
  };

  useEffect(() => {
    hasAutoLoadedRef.current = false;
    const cachedList = loadCachedContracts(currentConfig?.name);
    setSavedContracts(cachedList);
    setHasCache(cachedList.length > 0);
    if (cachedList.length > 0) {
      const latest = cachedList[0];
      setAddress(latest.address);
      setArtifactInput(latest.artifact ?? '');
    } else {
      setAddress('');
      setArtifactInput('');
    }
    setParsed(null);
    setSelectedFnName(null);
    setFormValues({});
    setFilter('');
    setParseError(null);
  }, [currentConfig?.name]);

  useEffect(() => {
    if (hasAutoLoadedRef.current) return;
    if (parsed) return;
    if (savedContracts.length === 0) return;
    hasAutoLoadedRef.current = true;
    void handleApplySaved(savedContracts[0]);
  }, [parsed, savedContracts]);

  useEffect(() => {
    if (filteredFunctions.length > 0 && !selectedFnName) {
      setSelectedFnName(filteredFunctions[0].name);
    }
  }, [filteredFunctions, selectedFnName]);

  const handleLoadArtifact = async () => {
    try {
      requestPersistentStorage();

      const parsedArtifact = parseArtifactSource(artifactInput);
      setParsed(parsedArtifact);
      setParseError(null);
      let nextAddress = address;
      const discoveredAddress = (parsedArtifact.compiled as { address?: string }).address;
      const contractLabel = (parsedArtifact.compiled as { name?: string }).name;
      if (discoveredAddress && isValidAztecAddress(discoveredAddress)) {
        nextAddress = discoveredAddress;
        setAddress(discoveredAddress);
      }
      setSelectedFnName(parsedArtifact.functions[0]?.name ?? null);
      pushLog({
        level: 'success',
        title: 'Artifact loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions`,
      });
      const shouldCacheInline = artifactInput.length <= constants.MAX_CACHE_CHARS;
      let artifactKey: string | undefined;
      let artifactValue: string | undefined = artifactInput;
      if (!shouldCacheInline) {
        artifactKey = (await storeArtifact(artifactInput, currentConfig?.name)) ?? undefined;
        artifactValue = undefined;
      }
      const upserted = upsertContract(savedContracts, {
        address: nextAddress,
        label: contractLabel,
        artifact: shouldCacheInline ? artifactValue : undefined,
        artifactKey,
      });
      const { savedArtifacts } = persistCachedContracts(upserted, currentConfig?.name);
      setSavedContracts(upserted);
      setHasCache(upserted.length > 0);
      if (!savedArtifacts) {
        pushLog({
          level: 'info',
          title: 'Cached address only',
          detail:
            shouldCacheInline
              ? 'Storage quota reached; saved contract address only.'
              : artifactKey
                ? 'Artifact cached in extended storage.'
                : 'Artifact too large to cache; saved contract address only.',
        });
      }
      setHasCache(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to parse artifact';
      setParseError(message);
      pushLog({
        level: 'error',
        title: 'Artifact parse failed',
        detail: message,
      });
    }
  };

  const handleClearCache = () => {
    clearCachedContract(currentConfig?.name);
    clearArtifactsDb();
    setHasCache(false);
    setSavedContracts([]);
    setArtifactInput('');
    setAddress('');
    setParsed(null);
    setSelectedFnName(null);
    setFormValues({});
    setFilter('');
    setParseError(null);
    pushLog({
      level: 'info',
      title: 'Cached contract cleared',
    });
  };

  const handleValueChange = (path: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [path]: value }));
  };

  const handleApplySaved = async (contract: CachedContract) => {
    setAddress(contract.address);
    setArtifactInput(contract.artifact ?? '');
    setFormValues({});
    setFilter('');
    setParseError(null);

    let artifactToUse = contract.artifact;
    if (!artifactToUse && contract.artifactKey) {
      artifactToUse = (await loadArtifact(contract.artifactKey)) ?? undefined;
      if (!artifactToUse) {
        setParsed(null);
        setSelectedFnName(null);
        pushLog({
          level: 'info',
          title: 'Address applied',
          detail:
            'Cached artifact unavailable (too large / cleared); paste it to load functions.',
        });
        return;
      }
    }

    if (!artifactToUse) {
      setParsed(null);
      setSelectedFnName(null);
      pushLog({
        level: 'info',
        title: 'Address applied',
        detail: 'Artifact not cached (too large); paste it to load functions.',
      });
      return;
    }

    try {
      const parsedArtifact = parseArtifactSource(artifactToUse);
      setParsed(parsedArtifact);
      setSelectedFnName(parsedArtifact.functions[0]?.name ?? null);
      pushLog({
        level: 'success',
        title: 'Saved contract loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions from cache`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse cached artifact';
      setParsed(null);
      setSelectedFnName(null);
      setParseError(message);
      pushLog({
        level: 'error',
        title: 'Cached artifact parse failed',
        detail: message,
      });
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
    setHasCache(next.length > 0);
    persistCachedContracts(next, currentConfig?.name);
    pushLog({
      level: 'info',
      title: 'Saved contract removed',
      detail: targetAddress,
    });
  };

  const handleCall = async (mode: 'simulate' | 'execute') => {
    if (!parsed || !selectedFn) {
      pushLog({
        level: 'error',
        title: 'Missing artifact',
        detail: 'Load an artifact first',
      });
      return;
    }

    if (!isValidAztecAddress(address)) {
      pushLog({
        level: 'error',
        title: 'Invalid address',
        detail: 'Provide a valid Aztec address.',
      });
      return;
    }

    const { args, errors } = buildArgsFromInputs(selectedFn.inputs, formValues);
    if (errors.length > 0) {
      pushLog({
        level: 'error',
        title: 'Validation failed',
        detail: errors.join('; '),
      });
      return;
    }

    pushLog({
      level: 'info',
      title: `${mode === 'simulate' ? 'Simulating' : 'Executing'} ${selectedFn.name}`,
      detail: `Args: ${safeStringify(args)}`,
    });

    const caller = mode === 'simulate' ? simulate : execute;
    const result = await caller({
      address,
      functionName: selectedFn.name,
      args,
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
  const attributes = selectedFn?.attributes ?? [];
  const contractName =
    (parsed?.compiled as { name?: string } | undefined)?.name ??
    savedContracts.find(
      (contract) => contract.address.trim().toLowerCase() === address.trim().toLowerCase()
    )?.label ??
    null;
  const hasContract = (parsed?.functions?.length ?? 0) > 0;
  const hasAttr = (value: string): boolean => attributes.includes(value);
  const attrHasView = hasAttr('abi_view');
  const attrHasUtility = hasAttr('abi_utility');
  const attrHasPrivate = hasAttr('abi_private') || hasAttr('private');
  const attrHasPublic = hasAttr('abi_public') || hasAttr('public');
  const anyPrivateInput = Boolean(
    selectedFn?.inputs?.some((input) => input.visibility === 'private')
  );
  const isPrivateFunction = attrHasPrivate || (!attrHasPublic && anyPrivateInput);
  const ownerInput = selectedFn?.inputs.find((input) => input.path === 'owner');
  const connectedAddress = account?.getAddress().toString() ?? '';
  const ownerValue = ownerInput ? formValues[ownerInput.path] ?? '' : '';
  const ownerMismatchWarning =
    isPrivateFunction &&
    ownerInput &&
    ownerValue &&
    connectedAddress &&
    ownerValue.toLowerCase() !== connectedAddress.toLowerCase();
  const isExecutable =
    (attrHasPublic || attrHasPrivate) && !attrHasView && !hasAttr('abi_initializer');
  const canSimulate = attrHasView || attrHasUtility || !isExecutable;
  const simulateDisabled = !selectedFn || isBusy || !canSimulate;
  const executeDisabled = !selectedFn || isBusy || !isExecutable;

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
          address={address}
          artifactInput={artifactInput}
          onAddressChange={setAddress}
          onArtifactChange={setArtifactInput}
          onLoad={handleLoadArtifact}
          onClear={handleClearCache}
          hasCache={hasCache}
          savedContracts={savedContracts}
          onApplySaved={handleApplySaved}
          onDeleteSaved={handleDeleteSaved}
          error={parseError}
          isValidAddress={!address || isValidAztecAddress(address)}
          activeAddress={address}
          preconfigured={PRECONFIGURED_CONTRACTS.filter(
            (c) => !c.network || c.network === currentConfig?.name
          )}
          onApplyPreconfigured={handleApplyPreconfigured}
        />
        <FunctionList
          groups={grouped}
          selected={selectedFn?.name ?? null}
          onSelect={setSelectedFnName}
          filter={filter}
          onFilterChange={setFilter}
          contractName={contractName ?? undefined}
          hasContract={hasContract}
        />
      </div>

      {selectedFn && (
        <FunctionForm
          fn={selectedFn}
          values={formValues}
          onChange={handleValueChange}
          disabled={isBusy}
        />
      )}

      {selectedFn && isPrivateFunction && (
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
