import React, {
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { Download, Rocket } from 'lucide-react';
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
import { cn, iconSize } from '../../../utils';
import {
  isValidAztecAddress,
  toSidebarId,
} from '../../../utils/contractInteraction';
import { buildDeploymentLabel } from '../../../utils/deployableContracts';
import { Tabs, TabsList, TabsTrigger } from '../../ui';
import DeployTabContent from './setup/DeployTabContent';
import LoadTabContent from './setup/LoadTabContent';
import {
  buildCustomDeployableContract,
  type ArtifactInputMethod,
  type SetupTab,
  type ContractSource,
} from './setup/setup-utils';
import type { AztecNetwork } from '../../../config/networks/constants';
import type { PreconfiguredContract } from '../../../config/preconfiguredContracts';
import type { DeployableContract } from '../../../utils/deployableContracts';

const styles = {
  panel: 'flex flex-col gap-6 p-8 flex-1 overflow-y-auto',
  header: 'flex items-center justify-between',
  title: 'text-2xl font-bold text-default font-display',
  tabsList: 'bg-surface-tertiary border-0 p-1 rounded-xl gap-1',
  tabsTrigger: cn(
    'text-[13px] font-medium gap-1.5 px-4 py-2 rounded-lg',
    'data-[state=active]:bg-surface data-[state=active]:shadow-sm'
  ),
} as const;

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
  const { reset: resetFormValues } = useFormActions();
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

  // Validation
  const isValidAddress = !address || isValidAztecAddress(address);

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
    const inputs = effectiveConstructor.inputs;
    return inputs
      .filter((i) => i.type.kind !== 'struct')
      .every((input) => {
        const value = formValues[input.path] ?? '';
        return value.trim() !== '';
      });
  }, [
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

    setInvokeTarget(result.address ?? '');
    resetFormValues();

    requestAnimationFrame(() => {
      loadArtifactWithData(
        result.address ?? '',
        effectiveDeployable.artifactJson ?? '',
        deployedLabel
      )
        .then(() => {
          setSidebarSelectedId(toSidebarId(result.address ?? ''));
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
        <LoadTabContent
          source={{
            selected: loadSource,
            preconfiguredContracts,
            onChange: handleLoadSourceChange,
          }}
          artifact={{
            method: artifactMethod,
            value: artifactInput,
            parseError,
            isLoadingPreconfigured,
            preloadedFile: preloadedArtifactFile,
            onMethodChange: handleArtifactMethodChange,
            onChange: handleArtifactChange,
          }}
          canLoad={!!canLoadContract}
          onLoad={handleLoad}
        />
      )}

      {activeTab === 'deploy' && (
        <DeployTabContent
          source={{
            isCustom: isCustomDeploySelected,
            deployableContracts,
            selectedPreconfigured: selectedPreconfiguredDeployable,
            onSourceChange: handleDeploySourceChange,
            onSelectDeployable: handleSelectDeployable,
          }}
          customArtifact={{
            method: deployArtifactMethod,
            value: customDeployArtifact,
            parsed: customDeployable,
            onMethodChange: handleDeployArtifactMethodChange,
            onChange: handleCustomDeployArtifactChange,
          }}
          deploy={{
            deployable: effectiveDeployable,
            constructor: effectiveConstructor,
            isDeploying,
            isFormValid: isDeployFormValid,
            canDeploy: canDeploy(),
            errorMessage: deploymentErrorMessage,
            onDeploy: handleDeploy,
          }}
        />
      )}
    </div>
  );
};

export default ContractSetupPanel;
