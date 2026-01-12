import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EMBEDDED_CONNECTOR_ID } from '../connectors';
import { useUniversalWallet } from '../hooks';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useWalletActions, useWalletView } from '../store/wallet';
import {
  isEmbeddedConnector,
  isBrowserWalletConnector,
  isExternalSignerConnector,
  type WalletConnector,
  type ExternalSignerWalletConnector,
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
  const { connectors, currentConfig, switchToNetwork, getNetworkOptions } =
    useUniversalWallet();

  const { connectingConnectorId, status } = useWalletView();
  const { connectEmbedded, connectExistingEmbedded, hasSavedEmbeddedAccount } =
    useWalletActions();

  const embeddedConnector = connectors.find((conn) =>
    isEmbeddedConnector(conn)
  );

  const hasSavedEmbeddedAccountValue = hasSavedEmbeddedAccount();

  const externalSignerConnectors = connectors.filter(
    (conn): conn is ExternalSignerWalletConnector =>
      isExternalSignerConnector(conn)
  );

  const browserWalletConnectors = connectors.filter((conn) =>
    isBrowserWalletConnector(conn)
  );

  // Check network availability
  const { status: networkStatus, error: networkError } =
    useNetworkStatus(currentConfig);
  const isNetworkSelected = !!currentConfig?.name;
  const isNetworkReady = networkStatus === 'online';

  const isActionDisabled =
    !isNetworkSelected || !isNetworkReady || connectingConnectorId !== null;

  const isConnectorDisabled = (connector: WalletConnector) => {
    try {
      const status = connector.getStatus();
      return isActionDisabled || status.status === 'connected';
    } catch {
      return true;
    }
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

    return () => {
      if (rootElement) {
        rootElement.classList.remove('modal-open');
      }
    };
  }, [isOpen]);

  const handleEmbeddedWalletAction = async (action: 'create' | 'existing') => {
    if (connectingConnectorId || !embeddedConnector) return;
    try {
      switch (action) {
        case 'create':
          await connectEmbedded(EMBEDDED_CONNECTOR_ID);
          break;
        case 'existing': {
          const wallet = await connectExistingEmbedded(EMBEDDED_CONNECTOR_ID);
          if (!wallet) {
            return;
          }
          break;
        }
      }
      onWalletConnected?.();
      onClose();
    } catch {
      // Connection failed - error state handled by store
    }
  };

  const handleBrowserWalletConnect = async (connector: WalletConnector) => {
    try {
      await connector.connect();
      onWalletConnected?.();
      onClose();
    } catch {
      // Connection failed - error state handled by store
    }
  };

  const handleExternalSignerConnect = async (
    connector: ExternalSignerWalletConnector
  ) => {
    try {
      await connector.connect();
      onWalletConnected?.();
      onClose();
    } catch {
      // Connection failed - error state handled by store
    }
  };

  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkName = event.target.value;
    if (networkName && networkName !== currentConfig.name) {
      switchToNetwork(networkName);
    }
  };

  const getConnectorStatus = (connector: WalletConnector) => {
    try {
      return connector.getStatus();
    } catch {
      return {
        isInstalled: false,
        status: 'disconnected' as const,
        error: null,
      };
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

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h3 id="modal-title">Connect Wallet</h3>
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
                : networkStatus === 'checking'
                  ? 'initializing'
                  : networkStatus === 'online'
                    ? 'connected'
                    : 'failed'
            }`}
          >
            {!isNetworkSelected && <span>Network not selected</span>}
            {networkStatus === 'checking' && (
              <>
                <div className="initializing-spinner"></div>
                <span>Checking {currentConfig.displayName}...</span>
              </>
            )}
            {(networkStatus === 'offline' || networkStatus === 'error') && (
              <span>
                {currentConfig.displayName} unavailable
                {networkError && ` - ${networkError}`}
              </span>
            )}
            {networkStatus === 'online' && (
              <span>{currentConfig.displayName} available</span>
            )}
          </div>

          {browserWalletConnectors.length > 0 && (
            <div className="browser-wallet-section">
              <label className="wallet-section-label">Browser Wallet</label>
              {browserWalletConnectors.map((connector) => {
                const status = getConnectorStatus(connector);
                const isThisConnecting =
                  connectingConnectorId === connector.id ||
                  status.status === 'connecting';
                return (
                  <button
                    key={connector.id}
                    onClick={() => handleBrowserWalletConnect(connector)}
                    type="button"
                    disabled={isConnectorDisabled(connector)}
                    className="modal-action-button browser-wallet-connect"
                    title={
                      !isNetworkSelected
                        ? 'Please select a network first'
                        : networkStatus === 'checking'
                          ? 'Checking network...'
                          : !isNetworkReady
                            ? 'Network unavailable'
                            : ''
                    }
                  >
                    {isThisConnecting
                      ? 'Connecting...'
                      : status.status === 'connected'
                        ? `${connector.label} Connected`
                        : `Connect ${connector.label}`}
                  </button>
                );
              })}
            </div>
          )}

          {externalSignerConnectors.length > 0 && (
            <div className="browser-wallet-section">
              <label className="wallet-section-label">External Signer</label>
              {externalSignerConnectors.map((connector) => {
                const status = getConnectorStatus(connector);
                const isThisConnecting =
                  connectingConnectorId === connector.id ||
                  status.status === 'connecting';
                return (
                  <button
                    key={connector.id}
                    onClick={() => handleExternalSignerConnect(connector)}
                    type="button"
                    disabled={isConnectorDisabled(connector)}
                    className="modal-action-button browser-wallet-connect"
                    title={
                      !isNetworkSelected
                        ? 'Please select a network first'
                        : networkStatus === 'checking'
                          ? 'Checking network...'
                          : !isNetworkReady
                            ? 'Network unavailable'
                            : ''
                    }
                  >
                    {isThisConnecting
                      ? 'Connecting...'
                      : status.status === 'connected'
                        ? `${connector.label} Connected`
                        : `Connect ${connector.label}`}
                  </button>
                );
              })}
            </div>
          )}

          <div className="embedded-connect-section">
            <label className="wallet-section-label">Embedded Wallet</label>

            <div className="modal-actions">
              <button
                onClick={() => handleEmbeddedWalletAction('existing')}
                type="button"
                disabled={
                  isActionDisabled ||
                  !hasSavedEmbeddedAccountValue ||
                  connectingConnectorId === EMBEDDED_CONNECTOR_ID
                }
                className="modal-action-button primary"
                title={
                  !isNetworkSelected
                    ? 'Please select a network first'
                    : networkStatus === 'checking'
                      ? 'Checking network...'
                      : !isNetworkReady
                        ? 'Network unavailable'
                        : !hasSavedEmbeddedAccountValue
                          ? 'No saved account found'
                          : ''
                }
              >
                {connectingConnectorId === EMBEDDED_CONNECTOR_ID
                  ? 'Connecting...'
                  : 'Connect Existing Account'}
              </button>
              <button
                onClick={() => handleEmbeddedWalletAction('create')}
                type="button"
                disabled={
                  isActionDisabled ||
                  connectingConnectorId === EMBEDDED_CONNECTOR_ID
                }
                className="modal-action-button primary"
                title={
                  !isNetworkSelected
                    ? 'Please select a network first'
                    : networkStatus === 'checking'
                      ? 'Checking network...'
                      : !isNetworkReady
                        ? 'Network unavailable'
                        : ''
                }
              >
                {connectingConnectorId === EMBEDDED_CONNECTOR_ID
                  ? 'Creating...'
                  : 'Create New Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};
