import React from 'react';
import { useToken } from '../hooks/context/useToken';

export const TokenBalanceCard: React.FC = () => {
  const { 
    isBalanceLoading: isLoading, 
    balanceError: error, 
    setTokenAddress, 
    currentTokenAddress
  } = useToken();

  return (
    <div className="token-address-input">
      <div className="form-group">
        <label htmlFor="balance-token-address">Contract Address:</label>
        <input
          id="balance-token-address"
          type="text"
          value={currentTokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="Enter token contract address"
          disabled={isLoading}
          className="sidebar-input"
        />
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
};
