import React from 'react';
import { cn } from '../../utils';
import { Input, Textarea, Button } from '../ui';
import type { ExistingContractFormProps } from './types';

/**
 * ExistingContractForm styles - semantic pattern.
 */
const styles = {
  container: 'space-y-4',
  formGroup: 'space-y-1.5',
  label: 'block text-sm font-semibold text-default',
  hint: 'text-xs text-muted mt-1',
  hintError: 'text-xs text-red-500 mt-1',
  textareaWrapper: 'relative',
  loadingOverlay: cn(
    'absolute inset-0 flex items-center justify-center gap-2',
    'bg-surface/80 backdrop-blur-sm rounded-lg',
    'text-sm text-muted'
  ),
  loadingSpinner:
    'animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent',
  actionRow: 'pt-2',
} as const;

const ExistingContractForm = ({
  address,
  artifactInput,
  onAddressChange,
  onArtifactChange,
  onLoad,
  error,
  isValidAddress,
  isPreconfiguredMode,
  isLoadingPreconfigured = false,
  canLoad,
}: ExistingContractFormProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.formGroup}>
        <label htmlFor="contract-address" className={styles.label}>
          Contract Address
        </label>
        <Input
          id="contract-address"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Paste deployed contract address"
          aria-label="Contract address"
          hasError={!isValidAddress && Boolean(address)}
        />
        {!isValidAddress && address && (
          <span className={styles.hintError}>Invalid Aztec address</span>
        )}
        {isPreconfiguredMode && (
          <span className={styles.hint}>
            Pre-filled address, but you can change it to use a different
            deployment.
          </span>
        )}
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="artifact-json" className={styles.label}>
          Artifact (JSON)
        </label>
        <div className={styles.textareaWrapper}>
          <Textarea
            id="artifact-json"
            value={isLoadingPreconfigured ? '' : artifactInput}
            onChange={(e) => onArtifactChange(e.target.value)}
            placeholder={
              isLoadingPreconfigured
                ? 'Loading artifact...'
                : 'Paste compiled artifact JSON'
            }
            aria-label="Artifact JSON"
            disabled={isPreconfiguredMode || isLoadingPreconfigured}
            readOnly={isPreconfiguredMode}
            rows={6}
          />
          {isLoadingPreconfigured && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner} />
              <span>Loading artifact...</span>
            </div>
          )}
        </div>
      </div>

      {error && <div className={styles.hintError}>{error}</div>}

      <div className={styles.actionRow}>
        <Button
          variant="primary"
          onClick={onLoad}
          disabled={!canLoad}
          aria-label={
            isPreconfiguredMode
              ? 'Load preconfigured contract'
              : 'Load custom artifact'
          }
        >
          {isPreconfiguredMode ? 'Load contract' : 'Load artifact'}
        </Button>
      </div>
    </div>
  );
};

export default ExistingContractForm;
