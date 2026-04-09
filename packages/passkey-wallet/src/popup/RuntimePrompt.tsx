import { AlertTriangle, CheckCircle, X, Globe } from 'lucide-react';
import { prettifyFunctionName, abbreviateAddress } from '../host/capabilities/PermissionDisplay';
import type { PopupResponse, RuntimePromptSummary } from '../shared/types';
import {
  layoutStyles,
  headerStyles,
  originStyles,
  detailCardStyles,
  buttonStyles,
  permissionStyles,
} from './styles';

const styles = {
  shell: layoutStyles.shell,
  card: layoutStyles.card,
  section: layoutStyles.section,
  headerRow: headerStyles.row,
  logoWrap: headerStyles.logoWrap,
  logoText: headerStyles.logoText,
  wordmark: headerStyles.wordmark,
  originWrap: originStyles.wrap,
  originLabel: originStyles.label,
  originBadge: originStyles.badge,
  detailCard: detailCardStyles.card,
  detailRow: detailCardStyles.row,
  detailLabel: detailCardStyles.label,
  detailValue: detailCardStyles.value,
  readBadge: permissionStyles.readBadge,
  writeBadge: permissionStyles.writeBadge,
  warningBadge: permissionStyles.warningBadge,
  approveButton: buttonStyles.primary,
  warningApproveButton: permissionStyles.warningApproveButton,
  rejectButton: buttonStyles.danger,
} as const;

interface RuntimePromptProps {
  summary: RuntimePromptSummary;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

export function RuntimePrompt({ summary, onComplete, onCancel }: RuntimePromptProps) {
  const isWrite = summary.operationType === 'write';
  const handleApprove = () => onComplete({ type: 'prompt-approved' });
  const handleDeny = () => onComplete({ type: 'prompt-denied' });

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

        {/* Warning badge */}
        <div style={{ textAlign: 'center' }}>
          <span style={styles.warningBadge}>
            <AlertTriangle size={12} />
            NOT PRE-APPROVED
          </span>
        </div>

        {/* Origin */}
        <div style={styles.originWrap}>
          <span style={styles.originLabel}>Requested by</span>
          <span style={styles.originBadge}>
            <Globe size={10} strokeWidth={2} aria-hidden="true" />
            {summary.dappOrigin}
          </span>
        </div>

        {/* Operation details */}
        <div style={styles.detailCard}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Operation</span>
            <span style={isWrite ? styles.writeBadge : styles.readBadge}>
              {isWrite ? 'WRITE' : 'READ'}
            </span>
          </div>
          {summary.functionName && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Function</span>
              <span style={styles.detailValue}>{prettifyFunctionName(summary.functionName)}</span>
            </div>
          )}
          {summary.contractAddress && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Contract</span>
              <span style={styles.detailValue}>{abbreviateAddress(summary.contractAddress)}</span>
            </div>
          )}
          {isWrite && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              This operation was not in the app&apos;s permission request. Biometric confirmation required.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ ...styles.section, marginTop: '16px' }}>
          <button type="button" onClick={handleApprove} style={isWrite ? styles.warningApproveButton : styles.approveButton}>
            <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
            <span>{isWrite ? 'Approve & Sign' : 'Allow'}</span>
          </button>
          <button type="button" onClick={handleDeny} style={styles.rejectButton}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
            <span>Deny</span>
          </button>
        </div>
      </div>
    </div>
  );
}
