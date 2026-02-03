import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '../../../../components/ui';
import { iconSize } from '../../../../utils';
import { AddressDisplay } from '../../shared';
import { useConnectModalContext } from '../context';

const styles = {
  container: 'flex flex-col items-center py-8 gap-6',
  iconContainer: [
    'w-16 h-16 rounded-2xl',
    'bg-green-500/10',
    'flex items-center justify-center',
    'animate-scale-bounce',
  ].join(' '),
  checkIcon: 'text-green-500',
  textContainer: 'flex flex-col items-center gap-1',
  title: 'text-lg font-semibold text-default',
  subtitle: 'text-sm text-muted',
  accountSection: 'w-full flex flex-col gap-2',
  label: 'text-xs uppercase tracking-wider text-muted font-medium',
  continueButton: [
    'w-full',
    'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]',
    'hover:shadow-[0_0_20px_color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
  ].join(' '),
} as const;

/**
 * View showing successful connection
 */
export const SuccessView: React.FC = () => {
  const { successState, onClose } = useConnectModalContext();

  if (!successState) {
    return null;
  }

  const { address } = successState;

  return (
    <div className={styles.container}>
      <div className={styles.iconContainer}>
        <Check size={iconSize('xl')} className={styles.checkIcon} />
      </div>

      <div className={styles.textContainer}>
        <h3 className={styles.title}>Connected!</h3>
        <p className={styles.subtitle}>Your wallet is now connected</p>
      </div>

      <div className={styles.accountSection}>
        <span className={styles.label}>Your address</span>
        <AddressDisplay address={address} showCopy />
      </div>

      <Button
        variant="primary"
        className={styles.continueButton}
        onClick={onClose}
        icon={<ArrowRight size={iconSize()} />}
      >
        Continue to App
      </Button>
    </div>
  );
};
