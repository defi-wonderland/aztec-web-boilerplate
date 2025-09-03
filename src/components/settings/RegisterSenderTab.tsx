import React from 'react';
import { useRegisterSender } from '../../hooks/useRegisterSender';
import { AddressDisplay } from '../AddressDisplay';

export const RegisterSenderTab: React.FC = () => {
  const {
    registeredSenders,
    newSenderAddress,
    setNewSenderAddress,
    isLoading,
    error,
    success,
    handleAddSender,
    handleRemoveSender,
    handleKeyPress,
    clearMessages,
    setSuccessMessage,
  } = useRegisterSender();

  const hasNoSenders = registeredSenders.length === 0;
  const isLoadingInitial = isLoading && hasNoSenders;
  const canAddSender = !isLoading && newSenderAddress.trim();

  return (
    <div className="senders-content">
      <div className="form-section">
        {error && (
          <div className="error-message" onClick={clearMessages}>
            ⚠️ {error}
          </div>
        )}
        
        {success && (
          <div className="success-message" onClick={clearMessages}>
            ✅ {success}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="sender-address">Add New Sender Address</label>
          <input
            id="sender-address"
            type="text"
            placeholder="Enter Aztec address (0x...)"
            value={newSenderAddress}
            onChange={(e) => setNewSenderAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="form-input"
          />
          <button
            onClick={handleAddSender}
            disabled={!canAddSender}
            className="btn btn-primary add-sender-btn"
          >
            <span className="btn-icon">➕</span>
            {isLoading && <>Adding...</>}
            {!isLoading && <>Add Sender</>}
          </button>
          <p className="field-help">Register addresses that can send you tokens. This allows your PXE to decrypt notes from these senders.</p>
        </div>

        <div className="senders-section">
          <div className="content-header">
            <div className="icon-container">
              <span className="icon">📝</span>
            </div>
            <div>
              <h4>Registered Senders ({registeredSenders.length})</h4>
              <p>Addresses authorized to send you tokens</p>
            </div>
          </div>

          <div className="senders-list">
            {isLoadingInitial && (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading registered senders...</p>
              </div>
            )}
            {!isLoadingInitial && hasNoSenders && (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h5>No senders registered yet</h5>
                <p>Add sender addresses to receive tokens from them.</p>
              </div>
            )}
            {!hasNoSenders && (
              <div className="senders-grid">
                {registeredSenders.map((sender) => (
                  <div key={sender} className="sender-address-row">
                    <AddressDisplay
                      address={sender}
                      copyMessage="Address copied to clipboard"
                      className="sender-address-display"
                    />
                    <button
                      onClick={() => handleRemoveSender(sender)}
                      disabled={isLoading}
                      className="btn btn-danger remove-btn"
                      title="Remove sender"
                    >
                      <span className="btn-icon">🗑️</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};