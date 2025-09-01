// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType = 'mint' | 'settings' | 'bridge-out';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  component: React.ReactNode;
}
