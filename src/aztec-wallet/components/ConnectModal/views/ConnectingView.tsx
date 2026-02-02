import React from 'react';
import { Loader2, Info } from 'lucide-react';
import { iconSize } from '../../../../utils';
import { useConnectModalContext } from '../context';

const styles = {
  container: 'flex flex-col items-center justify-center py-8 gap-6',
  spinnerContainer: [
    'relative',
    'w-24 h-24 rounded-2xl',
    'bg-accent/10',
    'flex items-center justify-center',
  ].join(' '),
  spinnerIcon: 'text-accent animate-spin',
  textContainer: 'flex flex-col items-center gap-2',
  title: 'text-lg font-semibold text-default',
  message: 'text-sm text-muted text-center max-w-[280px]',
  dots: 'flex gap-1.5',
  dot: ['w-2 h-2 rounded-full bg-accent/40', 'animate-pulse'].join(' '),
  infoCard: [
    'w-full mt-2 p-4 rounded-xl',
    'bg-blue-500/10 border border-blue-500/20',
    'flex gap-3',
  ].join(' '),
  infoIcon: 'text-blue-400 shrink-0 mt-0.5',
  infoText: 'text-xs text-blue-300/90 leading-relaxed',
} as const;

/**
 * View showing connection loading state
 */
export const ConnectingView: React.FC = () => {
  const { connectingState } = useConnectModalContext();

  if (!connectingState) {
    return null;
  }

  const { walletName, walletType } = connectingState;

  // Show info card for embedded and EVM wallets (account deployment info)
  const showDeploymentInfo = walletType === 'embedded' || walletType === 'evm';

  return (
    <div className={styles.container}>
      <div className={styles.spinnerContainer}>
        <Loader2 size={iconSize('2xl')} className={styles.spinnerIcon} />
      </div>

      <div className={styles.textContainer}>
        <p className={styles.title}>
          {walletName ? `Connecting to ${walletName}` : 'Connecting...'}
        </p>
        <p className={styles.message}>
          Please wait while we connect your wallet. Check for any popups that
          may have appeared on your screen.
        </p>
      </div>

      <div className={styles.dots}>
        <span className={styles.dot} style={{ animationDelay: '0ms' }} />
        <span className={styles.dot} style={{ animationDelay: '150ms' }} />
        <span className={styles.dot} style={{ animationDelay: '300ms' }} />
      </div>

      {showDeploymentInfo && (
        <div className={styles.infoCard}>
          <Info size={iconSize()} className={styles.infoIcon} />
          <p className={styles.infoText}>
            If this is your first time connecting, it may take a bit longer as
            we deploy your new account on Aztec. Future connections will be much
            faster.
          </p>
        </div>
      )}
    </div>
  );
};
