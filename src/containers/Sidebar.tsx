import React from 'react';
import { useTokenBalance } from '../hooks/queries/useTokenBalance';
import { useUniversalWallet } from '../hooks';
import { AddressDisplay } from '../components/AddressDisplay';

export const Sidebar: React.FC = () => {
  const { formattedBalances, isLoading: isBalanceLoading } = useTokenBalance();
  const { currentConfig, account } = useUniversalWallet();

  const accountAddress = account?.getAddress().toString() ?? null;
  const privateBalance = formattedBalances ? parseInt(formattedBalances.private) : 0;
  const publicBalance = formattedBalances ? parseInt(formattedBalances.public) : 0;
  const totalBalance = privateBalance + publicBalance;
  const privatePercentage = totalBalance > 0 ? (privateBalance / totalBalance) * 100 : 0;
  const publicPercentage = totalBalance > 0 ? (publicBalance / totalBalance) * 100 : 0;

  return (
    <aside className="sidebar">
      {/* Token Balance Card */}
      <div className="sidebar-card">
        <div className="card-header">
          <h3 className="card-title">
            <span className="title-icon">💰</span>
            Aztec Token Balance
          </h3>
        </div>
        <div className="card-content">
          {isBalanceLoading ? (
            <div className="balance-loading">
              <div className="loading-spinner"></div>
              <span>Loading balance...</span>
            </div>
          ) : (
            <>
              <div className="balance-items">
                <div className="balance-item">
                  <div className="balance-label">
                    <span className="balance-icon">🛡️</span>
                    <span>Private:</span>
                  </div>
                  <span className="balance-value">{privateBalance}</span>
                </div>
                <div className="balance-item">
                  <div className="balance-label">
                    <span className="balance-icon">🌐</span>
                    <span>Public:</span>
                  </div>
                  <span className="balance-value">{publicBalance}</span>
                </div>

                {/* Visual balance representation */}
                {totalBalance > 0 && (
                  <div className="balance-visual">
                    <div className="balance-bar">
                      {privatePercentage > 0 && (
                        <div
                          className="balance-bar-segment private"
                          style={{ width: `${privatePercentage}%` }}
                        />
                      )}
                      {publicPercentage > 0 && (
                        <div
                          className="balance-bar-segment public"
                          style={{ width: `${publicPercentage}%` }}
                        />
                      )}
                    </div>
                    <div className="balance-percentages">
                      <span>🛡️ {privatePercentage.toFixed(0)}%</span>
                      <span>🌐 {publicPercentage.toFixed(0)}%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="balance-total">
                <span className="total-label">Total:</span>
                <span className="total-value">{totalBalance}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats Card */}
      <div className="sidebar-card">
        <div className="card-header">
          <h3 className="card-title">
            <span className="title-icon">⚡</span>
            Network Status
          </h3>
        </div>
        <div className="card-content">
          <div className="stats-items">
            <div className="stat-item">
              <span className="stat-label">Network:</span>
              <span className="stat-value">{currentConfig.displayName}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Node URL:</span>
              <span className="stat-value node-url" title={currentConfig.nodeUrl}>
                {currentConfig.nodeUrl}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Address Card */}
      <div className="sidebar-card">
        <div className="card-header">
          <h3 className="card-title">Contract Addresses</h3>
        </div>
        <div className="card-content">
          {accountAddress && (
            <div className="address-section">
              <label className="address-label">Account Contract:</label>
              <AddressDisplay
                address={accountAddress}
                copyMessage="Account address copied to clipboard"
                className="sidebar-address"
              />
            </div>
          )}
          <div className="address-section">
            <label className="address-label">Token Contract:</label>
            <AddressDisplay
              address={currentConfig.tokenContractAddress}
              copyMessage="Token contract address copied to clipboard"
              className="sidebar-address"
            />
          </div>
          <div className="address-section">
            <label className="address-label">Dripper Contract:</label>
            <AddressDisplay
              address={currentConfig.dripperContractAddress}
              copyMessage="Dripper contract address copied to clipboard"
              className="sidebar-address"
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
