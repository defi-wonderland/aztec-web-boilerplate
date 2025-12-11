import React from 'react';
import { copyToClipboard } from '../utils/clipboard';
import { truncateAddress, formatAddress } from '../utils';
import { useError } from '../providers/ErrorProvider';

interface AddressDisplayProps {
  address: string | undefined;
  showCopy?: boolean;
  copyMessage?: string;
  onCopy?: () => void;
  className?: string;
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  showCopy = true,
  copyMessage,
  onCopy,
  className = ''
}) => {
  const { addMessage } = useError();

  const displayAddress = truncateAddress(address);
  const fullAddress = formatAddress(address);

  const handleCopy = async () => {
    await copyToClipboard(address, {
      onSuccess: () => {
        if (copyMessage) {
          addMessage({
            message: copyMessage,
            type: 'success',
          });
        }
        onCopy?.();
      },
    });
  };

  return (
    <div className={`address-display-container ${className}`}>
      <code className="address-display" title={fullAddress}>
        {displayAddress}
      </code>
      {showCopy && (
        <button
          className="copy-button"
          onClick={handleCopy}
          disabled={!address}
          title="Copy to clipboard"
        >
          📋
        </button>
      )}
    </div>
  );
};