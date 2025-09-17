// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType = 'mint' | 'contracts' | 'settings';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  component: React.ReactNode;
}
