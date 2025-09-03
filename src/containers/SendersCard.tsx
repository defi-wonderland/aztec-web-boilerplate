import React from 'react';
import { RegisterSenderTab } from '../components/settings';

export const SendersCard: React.FC = () => {
  return (
    <div className="settings-content">
      <div className="content-header">
        <div className="icon-container">
          <span className="icon">👥</span>
        </div>
        <div>
          <h3>Registered Senders</h3>
          <p>Manage addresses that can send you tokens</p>
        </div>
      </div>

      <RegisterSenderTab />
    </div>
  );
};