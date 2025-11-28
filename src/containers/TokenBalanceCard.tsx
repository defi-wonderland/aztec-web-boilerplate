import React from 'react';
import { useTokenContract } from '../hooks/context/useTokenContract';
import { useTokenBalance } from '../hooks/queries/useTokenBalance';

export const TokenBalanceCard: React.FC = () => {
  const { token, status } = useTokenContract();
  const { isLoading, error } = useTokenBalance();

  const tokenAddress = token?.address.toString() ?? '';

  return (
    <div className="token-address-input">
      <div className="form-group">
        <label htmlFor="balance-token-address">Contract Address:</label>
        <input
          id="balance-token-address"
          type="text"
          value={status === 'registering' ? 'Registering...' : tokenAddress || 'Loading...'}
          readOnly
          className="sidebar-input"
          aria-label="Token contract address for balance lookup"
        />
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error.message}</p>
        </div>
      )}

      {isLoading && (
        <div className="loading-message">
          <span>Loading balance...</span>
        </div>
      )}
    </div>
  );
};
