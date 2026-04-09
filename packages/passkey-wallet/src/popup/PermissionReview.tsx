import { Shield, FileText, Globe as GlobeIcon, Users } from 'lucide-react';
import {
  transformCapabilities,
} from '../host/capabilities/PermissionDisplay';
import {
  layoutStyles,
  headerStyles,
  originStyles,
  buttonStyles,
  permissionStyles,
} from './styles';
import type { CSSProperties } from 'react';

const styles = {
  shell: layoutStyles.shell,
  card: { ...layoutStyles.card, maxHeight: '90vh', overflowY: 'auto' } as CSSProperties,
  section: layoutStyles.section,
  headerRow: headerStyles.row,
  logoWrap: headerStyles.logoWrap,
  logoText: headerStyles.logoText,
  wordmark: headerStyles.wordmark,
  originWrap: originStyles.wrap,
  originLabel: originStyles.label,
  originBadge: originStyles.badge,
  rejectButton: buttonStyles.danger,
  ...permissionStyles,
} as const;

interface PermissionReviewProps {
  manifest: { metadata: { name: string; url?: string }; capabilities: unknown[] };
  onApprove: () => void;
  onReject: () => void;
}

export function PermissionReview({ manifest, onApprove, onReject }: PermissionReviewProps) {
  const display = transformCapabilities(manifest.capabilities);

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

        {/* App info */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {manifest.metadata.name}
          </h1>
          {manifest.metadata.url && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {manifest.metadata.url}
            </p>
          )}
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            wants to connect to your wallet
          </p>
        </div>

        {/* Requested permissions label */}
        <div style={styles.sectionLabel}>Requested Permissions</div>

        {/* Account access */}
        {display.accountAccess && (
          <div style={styles.permissionRow}>
            <span style={styles.permissionIcon}><Users size={16} /></span>
            <div>
              <div style={styles.permissionTitle}>Account Access</div>
              <div style={styles.permissionDesc}>
                {[
                  display.accountAccess.canGet && 'View accounts',
                  display.accountAccess.canCreateAuthWit && 'Create auth witnesses',
                ].filter(Boolean).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Per-contract groups */}
        {display.contractGroups.map((group) => (
          <div key={group.fullAddress} style={styles.contractCard}>
            <div style={styles.contractHeader}>
              <span style={styles.permissionIcon}><FileText size={16} /></span>
              <div>
                <div style={styles.contractAddress}>{group.address}</div>
              </div>
            </div>
            {group.reads.length > 0 && (
              <div style={styles.badgeRow}>
                <span style={styles.readBadge}>READ</span>
                <span style={styles.functionList}>{group.reads.join(', ')}</span>
              </div>
            )}
            {group.writes.length > 0 && (
              <div style={styles.badgeRow}>
                <span style={styles.writeBadge}>WRITE</span>
                <span style={styles.functionList}>{group.writes.join(', ')}</span>
              </div>
            )}
          </div>
        ))}

        {/* Wildcard functions */}
        {display.wildcardFunctions.length > 0 && (
          <div style={styles.permissionRow}>
            <span style={styles.permissionIcon}><GlobeIcon size={16} /></span>
            <div>
              <div style={styles.permissionTitle}>Any Contract</div>
              <div style={styles.permissionDesc}>{display.wildcardFunctions.join(', ')}</div>
            </div>
          </div>
        )}

        {/* Contract registration */}
        {display.contractRegistration && (
          <div style={styles.permissionRow}>
            <span style={styles.permissionIcon}><Shield size={16} /></span>
            <div>
              <div style={styles.permissionTitle}>Contract Registration</div>
              <div style={styles.permissionDesc}>
                {display.contractRegistration.contracts === '*'
                  ? 'Register any contract'
                  : `Register ${display.contractRegistration.count} contract${display.contractRegistration.count !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ ...styles.section, marginTop: '16px' }}>
          <button type="button" onClick={onApprove} style={buttonStyles.primary}>
            <Shield size={16} strokeWidth={2} aria-hidden="true" />
            <span>Approve &amp; Continue</span>
          </button>
          <button type="button" onClick={onReject} style={styles.rejectButton}>
            <span>Reject</span>
          </button>
        </div>
      </div>
    </div>
  );
}
