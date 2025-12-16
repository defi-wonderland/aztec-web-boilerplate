import React from 'react';
import { useUniversalWallet } from '../hooks';
import { useError } from '../providers/ErrorProvider';

export const StatusMessage: React.FC = () => {
  const { error: walletError, isLoading, isInitialized } = useUniversalWallet();
  const { messages: globalMessages, clearMessage, hasMessages } = useError();

  const renderStatus = () => {
    if (!isInitialized) {
      return 'Initializing Aztec wallet...';
    }

    if (isLoading) {
      return 'Loading...';
    }

    if (walletError) {
      return walletError;
    }

    return null;
  };

  const statusText = renderStatus();
  const hasWalletError = walletError && isInitialized;
  const shouldShow = statusText && isInitialized;

  if (!shouldShow && !hasMessages) {
    return null;
  }

  return (
    <div className="status-messages-container">
      {shouldShow && (
        <div 
          id="status-message" 
          className={`status-message ${hasWalletError ? 'error' : 'info'}`}
        >
          {statusText}
        </div>
      )}

      {globalMessages.map((message) => (
        <div 
          key={message.id}
          className={`status-message ${message.type} global-message ${message.source ? `source-${message.source}` : ''}`}
        >
          <div className="message-header">
            <div className="message-source-container">
              {message.source && (
                <span className={`message-source ${message.type === 'info' ? 'info-source' : message.type === 'success' ? 'success-source' : ''}`}>
                  {message.source}
                </span>
              )}
            </div>
            <button 
              className={`message-close ${message.type === 'info' ? 'info-close' : message.type === 'success' ? 'success-close' : ''}`}
              onClick={() => clearMessage(message.id)}
              title="Dismiss message"
            >
              ×
            </button>
          </div>
          <div className="message-text">{message.message}</div>
          {message.details && (
            <div className="message-details">{message.details}</div>
          )}
        </div>
      ))}
    </div>
  );
};
