import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { Rocket } from 'lucide-react';
import { useDeployableContracts } from '../../../hooks/useInteractionContracts';
import {
  useSelectedDeployable,
  useSelectedConstructor,
  useIsCustomDeployable,
  useContractActions,
  useDeployFlowState,
  useFormValues,
  useFormActions,
} from '../../../store';
import { iconSize } from '../../../utils';
import { constants } from '../../../utils/contractCache';
import {
  loadAndPrepareArtifact,
  type ParsedFunction,
} from '../../../utils/contractInteraction';
import { toTitleCase } from '../../../utils/string';
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
import type {
  ContractConstructor,
  DeployableContract,
} from '../../../utils/deployableContracts';

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

const DeployFlow: React.FC<DeployFlowProps> = ({
  networkName,
  onDeploy,
  isDeploying,
  deploymentError,
  canDeploy,
}) => {
  const deployableContracts = useDeployableContracts(networkName);
  const selectedDeployable = useSelectedDeployable(networkName);
  const selectedConstructor = useSelectedConstructor(networkName);
  const isCustomSelected = useIsCustomDeployable();
  const formValues = useFormValues();
  const { deployableId, constructorName } = useDeployFlowState();
  const { setDeployableId, setSelectedConstructor } = useContractActions();
  const { setValue: setFormValue } = useFormActions();

  const [customArtifactInput, setCustomArtifactInput] = useState('');

  const customDeployable = useMemo(
    () => buildCustomDeployableContract(customArtifactInput),
    [customArtifactInput]
  );

  const effectiveDeployable = isCustomSelected
    ? customDeployable.contract
    : selectedDeployable;

  const effectiveConstructor = useMemo(() => {
    if (!effectiveDeployable) return null;
    if (isCustomSelected && customDeployable.contract) {
      return (
        customDeployable.contract.constructors.find(
          (c) => c.name === constructorName
        ) ?? null
      );
    }
    return selectedConstructor;
  }, [
    effectiveDeployable,
    isCustomSelected,
    customDeployable.contract,
    constructorName,
    selectedConstructor,
  ]);

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
      setDeployableId(value === 'custom' ? null : value || null);
      setCustomArtifactInput('');
    },
    [setDeployableId]
  );

  const handleConstructorChange = useCallback(
    (value: string) => {
      setSelectedConstructor(value || null);
    },
    [setSelectedConstructor]
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
      selectedDeployable &&
      !constructorName &&
      selectedDeployable.constructors.length > 0
    ) {
      setSelectedConstructor(selectedDeployable.constructors[0].name);
    }
  }, [
    isCustomSelected,
    selectedDeployable,
    constructorName,
    setSelectedConstructor,
  ]);

  const prevConstructorsLength = useRef(0);
  useEffect(() => {
    const currentLength = customDeployable.contract?.constructors.length ?? 0;
    if (currentLength > 0 && prevConstructorsLength.current === 0) {
      setSelectedConstructor(customDeployable.contract!.constructors[0].name);
    }
    prevConstructorsLength.current = currentLength;
  }, [customDeployable.contract, setSelectedConstructor]);

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
