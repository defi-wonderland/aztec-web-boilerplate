import React, { useCallback } from 'react';
import {
  Download,
  Loader2,
  ArrowLeft,
  FileEdit,
  Coins,
  FileJson,
  Copy,
  Check,
} from 'lucide-react';
import { useCopyToClipboard } from '../../../../hooks/useCopyToClipboard';
import { useInvokeFlowData, useContractActions } from '../../../../store';
import { cn, downloadAsFile, iconSize } from '../../../../utils';
import { isValidAztecAddress } from '../../../../utils/contractInteraction';
import { Button, Input } from '../../../ui';
import { ArtifactInput } from '../../ArtifactInput';
import { ContractSourceCard } from '../ContractSourceCard';
import { ArtifactMethodSelector } from './ArtifactMethodSelector';
import type { ArtifactInputMethod, ContractSource } from './setup-utils';
import type { PreconfiguredContract } from '../../../../config/preconfiguredContracts';

const styles = {
  section: 'flex flex-col gap-5',
  sectionLabel: 'text-sm font-bold text-default uppercase tracking-wide',
  cardsGrid: 'flex gap-3 flex-wrap',
  card: 'w-[240px]',
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
  // Artifact info bar (preconfigured)
  artifactSection: 'flex flex-col gap-2',
  artifactLabel: 'text-sm font-semibold text-default',
  artifactBar: cn(
    'flex items-center gap-3 px-4 py-3',
    'rounded-xl border border-default bg-surface-secondary'
  ),
  artifactIcon: 'text-accent shrink-0',
  artifactDetails: 'flex flex-col min-w-0 flex-1',
  artifactName: 'text-sm font-medium text-default truncate',
  artifactSize: 'text-xs text-muted',
  artifactActions: 'flex items-center gap-1 shrink-0',
  artifactLoading: cn(
    'flex items-center justify-center gap-2',
    'py-6 text-muted'
  ),
  loadingSpinner: 'animate-spin',
  hintError: 'text-sm text-error',
  actionsRow: 'flex gap-4 pt-2',
} as const;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  const { copied, copy } = useCopyToClipboard();

  const isValid = !address || isValidAztecAddress(address);
  const addressError =
    (!isValid && address && 'Invalid Aztec address') || undefined;

  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAddress(e.target.value);
    },
    [setAddress]
  );

  const handleCopyArtifact = useCallback(() => {
    const content = artifact.preloadedFile?.content;
    if (!content) return;
    copy(content);
  }, [artifact.preloadedFile, copy]);

  const handleDownloadArtifact = useCallback(() => {
    const file = artifact.preloadedFile;
    if (!file) return;
    downloadAsFile(file.content, file.name);
  }, [artifact.preloadedFile]);

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
                ? source.preconfiguredContracts[0].label || 'Pre-configured'
                : 'Pre-configured'
            }
            description={
              (source.preconfiguredContracts.length === 1 &&
                'Pre-configured contract') ||
              `${source.preconfiguredContracts.length} contracts available`
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

          {/* Preconfigured: Show artifact info bar */}
          {source.selected === 'preconfigured' && (
            <div className={styles.artifactSection}>
              <span className={styles.artifactLabel}>
                Contract Artifact (JSON)
              </span>
              {artifact.isLoadingPreconfigured && (
                <div className={styles.artifactLoading}>
                  <Loader2
                    size={iconSize()}
                    className={styles.loadingSpinner}
                  />
                  <span>Loading artifact...</span>
                </div>
              )}
              {!artifact.isLoadingPreconfigured && !artifact.preloadedFile && (
                <div className={styles.artifactLoading}>
                  <span>No artifact available</span>
                </div>
              )}
              {!artifact.isLoadingPreconfigured && artifact.preloadedFile && (
                <div className={styles.artifactBar}>
                  <FileJson
                    size={iconSize('md')}
                    className={styles.artifactIcon}
                  />
                  <div className={styles.artifactDetails}>
                    <span className={styles.artifactName}>
                      {artifact.preloadedFile.name}
                    </span>
                    <span className={styles.artifactSize}>
                      {formatFileSize(artifact.preloadedFile.size)}
                    </span>
                  </div>
                  <div className={styles.artifactActions}>
                    <Button
                      variant="icon"
                      size="icon"
                      onClick={handleCopyArtifact}
                    >
                      {copied && <Check size={iconSize()} />}
                      {!copied && <Copy size={iconSize()} />}
                    </Button>
                    <Button
                      variant="icon"
                      size="icon"
                      onClick={handleDownloadArtifact}
                    >
                      <Download size={iconSize()} />
                    </Button>
                  </div>
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
