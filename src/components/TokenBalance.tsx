import React from 'react';
import { useTokenBalance } from '../hooks/queries/useTokenBalance';

export const TokenBalance: React.FC = () => {
  const { formattedBalances, isLoading, isFetching } = useTokenBalance();

  const privateBalance = formattedBalances ? parseInt(formattedBalances.private) : 0;
  const publicBalance = formattedBalances ? parseInt(formattedBalances.public) : 0;
  const totalBalance = privateBalance + publicBalance;
  const privatePercentage = totalBalance > 0 ? (privateBalance / totalBalance) * 100 : 0;
  const publicPercentage = totalBalance > 0 ? (publicBalance / totalBalance) * 100 : 0;

  return (
    <div className="token-balance-card">
      <div className="card-header">
        <h4 className="card-title">
          <span className="title-icon">💰</span>
          Your Balance
        </h4>
        {isFetching && !isLoading && (
          <span className="balance-refetch-badge">Syncing</span>
        )}
      </div>
      <div className="card-content">
        {isLoading ? (
          <div className="balance-loading">
            <div className="loading-spinner" />
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
  );
};
