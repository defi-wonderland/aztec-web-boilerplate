// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType =
  | 'mint'
  | 'settings'
  | 'contract'
  | 'components'
  | 'passkey';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}
