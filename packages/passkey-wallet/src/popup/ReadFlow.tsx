import { Eye, Globe, CheckCircle, X, Info } from 'lucide-react';
import type { PopupResponse, ReadSummary } from '../shared/types';
import {
  layoutStyles,
  headerStyles,
  originStyles,
  detailCardStyles,
  buttonStyles,
  infoStyles,
} from './styles';

/* ---------------------------------------------------------------------------
   Styles
   --------------------------------------------------------------------------- */

const styles = {
  // Layout
  shell: layoutStyles.shell,
  card: layoutStyles.card,
  section: layoutStyles.section,

  // Header
  headerRow: headerStyles.row,
  logoWrap: headerStyles.logoWrap,
  logoText: headerStyles.logoText,
  wordmark: headerStyles.wordmark,

  // Page title
  titleRow: 'flex items-center gap-2 mb-1',
  titleIcon: 'text-blue-500',
  title: 'text-lg font-semibold text-default',
  subtitle: 'text-sm text-muted mb-4',

  // Origin
  originWrap: originStyles.wrap,
  originLabel: originStyles.label,
  originBadge: originStyles.badge,

  // Info box
  infoWrap: infoStyles.wrap,
  infoIcon: infoStyles.icon,
  infoText: infoStyles.text,

  // Detail card
  detailCard: detailCardStyles.card,
  detailRow: detailCardStyles.row,
  detailLabel: detailCardStyles.label,
  detailValue: detailCardStyles.value,
  methodBadge: detailCardStyles.methodBadge,

  // Buttons
  allowButton: buttonStyles.primary,
  denyButton: buttonStyles.danger,
} as const;

/* ---------------------------------------------------------------------------
   Props
   --------------------------------------------------------------------------- */

interface ReadFlowProps {
  summary: ReadSummary;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */

/** Truncate a contract address for display */
function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export function ReadFlow({ summary, onComplete, onCancel }: ReadFlowProps) {
  const handleAllow = () => onComplete({ type: 'read-approved' });
  const handleDeny = () => onComplete({ type: 'read-cancelled' });

  return (
    <div className={styles.shell}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.headerRow}>
          <div className={styles.logoWrap} aria-hidden="true">
            <span className={styles.logoText}>A</span>
          </div>
          <span className={styles.wordmark}>Aztec Wallet</span>
        </div>

        {/* Page title */}
        <div className={styles.titleRow}>
          <Eye size={18} strokeWidth={2} className={styles.titleIcon} aria-hidden="true" />
          <h1 className={styles.title}>Private Data Request</h1>
        </div>
        <p className={styles.subtitle}>A dapp wants to read private data from your wallet.</p>

        {/* Origin badge */}
        <div className={styles.originWrap}>
          <span className={styles.originLabel}>Requested by</span>
          <span className={styles.originBadge} data-testid="read-dapp-origin">
            <Globe size={10} strokeWidth={2} aria-hidden="true" />
            {summary.dappOrigin}
          </span>
        </div>

        {/* Info message (read-only, less alarming than sign) */}
        <div className={styles.infoWrap} role="note">
          <Info size={14} strokeWidth={2} className={styles.infoIcon} aria-hidden="true" />
          <p className={styles.infoText}>
            This is a read-only request. No transaction will be sent and no funds will move.
          </p>
        </div>

        {/* Read details card */}
        <div className={styles.detailCard} data-testid="read-details-card">
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Contract</span>
            <span className={styles.detailValue} title={summary.contractAddress}>
              {truncateAddress(summary.contractAddress)}
            </span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>View</span>
            <span className={styles.methodBadge} data-testid="read-method-name">
              {summary.methodName}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className={[styles.section, 'mt-4'].join(' ')}>
          <button
            type="button"
            onClick={handleAllow}
            className={styles.allowButton}
            data-testid="read-allow-button"
          >
            <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
            <span>Allow</span>
          </button>

          <button
            type="button"
            onClick={handleDeny}
            className={styles.denyButton}
            data-testid="read-deny-button"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
            <span>Deny</span>
          </button>
        </div>

      </div>
    </div>
  );
}
