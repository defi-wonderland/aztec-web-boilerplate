import React, { useMemo } from 'react';
import { findConstructor } from '../../utils/deployableContracts';
import { getPlaceholderForType, getLabelForType } from './helpers';
import type { DeployContractFormProps } from './types';

/**
 * Form for deploying a new contract.
 * Includes contract selection, constructor selection, and parameter inputs.
 */
const DeployContractForm = ({
  deployableContracts,
  selectedDeployableId,
  onSelectDeployable,
  isCustomSelected,
  customDeployable,
  selectedConstructorName,
  onSelectConstructor,
  formValues,
  onFormValueChange,
  onDeploy,
  isDeploying,
  deploymentError,
  canDeploy,
  customArtifactInput,
  onCustomArtifactChange,
  customArtifactError,
}: DeployContractFormProps) => {
  const selectedDeployable = useMemo(() => {
    if (isCustomSelected) {
      return customDeployable;
    }
    if (!selectedDeployableId) return null;
    return (
      deployableContracts.find((c) => c.id === selectedDeployableId) ?? null
    );
  }, [
    customDeployable,
    deployableContracts,
    isCustomSelected,
    selectedDeployableId,
  ]);

  const selectedConstructor = useMemo(() => {
    if (!selectedDeployable || !selectedConstructorName) return null;
    return findConstructor(selectedDeployable, selectedConstructorName) ?? null;
  }, [selectedDeployable, selectedConstructorName]);

  const constructorInputs = useMemo(() => {
    if (!selectedConstructor) return [];
    return selectedConstructor.inputs.filter(
      (input) => input.type.kind !== 'struct'
    );
  }, [selectedConstructor]);

  const hasNoConstructorInputs =
    selectedConstructor && constructorInputs.length === 0;
  const selectedDeployableValue = selectedDeployableId ?? '';

  const isDeployFormValid = useMemo(() => {
    if (isCustomSelected && customArtifactError) return false;
    if (isCustomSelected && !selectedDeployable) return false;
    if (!selectedConstructor) return false;
    return constructorInputs.every((input) => {
      const value = formValues[input.path] ?? '';
      return value.trim() !== '';
    });
  }, [
    constructorInputs,
    customArtifactError,
    formValues,
    isCustomSelected,
    selectedConstructor,
    selectedDeployable,
  ]);

  const handleDeployableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const contractId = value || null;
    onSelectDeployable(contractId);
  };

  const handleConstructorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const constructorName = e.target.value;
    onSelectConstructor(constructorName);
  };

  const handleParamChange = (paramName: string, value: string) => {
    onFormValueChange(paramName, value);
  };

  const handleDeploy = () => {
    onDeploy();
  };

  return (
    <div className="deploy-section">
      <div className="form-group">
        <label htmlFor="deployable-contract">Contract to Deploy</label>
        <select
          id="deployable-contract"
          className="form-input"
          value={selectedDeployableValue}
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
            onChange={(e) => onCustomArtifactChange(e.target.value)}
            placeholder="Paste the compiled contract artifact JSON here"
            disabled={isDeploying}
            aria-label="Custom contract artifact JSON"
            rows={6}
          />
          {customArtifactError ? (
            <div className="input-hint error" role="alert">
              {customArtifactError}
            </div>
          ) : (
            customArtifactInput &&
            !selectedDeployable && (
              <div className="input-hint warning" role="status">
                Provide a valid artifact to load constructors.
              </div>
            )
          )}
        </div>
      )}

      {selectedDeployable && (
        <div className="form-group">
          <label htmlFor="constructor-select">Constructor</label>
          <select
            id="constructor-select"
            className="form-input"
            value={selectedConstructorName ?? ''}
            onChange={handleConstructorChange}
            disabled={isDeploying}
            aria-label="Select constructor"
          >
            <option value="">Select a constructor...</option>
            {selectedDeployable.constructors.map((ctor) => (
              <option key={ctor.name} value={ctor.name}>
                {ctor.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedConstructor && (
        <div className="constructor-params">
          <div className="form-section-title">Constructor Parameters</div>
          {hasNoConstructorInputs && (
            <div className="input-hint" role="status">
              This constructor requires no parameters.
            </div>
          )}
          {constructorInputs.length > 0 && (
            <div className="form-grid">
              {constructorInputs.map((input) => {
                const typeLabel = getLabelForType(input.type);
                return (
                  <div className="form-group" key={input.path}>
                    <label htmlFor={`param-${input.path}`}>
                      <span className="form-label-row">
                        <span className="form-label-main">{input.label}</span>
                        {typeLabel && (
                          <span className="form-type-hint">{typeLabel}</span>
                        )}
                      </span>
                    </label>
                    <input
                      id={`param-${input.path}`}
                      className="form-input"
                      value={formValues[input.path] ?? ''}
                      onChange={(e) =>
                        handleParamChange(input.path, e.target.value)
                      }
                      placeholder={getPlaceholderForType(input.type)}
                      disabled={isDeploying}
                      aria-label={input.label}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {deploymentError && (
        <div className="input-hint error" role="alert">
          {deploymentError}
        </div>
      )}

      {!canDeploy && selectedConstructor && (
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

export default DeployContractForm;
