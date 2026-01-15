import React, { useMemo } from 'react';
import { Rocket } from 'lucide-react';
import { iconSize } from '../../utils';
import { findConstructor } from '../../utils/deployableContracts';
import {
  Input,
  Textarea,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui';
import { getPlaceholderForType, getLabelForType } from './helpers';
import type { DeployContractFormProps } from './types';

/**
 * DeployContractForm styles - semantic pattern.
 */
const styles = {
  section: 'space-y-4',
  formGroup: 'space-y-1.5',
  label: 'block text-sm font-semibold text-default',
  labelRow: 'flex items-center gap-2',
  labelMain: 'text-default',
  typeHint: 'text-xs text-muted font-normal',
  hint: 'text-xs text-muted mt-1',
  hintError: 'text-xs text-red-500 mt-1',
  hintWarning: 'text-xs text-amber-500 mt-1',
  paramsSection: 'space-y-3',
  sectionTitle: 'text-sm font-semibold text-default mb-3',
  paramsGrid: 'grid gap-4 sm:grid-cols-2',
  actionRow: 'pt-2',
} as const;

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

  const handleDeployableChange = (value: string) => {
    const contractId = value === 'custom' ? null : value;
    onSelectDeployable(contractId);
  };

  const handleConstructorChange = (value: string) => {
    onSelectConstructor(value);
  };

  const handleParamChange = (paramName: string, value: string) => {
    onFormValueChange(paramName, value);
  };

  const handleDeploy = () => {
    onDeploy();
  };

  return (
    <div className={styles.section}>
      <div className={styles.formGroup}>
        <label htmlFor="deployable-contract" className={styles.label}>
          Contract to Deploy
        </label>
        <Select
          value={selectedDeployableId ?? 'custom'}
          onValueChange={handleDeployableChange}
          disabled={isDeploying}
        >
          <SelectTrigger id="deployable-contract">
            <SelectValue placeholder="Select contract to deploy" />
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
        <div className={styles.formGroup}>
          <label htmlFor="custom-artifact" className={styles.label}>
            Custom contract artifact (JSON)
          </label>
          <Textarea
            id="custom-artifact"
            value={customArtifactInput}
            onChange={(e) => onCustomArtifactChange(e.target.value)}
            placeholder="Paste the compiled contract artifact JSON here"
            disabled={isDeploying}
            aria-label="Custom contract artifact JSON"
            rows={6}
          />
          {customArtifactError && (
            <div className={styles.hintError} role="alert">
              {customArtifactError}
            </div>
          )}
          {!customArtifactError &&
            customArtifactInput &&
            !selectedDeployable && (
              <div className={styles.hintWarning} role="status">
                Provide a valid artifact to load constructors.
              </div>
            )}
        </div>
      )}

      {selectedDeployable && (
        <div className={styles.formGroup}>
          <label htmlFor="constructor-select" className={styles.label}>
            Constructor
          </label>
          <Select
            value={selectedConstructorName ?? ''}
            onValueChange={handleConstructorChange}
            disabled={isDeploying}
          >
            <SelectTrigger id="constructor-select">
              <SelectValue placeholder="Select a constructor..." />
            </SelectTrigger>
            <SelectContent>
              {selectedDeployable.constructors.map((ctor) => (
                <SelectItem key={ctor.name} value={ctor.name}>
                  {ctor.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedConstructor && (
        <div className={styles.paramsSection}>
          <div className={styles.sectionTitle}>Constructor Parameters</div>
          {hasNoConstructorInputs && (
            <div className={styles.hint} role="status">
              This constructor requires no parameters.
            </div>
          )}
          {constructorInputs.length > 0 && (
            <div className={styles.paramsGrid}>
              {constructorInputs.map((input) => {
                const typeLabel = getLabelForType(input.type);
                return (
                  <div className={styles.formGroup} key={input.path}>
                    <label
                      htmlFor={`param-${input.path}`}
                      className={styles.label}
                    >
                      <span className={styles.labelRow}>
                        <span className={styles.labelMain}>{input.label}</span>
                        {typeLabel && (
                          <span className={styles.typeHint}>{typeLabel}</span>
                        )}
                      </span>
                    </label>
                    <Input
                      id={`param-${input.path}`}
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
        <div className={styles.hintError} role="alert">
          {deploymentError}
        </div>
      )}

      {!canDeploy && selectedConstructor && (
        <div className={styles.hintWarning} role="alert">
          Contract deployment is not yet supported for your wallet type.
        </div>
      )}

      <div className={styles.actionRow}>
        <Button
          variant="primary"
          onClick={handleDeploy}
          disabled={!canDeploy || !isDeployFormValid || isDeploying}
          isLoading={isDeploying}
          icon={<Rocket size={iconSize()} />}
          aria-label="Deploy contract"
        >
          {isDeploying ? 'Deploying...' : 'Deploy Contract'}
        </Button>
      </div>
    </div>
  );
};

export default DeployContractForm;
