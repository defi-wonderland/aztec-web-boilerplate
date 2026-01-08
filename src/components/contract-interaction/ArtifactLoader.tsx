import React from 'react';
import DeployContractForm from './DeployContractForm';
import ExistingContractForm from './ExistingContractForm';
import PreconfiguredSelector from './PreconfiguredSelector';
import SavedContractsList from './SavedContractsList';
import type { ArtifactLoaderProps, ArtifactLoaderMode } from './types';

/**
 * Orchestrator component for loading existing contracts or deploying new ones.
 * Composes sub-components for different functionalities.
 */
const ArtifactLoader = ({
  mode = 'existing',
  onModeChange,
  existing,
  saved,
  preconfigured,
  deploy,
}: ArtifactLoaderProps) => {
  const isDeployMode = mode === 'deploy';
  const hasDeployableContracts = Boolean(deploy);
  const hasPreconfigured = Boolean(preconfigured?.options.length);

  const isCustomMode = !preconfigured?.selectedId;
  const isPreconfiguredMode = Boolean(preconfigured?.selectedId);
  const isLoadingPreconfigured = preconfigured?.isLoading ?? false;

  const canLoadExisting = isCustomMode
    ? Boolean(existing.address && existing.artifactInput)
    : isPreconfiguredMode && !isLoadingPreconfigured;

  const canClear =
    Boolean(
      saved.hasCache ||
        existing.address ||
        existing.artifactInput ||
        isPreconfiguredMode
    ) && !isLoadingPreconfigured;

  const handleModeToggle = (newMode: ArtifactLoaderMode) => {
    onModeChange?.(newMode);
  };

  return (
    <div className="loader-card">
      {hasDeployableContracts && (
        <div className="mode-toggle-container">
          <div
            className="mode-toggle"
            role="tablist"
            aria-label="Contract mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isDeployMode}
              className={`mode-toggle-btn${!isDeployMode ? ' active' : ''}`}
              onClick={() => handleModeToggle('existing')}
              disabled={deploy?.isDeploying}
            >
              Use Existing
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isDeployMode}
              className={`mode-toggle-btn${isDeployMode ? ' active' : ''}`}
              onClick={() => handleModeToggle('deploy')}
              disabled={deploy?.isDeploying}
            >
              Deploy New
            </button>
          </div>
        </div>
      )}

      {isDeployMode && deploy && (
        <DeployContractForm
          deployableContracts={deploy.contracts}
          selectedDeployableId={deploy.selectedContractId}
          onSelectDeployable={deploy.onSelectContract}
          isCustomSelected={deploy.isCustomSelected}
          customDeployable={deploy.customDeployable}
          selectedConstructorName={deploy.selectedConstructorName}
          onSelectConstructor={deploy.onSelectConstructor}
          formValues={deploy.formValues}
          onFormValueChange={deploy.onFormValueChange}
          onDeploy={deploy.onDeploy}
          isDeploying={deploy.isDeploying}
          deploymentError={deploy.error}
          canDeploy={deploy.canDeploy}
          customArtifactInput={deploy.customArtifactInput}
          onCustomArtifactChange={deploy.onCustomArtifactChange}
          customArtifactError={deploy.customArtifactError}
        />
      )}

      {!isDeployMode && (
        <>
          {hasPreconfigured && preconfigured && (
            <PreconfiguredSelector
              preconfigured={preconfigured.options}
              selectedId={preconfigured.selectedId}
              onSelect={preconfigured.onSelect}
              isLoading={preconfigured.isLoading}
            />
          )}

          <ExistingContractForm
            address={existing.address}
            artifactInput={existing.artifactInput}
            onAddressChange={existing.onAddressChange}
            onArtifactChange={existing.onArtifactChange}
            onLoad={existing.onLoad}
            error={existing.error}
            isValidAddress={existing.isValidAddress}
            isPreconfiguredMode={isPreconfiguredMode}
            isLoadingPreconfigured={isLoadingPreconfigured}
            canLoad={canLoadExisting}
          />

          <SavedContractsList
            contracts={saved.contracts}
            activeAddress={saved.activeAddress}
            onApply={saved.onApply}
            onDelete={saved.onDelete}
            onClearAll={saved.onClearAll}
            canClear={canClear}
          />
        </>
      )}
    </div>
  );
};

export default ArtifactLoader;
