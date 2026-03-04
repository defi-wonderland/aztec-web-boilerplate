import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormActions, useFormValues } from '../../../../../store/form';
import { buildDeploymentLabel } from '../../../../../utils/deployableContracts';
import { useContractDeployer, useLoadArtifact } from '../../../hooks';
import { useDeployableContracts } from '../../../hooks/useInteractionContracts';
import {
  useContractActions,
  useDeployFlowState,
  useLayoutActions,
} from '../../../store';
import { toSidebarId } from '../../../utils';
import {
  buildCustomDeployableContract,
  type ArtifactInputMethod,
  type ContractSource,
} from './setup-utils';
import type { AztecNetwork } from '../../../../../config/networks/constants';
import type { DeployableContract } from '../../../../../utils/deployableContracts';

interface UseDeployTabOptions {
  networkName?: AztecNetwork;
}

export const useDeployTab = (options: UseDeployTabOptions) => {
  const { networkName } = options;

  const [deploySource, setDeploySource] = useState<ContractSource>('custom');
  const [customDeployArtifact, setCustomDeployArtifact] = useState('');
  const [deployArtifactMethod, setDeployArtifactMethod] =
    useState<ArtifactInputMethod>(null);

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

  const isCustomDeploySelected = deploySource === 'custom';

  // Parse custom artifact for deployment
  const customDeployable = useMemo(
    () => buildCustomDeployableContract(customDeployArtifact),
    [customDeployArtifact]
  );

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
    const constructors = customDeployable.contract?.constructors ?? [];
    const currentLength = constructors.length;
    if (currentLength > 0 && prevCustomConstructorsLength.current === 0) {
      setSelectedConstructor(constructors[0].name);
    }
    prevCustomConstructorsLength.current = currentLength;
  }, [customDeployable.contract, setSelectedConstructor]);

  // --- Handlers ---

  const handleCustomDeployArtifactChange = useCallback((value: string) => {
    setCustomDeployArtifact(value);
  }, []);

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

    setInvokeTarget(result.address ?? '', null);
    resetFormValues();

    try {
      const artifactJson = effectiveDeployable.artifactJson;
      if (!artifactJson) {
        throw new Error(
          `No artifact JSON available for "${effectiveDeployable.label}". ` +
            'Registry-based contracts must be resolved before deployment.'
        );
      }

      await loadArtifactWithData(
        result.address ?? '',
        artifactJson,
        deployedLabel
      );
      setSidebarSelectedId(toSidebarId(result.address ?? ''));
      setViewMode('explorer');
    } catch (err) {
      pushLog({
        level: 'error',
        title: 'Failed to load deployed contract',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
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

  return {
    // Props for DeployTabContent
    source: {
      isCustom: isCustomDeploySelected,
      deployableContracts,
      selectedPreconfigured: selectedPreconfiguredDeployable,
      onSourceChange: handleDeploySourceChange,
      onSelectDeployable: handleSelectDeployable,
    },
    customArtifact: {
      method: deployArtifactMethod,
      value: customDeployArtifact,
      parsed: customDeployable,
      onMethodChange: handleDeployArtifactMethodChange,
      onChange: handleCustomDeployArtifactChange,
    },
    deploy: {
      deployable: effectiveDeployable,
      constructor: effectiveConstructor,
      isDeploying,
      isFormValid: isDeployFormValid,
      canDeploy: canDeploy(),
      errorMessage: deploymentErrorMessage,
      onDeploy: handleDeploy,
    },
  };
};
