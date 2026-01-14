import React from 'react';
import { TabType, TabConfig } from '../types';
import { Tabs as RadixTabs, TabsList, TabsTrigger, TabsContent } from './ui';

const styles = {
  tabs: 'w-full',
  tabLabel: 'hidden sm:inline',
  content: 'mt-4',
} as const;

interface TabsProps {
  tabs: TabConfig[];
  defaultTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  children?: React.ReactNode;
}

/**
 * Application tabs component.
 * Uses Radix UI Tabs under the hood with Tailwind styling.
 *
 * Uses uncontrolled mode - Radix manages the active tab state internally.
 * The parent can still be notified of changes via onTabChange.
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab = 'mint',
  onTabChange,
  children,
}) => {
  const handleTabChange = (value: string) => {
    onTabChange?.(value as TabType);
  };

  return (
    <RadixTabs
      defaultValue={defaultTab}
      onValueChange={handleTabChange}
      className={styles.tabs}
    >
      {/* Tab Navigation */}
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.icon}
            <span className={styles.tabLabel}>{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Tab Content */}
      {children ? (
        <div className={styles.content}>{children}</div>
      ) : (
        tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {tab.component}
          </TabsContent>
        ))
      )}
    </RadixTabs>
  );
};
