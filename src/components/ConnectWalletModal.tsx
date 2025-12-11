import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUniversalWallet } from '../hooks';
import { useEVMWallet } from '../hooks/context/useEVMWallet';
import { MetaMaskAztecConnector } from '../connectors';
import {
  isEmbeddedConnector,
  isBrowserWalletConnector,
  type WalletConnector,
} from '../types/walletConnector';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected?: () => void;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  onWalletConnected,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const {
    connectors,
    isInitialized,
    isLoading,
    error,
    currentConfig,
    switchToNetwork,
    getNetworkOptions,
  } = useUniversalWallet();

  const { isConnected: isEVMConnected, connectWalletAsync } = useEVMWallet();

  const metamaskAztecConnector = connectors.find(
    (conn): conn is MetaMaskAztecConnector =>
      conn instanceof MetaMaskAztecConnector
  );

  const embeddedConnector = connectors.find((conn) =>
    isEmbeddedConnector(conn)
  );

  // Browser wallets = all non-embedded connectors
  const browserWallets = connectors.filter((conn) =>
    isBrowserWalletConnector(conn)
  );

  // Disable functionality when no network is selected, network is initializing, or failed
  const isNetworkSelected = currentConfig?.name && currentConfig.name !== '';
  const isNetworkInitializing =
    isNetworkSelected && !isInitialized && isLoading;
  const isNetworkFailed = isNetworkSelected && error && !isInitialized;
  const isActionDisabled =
    !isNetworkSelected ||
    isNetworkInitializing ||
    isNetworkFailed ||
    isConnecting;

  const isBrowserWalletDisabled = (connector: WalletConnector) => {
    const status = connector.getStatus();
    return (
      !isNetworkSelected ||
      isNetworkInitializing ||
      isNetworkFailed ||
      isConnecting ||
      status.isConnected
    );
  };

  // Apply modal-open class to root when modal is open
  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      if (isOpen) {
        rootElement.classList.add('modal-open');
      } else {
        rootElement.classList.remove('modal-open');
      }
    }

    // Cleanup on unmount
    return () => {
      if (rootElement) {
        rootElement.classList.remove('modal-open');
      }
    };
  }, [isOpen]);

  const handleEmbeddedWalletAction = async (action: 'create' | 'existing') => {
    if (isConnecting || !isEmbeddedConnector(embeddedConnector)) return;

    setIsConnecting(true);
    try {
      switch (action) {
        case 'create':
          await embeddedConnector.createAccount();
          break;
        case 'existing':
          const wallet = await embeddedConnector.connectExistingAccount();
          if (!wallet) {
            console.warn('No stored account found to connect');
            return;
          }
          break;
      }
      onWalletConnected?.();
      onClose();
    } catch (err) {
      console.error(`Failed to ${action} account:`, err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBrowserWalletConnect = async (connector: WalletConnector) => {
    const status = connector.getStatus();
    if (isConnecting || status.isConnecting) return;

    setConnectingId(connector.id);
    try {
      await connector.connect();
      onWalletConnected?.();
      onClose();
    } catch (err) {
      console.error(`Failed to connect ${connector.label}:`, err);
    } finally {
      setConnectingId(null);
    }
  };

  const handleMetaMaskAztecConnect = async () => {
    if (!metamaskAztecConnector) return;

    setConnectingId('metamask-aztec');
    try {
      // Step 1: Connect EVM wallet if not connected
      if (!isEVMConnected) {
        await connectWalletAsync();
      }
      // Step 2: Create Aztec account (will sign message to recover public key)
      await metamaskAztecConnector.connect();
      onWalletConnected?.();
      onClose();
    } catch (err) {
      console.error('Failed to connect MetaMask Aztec:', err);
    } finally {
      setConnectingId(null);
    }
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkName = event.target.value;
    console.log('🔄 Network change requested from modal:', {
      from: currentConfig.name,
      to: networkName,
      currentConfig,
    });

    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };

  const renderNetworkSelector = () => {
    const networkOptions = getNetworkOptions();

    return (
      <div className="network-connect-section">
        <label className="wallet-section-label">Network</label>
        <div className="modal-network-selector">
          <div className="network-select-wrapper">
            <select
              id="modal-network-selector"
              name="modal-network-selector"
              value={currentConfig?.name || ''}
              onChange={handleNetworkChange}
              className="network-select"
              title="Select network configuration"
            >
              <option value="" disabled>
                Network
              </option>
              {networkOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <span className="network-select-arrow">▼</span>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Connect Wallet</h3>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Create or connect to an Aztec account using a wallet.
          </p>

          {renderNetworkSelector()}

          <div
            className={`network-status ${
              !isNetworkSelected
                ? 'not-connected'
                : isNetworkInitializing
                  ? 'initializing'
                  : isNetworkFailed
                    ? 'failed'
                    : 'connected'
            }`}
          >
            {!isNetworkSelected && <span>Network not connected</span>}
            {isNetworkInitializing && (
              <>
                <div className="initializing-spinner"></div>
                <span>Initializing network connection...</span>
              </>
            )}
            {isNetworkFailed && (
              <span>{currentConfig.displayName} connection failed</span>
            )}
            {isNetworkSelected && isInitialized && (
              <span>{currentConfig.displayName} connected</span>
            )}
          </div>

          {browserWallets.length > 0 && (
            <div className="browser-wallet-section">
              <label className="wallet-section-label">Browser Wallet</label>
              {browserWallets.map((connector) => {
                const status = connector.getStatus();
                const isThisConnecting = connectingId === connector.id;
                return (
                  <button
                    key={connector.id}
                    onClick={() => handleBrowserWalletConnect(connector)}
                    type="button"
                    disabled={isBrowserWalletDisabled(connector)}
                    className="modal-action-button browser-wallet-connect"
                    title={
                      !isNetworkSelected
                        ? 'Please select a network first'
                        : isNetworkInitializing
                          ? 'Network is initializing...'
                          : isNetworkFailed
                            ? 'Network connection failed'
                            : ''
                    }
                  >
                    {isThisConnecting || status.isConnecting
                      ? 'Connecting...'
                      : status.isConnected
                        ? `${connector.label} Connected`
                        : `Connect ${connector.label}`}
                  </button>
                );
              })}
            </div>
          )}

          {metamaskAztecConnector && (
            <div className="browser-wallet-section">
              <label className="wallet-section-label">EVM Wallet</label>
              <button
                onClick={handleMetaMaskAztecConnect}
                type="button"
                disabled={
                  !isNetworkSelected ||
                  isNetworkInitializing ||
                  isNetworkFailed ||
                  connectingId === 'metamask-aztec' ||
                  metamaskAztecConnector.getStatus().isConnected
                }
                className="modal-action-button browser-wallet-connect"
                title={
                  !isNetworkSelected
                    ? 'Please select a network first'
                    : isNetworkInitializing
                      ? 'Network is initializing...'
                      : isNetworkFailed
                        ? 'Network connection failed'
                        : ''
                }
              >
                {connectingId === 'metamask-aztec'
                  ? 'Connecting...'
                  : metamaskAztecConnector.getStatus().isConnected
                    ? 'MetaMask Connected'
                    : 'Connect MetaMask'}
              </button>
            </div>
          )}

          <div className="embedded-connect-section">
            <label className="wallet-section-label">Embedded Wallet</label>

            <div className="modal-actions">
              <button
                onClick={() => handleEmbeddedWalletAction('existing')}
                type="button"
                disabled={isActionDisabled}
                className="modal-action-button primary"
                title={
                  !isNetworkSelected
                    ? 'Please select a network first'
                    : isNetworkInitializing
                      ? 'Network is initializing...'
                      : isNetworkFailed
                        ? 'Network connection failed'
                        : ''
                }
              >
                {isConnecting ? 'Connecting...' : 'Connect Existing Account'}
              </button>
              <button
                onClick={() => handleEmbeddedWalletAction('create')}
                type="button"
                disabled={isActionDisabled}
                className="modal-action-button primary"
                title={
                  !isNetworkSelected
                    ? 'Please select a network first'
                    : isNetworkInitializing
                      ? 'Network is initializing...'
                      : isNetworkFailed
                        ? 'Network connection failed'
                        : ''
                }
              >
                {isConnecting ? 'Creating...' : 'Create New Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};
