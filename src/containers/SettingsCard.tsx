import React, { useState } from 'react';
import { ConfigDisplay } from '../components/settings';
import type { AztecNetwork } from '../config/networks/constants';

export const SettingsCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AztecNetwork>('sandbox');

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
          onClick={() => setActiveTab('sandbox')}
        >
          <span className="tab-icon">🏠</span>
          <span className="tab-label">Sandbox</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'devnet' ? 'active' : ''}`}
          onClick={() => setActiveTab('devnet')}
        >
          <span className="tab-icon">🌐</span>
          <span className="tab-label">Devnet</span>
        </button>
      </div>

      <div className="settings-tab-content">
        <ConfigDisplay networkName={activeTab} />
      </div>
    </div>
  );
};
