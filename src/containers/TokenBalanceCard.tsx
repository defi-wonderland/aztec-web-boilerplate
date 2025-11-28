import React from 'react';
import { useConfig } from '../hooks/context/useConfig';
import { useContractRegistration } from '../hooks/context/useContractRegistration';
import { useTokenBalance } from '../hooks/queries/useTokenBalance';

export const TokenBalanceCard: React.FC = () => {
  const { currentConfig } = useConfig();
  const { status } = useContractRegistration('token');
  const { isLoading, error } = useTokenBalance();

  const tokenAddress = currentConfig.tokenContractAddress;

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
