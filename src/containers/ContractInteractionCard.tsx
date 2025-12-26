import React, { useEffect, useMemo, useState } from 'react';
import { useUniversalWallet } from '../hooks';
import { useDynamicContractCaller } from '../hooks/contracts/useDynamicContractCaller';
import {
  buildArgsFromInputs,
  formatFunctionSignature,
  isValidAztecAddress,
  parseArtifactSource,
  type ParsedArtifact,
  type ParsedField,
  type ParsedFunction,
  type ParsedType,
} from '../utils/contractInteraction';

const contractCacheKey = (networkName?: string) =>
  `aztec-contract-cache${networkName ? `:${networkName}` : ''}`;

const MAX_CACHE_CHARS = 400_000;
const MAX_SAVED_CONTRACTS = 10;
const ARTIFACT_DB = 'aztec-contract-artifacts';
const ARTIFACT_STORE = 'artifacts';
const HIDDEN_FUNCTION_NAMES = ['constructor', 'public_dispatch'];

type CachedContract = {
  address: string;
  artifact?: string;
  artifactKey?: string;
  label?: string;
  savedAt?: number;
};

const getLocalStorage = (): Storage | null =>
  typeof window === 'undefined' ? null : window.localStorage;

const getIndexedDB = (): IDBFactory | null =>
  typeof window === 'undefined' ? null : window.indexedDB ?? null;

const openArtifactDb = async (): Promise<IDBDatabase | null> => {
  const indexedDB = getIndexedDB();
  if (!indexedDB) return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(ARTIFACT_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARTIFACT_STORE)) {
        db.createObjectStore(ARTIFACT_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
};

const storeArtifact = async (
  artifact: string,
  namespace?: string
): Promise<string | null> => {
  const db = await openArtifactDb();
  if (!db) return null;
  const sanitizedNamespace = (namespace ?? 'global').replace(/[^a-z0-9_-]/gi, '');
  const key = `${sanitizedNamespace}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE, 'readwrite');
    tx.objectStore(ARTIFACT_STORE).put(artifact, key);
    tx.oncomplete = () => resolve(key);
    tx.onerror = () => resolve(null);
  });
};

const loadArtifact = async (key?: string): Promise<string | null> => {
  if (!key) return null;
  const db = await openArtifactDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE, 'readonly');
    const req = tx.objectStore(ARTIFACT_STORE).get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
};

const deleteArtifact = async (key?: string): Promise<void> => {
  if (!key) return;
  const db = await openArtifactDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE, 'readwrite');
    tx.objectStore(ARTIFACT_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const clearArtifactsDb = async () => {
  const indexedDB = getIndexedDB();
  if (!indexedDB) return;
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(ARTIFACT_DB);
    req.onsuccess = () => resolve(null);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
};

const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) return;
  const alreadyPersisted = await navigator.storage.persisted();
  if (!alreadyPersisted) {
    await navigator.storage.persist();
  }
};

const loadCachedContracts = (networkName?: string): CachedContract[] => {
  const storage = getLocalStorage();
  if (!storage) return [];
  const raw = storage.getItem(contractCacheKey(networkName));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const value = item as Partial<CachedContract>;
        if (typeof value?.address !== 'string') return null;

        const result: CachedContract = { address: value.address };
        if (typeof value.artifact === 'string') result.artifact = value.artifact;
        if (typeof value.artifactKey === 'string') result.artifactKey = value.artifactKey;
        if (typeof value.label === 'string') result.label = value.label;
        if (typeof value.savedAt === 'number') result.savedAt = value.savedAt;

        return result;
      })
      .filter((item): item is CachedContract => item !== null);
  } catch {
    return [];
  }
};

const persistCachedContracts = (
  contracts: CachedContract[],
  networkName?: string
): { savedArtifacts: boolean } => {
  const storage = getLocalStorage();
  if (!storage) return { savedArtifacts: false };
  const key = contractCacheKey(networkName);
  const sanitized = contracts.slice(0, MAX_SAVED_CONTRACTS);
  const attemptSave = (payload: CachedContract[]) => {
    storage.setItem(key, JSON.stringify(payload));
  };
  try {
    attemptSave(sanitized);
    return {
      savedArtifacts: sanitized.some((c) => Boolean(c.artifact)),
    };
  } catch {
    // Fallback: drop artifacts and try again
    const stripped = sanitized.map((c) => ({
      address: c.address,
      label: c.label,
      savedAt: c.savedAt,
      artifactKey: c.artifactKey,
    }));
    try {
      attemptSave(stripped);
    } catch {
      // ignore
    }
    return { savedArtifacts: false };
  }
};

const clearCachedContract = (networkName?: string) => {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(contractCacheKey(networkName));
};

const upsertContract = (
  current: CachedContract[],
  next: CachedContract
): CachedContract[] => {
  const normalizedAddress = next.address.toLowerCase();
  const filtered = current.filter(
    (item) => item.address.toLowerCase() !== normalizedAddress
  );
  const entry: CachedContract = {
    ...next,
    savedAt: Date.now(),
  };
  return [entry, ...filtered].slice(0, MAX_SAVED_CONTRACTS);
};

const removeContract = (current: CachedContract[], address: string): CachedContract[] => {
  const normalized = address.toLowerCase();
  return current.filter((item) => item.address.toLowerCase() !== normalized);
};

const safeStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));

type LogLevel = 'info' | 'error' | 'success';

interface LogEntry {
  id: string;
  level: LogLevel;
  title: string;
  detail?: string;
}

interface FunctionGroup {
  id: string;
  label: string;
  items: ParsedFunction[];
}

const placeholderForType = (type: ParsedType): string => {
  switch (type.kind) {
    case 'address':
      return '0x...';
    case 'integer':
    case 'field':
      return 'Numeric value';
    case 'boolean':
      return 'true / false';
    case 'array':
      return 'Comma-separated values';
    case 'struct':
      return 'Object field';
    default:
      return 'Value';
  }
};

const FunctionForm: React.FC<{
  fn: ParsedFunction;
  values: Record<string, string>;
  onChange: (path: string, value: string) => void;
  disabled: boolean;
}> = ({ fn, values, onChange, disabled }) => {
  return (
    <div className="form-section">
      <div className="form-grid">
        {fn.inputs
          .filter((input) => input.type.kind !== 'struct')
          .map((input) => (
            <div className="form-group" key={input.path}>
              <label
                htmlFor={input.path}
                title={
                  input.path.includes('.')
                    ? `${input.label} (${input.path})`
                    : input.label
                }
              >
                <span className="form-label-main">{input.label}</span>
                {input.path.includes('.') && (
                  <span className="form-sub-label">({input.path})</span>
                )}
              </label>
              <input
                id={input.path}
                className="form-input"
                value={values[input.path] ?? ''}
                onChange={(e) => onChange(input.path, e.target.value)}
                placeholder={placeholderForType(input.type)}
                disabled={disabled}
                aria-label={input.path}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

const FunctionList: React.FC<{
  groups: FunctionGroup[];
  selected: string | null;
  onSelect: (name: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
}> = ({ groups, selected, onSelect, filter, onFilterChange }) => (
  <div className="function-list-card">
    <div className="form-group">
      <label htmlFor="function-filter">Search functions</label>
      <input
        id="function-filter"
        className="form-input"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Type to filter"
      />
    </div>
    {groups.map((group) => (
      <div className="function-group" key={group.id}>
        <div className="function-group-label">{group.label}</div>
        <div className="function-list">
          {group.items.map((fn) => (
            <button
              key={fn.name}
              type="button"
              className={`function-item ${selected === fn.name ? 'active' : ''}`}
              onClick={() => onSelect(fn.name)}
            >
              <span className="function-name">{fn.name}</span>
              <span className="function-meta">
                {fn.attributes.join(' · ') || 'public'}
              </span>
            </button>
          ))}
          {group.items.length === 0 && (
            <div className="empty-state">No functions in this group.</div>
          )}
        </div>
      </div>
    ))}
    {groups.length === 0 && (
      <div className="empty-state">No functions found for current filter.</div>
    )}
  </div>
);

const ArtifactLoader: React.FC<{
  address: string;
  artifactInput: string;
  onAddressChange: (value: string) => void;
  onArtifactChange: (value: string) => void;
  onLoad: () => void;
  onClear: () => void;
  hasCache: boolean;
  savedContracts: CachedContract[];
  onApplySaved: (contract: CachedContract) => void;
  onDeleteSaved: (address: string) => void;
  error?: string | null;
  isValidAddress: boolean;
}> = ({
  address,
  artifactInput,
  onAddressChange,
  onArtifactChange,
  onLoad,
  onClear,
  hasCache,
  savedContracts,
  onApplySaved,
  onDeleteSaved,
  error,
  isValidAddress,
}) => (
  <div className="loader-card">
    <div className="form-group">
      <label htmlFor="contract-address">Contract Address</label>
      <input
        id="contract-address"
        className="form-input"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Paste deployed contract address"
        aria-label="Contract address"
      />
      {!isValidAddress && address && (
        <span className="input-hint error">Invalid Aztec address</span>
      )}
    </div>
    <div className="form-group">
      <label htmlFor="artifact-json">Artifact (JSON)</label>
      <textarea
        id="artifact-json"
        className="form-input artifact-textarea"
        value={artifactInput}
        onChange={(e) => onArtifactChange(e.target.value)}
        placeholder="Paste compiled artifact JSON"
        aria-label="Artifact JSON"
      />
    </div>
    {error && <div className="input-hint error">{error}</div>}
    <div className="action-row">
      <button type="button" className="btn btn-primary" onClick={onLoad}>
        Load artifact
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClear}
        disabled={!hasCache && !address && !artifactInput}
      >
        Clear saved
      </button>
    </div>
    {savedContracts.length > 0 && (
      <div className="form-group">
        <label>Saved contracts</label>
        <div className="saved-contracts">
          {savedContracts.map((contract) => (
            <div className="saved-contract-card" key={contract.address}>
              <div className="saved-contract-info">
                <div className="saved-contract-name">{contract.label ?? 'Saved contract'}</div>
                <div className="saved-contract-address">{contract.address}</div>
                <div className="saved-contract-meta">
                  {contract.artifact || contract.artifactKey ? 'Artifact cached' : 'Address only'}
                </div>
              </div>
              <div className="saved-contract-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onApplySaved(contract)}
                >
                  Use
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onDeleteSaved(contract.address)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const LogPanel: React.FC<{
  logs: LogEntry[];
}> = ({ logs }) => (
  <div className="log-panel">
    <div className="log-header">
      <h4>Log</h4>
      <span className="log-count">{logs.length}</span>
    </div>
    <div className="log-entries">
      {logs.map((log) => (
        <div key={log.id} className={`log-entry ${log.level}`}>
          <div className="log-title">{log.title}</div>
          {log.detail && <div className="log-detail">{log.detail}</div>}
        </div>
      ))}
      {logs.length === 0 && (
        <div className="empty-state">
          No calls yet. Load an artifact to begin.
        </div>
      )}
    </div>
  </div>
);

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

  const {
    simulate,
    execute,
    isExecuting,
    isSimulating,
    error: callerError,
  } = useDynamicContractCaller(parsed?.artifact);

  const functions = useMemo<ParsedFunction[]>(() => {
    if (!parsed) return [];
    const normalizedFilter = filter.trim().toLowerCase();
    return parsed.functions
      .filter(
        (fn) =>
          !HIDDEN_FUNCTION_NAMES.includes(fn.name.toLowerCase()) &&
          !fn.attributes.includes('initializer')
      )
      .filter((fn) =>
        formatFunctionSignature(fn).toLowerCase().includes(normalizedFilter)
      );
  }, [filter, parsed]);

  const groupedFunctions = useMemo<FunctionGroup[]>(() => {
    if (functions.length === 0) return [];
    const isExecutableFn = (fn: ParsedFunction): boolean => {
      const attrs = fn.attributes ?? [];
      const hasAttr = (value: string) => attrs.includes(value);
      const isView = hasAttr('abi_view') || hasAttr('view');
      const isInitializer = hasAttr('abi_initializer') || hasAttr('initializer');
      const isPublic = hasAttr('abi_public') || hasAttr('public');
      const isPrivate = hasAttr('abi_private') || hasAttr('private');
      return (isPublic || isPrivate) && !isView && !isInitializer;
    };

    const callableFunctions = functions.filter(
      (fn) => isExecutableFn(fn) || !fn.isUnconstrained
    );
    const readFunctions = functions.filter(
      (fn) => fn.isUnconstrained && !isExecutableFn(fn)
    );

    const groups: FunctionGroup[] = [];
    if (callableFunctions.length > 0) {
      groups.push({
        id: 'callable',
        label: 'Callable functions',
        items: callableFunctions,
      });
    }
    if (readFunctions.length > 0) {
      groups.push({
        id: 'unconstrained',
        label: 'Unconstrained / read functions',
        items: readFunctions,
      });
    }
    return groups;
  }, [functions]);

  const selectedFn =
    functions.find((fn) => fn.name === selectedFnName) ?? functions[0] ?? null;

  useEffect(() => {
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
    if (functions.length > 0 && !selectedFnName) {
      setSelectedFnName(functions[0].name);
    }
  }, [functions, selectedFnName]);

  const pushLog = (entry: Omit<LogEntry, 'id'>) => {
    setLogs((prev) => [
      {
        ...entry,
        id: `${Date.now()}-${prev.length}`,
      },
      ...prev.slice(0, 49),
    ]);
  };

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
      const shouldCacheInline = artifactInput.length <= MAX_CACHE_CHARS;
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
          <p>Load an artifact, pick a function, and call it.</p>
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
        />
        <FunctionList
          groups={groupedFunctions}
          selected={selectedFn?.name ?? null}
          onSelect={setSelectedFnName}
          filter={filter}
          onFilterChange={setFilter}
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
