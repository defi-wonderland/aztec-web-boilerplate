import React, {
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  Download,
  Rocket,
  Coins,
  FileEdit,
  Loader2,
  Upload,
  ClipboardPaste,
  ArrowLeft,
} from 'lucide-react';
import { useContractDeployer, useLoadArtifact } from '../../../hooks/contracts';
import { useDeployableContracts } from '../../../hooks/useInteractionContracts';
import {
  useContractActions,
  useInvokeFlowData,
  useDeployFlowState,
  useFormValues,
  useFormActions,
  useLayoutActions,
} from '../../../store';
import { cn, iconSize, toTitleCase } from '../../../utils';
import {
  isValidAztecAddress,
  loadAndPrepareArtifact,
  toSidebarId,
} from '../../../utils/contractInteraction';
import { buildDeploymentLabel } from '../../../utils/deployableContracts';
import {
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui';
import ArtifactInput from '../ArtifactInput';
import ParameterInputs from '../ParameterInputs';
import ContractSourceCard from './ContractSourceCard';
import type { AztecNetwork } from '../../../config/networks/constants';
import type { PreconfiguredContract } from '../../../config/preconfiguredContracts';
import type { ParsedFunction } from '../../../types/artifact';
import type {
  ContractConstructor,
  DeployableContract,
} from '../../../utils/deployableContracts';

const styles = {
  panel: 'flex flex-col gap-6 p-8 flex-1 overflow-y-auto',
  header: 'flex items-center justify-between',
  title: 'text-2xl font-bold text-default font-display',
  tabsList: 'bg-surface-tertiary border-0 p-1 rounded-xl gap-1',
  tabsTrigger: cn(
    'text-[13px] font-medium gap-1.5 px-4 py-2 rounded-lg',
    'data-[state=active]:bg-surface data-[state=active]:shadow-sm'
  ),
  section: 'flex flex-col gap-5',
  sectionLabel: 'text-sm font-bold text-default uppercase tracking-wide',
  cardsGrid: 'flex gap-3 flex-wrap',
  card: 'w-[220px]',
  divider: 'flex items-center gap-4 text-muted',
  dividerLine: 'flex-1 h-px bg-default',
  formSection: 'flex flex-col gap-4',
  formGroup: 'flex flex-col gap-2',
  formLabel: 'text-xs font-medium text-muted',
  actionsRow: 'flex gap-4 pt-2',
  textareaWrapper: 'relative',
  loadingOverlay: cn(
    'absolute inset-0 flex items-center justify-center gap-2',
    'bg-surface/80 rounded-xl text-muted'
  ),
  // Constructor section styles
  constructorSection: cn(
    'rounded-2xl border border-default bg-surface overflow-hidden'
  ),
  constructorHeader: cn(
    'flex items-center gap-2.5 px-5 py-3.5',
    'border-b border-default'
  ),
  constructorIcon: 'text-accent',
  constructorTitle: 'text-sm font-semibold text-default',
  constructorContent: 'flex flex-col gap-4 p-5',
  hint: 'text-sm text-muted',
  hintError: 'text-sm text-error',
  hintWarning: 'text-sm text-warning',
  // Contract details card
  detailsCard: cn(
    'rounded-2xl border border-default bg-surface',
    'overflow-hidden'
  ),
  detailsHeader: cn(
    'flex items-center justify-between',
    'px-5 py-3.5 border-b border-default'
  ),
  detailsTitle: 'text-sm font-semibold text-default',
  detailsBackBtn: cn(
    'flex items-center gap-1 text-xs font-medium text-accent',
    'cursor-pointer hover:text-accent/80 transition-colors'
  ),
  detailsContent: 'flex flex-col gap-4 p-5',
  // Artifact method selection
  artifactMethodGrid: 'flex gap-3',
  artifactMethodCard: cn(
    'flex-1 flex flex-col items-center gap-2',
    'px-4 py-5 rounded-xl border border-dashed',
    'cursor-pointer transition-all duration-150'
  ),
  artifactMethodCardDefault: cn(
    'border-zinc-300 bg-surface-tertiary/30',
    'hover:border-accent hover:bg-accent/5'
  ),
  artifactMethodCardSelected: 'border-accent bg-accent/10',
  artifactMethodIcon: 'text-muted',
  artifactMethodIconSelected: 'text-accent',
  artifactMethodTitle: 'text-sm font-semibold text-default',
  artifactMethodDesc: 'text-xs text-muted text-center',
} as const;

type ArtifactInputMethod = 'file' | 'paste' | null;

type SetupTab = 'load' | 'deploy';

type ContractSource = 'preconfigured' | 'custom';

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
    // Empty address: we're parsing for deployment, no existing contract to target
    const result = loadAndPrepareArtifact(artifactInput, '');
    if (!result.success) {
      return {
        contract: null,
        error: result.error?.message ?? 'Invalid artifact',
      };
    }

    const parsedArtifact = result.parsed;

    const constructors: ContractConstructor[] = parsedArtifact.functions
      .filter((fn: ParsedFunction) => fn.attributes.includes('abi_initializer'))
      .map((fn: ParsedFunction) => ({
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
      (parsedArtifact.compiled as { name?: string })?.name ?? 'Custom Contract';

    return {
      contract: {
        id: 'custom',
        label: contractName,
        artifactJson: artifactInput,
        constructors,
      },
      error: null,
    };
  } catch {
    return { contract: null, error: 'Failed to parse artifact JSON' };
  }
};

interface ContractSetupPanelProps {
  networkName?: AztecNetwork;
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

export const ContractSetupPanel: React.FC<ContractSetupPanelProps> = ({
  networkName,
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
}) => {
  const [activeTab, setActiveTab] = useState<SetupTab>('load');
  const [loadSource, setLoadSource] = useState<ContractSource>('custom');
  const [deploySource, setDeploySource] = useState<ContractSource>('custom');
  const [customDeployArtifact, setCustomDeployArtifact] = useState('');
  const [artifactMethod, setArtifactMethod] =
    useState<ArtifactInputMethod>(null);
  const [deployArtifactMethod, setDeployArtifactMethod] =
    useState<ArtifactInputMethod>(null);

  const { address, preconfiguredId } = useInvokeFlowData();
  const { deployableId, constructorName } = useDeployFlowState();
  const formValues = useFormValues();
  const { setInvokeTarget, setDeployTarget, setSelectedConstructor, pushLog } =
    useContractActions();
  const { setValue: setFormValue, reset: resetFormValues } = useFormActions();
  const { setViewMode, setSidebarSelectedId } = useLayoutActions();
  const loadArtifactWithData = useLoadArtifact(networkName);

  const deployableContracts = useDeployableContracts(networkName);

  const {
    deploy,
    isDeploying,
    error: deployError,
    canDeploy,
    getUnsupportedMessage,
  } = useContractDeployer();

  // Check if custom is selected for deploy
  const isCustomDeploySelected = deploySource === 'custom';

  // Parse custom artifact for deployment
  const customDeployable = useMemo(
    () => buildCustomDeployableContract(customDeployArtifact),
    [customDeployArtifact]
  );

  // Get the selected preconfigured contract
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

  // Get the selected deployable contract (preconfigured)
  const selectedPreconfiguredDeployable = useMemo(
    () => deployableContracts.find((c) => c.id === deployableId) ?? null,
    [deployableContracts, deployableId]
  );

  // Effective deployable (either preconfigured or custom)
  const effectiveDeployable = isCustomDeploySelected
    ? customDeployable.contract
    : selectedPreconfiguredDeployable;

  // Get the selected constructor
  const effectiveConstructor = useMemo(() => {
    if (!effectiveDeployable) return null;
    if (!constructorName) return null;
    return (
      effectiveDeployable.constructors.find(
        (c) => c.name === constructorName
      ) ?? null
    );
  }, [effectiveDeployable, constructorName]);

  const constructorInputs = useMemo(
    () => effectiveConstructor?.inputs ?? [],
    [effectiveConstructor]
  );

  const hasNoConstructorInputs =
    effectiveConstructor &&
    constructorInputs.filter((i) => i.type.kind !== 'struct').length === 0;

  // Validation
  const isValidAddress = !address || isValidAztecAddress(address);
  const addressError =
    !isValidAddress && address ? 'Invalid Aztec address' : undefined;

  const canLoadContract =
    loadSource === 'custom'
      ? Boolean(address && artifactInput && isValidAddress)
      : loadSource === 'preconfigured' &&
        selectedPreconfigured &&
        !isLoadingPreconfigured;

  const isDeployFormValid = useMemo(() => {
    if (isCustomDeploySelected && customDeployable.error) return false;
    if (isCustomDeploySelected && !effectiveDeployable) return false;
    if (!effectiveDeployable || !effectiveConstructor) return false;
    return constructorInputs
      .filter((i) => i.type.kind !== 'struct')
      .every((input) => {
        const value = formValues[input.path] ?? '';
        return value.trim() !== '';
      });
  }, [
    constructorInputs,
    formValues,
    effectiveDeployable,
    effectiveConstructor,
    isCustomDeploySelected,
    customDeployable.error,
  ]);

  // Auto-select first constructor when deployable changes
  useEffect(() => {
    if (
      !isCustomDeploySelected &&
      selectedPreconfiguredDeployable &&
      !constructorName &&
      selectedPreconfiguredDeployable.constructors.length > 0
    ) {
      setSelectedConstructor(
        selectedPreconfiguredDeployable.constructors[0].name
      );
    }
  }, [
    isCustomDeploySelected,
    selectedPreconfiguredDeployable,
    constructorName,
    setSelectedConstructor,
  ]);

  // Auto-select first constructor when custom artifact is parsed
  const prevCustomConstructorsLength = useRef(0);
  useEffect(() => {
    const currentLength = customDeployable.contract?.constructors.length ?? 0;
    if (currentLength > 0 && prevCustomConstructorsLength.current === 0) {
      setSelectedConstructor(customDeployable.contract!.constructors[0].name);
    }
    prevCustomConstructorsLength.current = currentLength;
  }, [customDeployable.contract, setSelectedConstructor]);

  // Clear address and artifact when starting with custom mode (on mount)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      // Clear state when mounting with custom mode selected
      if (loadSource === 'custom') {
        setInvokeTarget('');
        onArtifactChange('');
        onSelectPreconfigured(null);
      }
    }
  }, [loadSource, setInvokeTarget, onArtifactChange, onSelectPreconfigured]);

  // Handlers
  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInvokeTarget(e.target.value);
    },
    [setInvokeTarget]
  );

  const handleArtifactChange = useCallback(
    (value: string) => {
      onArtifactChange(value);
    },
    [onArtifactChange]
  );

  const handleCustomDeployArtifactChange = useCallback((value: string) => {
    setCustomDeployArtifact(value);
  }, []);

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
      // Clear artifact when switching methods
      onArtifactChange('');
    },
    [onArtifactChange]
  );

  const handleDeployArtifactMethodChange = useCallback(
    (method: ArtifactInputMethod) => {
      setDeployArtifactMethod(method);
      setCustomDeployArtifact('');
    },
    []
  );

  const handleDeploySourceChange = useCallback(
    (source: ContractSource) => {
      setDeploySource(source);
      setDeployArtifactMethod(null);
      if (source === 'preconfigured' && deployableContracts.length > 0) {
        const firstConstructor = deployableContracts[0].constructors[0];
        setDeployTarget(
          deployableContracts[0].id,
          firstConstructor?.name ?? null
        );
      } else {
        setDeployTarget(null, null);
        setCustomDeployArtifact('');
      }
    },
    [deployableContracts, setDeployTarget]
  );

  const handleSelectDeployable = useCallback(
    (contract: DeployableContract) => {
      setDeploySource('preconfigured');
      setDeployTarget(contract.id, contract.constructors[0]?.name ?? null);
    },
    [setDeployTarget]
  );

  const handleConstructorChange = useCallback(
    (value: string) => {
      setSelectedConstructor(value || null);
      resetFormValues();
    },
    [setSelectedConstructor, resetFormValues]
  );

  const handleParamChange = useCallback(
    (paramName: string, value: string) => {
      setFormValue(paramName, value);
    },
    [setFormValue]
  );

  const handleLoad = useCallback(() => {
    // Check if contract already exists in saved contracts
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

    // Contract doesn't exist, load it (this saves to cache)
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

  const handleDeploy = useCallback(async () => {
    if (!effectiveDeployable || !effectiveConstructor) return;

    pushLog({
      level: 'info',
      title: 'Deploying contract',
      detail: `${effectiveDeployable.label} using ${effectiveConstructor.label}`,
    });

    const result = await deploy({
      contract: effectiveDeployable,
      constructor: effectiveConstructor,
      args: formValues,
    });

    if (!result.success) {
      pushLog({
        level: 'error',
        title: 'Deployment failed',
        detail: result.error ?? 'Unknown error',
      });
      return;
    }

    const deployedLabel = buildDeploymentLabel(effectiveDeployable, formValues);

    pushLog({
      level: 'success',
      title: 'Contract deployed',
      detail: `${deployedLabel} at ${result.address}${result.txHash ? ` | TX: ${result.txHash}` : ''}`,
    });

    // Load the deployed contract
    setInvokeTarget(result.address ?? '');
    resetFormValues();

    requestAnimationFrame(() => {
      loadArtifactWithData(
        result.address ?? '',
        effectiveDeployable.artifactJson ?? '',
        deployedLabel
      )
        .then(() => {
          // Switch to explorer view with the deployed contract
          const contractId = `deployed-${result.address}`;
          setSidebarSelectedId(contractId);
          setViewMode('explorer');
        })
        .catch((err) => {
          pushLog({
            level: 'error',
            title: 'Failed to load deployed contract',
            detail: err instanceof Error ? err.message : 'Unknown error',
          });
        });
    });
  }, [
    effectiveDeployable,
    effectiveConstructor,
    formValues,
    deploy,
    pushLog,
    setInvokeTarget,
    resetFormValues,
    loadArtifactWithData,
    setSidebarSelectedId,
    setViewMode,
  ]);

  const deploymentErrorMessage = deployError ?? getUnsupportedMessage();

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h1 className={styles.title}>Add Contract</h1>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SetupTab)}
        >
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="load" className={styles.tabsTrigger}>
              <Download size={iconSize()} />
              Load Existing
            </TabsTrigger>
            <TabsTrigger value="deploy" className={styles.tabsTrigger}>
              <Rocket size={iconSize()} />
              Deploy New
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'load' && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Select Contract Source</span>
          <div className={styles.cardsGrid}>
            <ContractSourceCard
              icon={FileEdit}
              title="Custom Contract"
              description="Enter address & artifact manually"
              isSelected={loadSource === 'custom'}
              onClick={() => handleLoadSourceChange('custom')}
              className={styles.card}
            />
            {preconfiguredContracts.length > 0 && (
              <ContractSourceCard
                icon={Coins}
                title="Token Contract"
                description="Wonderland Token (ERC20-like)"
                isSelected={loadSource === 'preconfigured'}
                onClick={() => handleLoadSourceChange('preconfigured')}
                className={styles.card}
              />
            )}
          </div>

          {/* Contract Details Card */}
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <span className={styles.detailsTitle}>Contract Details</span>
              {loadSource === 'custom' && artifactMethod && (
                <button
                  type="button"
                  className={styles.detailsBackBtn}
                  onClick={() => handleArtifactMethodChange(null)}
                >
                  <ArrowLeft size={12} />
                  Change method
                </button>
              )}
            </div>
            <div className={styles.detailsContent}>
              <Input
                id="contract-address"
                label="Contract Address"
                value={address}
                onChange={handleAddressChange}
                placeholder="0x1d64b9cf07d536e6b218c14256c4965a..."
                error={addressError}
                disabled={loadSource === 'preconfigured'}
              />

              {/* Preconfigured: Show preloaded file */}
              {loadSource === 'preconfigured' && (
                <div className={styles.textareaWrapper}>
                  <ArtifactInput
                    id="artifact-json"
                    value={isLoadingPreconfigured ? '' : artifactInput}
                    onChange={handleArtifactChange}
                    placeholder="Loading artifact..."
                    disabled={isLoadingPreconfigured}
                    rows={8}
                    preloadedFile={preloadedArtifactFile ?? undefined}
                  />
                  {isLoadingPreconfigured && (
                    <div className={styles.loadingOverlay}>
                      <Loader2 size={iconSize()} className="animate-spin" />
                      <span>Loading artifact...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Custom: Show method selection or selected input */}
              {loadSource === 'custom' && !artifactMethod && (
                <>
                  <span className={styles.formLabel}>
                    How would you like to provide the artifact?
                  </span>
                  <div className={styles.artifactMethodGrid}>
                    <button
                      type="button"
                      className={cn(
                        styles.artifactMethodCard,
                        styles.artifactMethodCardDefault
                      )}
                      onClick={() => handleArtifactMethodChange('file')}
                    >
                      <Upload
                        size={iconSize('lg')}
                        className={styles.artifactMethodIcon}
                      />
                      <span className={styles.artifactMethodTitle}>
                        Upload File
                      </span>
                      <span className={styles.artifactMethodDesc}>
                        Drop or browse for JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        styles.artifactMethodCard,
                        styles.artifactMethodCardDefault
                      )}
                      onClick={() => handleArtifactMethodChange('paste')}
                    >
                      <ClipboardPaste
                        size={iconSize('lg')}
                        className={styles.artifactMethodIcon}
                      />
                      <span className={styles.artifactMethodTitle}>
                        Paste JSON
                      </span>
                      <span className={styles.artifactMethodDesc}>
                        Enter artifact manually
                      </span>
                    </button>
                  </div>
                </>
              )}

              {/* Custom with method selected: Show the appropriate input */}
              {loadSource === 'custom' && artifactMethod && (
                <ArtifactInput
                  id="artifact-json"
                  value={artifactInput}
                  onChange={handleArtifactChange}
                  placeholder="Paste contract artifact JSON here..."
                  disabled={false}
                  rows={12}
                  inputMethod={artifactMethod}
                />
              )}

              {parseError && <p className={styles.hintError}>{parseError}</p>}
            </div>
          </div>

          <div className={styles.actionsRow}>
            <Button
              variant="primary"
              onClick={handleLoad}
              disabled={!canLoadContract}
              icon={<Download size={iconSize()} />}
            >
              Load Contract
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'deploy' && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Select Contract to Deploy</span>
          <div className={styles.cardsGrid}>
            <ContractSourceCard
              icon={FileEdit}
              title="Custom Contract"
              description="Deploy from artifact"
              isSelected={isCustomDeploySelected}
              onClick={() => handleDeploySourceChange('custom')}
              className={styles.card}
            />
            {deployableContracts.map((contract) => (
              <ContractSourceCard
                key={contract.id}
                icon={Coins}
                title={contract.label}
                description="ERC20-like token"
                isSelected={
                  !isCustomDeploySelected &&
                  selectedPreconfiguredDeployable?.id === contract.id
                }
                onClick={() => handleSelectDeployable(contract)}
                className={styles.card}
              />
            ))}
          </div>

          {/* Custom artifact input for deployment */}
          {isCustomDeploySelected && (
            <div className={styles.detailsCard}>
              <div className={styles.detailsHeader}>
                <span className={styles.detailsTitle}>Contract Artifact</span>
                {deployArtifactMethod && (
                  <button
                    type="button"
                    className={styles.detailsBackBtn}
                    onClick={() => handleDeployArtifactMethodChange(null)}
                  >
                    <ArrowLeft size={12} />
                    Change method
                  </button>
                )}
              </div>
              <div className={styles.detailsContent}>
                {!deployArtifactMethod && (
                  <>
                    <span className={styles.formLabel}>
                      How would you like to provide the artifact?
                    </span>
                    <div className={styles.artifactMethodGrid}>
                      <button
                        type="button"
                        className={cn(
                          styles.artifactMethodCard,
                          styles.artifactMethodCardDefault
                        )}
                        onClick={() => handleDeployArtifactMethodChange('file')}
                      >
                        <Upload
                          size={iconSize('lg')}
                          className={styles.artifactMethodIcon}
                        />
                        <span className={styles.artifactMethodTitle}>
                          Upload File
                        </span>
                        <span className={styles.artifactMethodDesc}>
                          Drop or browse for JSON
                        </span>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          styles.artifactMethodCard,
                          styles.artifactMethodCardDefault
                        )}
                        onClick={() =>
                          handleDeployArtifactMethodChange('paste')
                        }
                      >
                        <ClipboardPaste
                          size={iconSize('lg')}
                          className={styles.artifactMethodIcon}
                        />
                        <span className={styles.artifactMethodTitle}>
                          Paste JSON
                        </span>
                        <span className={styles.artifactMethodDesc}>
                          Enter artifact manually
                        </span>
                      </button>
                    </div>
                  </>
                )}

                {deployArtifactMethod && (
                  <ArtifactInput
                    id="custom-deploy-artifact"
                    value={customDeployArtifact}
                    onChange={handleCustomDeployArtifactChange}
                    placeholder="Paste the compiled contract artifact JSON here"
                    disabled={isDeploying}
                    rows={12}
                    inputMethod={deployArtifactMethod}
                    error={customDeployable.error ?? undefined}
                    helperText={
                      customDeployArtifact &&
                      !effectiveDeployable &&
                      !customDeployable.error
                        ? 'Provide a valid artifact to load constructors.'
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          )}

          {/* Constructor selector (show when multiple constructors) */}
          {effectiveDeployable &&
            effectiveDeployable.constructors.length > 1 && (
              <div className={styles.formGroup}>
                <label
                  htmlFor="constructor-select"
                  className={styles.sectionLabel}
                >
                  Constructor
                </label>
                <Select
                  value={effectiveConstructor?.name ?? ''}
                  onValueChange={handleConstructorChange}
                  disabled={isDeploying}
                >
                  <SelectTrigger id="constructor-select">
                    <SelectValue placeholder="Select a constructor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveDeployable.constructors.map((ctor) => (
                      <SelectItem key={ctor.name} value={ctor.name}>
                        {ctor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          {/* Constructor parameters */}
          {effectiveDeployable && effectiveConstructor && (
            <div className={styles.constructorSection}>
              <div className={styles.constructorHeader}>
                <Rocket
                  size={iconSize('md')}
                  className={styles.constructorIcon}
                />
                <span className={styles.constructorTitle}>
                  Constructor Parameters
                </span>
              </div>
              <div className={styles.constructorContent}>
                {hasNoConstructorInputs && (
                  <p className={styles.hint}>
                    This constructor requires no parameters.
                  </p>
                )}
                <ParameterInputs
                  inputs={constructorInputs}
                  values={formValues}
                  onChange={handleParamChange}
                  disabled={isDeploying}
                  idPrefix="param"
                />
              </div>
            </div>
          )}

          {deploymentErrorMessage && (
            <p className={styles.hintError} role="alert">
              {deploymentErrorMessage}
            </p>
          )}

          {!canDeploy() && effectiveConstructor && (
            <p className={styles.hintWarning} role="alert">
              Contract deployment is not yet supported for your wallet type.
            </p>
          )}

          <div className={styles.actionsRow}>
            <Button
              variant="primary"
              onClick={handleDeploy}
              disabled={!canDeploy() || !isDeployFormValid || isDeploying}
              isLoading={isDeploying}
              icon={<Rocket size={iconSize()} />}
            >
              {isDeploying ? 'Deploying...' : 'Deploy Contract'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractSetupPanel;
