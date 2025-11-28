import React, { useState } from 'react';
import { useConfig } from '../hooks';
import { useTokenBalance } from '../hooks/queries/useTokenBalance';

export const TokenBalanceCard: React.FC = () => {
  const { currentConfig } = useConfig();
  const [tokenAddress, setTokenAddress] = useState(currentConfig.tokenContractAddress ?? '');

  const { isLoading, error } = useTokenBalance({ tokenAddress });

  return (
    <div className="token-address-input">
      <div className="form-group">
        <label htmlFor="balance-token-address">Contract Address:</label>
        <input
          id="balance-token-address"
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="Enter token contract address"
          disabled={isLoading}
          className="sidebar-input"
          aria-label="Token contract address for balance lookup"
        />
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error.message}</p>
        </div>
      )}
    </div>
  );
};
