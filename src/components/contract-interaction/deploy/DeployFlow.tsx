import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
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
import { constants } from '../../../utils/contractCache';
import {
  loadAndPrepareArtifact,
  type ParsedFunction,
} from '../../../utils/contractInteraction';
import { toTitleCase } from '../../../utils/string';
import ParameterInputs from '../ParameterInputs';
import type { AztecNetwork } from '../../../config/networks/constants';
import type {
  ContractConstructor,
  DeployableContract,
} from '../../../utils/deployableContracts';

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
      // In custom mode, selectedConstructor is null (findConstructorByName returns null
      // when deployableId is null), so use constructorName directly from the store
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

  const constructorInputs = effectiveConstructor?.inputs ?? [];

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
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value || null;
      setDeployableId(value);
      setCustomArtifactInput('');
    },
    [setDeployableId]
  );

  const handleConstructorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedConstructor(e.target.value || null);
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
    <div className="deploy-section">
      <div className="form-group">
        <label htmlFor="deployable-contract">Contract to Deploy</label>
        <select
          id="deployable-contract"
          className="form-input"
          value={deployableId ?? ''}
          onChange={handleDeployableChange}
          disabled={isDeploying}
          aria-label="Select contract to deploy"
        >
          <option value="">Custom artifact (paste JSON)</option>
          {deployableContracts.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.label}
            </option>
          ))}
        </select>
      </div>

      {isCustomSelected && (
        <div className="form-group">
          <label htmlFor="custom-artifact">
            Custom contract artifact (JSON)
          </label>
          <textarea
            id="custom-artifact"
            className="form-input"
            value={customArtifactInput}
            onChange={handleCustomArtifactChange}
            placeholder="Paste the compiled contract artifact JSON here"
            disabled={isDeploying}
            aria-label="Custom contract artifact JSON"
            rows={6}
          />
          {customDeployable.error ? (
            <div className="input-hint error" role="alert">
              {customDeployable.error}
            </div>
          ) : (
            customArtifactInput &&
            !effectiveDeployable && (
              <div className="input-hint warning" role="status">
                Provide a valid artifact to load constructors.
              </div>
            )
          )}
        </div>
      )}

      {effectiveDeployable && (
        <div className="form-group">
          <label htmlFor="constructor-select">Constructor</label>
          <select
            id="constructor-select"
            className="form-input"
            value={effectiveConstructor?.name ?? ''}
            onChange={handleConstructorChange}
            disabled={isDeploying}
            aria-label="Select constructor"
          >
            <option value="">Select a constructor...</option>
            {effectiveDeployable.constructors.map((ctor) => (
              <option key={ctor.name} value={ctor.name}>
                {ctor.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {effectiveConstructor && (
        <div className="constructor-params">
          <div className="form-section-title">Constructor Parameters</div>
          {hasNoConstructorInputs && (
            <div className="input-hint" role="status">
              This constructor requires no parameters.
            </div>
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
        <div className="input-hint error" role="alert">
          {deploymentError}
        </div>
      )}

      {!canDeploy && effectiveConstructor && (
        <div className="input-hint warning" role="alert">
          Contract deployment is not yet supported for your wallet type.
        </div>
      )}

      <div className="action-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDeploy}
          disabled={!canDeploy || !isDeployFormValid || isDeploying}
          aria-label="Deploy contract"
        >
          {isDeploying ? 'Deploying...' : 'Deploy Contract'}
        </button>
      </div>
    </div>
  );
};

export default DeployFlow;
