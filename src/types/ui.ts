// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType = 'contracts' | 'mint' | 'deploy' | 'settings' | 'senders';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  component: React.ReactNode;
}
