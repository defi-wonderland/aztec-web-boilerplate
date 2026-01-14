import React from 'react';
import DeployContractForm from './DeployContractForm';
import ExistingContractForm from './ExistingContractForm';
import PreconfiguredSelector from './PreconfiguredSelector';
import SavedContractsList from './SavedContractsList';
import type { ArtifactLoaderProps } from './types';

/**
 * ArtifactLoader styles - semantic pattern.
 */
const styles = {
  card: 'rounded-lg border border-default bg-surface-secondary p-4 space-y-4',
} as const;

/**
 * Orchestrator component for loading existing contracts or deploying new ones.
 * Renders content based on the mode prop - tabs are managed externally.
 */
const ArtifactLoader = ({
  mode = 'existing',
  existing,
  saved,
  preconfigured,
  deploy,
}: ArtifactLoaderProps) => {
  const isDeployMode = mode === 'deploy';
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

  return (
    <div className={styles.card}>
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
