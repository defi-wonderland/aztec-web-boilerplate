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
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  } as const,
  titleIcon: {
    color: 'var(--accent-primary)',
  } as const,
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  } as const,
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    marginBottom: '16px',
  } as const,

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
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

// TIER-2-UPGRADE: On approve, calls credentials.get({ challenge: outer_hash }) for WebAuthn signing.
export function SignFlow({ summary, onComplete, onCancel }: SignFlowProps) {
  const handleApprove = () => onComplete({ type: 'tx-approved' });
  const handleReject = () => onComplete({ type: 'tx-cancelled' });

  return (
    <div style={styles.shell}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.headerRow}>
          <div style={styles.logoWrap} aria-hidden="true">
            <span style={styles.logoText}>A</span>
          </div>
          <span style={styles.wordmark}>Aztec Wallet</span>
        </div>

        {/* Page title */}
        <div style={styles.titleRow}>
          <Zap size={18} strokeWidth={2} style={styles.titleIcon} aria-hidden="true" />
          <h1 style={styles.title}>Approve Transaction</h1>
        </div>
        <p style={styles.subtitle}>Review the details before approving.</p>

        {/* Origin badge */}
        <div style={styles.originWrap}>
          <span style={styles.originLabel}>Requested by</span>
          <span style={styles.originBadge} data-testid="sign-dapp-origin">
            <Globe size={10} strokeWidth={2} aria-hidden="true" />
            {summary.dappOrigin}
          </span>
        </div>

        {/* Transaction details card */}
        <div style={styles.detailCard} data-testid="sign-details-card">
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Contract</span>
            <span style={styles.detailValue} title={summary.contractAddress}>
              {truncateAddress(summary.contractAddress)}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Method</span>
            <span style={styles.methodBadge} data-testid="sign-method-name">
              {summary.methodName}
            </span>
          </div>
          {summary.args && summary.args.length > 0 && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Args</span>
              <span style={styles.detailValue}>
                {summary.args.length} argument{summary.args.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ ...styles.section, marginTop: '16px' }}>
          <button
            type="button"
            onClick={handleApprove}
            style={styles.approveButton}
            data-testid="sign-approve-button"
          >
            <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
            <span>Approve</span>
          </button>

          <button
            type="button"
            onClick={handleReject}
            style={styles.rejectButton}
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
