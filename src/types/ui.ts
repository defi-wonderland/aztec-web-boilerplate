// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType = string;

export interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}
