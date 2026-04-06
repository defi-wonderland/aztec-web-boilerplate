import { Zap, Globe, CheckCircle, X } from 'lucide-react';
import type { PopupResponse, TxSummary } from '../shared/types';
import {
  layoutStyles,
  headerStyles,
  originStyles,
  detailCardStyles,
  buttonStyles,
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
  titleIcon: 'text-accent',
  title: 'text-lg font-semibold text-default',
  subtitle: 'text-sm text-muted mb-4',

  // Origin
  originWrap: originStyles.wrap,
  originLabel: originStyles.label,
  originBadge: originStyles.badge,

  // Detail card
  detailCard: detailCardStyles.card,
  detailRow: detailCardStyles.row,
  detailLabel: detailCardStyles.label,
  detailValue: detailCardStyles.value,
  methodBadge: detailCardStyles.methodBadge,

  // Buttons
  approveButton: buttonStyles.primary,
  rejectButton: buttonStyles.danger,
} as const;

/* ---------------------------------------------------------------------------
   Props
   --------------------------------------------------------------------------- */

interface SignFlowProps {
  summary: TxSummary;
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

// TIER-2-UPGRADE: On approve, calls credentials.get({ challenge: outer_hash }) for WebAuthn signing.
export function SignFlow({ summary, onComplete, onCancel }: SignFlowProps) {
  const handleApprove = () => onComplete({ type: 'tx-approved' });
  const handleReject = () => onComplete({ type: 'tx-cancelled' });

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
          <Zap size={18} strokeWidth={2} className={styles.titleIcon} aria-hidden="true" />
          <h1 className={styles.title}>Approve Transaction</h1>
        </div>
        <p className={styles.subtitle}>Review the details before approving.</p>

        {/* Origin badge */}
        <div className={styles.originWrap}>
          <span className={styles.originLabel}>Requested by</span>
          <span className={styles.originBadge} data-testid="sign-dapp-origin">
            <Globe size={10} strokeWidth={2} aria-hidden="true" />
            {summary.dappOrigin}
          </span>
        </div>

        {/* Transaction details card */}
        <div className={styles.detailCard} data-testid="sign-details-card">
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Contract</span>
            <span className={styles.detailValue} title={summary.contractAddress}>
              {truncateAddress(summary.contractAddress)}
            </span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Method</span>
            <span className={styles.methodBadge} data-testid="sign-method-name">
              {summary.methodName}
            </span>
          </div>
          {summary.args && summary.args.length > 0 && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Args</span>
              <span className={styles.detailValue}>
                {summary.args.length} argument{summary.args.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={[styles.section, 'mt-4'].join(' ')}>
          <button
            type="button"
            onClick={handleApprove}
            className={styles.approveButton}
            data-testid="sign-approve-button"
          >
            <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
            <span>Approve</span>
          </button>

          <button
            type="button"
            onClick={handleReject}
            className={styles.rejectButton}
            data-testid="sign-reject-button"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
            <span>Reject</span>
          </button>
        </div>

      </div>
    </div>
  );
}
