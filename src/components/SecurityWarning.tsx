import React, { useState } from 'react';

interface SecurityWarningProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export const SecurityWarning: React.FC<SecurityWarningProps> = ({ 
  onDismiss,
  showDismiss = true 
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="security-warning">
      <div className="security-warning-content">
        <span className="security-warning-icon" aria-hidden="true">⚠️</span>
        <div className="security-warning-text">
          <strong>Testnet Only</strong>
          <span className="security-warning-detail">
            Embedded wallet keys are stored locally. For testnet, use the embedded wallet.
          </span>
        </div>
        {showDismiss && (
          <button 
            className="security-warning-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss warning"
            type="button"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

