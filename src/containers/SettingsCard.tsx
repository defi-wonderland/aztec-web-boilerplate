import React, { useState } from 'react';
import { SandboxTab, TestnetTab, CustomTab } from '../components/settings';

export const SettingsCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'testnet' | 'custom'>('sandbox');

  const handleTabChange = (tab: 'sandbox' | 'testnet' | 'custom') => {
    setActiveTab(tab);
  };

  return (
    <div className="settings-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">⚙️</span>
        </div>
        <div>
          <h3>Network Configuration</h3>
          <p>View and configure network settings</p>
        </div>
      </div>

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'sandbox' ? 'active' : ''}`}
          onClick={() => handleTabChange('sandbox')}
        >
          <span className="tab-icon">🏠</span>
          <span className="tab-label">Sandbox</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'testnet' ? 'active' : ''}`}
          onClick={() => handleTabChange('testnet')}
        >
          <span className="tab-icon">🌐</span>
          <span className="tab-label">Testnet</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => handleTabChange('custom')}
        >
          <span className="tab-icon">🔧</span>
          <span className="tab-label">Custom</span>
        </button>
      </div>

      <div className="settings-tab-content">
        {activeTab === 'sandbox' && <SandboxTab />}
        {activeTab === 'testnet' && <TestnetTab />}
        {activeTab === 'custom' && <CustomTab />}
      </div>
    </div>
  );
};
