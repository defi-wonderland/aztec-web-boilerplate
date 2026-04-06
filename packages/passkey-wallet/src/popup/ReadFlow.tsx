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
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  } as const,
  titleIcon: {
    color: '#3b82f6',
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
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export function ReadFlow({ summary, onComplete, onCancel }: ReadFlowProps) {
  const handleAllow = () => onComplete({ type: 'read-approved' });
  const handleDeny = () => onComplete({ type: 'read-cancelled' });

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
          <Eye size={18} strokeWidth={2} style={styles.titleIcon} aria-hidden="true" />
          <h1 style={styles.title}>Private Data Request</h1>
        </div>
        <p style={styles.subtitle}>A dapp wants to read private data from your wallet.</p>

        {/* Origin badge */}
        <div style={styles.originWrap}>
          <span style={styles.originLabel}>Requested by</span>
          <span style={styles.originBadge} data-testid="read-dapp-origin">
            <Globe size={10} strokeWidth={2} aria-hidden="true" />
            {summary.dappOrigin}
          </span>
        </div>

        {/* Info message (read-only, less alarming than sign) */}
        <div style={styles.infoWrap} role="note">
          <Info size={14} strokeWidth={2} style={styles.infoIcon} aria-hidden="true" />
          <p style={styles.infoText}>
            This is a read-only request. No transaction will be sent and no funds will move.
          </p>
        </div>

        {/* Read details card */}
        <div style={styles.detailCard} data-testid="read-details-card">
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Contract</span>
            <span style={styles.detailValue} title={summary.contractAddress}>
              {truncateAddress(summary.contractAddress)}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>View</span>
            <span style={styles.methodBadge} data-testid="read-method-name">
              {summary.methodName}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ ...styles.section, marginTop: '16px' }}>
          <button
            type="button"
            onClick={handleAllow}
            style={styles.allowButton}
            data-testid="read-allow-button"
          >
            <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
            <span>Allow</span>
          </button>

          <button
            type="button"
            onClick={handleDeny}
            style={styles.denyButton}
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
