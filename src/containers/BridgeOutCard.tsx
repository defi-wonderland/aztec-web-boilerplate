import React, { useState } from 'react';
import { useEVMWallet } from '../hooks/context/useEVMWallet';
import { useAztecWallet } from '../hooks/context/useAztecWallet';
import { useWethBalance } from '../hooks/useWethBalance';
import { useBridgeOut } from '../hooks/useBridgeOut';
import { formatUnits } from 'viem';
import { BRIDGE_CONFIG } from '../config/networks/testnet';

export const BridgeOutCard: React.FC = () => {
  const { account: evmAccount, connect: connectEVM, isSupported } = useEVMWallet();
  const { connectedAccount: aztecWallet } = useAztecWallet();
  const { balance: wethBalance, isLoading: isLoadingWethBalance, refetch: refetchWethBalance } = useWethBalance();
  const [amount, setAmount] = useState('');
  
  const { bridgeOut, isBridging, error, orderStatus, clearError } = useBridgeOut({
    onSuccess: async () => {
      setAmount('');
      await refetchWethBalance();
    }
  });

  const privateBalance = wethBalance ?? 0n;
  const formattedPrivate = formatUnits(privateBalance, 18);
  
  // Computed variables for addresses
  const aztecAddress = aztecWallet?.getAddress().toString();
  const truncatedAztecAddress = aztecAddress ? `${aztecAddress.slice(0, 8)}...${aztecAddress.slice(-6)}` : '';
  const truncatedEvmAddress = evmAccount?.address ? `${evmAccount.address.slice(0, 8)}...${evmAccount.address.slice(-6)}` : '';
  const truncatedWethAddress = `${BRIDGE_CONFIG.aztecWETH.slice(0, 6)}...${BRIDGE_CONFIG.aztecWETH.slice(-4)}`;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      clearError();
    }
  };

  const handleBridge = async () => {
    await bridgeOut(amount, privateBalance);
  };

  const isConnected = evmAccount?.isConnected && aztecWallet;
  const canBridge = isConnected && amount && !isBridging && parseFloat(amount) > 0;

  return (
    <div className="bridge-out-card">
      <div className="bridge-header">
        <h2 className="bridge-title">
          <span className="bridge-icon">🌉</span>
          Bridge Out
        </h2>
        <p className="bridge-subtitle">Transfer WETH from Aztec to Base Sepolia</p>
      </div>

      <div className="bridge-route">
        <div className="route-endpoint">
          <span className="route-label">From</span>
          <div className="route-network">Aztec Sepolia</div>
          {aztecAddress && (
            <div className="route-address" title={aztecAddress}>
              {truncatedAztecAddress}
            </div>
          )}
        </div>
        <div className="route-arrow">→</div>
        <div className="route-endpoint">
          <span className="route-label">To</span>
          <div className="route-network">Base Sepolia</div>
          {evmAccount?.address ? (
            <div className="route-address" title={evmAccount.address}>
              {truncatedEvmAddress}
            </div>
          ) : (
            <button 
              className="connect-evm-button"
              onClick={connectEVM}
              disabled={!isSupported}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className="token-section">
        <div className="token-info">
          <span className="token-label">Token</span>
          <div className="token-details">
            <div className="token-name">WETH (Wrapped Ether)</div>
            <div className="token-address" title={BRIDGE_CONFIG.aztecWETH}>
              {truncatedWethAddress}
            </div>
          </div>
        </div>
      </div>

      <div className="amount-section">
        <label className="amount-label" htmlFor="bridge-amount">
          Amount to Bridge
        </label>
        <input
          id="bridge-amount"
          type="text"
          className="amount-input"
          placeholder="0.0"
          value={amount}
          onChange={handleAmountChange}
          disabled={!isConnected || isBridging}
        />
        {aztecWallet && (
          <div className="balance-info">
            <div className="balance-label">Available Private Balance</div>
            {!isLoadingWethBalance && 
              <div className="balance-value">{formattedPrivate} WETH</div>
            }
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {orderStatus && orderStatus.status !== 'failed' && (
        <div className="order-status">
          <div className="status-label">Order Status</div>
          <div className="status-value">
            {orderStatus.status === 'pending' && '⏳ Creating order...'}
            {orderStatus.status === 'opened' && '📝 Order opened, waiting for filler...'}
            {orderStatus.status === 'filled' && '✅ Bridge completed!'}
          </div>
          {orderStatus.orderId && (
            <div className="order-id">Order ID: {orderStatus.orderId.slice(0, 10)}...</div>
          )}
        </div>
      )}

      <button
        className="bridge-button"
        onClick={handleBridge}
        disabled={!canBridge}
      >
        {isBridging && <>Processing...</>}
        {!isBridging && !aztecWallet && 'Connect Aztec Wallet'}
        {!isBridging && aztecWallet && !evmAccount?.isConnected && 'Connect EVM Wallet'}
        {!isBridging && aztecWallet && evmAccount?.isConnected && 'Bridge to Base Sepolia'}
      </button>

      {!isSupported && (
        <div className="error-message">
          ⚠️ Please switch to Base Sepolia network
        </div>
      )}
    </div>
  );
};