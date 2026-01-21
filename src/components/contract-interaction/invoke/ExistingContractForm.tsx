import React from 'react';
import { Loader2 } from 'lucide-react';
import { iconSize } from '../../../utils';
import { Button, Input, Textarea } from '../../ui';
import type { ExistingContractFormProps } from '../types';

const styles = {
  section: 'flex flex-col gap-4',
  textareaWrapper: 'relative',
  loadingOverlay:
    'absolute inset-0 flex items-center justify-center gap-2 bg-surface/80 rounded-lg text-muted',
  hint: 'text-sm text-muted',
  hintError: 'text-sm text-red-500',
  actionRow: 'flex gap-2 pt-2',
} as const;

const ExistingContractForm: React.FC<ExistingContractFormProps> = ({
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
}) => {
  const addressError =
    !isValidAddress && address ? 'Invalid Aztec address' : undefined;

  return (
    <div className={styles.section}>
      <Input
        id="contract-address"
        label="Contract Address"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="0x1d64b9cf07d536e6b218c14256c4965a..."
        error={addressError}
        helperText={
          isPreconfiguredMode
            ? 'Pre-filled address, but you can change it to use a different deployment.'
            : undefined
        }
      />

      <div className={styles.textareaWrapper}>
        <Textarea
          id="artifact-json"
          label="Artifact (JSON)"
          value={isLoadingPreconfigured ? '' : artifactInput}
          onChange={(e) => onArtifactChange(e.target.value)}
          placeholder={
            isLoadingPreconfigured
              ? 'Loading artifact...'
              : 'Paste compiled artifact JSON'
          }
          disabled={isPreconfiguredMode || isLoadingPreconfigured}
          readOnly={isPreconfiguredMode}
          rows={4}
        />
        {isLoadingPreconfigured && (
          <div className={styles.loadingOverlay}>
            <Loader2 size={iconSize()} className="animate-spin" />
            <span>Loading artifact...</span>
          </div>
        )}
      </div>

      {error && <p className={styles.hintError}>{error}</p>}

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
