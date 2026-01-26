import React, { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import { downloadJson, iconSize } from '../../../utils';
import {
  Button,
  Input,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../ui';
import type { ArtifactSummary, ExistingContractFormProps } from '../types';

/**
 * Extracts minimal summary from artifact JSON without full parsing.
 * This is much faster than full artifact parsing for large contracts.
 */
function extractSummaryFromJson(json: string): ArtifactSummary | null {
  if (!json || json.length < 100) return null;
  try {
    // Look for contract name near the start of the JSON (first 500 chars)
    const startSection = json.slice(0, 500);
    const nameMatch = startSection.match(/"name"\s*:\s*"([^"]+)"/);
    const name = nameMatch?.[1] ?? 'Contract';

    // Count function entries by matching function_type occurrences
    const functionTypeMatches = json.match(/"function_type"\s*:/g);
    const functionCount = functionTypeMatches?.length ?? 0;

    return { name, functionCount };
  } catch {
    return { name: 'Contract', functionCount: 0 };
  }
}

const styles = {
  section: 'flex flex-col gap-4',
  textareaWrapper: 'relative',
  loadingOverlay:
    'absolute inset-0 flex items-center justify-center gap-2 bg-surface/80 rounded-lg text-muted',
  label: 'text-sm font-medium text-default',
  hintError: 'text-sm text-red-500',
  actionRow: 'flex gap-2 pt-2',
  // Artifact summary styles
  summaryContainer: 'flex flex-col gap-1',
  summaryBox:
    'rounded-lg border border-default bg-surface-secondary p-4 flex items-center justify-between',
  summaryLeft: 'flex items-center gap-3',
  summaryIcon: 'text-green-500',
  summaryContent: 'flex flex-col',
  summaryTitle: 'text-sm font-medium text-default',
  summaryDetail: 'text-xs text-muted',
  actionButtons: 'flex items-center gap-2',
  iconButton: 'text-muted hover:text-default transition-colors',
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
  artifactSummary,
}) => {
  const [copied, setCopied] = useState(false);

  const addressError =
    !isValidAddress && address ? 'Invalid Aztec address' : undefined;

  // Use provided summary or extract from JSON input
  // Always show summary if we have substantial artifact input (avoids rendering huge text)
  const effectiveSummary = useMemo(() => {
    if (artifactSummary) return artifactSummary;
    if (artifactInput && artifactInput.length > 100) {
      return (
        extractSummaryFromJson(artifactInput) ?? {
          name: 'Contract',
          functionCount: 0,
        }
      );
    }
    return null;
  }, [artifactSummary, artifactInput]);

  const showSummary = effectiveSummary && !isLoadingPreconfigured;

  const handleCopy = useCallback(async () => {
    if (!artifactInput) return;
    try {
      await navigator.clipboard.writeText(artifactInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn('Clipboard write failed');
    }
  }, [artifactInput]);

  const handleDownload = () => {
    if (!artifactInput) return;
    const fileName = effectiveSummary?.name
      ? `${effectiveSummary.name.toLowerCase().replace(/\s+/g, '_')}_artifact.json`
      : 'artifact.json';
    downloadJson(artifactInput, fileName);
  };

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

      {showSummary && (
        <div className={styles.summaryContainer}>
          <label className={styles.label}>Artifact (JSON)</label>
          <div className={styles.summaryBox}>
            <div className={styles.summaryLeft}>
              <Check size={iconSize('md')} className={styles.summaryIcon} />
              <div className={styles.summaryContent}>
                <span className={styles.summaryTitle}>
                  {effectiveSummary.name} contract loaded
                </span>
                <span className={styles.summaryDetail}>
                  {effectiveSummary.functionCount > 0
                    ? `${effectiveSummary.functionCount} functions available`
                    : 'Artifact loaded'}
                </span>
              </div>
            </div>
            <div className={styles.actionButtons}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={styles.iconButton}
                  >
                    {copied && <Check size={iconSize()} />}
                    {!copied && <Copy size={iconSize()} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? 'Copied!' : 'Copy artifact JSON'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className={styles.iconButton}
                  >
                    <Download size={iconSize()} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Download artifact JSON</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {!showSummary && (
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
            disabled={isLoadingPreconfigured}
            rows={4}
          />
          {isLoadingPreconfigured && (
            <div className={styles.loadingOverlay}>
              <Loader2 size={iconSize()} className="animate-spin" />
              <span>Loading artifact...</span>
            </div>
          )}
        </div>
      )}

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
