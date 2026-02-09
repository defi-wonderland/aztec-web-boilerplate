import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { Rocket } from 'lucide-react';
import {
  useDeployableContracts,
  resolveDeployableArtifact,
} from '../../../hooks/useInteractionContracts';
import {
  useSelectedDeployable,
  useIsCustomDeployable,
  useContractActions,
  useDeployFlowState,
  useFormValues,
  useFormActions,
} from '../../../store';
import { iconSize } from '../../../utils';
import { hasProcessedFunctions } from '../../../utils/artifactNormalizer';
import { loadAndPrepareArtifact } from '../../../utils/contractInteraction';
import {
  buildConstructorLabel,
  type ArtifactFormat,
  type ContractConstructor,
  type DeployableContract,
} from '../../../utils/deployableContracts';
import {
  Button,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui';
import ParameterInputs from '../ParameterInputs';
import type { AztecNetwork } from '../../../config/networks/constants';
import type { ParsedFunction } from '../../../types/artifact';

const styles = {
  section: 'flex flex-col gap-4',
  formGroup: 'flex flex-col gap-2',
  label: 'text-sm font-semibold text-default',
  constructorParams: 'flex flex-col gap-3 pt-4 border-t border-default',
  sectionTitle: 'text-sm font-semibold text-default',
  hint: 'text-sm text-muted',
  hintError: 'text-sm text-red-500',
  hintWarning: 'text-sm text-amber-500',
  actionRow: 'flex gap-2 pt-4',
} as const;

export interface DeployFlowProps {
  networkName?: AztecNetwork;
  onDeploy: (
    deployable: DeployableContract,
    constructor: ContractConstructor,
    formValues: Record<string, string>
  ) => void;
  isDeploying: boolean;
  deploymentError?: string | null;
  canDeploy: boolean;
}

type CustomDeployableResult = {
  contract: DeployableContract | null;
  error: string | null;
};

const buildCustomDeployableContract = (
  artifactInput: string
): CustomDeployableResult => {
  if (!artifactInput.trim()) {
    return { contract: null, error: null };
  }

  try {
    const result = loadAndPrepareArtifact(artifactInput, '');
    if (!result.success) {
      return { contract: null, error: result.error.message };
    }

    const parsedArtifact = result.parsed;

    // Detect format at the ingestion boundary so downstream consumers
    // don't need to sniff the JSON structure at runtime
    const raw = JSON.parse(artifactInput);
    const artifactFormat: ArtifactFormat = hasProcessedFunctions(raw)
      ? 'artifact'
      : 'compiled';

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
        artifactFormat,
        constructors,
      },
      error: null,
    };
  } catch {
    return { contract: null, error: 'Failed to parse artifact JSON' };
  }
};

const DeployFlow: React.FC<DeployFlowProps> = ({
  networkName,
  onDeploy,
  isDeploying,
  deploymentError,
  canDeploy,
}) => {
  const deployableContracts = useDeployableContracts(networkName);
  const selectedDeployable = useSelectedDeployable(networkName);
  const isCustomSelected = useIsCustomDeployable();
  const formValues = useFormValues();
  const { deployableId, constructorName } = useDeployFlowState();
  const { setDeployTarget } = useContractActions();
  const { setValue: setFormValue } = useFormActions();

  const [customArtifactInput, setCustomArtifactInput] = useState('');
  const [resolvedDeployable, setResolvedDeployable] =
    useState<DeployableContract | null>(null);
  const [isResolvingArtifact, setIsResolvingArtifact] = useState(false);

  const customDeployable = useMemo(
    () => buildCustomDeployableContract(customArtifactInput),
    [customArtifactInput]
  );

  // Check if selected contract needs async resolution from registry
  const needsAsyncResolution = useMemo(() => {
    if (isCustomSelected || !selectedDeployable) return false;
    // Has constructors - no need to fetch
    if (selectedDeployable.constructors.length > 0) return false;
    // No classId - can't fetch
    if (!selectedDeployable.classId) return false;
    return true;
  }, [isCustomSelected, selectedDeployable]);

  // Resolve artifact from registry for classId-based contracts
  useEffect(() => {
    if (!needsAsyncResolution || !selectedDeployable) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      setIsResolvingArtifact(true);
      setResolvedDeployable(null);

      try {
        const resolved = await resolveDeployableArtifact(selectedDeployable);
        if (!controller.signal.aborted) {
          setResolvedDeployable(resolved);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResolvedDeployable(selectedDeployable);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsResolvingArtifact(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [needsAsyncResolution, selectedDeployable]);

  const effectiveDeployable = useMemo(() => {
    if (isCustomSelected) return customDeployable.contract;
    if (!selectedDeployable) return null;
    if (needsAsyncResolution) return resolvedDeployable;
    return selectedDeployable;
  }, [
    isCustomSelected,
    customDeployable.contract,
    selectedDeployable,
    needsAsyncResolution,
    resolvedDeployable,
  ]);

  const effectiveConstructor = useMemo(() => {
    if (!effectiveDeployable) return null;
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

  const isDeployFormValid = useMemo(() => {
    if (isCustomSelected && customDeployable.error) return false;
    if (isCustomSelected && !effectiveDeployable) return false;
    if (!effectiveConstructor) return false;
    return constructorInputs
      .filter((i) => i.type.kind !== 'struct')
      .every((input) => {
        const value = formValues[input.path] ?? '';
        return value.trim() !== '';
      });
  }, [
    constructorInputs,
    customDeployable.error,
    formValues,
    isCustomSelected,
    effectiveConstructor,
    effectiveDeployable,
  ]);

  const handleDeployableChange = useCallback(
    (value: string) => {
      setDeployTarget(value === 'custom' ? null : value || null, null);
      setCustomArtifactInput('');
    },
    [setDeployTarget]
  );

  const handleConstructorChange = useCallback(
    (value: string) => {
      setDeployTarget(deployableId, value || null);
    },
    [setDeployTarget, deployableId]
  );

  const handleParamChange = useCallback(
    (paramName: string, value: string) => {
      setFormValue(paramName, value);
    },
    [setFormValue]
  );

  const handleCustomArtifactChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCustomArtifactInput(e.target.value);
    },
    []
  );

  useEffect(() => {
    if (
      !isCustomSelected &&
      effectiveDeployable &&
      !constructorName &&
      effectiveDeployable.constructors.length > 0
    ) {
      setDeployTarget(deployableId, effectiveDeployable.constructors[0].name);
    }
  }, [
    isCustomSelected,
    effectiveDeployable,
    constructorName,
    deployableId,
    setDeployTarget,
  ]);

  const prevConstructorsLength = useRef(0);
  useEffect(() => {
    const currentLength = customDeployable.contract?.constructors.length ?? 0;
    if (currentLength > 0 && prevConstructorsLength.current === 0) {
      setDeployTarget(null, customDeployable.contract!.constructors[0].name);
    }
    prevConstructorsLength.current = currentLength;
  }, [customDeployable.contract, setDeployTarget]);

  const handleDeploy = useCallback(() => {
    if (!effectiveDeployable || !effectiveConstructor) return;
    onDeploy(effectiveDeployable, effectiveConstructor, formValues);
  }, [effectiveDeployable, effectiveConstructor, formValues, onDeploy]);

  return (
    <div className={styles.section}>
      <div className={styles.formGroup}>
        <label htmlFor="deployable-contract" className={styles.label}>
          Contract to Deploy
        </label>
        <Select
          value={deployableId ?? 'custom'}
          onValueChange={handleDeployableChange}
          disabled={isDeploying}
        >
          <SelectTrigger id="deployable-contract">
            <SelectValue placeholder="Custom artifact (paste JSON)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom artifact (paste JSON)</SelectItem>
            {deployableContracts.map((contract) => (
              <SelectItem key={contract.id} value={contract.id}>
                {contract.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustomSelected && (
        <Textarea
          id="custom-artifact"
          label="Custom contract artifact (JSON)"
          value={customArtifactInput}
          onChange={handleCustomArtifactChange}
          placeholder="Paste the compiled contract artifact JSON here"
          disabled={isDeploying}
          rows={6}
          error={customDeployable.error ?? undefined}
          helperText={
            customArtifactInput &&
            !effectiveDeployable &&
            !customDeployable.error
              ? 'Provide a valid artifact to load constructors.'
              : undefined
          }
        />
      )}

      {isResolvingArtifact && (
        <p className={styles.hint}>Loading contract artifact...</p>
      )}

      {effectiveDeployable && (
        <div className={styles.formGroup}>
          <label htmlFor="constructor-select" className={styles.label}>
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

      {effectiveConstructor && (
        <div className={styles.constructorParams}>
          <div className={styles.sectionTitle}>Constructor Parameters</div>
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
      )}

      {deploymentError && (
        <p className={styles.hintError} role="alert">
          {deploymentError}
        </p>
      )}

      {!canDeploy && effectiveConstructor && (
        <p className={styles.hintWarning} role="alert">
          Contract deployment is not yet supported for your wallet type.
        </p>
      )}

      <div className={styles.actionRow}>
        <Button
          variant="primary"
          onClick={handleDeploy}
          disabled={!canDeploy || !isDeployFormValid || isDeploying}
          isLoading={isDeploying}
          icon={<Rocket size={iconSize()} />}
        >
          {isDeploying ? 'Deploying...' : 'Deploy Contract'}
        </Button>
      </div>
    </div>
  );
};

export default DeployFlow;
