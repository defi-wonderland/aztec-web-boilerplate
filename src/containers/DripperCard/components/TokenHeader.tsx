import React from 'react';
import { CircleDollarSign, Copy } from 'lucide-react';
import { Skeleton } from '../../../components/ui';
import { iconSize } from '../../../utils';
import { styles } from '../styles';

interface TokenHeaderProps {
  address: string;
  tokenName: string;
  tokenSymbol: string;
  onCopy: () => void;
  isConnected: boolean;
}

export const TokenHeader: React.FC<TokenHeaderProps> = ({
  address,
  tokenName,
  tokenSymbol,
  onCopy,
  isConnected,
}) => (
  <div className={styles.tokenHeader}>
    <div className={styles.tokenLeft}>
      <div className={styles.tokenIcon}>
        <CircleDollarSign
          size={iconSize('lg')}
          className={styles.tokenIconInner}
        />
      </div>
      <div className={styles.tokenInfo}>
        {!isConnected && (
          <>
            <Skeleton className={styles.skeleton.tokenName} />
            <Skeleton className={styles.skeleton.tokenAddress} />
          </>
        )}
        {isConnected && (
          <>
            <span className={styles.tokenName}>
              {tokenName} ({tokenSymbol})
            </span>
            <button
              type="button"
              className={styles.tokenAddress}
              onClick={onCopy}
              aria-label="Copy token address"
            >
              <span className={styles.tokenAddressText}>{address}</span>
              <Copy size={iconSize('xs')} className={styles.copyIcon} />
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);
