import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Wrench, AlertTriangle } from 'lucide-react';
import { readFieldCompressedString } from '@aztec/aztec.js/utils';
import ArtifactLoader from '../components/contract-interaction/ArtifactLoader';
import FunctionForm from '../components/contract-interaction/FunctionForm';
import FunctionList from '../components/contract-interaction/FunctionList';
import LogPanel from '../components/contract-interaction/LogPanel';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { FileUp, Rocket } from 'lucide-react';
import { DEPLOYABLE_CONTRACTS } from '../config/deployableContracts';
import { PRECONFIGURED_CONTRACTS } from '../config/preconfiguredContracts';
import { useUniversalWallet } from '../hooks';
import { useContractDeployer } from '../hooks/contracts/useContractDeployer';
import { useDynamicContractCaller } from '../hooks/contracts/useDynamicContractCaller';
import { useForm } from '../hooks/useForm';
import { useFunctionGroups } from '../hooks/useFunctionGroups';
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
  getDeployableContractsForNetwork,
  findDeployableContract,
  findConstructor,
  buildDeploymentLabel,
  type DeployableContract,
  type ContractConstructor,
} from '../utils/deployableContracts';
import { safeStringify, toTitleCase } from '../utils/string';
import type {
  CachedContract,
  LogEntry,
  ArtifactLoaderMode,
  DeploymentFormValues,
} from '../components/contract-interaction/types';
import type { CachedContract as CacheContract } from '../utils/contractCache';

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

/** State for contract deployment flow including mode, selected contract, and form inputs */
type DeploymentState = {
  mode: ArtifactLoaderMode;
  selectedDeployableId: string | null;
  selectedConstructorName: string | null;
  formValues: DeploymentFormValues;
  customArtifactInput: string;
};

type CustomDeployableResult = {
  contract: DeployableContract | null;
  error: string | null;
};

const buildConstructorLabel = (name: string): string => {
  const labelPart = name
    .replace(/^constructor_?/, '')
    .replace(/_/g, ' ')
    .trim();
  return labelPart ? toTitleCase(labelPart) : 'Default';
};

const buildCustomDeployableContract = (
  artifactInput: string
): CustomDeployableResult => {
  if (!artifactInput.trim()) {
    return { contract: null, error: null };
  }

  try {
    const result = loadAndPrepareArtifact(
      artifactInput,
      '',
      constants.MAX_CACHE_CHARS
    );
    if (!result.success) {
      return { contract: null, error: result.error ?? 'Invalid artifact' };
    }

    const parsedArtifact = result.parsed;
    const artifactJson = artifactInput;

    const constructors: ContractConstructor[] = parsedArtifact.functions
      .filter((fn) => fn.attributes.includes('abi_initializer'))
      .map((fn) => ({
        ...fn,
        label: buildConstructorLabel(fn.name),
      }));

    if (constructors.length === 0) {
      return {
        contract: null,
        error: 'No constructors found in the provided artifact',
      };
    }

    const contractName =
      (parsedArtifact.compiled as { name?: string } | undefined)?.name ??
      'Custom Contract';

    return {
      contract: {
        id: 'custom',
        label: `${contractName} (custom)`,
        artifactJson,
        constructors,
      },
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid artifact JSON';
    return { contract: null, error: `Invalid artifact: ${message}` };
  }
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

const INITIAL_DEPLOYMENT: DeploymentState = {
  mode: 'existing',
  selectedDeployableId: null,
  selectedConstructorName: null,
  formValues: {},
  customArtifactInput: '',
};

const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) return;
  const alreadyPersisted = await navigator.storage.persisted();
  if (!alreadyPersisted) {
    await navigator.storage.persist();
  }
};

/**
 * ContractInteractionCard styles - semantic pattern.
 */
const styles = {
  // Icon sizes
  icon: {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  },
  // Header
  headerIcon: 'h-8 w-8 text-accent',
  cardHeader: 'flex flex-row items-start gap-3',
  // Tab icon
  tabIcon: 'h-4 w-4',
  tabsList: 'mb-4',
  // Grid layout
  contractGrid: 'grid gap-4 md:grid-cols-2',
  contractGridDeploy: 'grid gap-4 md:grid-cols-1',
  // Hints and messages
  inputHint:
    'text-sm text-muted p-3 rounded-lg bg-surface-secondary border border-default mt-4',
  inputHintError:
    'text-sm text-red-500 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mt-4',
  // Action buttons row
  actionRow: 'flex items-center gap-4 mt-4',
  actionButton: 'flex-1',
} as const;

export const ContractInteractionCard: React.FC = () => {
  const { isConnected, isInitialized, account, currentConfig } =
    useUniversalWallet();

  const {
    state: artifact,
    update: updateArtifact,
    reset: resetArtifact,
    setState: setArtifact,
  } = useForm(INITIAL_ARTIFACT_LOADER);
  const {
    state: executor,
    update: updateExecutor,
    reset: resetExecutor,
  } = useForm(INITIAL_FUNCTION_EXECUTOR);
  const {
    state: deployment,
    update: updateDeployment,
    reset: resetDeployment,
  } = useForm(INITIAL_DEPLOYMENT);

  const [savedContracts, setSavedContracts] = useState<CachedContract[]>([]);
  const [parsed, setParsed] = useState<ParsedArtifact | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasAutoLoadedRef = useRef(false);

  const savedContractsRef = useRef<CacheContract[]>(savedContracts);
  // Latest ref pattern: keeps ref in sync so callbacks access current value without dep array churn
  // eslint-disable-next-line react-hooks/refs
  savedContractsRef.current = savedContracts;

  // Deployment hook
  const {
    deploy,
    isDeploying,
    error: deployError,
    clearError: clearDeployError,
    canDeploy,
    getUnsupportedMessage,
  } = useContractDeployer();

  const hasCache = savedContracts.length > 0;

  // Get deployable contracts for current network
  const deployableContracts = useMemo(
    () =>
      getDeployableContractsForNetwork(
        DEPLOYABLE_CONTRACTS,
        currentConfig?.name
      ),
    [currentConfig?.name]
  );

  const { contract: customDeployableContract, error: customArtifactError } =
    useMemo(
      () => buildCustomDeployableContract(deployment.customArtifactInput),
      [deployment.customArtifactInput]
    );

  // Get selected deployable contract and constructor
  // null/empty selectedDeployableId means custom mode
  const isCustomSelected = !deployment.selectedDeployableId;
  const selectedDeployable = useMemo(() => {
    if (isCustomSelected) {
      return customDeployableContract;
    }
    return (
      findDeployableContract(
        deployableContracts,
        deployment.selectedDeployableId!
      ) ?? null
    );
  }, [
    customDeployableContract,
    deployableContracts,
    deployment.selectedDeployableId,
    isCustomSelected,
  ]);

  const selectedConstructor = useMemo(() => {
    if (!selectedDeployable || !deployment.selectedConstructorName) return null;
    return (
      findConstructor(selectedDeployable, deployment.selectedConstructorName) ??
      null
    );
  }, [deployment.selectedConstructorName, selectedDeployable]);

  const pushLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLogs((prev) => [
      { ...entry, id: `${Date.now()}-${prev.length}` },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const handleValueChange = useCallback(
    (path: string, value: string) => {
      updateExecutor({ formValues: { ...executor.formValues, [path]: value } });
    },
    [executor.formValues, updateExecutor]
  );

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

  const { filteredFunctions, grouped } = useFunctionGroups(
    parsedFunctions,
    executor.filter
  );

  const selectedFn =
    filteredFunctions.find((fn) => fn.name === executor.selectedFnName) ??
    filteredFunctions[0] ??
    null;

  // Mode change handler
  const handleModeChange = useCallback(
    (mode: ArtifactLoaderMode) => {
      if (mode === 'deploy') {
        const hasExistingArtifact = artifact.artifactInput.trim().length > 0;
        const shouldPrefillCustom =
          !deployment.selectedDeployableId && hasExistingArtifact;

        if (shouldPrefillCustom) {
          updateDeployment({
            mode,
            selectedDeployableId: null,
            selectedConstructorName: null,
            formValues: {},
            customArtifactInput: artifact.artifactInput,
          });
        } else {
          updateDeployment({ mode });
        }
      } else {
        updateDeployment({ mode });
      }
      clearDeployError();
    },
    [
      artifact.artifactInput,
      clearDeployError,
      deployment.selectedDeployableId,
      updateDeployment,
    ]
  );

  // Deployable contract selection handler
  const handleSelectDeployable = useCallback(
    (contractId: string | null) => {
      const isCustom = !contractId;
      const contract = isCustom
        ? customDeployableContract
        : contractId
          ? findDeployableContract(deployableContracts, contractId)
          : null;
      const firstConstructor = contract?.constructors[0]?.name ?? null;

      updateDeployment({
        selectedDeployableId: contractId,
        selectedConstructorName: firstConstructor,
        formValues: {},
      });
      clearDeployError();
    },
    [
      clearDeployError,
      customDeployableContract,
      deployableContracts,
      updateDeployment,
    ]
  );

  // Constructor selection handler
  const handleSelectConstructor = useCallback(
    (constructorName: string) => {
      updateDeployment({
        selectedConstructorName: constructorName,
        formValues: {},
      });
      clearDeployError();
    },
    [updateDeployment, clearDeployError]
  );

  const handleCustomArtifactChange = useCallback(
    (value: string) => {
      updateDeployment({ customArtifactInput: value });
      clearDeployError();
    },
    [clearDeployError, updateDeployment]
  );

  // Auto-select first constructor when custom artifact changes (not when user manually selects)
  const prevCustomContractRef = useRef<typeof customDeployableContract>(null);
  useEffect(() => {
    // Only run in custom mode (null/empty selectedDeployableId)
    if (deployment.selectedDeployableId) return;
    // Only update constructor if the custom contract itself changed (new artifact pasted)
    if (prevCustomContractRef.current === customDeployableContract) return;
    prevCustomContractRef.current = customDeployableContract;
    const firstConstructor =
      customDeployableContract?.constructors[0]?.name ?? null;
    updateDeployment({
      selectedConstructorName: firstConstructor,
      formValues: {},
    });
  }, [
    customDeployableContract,
    deployment.selectedDeployableId,
    updateDeployment,
  ]);

  // Deployment form value change handler
  const handleDeploymentFormChange = useCallback(
    (paramName: string, value: string) => {
      updateDeployment({
        formValues: { ...deployment.formValues, [paramName]: value },
      });
    },
    [deployment.formValues, updateDeployment]
  );

  const handleLoadArtifactWithData = useCallback(
    async (address: string, artifactJson: string, customLabel?: string) => {
      requestPersistentStorage();

      const result = loadAndPrepareArtifact(
        artifactJson,
        address,
        constants.MAX_CACHE_CHARS
      );
      if (!result.success) {
        updateArtifact({ parseError: result.error });
        pushLog({
          level: 'error',
          title: 'Artifact parse failed',
          detail: result.error,
        });
        return;
      }

      const {
        parsed: parsedArtifact,
        address: resolvedAddress,
        contractLabel,
        shouldCacheInline,
        firstFunctionName,
      } = result;
      setParsed(parsedArtifact);
      updateArtifact({ parseError: null, address: resolvedAddress });
      updateExecutor({ selectedFnName: firstFunctionName });
      pushLog({
        level: 'success',
        title: 'Artifact loaded',
        detail: `Loaded ${parsedArtifact.functions.length} functions`,
      });

      const labelToUse = customLabel ?? contractLabel;

      const cacheResult = await cacheAndPersistArtifact({
        address: resolvedAddress,
        artifactInput: artifactJson,
        label: labelToUse,
        shouldCacheInline,
        savedContracts: savedContractsRef.current,
        networkName: currentConfig?.name,
      });
      setSavedContracts(cacheResult.updatedContracts);

      const cacheMsg = getCacheStatusMessage(cacheResult, shouldCacheInline);
      if (cacheMsg)
        pushLog({
          level: 'info',
          title: 'Cached address only',
          detail: cacheMsg,
        });
    },
    [currentConfig?.name, pushLog, updateArtifact, updateExecutor]
  );

  // Deploy handler
  const handleDeploy = useCallback(async () => {
    if (isCustomSelected && customArtifactError) {
      pushLog({
        level: 'error',
        title: 'Deployment failed',
        detail: customArtifactError,
      });
      return;
    }

    if (!selectedDeployable || !selectedConstructor) {
      pushLog({
        level: 'error',
        title: 'Deployment failed',
        detail: 'No contract or constructor selected',
      });
      return;
    }

    pushLog({
      level: 'info',
      title: 'Deploying contract',
      detail: `${selectedDeployable.label} using ${selectedConstructor.label}`,
    });

    const result = await deploy({
      contract: selectedDeployable,
      constructor: selectedConstructor,
      args: deployment.formValues,
    });

    if (!result.success) {
      pushLog({
        level: 'error',
        title: 'Deployment failed',
        detail: result.error ?? 'Unknown error',
      });
      return;
    }

    // Build a meaningful label using the deployment form values (e.g., token name)
    const deployedLabel = buildDeploymentLabel(
      selectedDeployable,
      deployment.formValues
    );

    pushLog({
      level: 'success',
      title: 'Contract deployed',
      detail: `${deployedLabel} at ${result.address}${result.txHash ? ` | TX: ${result.txHash}` : ''}`,
    });

    // Switch to existing mode with the deployed address and artifact
    updateArtifact({
      address: result.address ?? '',
      artifactInput: selectedDeployable.artifactJson,
      parseError: null,
      selectedPreconfiguredId: null,
      isLoadingPreconfigured: false,
    });

    // Store form values before reset for the label
    const labelForSave = deployedLabel;

    // Reset deployment state and switch to existing mode
    resetDeployment();

    // Auto-load the newly deployed contract with the custom label
    requestAnimationFrame(() => {
      void handleLoadArtifactWithData(
        result.address ?? '',
        selectedDeployable.artifactJson,
        labelForSave
      );
    });
  }, [
    customArtifactError,
    deployment.formValues,
    deploy,
    handleLoadArtifactWithData,
    isCustomSelected,
    pushLog,
    resetDeployment,
    selectedConstructor,
    selectedDeployable,
    updateArtifact,
  ]);

  const formatResultData = (value: unknown): unknown => {
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      return value.map(formatResultData);
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);

      // Attempt to decode FieldCompressedString { value: <field> }
      if (
        entries.length === 1 &&
        entries[0][0] === 'value' &&
        (typeof entries[0][1] === 'string' || typeof entries[0][1] === 'bigint')
      ) {
        const fieldValue = entries[0][1];
        try {
          return readFieldCompressedString({
            value: BigInt(fieldValue as string),
          });
        } catch {
          return fieldValue;
        }
      }

      const normalized: Record<string, unknown> = {};
      for (const [k, v] of entries) {
        normalized[k] = formatResultData(v);
      }
      return normalized;
    }

    return value;
  };

  const handleApplySaved = useCallback(
    async (contract: CachedContract) => {
      updateArtifact({
        address: contract.address,
        artifactInput: contract.artifact ?? '',
        parseError: null,
      });
      resetExecutor();

      const resolved = await resolveCachedArtifact(contract);
      if (!resolved.found) {
        setParsed(null);
        const detail =
          resolved.reason === 'extended_storage_unavailable'
            ? 'Cached artifact unavailable (too large / cleared); paste it to load functions.'
            : 'Artifact not cached (too large); paste it to load functions.';
        pushLog({ level: 'info', title: 'Address applied', detail });
        return;
      }

      try {
        const parsedArtifact = parseArtifactSource(resolved.artifact);
        setParsed(parsedArtifact);
        updateExecutor({
          selectedFnName: parsedArtifact.functions[0]?.name ?? null,
        });
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
        setParsed(null);
        updateArtifact({ parseError: message });
        pushLog({
          level: 'error',
          title: 'Cached artifact parse failed',
          detail: message,
        });
      }
    },
    [pushLog, resetExecutor, updateArtifact, updateExecutor]
  );

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
        updateArtifact({
          artifactInput: contract.artifactJson,
          isLoadingPreconfigured: false,
        });
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
    resetDeployment();
  }, [currentConfig?.name]);

  useEffect(() => {
    if (hasAutoLoadedRef.current) return;
    if (parsed) return;
    if (savedContracts.length === 0) return;
    hasAutoLoadedRef.current = true;
    void handleApplySaved(savedContracts[0]);
  }, [parsed, savedContracts, handleApplySaved]);

  useEffect(() => {
    if (filteredFunctions.length > 0 && !executor.selectedFnName) {
      updateExecutor({ selectedFnName: filteredFunctions[0].name });
    }
  }, [filteredFunctions, executor.selectedFnName]);

  const handleLoadArtifact = async () => {
    requestPersistentStorage();

    const result = loadAndPrepareArtifact(
      artifact.artifactInput,
      artifact.address,
      constants.MAX_CACHE_CHARS
    );
    if (!result.success) {
      updateArtifact({ parseError: result.error });
      pushLog({
        level: 'error',
        title: 'Artifact parse failed',
        detail: result.error,
      });
      return;
    }

    const {
      parsed: parsedArtifact,
      address,
      contractLabel,
      shouldCacheInline,
      firstFunctionName,
    } = result;
    setParsed(parsedArtifact);
    updateArtifact({ parseError: null, address });
    updateExecutor({ selectedFnName: firstFunctionName });
    pushLog({
      level: 'success',
      title: 'Artifact loaded',
      detail: `Loaded ${parsedArtifact.functions.length} functions`,
    });

    const cacheResult = await cacheAndPersistArtifact({
      address,
      artifactInput: artifact.artifactInput,
      label: contractLabel,
      shouldCacheInline,
      savedContracts: savedContractsRef.current,
      networkName: currentConfig?.name,
    });
    setSavedContracts(cacheResult.updatedContracts);

    const cacheMsg = getCacheStatusMessage(cacheResult, shouldCacheInline);
    if (cacheMsg)
      pushLog({
        level: 'info',
        title: 'Cached address only',
        detail: cacheMsg,
      });
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

  const handleDeleteSaved = async (targetAddress: string) => {
    const currentContracts = savedContractsRef.current;
    const target = currentContracts.find(
      (c) => c.address.toLowerCase() === targetAddress.toLowerCase()
    );
    if (target?.artifactKey) {
      await deleteArtifact(target.artifactKey);
    }
    const next = removeContract(currentContracts, targetAddress);
    setSavedContracts(next);
    persistCachedContracts(next, currentConfig?.name);
    // If deleting the currently active contract, reset the form state
    const isActiveContract =
      artifact.address.toLowerCase() === targetAddress.toLowerCase();
    if (isActiveContract) {
      resetArtifact();
      setParsed(null);
      resetExecutor();
    }
    pushLog({
      level: 'info',
      title: 'Saved contract removed',
      detail: targetAddress,
    });
  };

  const handleCall = async (mode: 'simulate' | 'execute') => {
    if (!parsed) {
      pushLog({
        level: 'error',
        title: 'Missing artifact',
        detail: 'Load an artifact first',
      });
      return;
    }

    const validation = validateAndBuildCallArgs(
      artifact.address,
      selectedFn,
      executor.formValues
    );
    if (!validation.valid) {
      pushLog({
        level: 'error',
        title: 'Validation failed',
        detail: validation.error,
      });
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
      detail: safeStringify(formatResultData(result.data ?? result.txHash)),
    });
  };

  const isBusy = isExecuting || isSimulating || isDeploying;
  const contractName =
    (parsed?.compiled as { name?: string } | undefined)?.name ??
    savedContracts.find(
      (contract) =>
        contract.address.trim().toLowerCase() ===
        artifact.address.trim().toLowerCase()
    )?.label ??
    null;
  const hasContract = (parsed?.functions?.length ?? 0) > 0;

  const capabilities = analyzeFunctionCapabilities(
    selectedFn?.attributes ?? [],
    selectedFn?.inputs
  );
  const ownerInput = selectedFn?.inputs.find((input) => input.path === 'owner');
  const connectedAddress = account?.getAddress().toString() ?? '';
  const ownerValue = ownerInput
    ? (executor.formValues[ownerInput.path] ?? '')
    : '';
  const ownerMismatchWarning =
    capabilities.isPrivate &&
    ownerInput &&
    ownerValue &&
    connectedAddress &&
    ownerValue.toLowerCase() !== connectedAddress.toLowerCase();

  const simulateDisabled = !selectedFn || isBusy || !capabilities.canSimulate;
  const executeDisabled = !selectedFn || isBusy || !capabilities.isExecutable;

  // Deployment error message (either from hook or unsupported wallet)
  const deploymentErrorMessage = deployError ?? getUnsupportedMessage();
  const isDeployMode = deployment.mode === 'deploy';

  if (!isConnected || !isInitialized) {
    return null;
  }

  return (
    <Card>
      <CardHeader className={styles.cardHeader}>
        <Wrench className={styles.headerIcon} />
        <div>
          <CardTitle>Contract Interaction</CardTitle>
          <CardDescription>
            {isDeployMode &&
              'Deploy a new contract instance with custom constructor parameters.'}
            {!isDeployMode &&
              'Load a contract artifact to explore callable and read-only functions, then simulate or execute with your inputs.'}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs
          value={deployment.mode}
          onValueChange={(value) =>
            handleModeChange(value as ArtifactLoaderMode)
          }
        >
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="existing" disabled={isDeploying}>
              <FileUp className={styles.tabIcon} />
              Use Contract
            </TabsTrigger>
            <TabsTrigger value="deploy" disabled={isDeploying}>
              <Rocket className={styles.tabIcon} />
              Deploy New Contract
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing">
            <div className={styles.contractGrid}>
              <ArtifactLoader
                mode="existing"
                existing={{
                  address: artifact.address,
                  artifactInput: artifact.artifactInput,
                  onAddressChange: (v) => updateArtifact({ address: v }),
                  onArtifactChange: (v) => updateArtifact({ artifactInput: v }),
                  onLoad: handleLoadArtifact,
                  error: artifact.parseError,
                  isValidAddress:
                    !artifact.address || isValidAztecAddress(artifact.address),
                }}
                saved={{
                  contracts: savedContracts,
                  activeAddress: artifact.address,
                  onApply: handleApplySaved,
                  onDelete: handleDeleteSaved,
                  onClearAll: handleClearCache,
                  hasCache,
                }}
                preconfigured={{
                  options: PRECONFIGURED_CONTRACTS.filter(
                    (c) => !c.network || c.network === currentConfig?.name
                  ),
                  selectedId: artifact.selectedPreconfiguredId,
                  onSelect: handleApplyPreconfigured,
                  isLoading: artifact.isLoadingPreconfigured,
                }}
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
          </TabsContent>

          <TabsContent value="deploy">
            <div className={styles.contractGridDeploy}>
              <ArtifactLoader
                mode="deploy"
                existing={{
                  address: artifact.address,
                  artifactInput: artifact.artifactInput,
                  onAddressChange: (v) => updateArtifact({ address: v }),
                  onArtifactChange: (v) => updateArtifact({ artifactInput: v }),
                  onLoad: handleLoadArtifact,
                  error: artifact.parseError,
                  isValidAddress:
                    !artifact.address || isValidAztecAddress(artifact.address),
                }}
                saved={{
                  contracts: savedContracts,
                  activeAddress: artifact.address,
                  onApply: handleApplySaved,
                  onDelete: handleDeleteSaved,
                  onClearAll: handleClearCache,
                  hasCache,
                }}
                deploy={{
                  contracts: deployableContracts,
                  selectedContractId: deployment.selectedDeployableId,
                  onSelectContract: handleSelectDeployable,
                  isCustomSelected,
                  customDeployable: customDeployableContract,
                  selectedConstructorName: deployment.selectedConstructorName,
                  onSelectConstructor: handleSelectConstructor,
                  formValues: deployment.formValues,
                  onFormValueChange: handleDeploymentFormChange,
                  onDeploy: handleDeploy,
                  isDeploying,
                  error: deploymentErrorMessage,
                  canDeploy: canDeploy(),
                  customArtifactInput: deployment.customArtifactInput,
                  onCustomArtifactChange: handleCustomArtifactChange,
                  customArtifactError,
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        {!isDeployMode && selectedFn && (
          <FunctionForm
            fn={selectedFn}
            values={executor.formValues}
            onChange={handleValueChange}
            disabled={isBusy}
          />
        )}

        {!isDeployMode && selectedFn && capabilities.isPrivate && (
          <div className={styles.inputHint} role="status">
            This is a private function. Results can only be proven by the note
            owner; querying other addresses will likely return 0 or fail.
          </div>
        )}

        {!isDeployMode && ownerMismatchWarning && (
          <div className={styles.inputHintError} role="alert">
            <AlertTriangle className={`${styles.icon.sm} inline mr-1`} />
            Owner differs from the connected wallet; private balances for other
            addresses will usually appear as 0.
          </div>
        )}

        {!isDeployMode && (
          <div className={styles.actionRow}>
            <Button
              variant="secondary"
              disabled={simulateDisabled}
              onClick={() => handleCall('simulate')}
              isLoading={isSimulating}
              className={styles.actionButton}
            >
              {isSimulating ? 'Simulating...' : 'Simulate'}
            </Button>
            <Button
              variant="primary"
              disabled={executeDisabled}
              onClick={() => handleCall('execute')}
              isLoading={isExecuting}
              className={styles.actionButton}
            >
              {isExecuting ? 'Executing...' : 'Execute'}
            </Button>
          </div>
        )}

        {!isDeployMode && callerError && (
          <div className={styles.inputHintError} role="alert">
            <AlertTriangle className={`${styles.icon.sm} inline mr-1`} />
            {callerError}
          </div>
        )}

        <LogPanel logs={logs} />
      </CardContent>
    </Card>
  );
};
