import React, { useCallback } from 'react';
import { Download, Loader2, ArrowLeft, FileEdit, Coins } from 'lucide-react';
import { useInvokeFlowData, useContractActions } from '../../../../store';
import { cn, iconSize } from '../../../../utils';
import { isValidAztecAddress } from '../../../../utils/contractInteraction';
import { Button, Input } from '../../../ui';
import ArtifactInput from '../../ArtifactInput';
import ContractSourceCard from '../ContractSourceCard';
import ArtifactMethodSelector from './ArtifactMethodSelector';
import type { ArtifactInputMethod, ContractSource } from './setup-utils';
import type { PreconfiguredContract } from '../../../../config/preconfiguredContracts';

const styles = {
  section: 'flex flex-col gap-5',
  sectionLabel: 'text-sm font-bold text-default uppercase tracking-wide',
  cardsGrid: 'flex gap-3 flex-wrap',
  card: 'w-[220px]',
  // Details card
  detailsCard: cn(
    'rounded-2xl border border-default bg-surface',
    'overflow-hidden'
  ),
  detailsHeader: cn(
    'flex items-center justify-between',
    'px-5 py-3.5 border-b border-default'
  ),
  detailsTitle: 'text-sm font-semibold text-default',
  detailsBackBtn: cn(
    'flex items-center gap-1 text-xs font-medium text-accent',
    'cursor-pointer hover:text-accent/80 transition-colors'
  ),
  detailsContent: 'flex flex-col gap-4 p-5',
  textareaWrapper: 'relative',
  loadingOverlay: cn(
    'absolute inset-0 flex items-center justify-center gap-2',
    'bg-surface/80 rounded-xl text-muted'
  ),
  loadingSpinner: 'animate-spin',
  hintError: 'text-sm text-error',
  actionsRow: 'flex gap-4 pt-2',
} as const;

interface LoadTabContentProps {
  source: {
    selected: ContractSource;
    preconfiguredContracts: PreconfiguredContract[];
    onChange: (source: ContractSource) => void;
  };
  artifact: {
    method: ArtifactInputMethod;
    value: string;
    parseError: string | null;
    isLoadingPreconfigured: boolean;
    preloadedFile: { name: string; size: number; content: string } | null;
    onMethodChange: (method: ArtifactInputMethod) => void;
    onChange: (value: string) => void;
  };
  canLoad: boolean;
  onLoad: () => void;
}

export const LoadTabContent: React.FC<LoadTabContentProps> = ({
  source,
  artifact,
  canLoad,
  onLoad,
}) => {
  const { address } = useInvokeFlowData();
  const { setAddress } = useContractActions();

  const isValid = !address || isValidAztecAddress(address);
  const addressError =
    !isValid && address ? 'Invalid Aztec address' : undefined;

  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAddress(e.target.value);
    },
    [setAddress]
  );

  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>Select Contract Source</span>
      <div className={styles.cardsGrid}>
        <ContractSourceCard
          icon={FileEdit}
          title="Custom Contract"
          description="Enter address & artifact manually"
          isSelected={source.selected === 'custom'}
          onClick={() => source.onChange('custom')}
          className={styles.card}
        />
        {source.preconfiguredContracts.length > 0 && (
          <ContractSourceCard
            icon={Coins}
            title={
              source.preconfiguredContracts.length === 1
                ? source.preconfiguredContracts[0].label
                : 'Pre-configured'
            }
            description={
              source.preconfiguredContracts.length === 1
                ? 'Pre-configured contract'
                : `${source.preconfiguredContracts.length} contracts available`
            }
            isSelected={source.selected === 'preconfigured'}
            onClick={() => source.onChange('preconfigured')}
            className={styles.card}
          />
        )}
      </div>

      {/* Contract Details Card */}
      <div className={styles.detailsCard}>
        <div className={styles.detailsHeader}>
          <span className={styles.detailsTitle}>Contract Details</span>
          {source.selected === 'custom' && artifact.method && (
            <button
              type="button"
              className={styles.detailsBackBtn}
              onClick={() => artifact.onMethodChange(null)}
            >
              <ArrowLeft size={iconSize('xs')} />
              Change method
            </button>
          )}
        </div>
        <div className={styles.detailsContent}>
          <Input
            id="contract-address"
            label="Contract Address"
            value={address}
            onChange={handleAddressChange}
            placeholder="0x1d64b9cf07d536e6b218c14256c4965a..."
            error={addressError}
            disabled={source.selected === 'preconfigured'}
          />

          {/* Preconfigured: Show preloaded file */}
          {source.selected === 'preconfigured' && (
            <div className={styles.textareaWrapper}>
              <ArtifactInput
                id="artifact-json"
                value={artifact.isLoadingPreconfigured ? '' : artifact.value}
                onChange={artifact.onChange}
                placeholder="Loading artifact..."
                disabled={artifact.isLoadingPreconfigured}
                rows={8}
                preloadedFile={artifact.preloadedFile ?? undefined}
              />
              {artifact.isLoadingPreconfigured && (
                <div className={styles.loadingOverlay}>
                  <Loader2
                    size={iconSize()}
                    className={styles.loadingSpinner}
                  />
                  <span>Loading artifact...</span>
                </div>
              )}
            </div>
          )}

          {/* Custom: Show method selection or selected input */}
          {source.selected === 'custom' && !artifact.method && (
            <ArtifactMethodSelector onSelect={artifact.onMethodChange} />
          )}

          {/* Custom with method selected: Show the appropriate input */}
          {source.selected === 'custom' && artifact.method && (
            <ArtifactInput
              id="artifact-json"
              value={artifact.value}
              onChange={artifact.onChange}
              placeholder="Paste contract artifact JSON here..."
              disabled={false}
              rows={12}
              inputMethod={artifact.method}
            />
          )}

          {artifact.parseError && (
            <p className={styles.hintError}>{artifact.parseError}</p>
          )}
        </div>
      </div>

      <div className={styles.actionsRow}>
        <Button
          variant="primary"
          onClick={onLoad}
          disabled={!canLoad}
          icon={<Download size={iconSize()} />}
        >
          Load Contract
        </Button>
      </div>
    </div>
  );
};

export default LoadTabContent;
