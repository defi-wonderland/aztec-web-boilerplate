import React, { useState, useEffect, useCallback } from 'react';
import { TabType, TabConfig } from '../types';

interface TabsProps {
  tabs: TabConfig[];
  defaultTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  children?: React.ReactNode;
}

// Sub-components
const TabButton: React.FC<{
  tab: TabConfig;
  isActive: boolean;
  onClick: (tabId: TabType) => void;
}> = ({ tab, isActive, onClick }) => (
  <button
    className={`tab-trigger ${isActive ? 'active' : ''}`}
    onClick={() => onClick(tab.id)}
  >
    <span className="tab-icon">{tab.icon}</span>
    {tab.label}
  </button>
);

const TabNavigation: React.FC<{
  tabs: TabConfig[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}> = ({ tabs, activeTab, onTabChange }) => (
  <div className="tabs-container">
    <div className="tabs-list">
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={onTabChange}
        />
      ))}
    </div>
  </div>
);

const TabContent: React.FC<{
  tabs: TabConfig[];
  activeTab: TabType;
  children?: React.ReactNode;
}> = ({ tabs, activeTab, children }) => {
  const renderTabContent = () => {
    const activeTabConfig = tabs.find(tab => tab.id === activeTab);
    return activeTabConfig?.component || tabs[0]?.component;
  };

  return (
    <div className="tab-content-wrapper">
      {children || renderTabContent()}
    </div>
  );
};

export const Tabs: React.FC<TabsProps> = ({ 
  tabs, 
  defaultTab = 'contracts', 
  onTabChange,
  children 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // Update active tab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  return (
    <div className="tabs-wrapper">
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      <TabContent tabs={tabs} activeTab={activeTab} children={children} />
    </div>
  );
};