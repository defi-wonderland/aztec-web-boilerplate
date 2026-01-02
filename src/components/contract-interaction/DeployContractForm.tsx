import React, { useMemo } from 'react';
import type { DeployContractFormProps } from './types';
import { findConstructor } from '../../utils/deployableContracts';
import { getPlaceholderForType, getLabelForType } from './helpers';

/**
 * Form for deploying a new contract.
 * Includes contract selection, constructor selection, and parameter inputs.
 */
const DeployContractForm = ({
  deployableContracts,
  selectedDeployableId,
  onSelectDeployable,
  selectedConstructorName,
  onSelectConstructor,
  formValues,
  onFormValueChange,
  onDeploy,
  isDeploying,
  deploymentError,
  canDeploy,
}: DeployContractFormProps) => {
  const selectedDeployable = useMemo(() => {
    if (!selectedDeployableId) return null;
    return (
      deployableContracts.find((c) => c.id === selectedDeployableId) ?? null
    );
  }, [deployableContracts, selectedDeployableId]);

  const selectedConstructor = useMemo(() => {
    if (!selectedDeployable || !selectedConstructorName) return null;
    return findConstructor(selectedDeployable, selectedConstructorName) ?? null;
  }, [selectedDeployable, selectedConstructorName]);

  const isDeployFormValid = useMemo(() => {
    if (!selectedConstructor) return false;
    const requiredInputs = selectedConstructor.inputs.filter(
      (input) => input.type.kind !== 'struct'
    );
    return requiredInputs.every((input) => {
      const value = formValues[input.path] ?? '';
      return value.trim() !== '';
    });
  }, [selectedConstructor, formValues]);

  const handleDeployableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const contractId = e.target.value || null;
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
          value={selectedDeployableId ?? ''}
          onChange={handleDeployableChange}
          disabled={isDeploying}
          aria-label="Select contract to deploy"
        >
          <option value="">Select a contract...</option>
          {deployableContracts.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.label}
            </option>
          ))}
        </select>
      </div>

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
          <div className="form-grid">
            {selectedConstructor.inputs
              .filter((input) => input.type.kind !== 'struct')
              .map((input) => {
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
