import React, { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { hashToEmoji } from '@aztec/wallet-sdk/crypto';
import { Button } from '../../../../components/ui';
import { iconSize } from '../../../../utils';
import { useVerificationStore } from '../../../store/verification';

const styles = {
  container: 'flex flex-col items-center py-6 gap-5',
  iconContainer: [
    'w-16 h-16 rounded-2xl',
    'bg-accent/10',
    'flex items-center justify-center',
  ].join(' '),
  icon: 'text-accent',
  textContainer: 'flex flex-col items-center gap-2 text-center',
  title: 'text-lg font-semibold text-default',
  walletName: 'text-sm text-muted',
  description: 'text-sm text-muted max-w-[300px]',
  emojiGrid: [
    'grid grid-cols-3 gap-3',
    'p-4 rounded-xl',
    'bg-surface-secondary',
    'border border-default',
  ].join(' '),
  emojiCell: [
    'w-14 h-14',
    'flex items-center justify-center',
    'text-3xl',
    'rounded-lg',
    'bg-surface',
  ].join(' '),
  actions: 'flex gap-3 w-full mt-2',
  cancelButton: 'flex-1',
  confirmButton: 'flex-1',
  hint: 'text-xs text-muted text-center max-w-[280px]',
} as const;

/**
 * View showing the emoji verification grid during Aztec Keychain connection.
 *
 * Both the dApp and wallet independently compute the same emoji sequence
 * from the ECDH shared secret. The user visually confirms they match
 * to prevent MITM attacks.
 */
export const EmojiVerificationView: React.FC = () => {
  const store = useVerificationStore;
  const {
    verificationHash,
    walletName,
    confirmVerification,
    cancelVerification,
  } = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  // Convert verification hash to emoji grid synchronously.
  // Using useMemo (not useEffect + dynamic import) so emojis render
  // on the very first paint — critical because the wallet extension popup
  // may be in the foreground, and async module loads can be deferred by
  // the browser when the page is not focused.
  const emojis = useMemo(() => {
    if (!verificationHash) return [];
    try {
      return [...hashToEmoji(verificationHash)];
    } catch {
      // Fallback: show hex pairs if emoji conversion fails
      return verificationHash.slice(0, 18).match(/.{1,2}/g) ?? [];
    }
  }, [verificationHash]);

  if (!verificationHash) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.iconContainer}>
        <ShieldCheck size={iconSize('xl')} className={styles.icon} />
      </div>

      <div className={styles.textContainer}>
        <p className={styles.title}>Verify Connection</p>
        {walletName && (
          <p className={styles.walletName}>Connecting to {walletName}</p>
        )}
        <p className={styles.description}>
          Compare these emojis with the ones shown in your Aztec Keychain app.
          They must match exactly.
        </p>
      </div>

      <div className={styles.emojiGrid}>
        {emojis.slice(0, 9).map((emoji, i) => (
          <div key={i} className={styles.emojiCell}>
            {emoji}
          </div>
        ))}
      </div>

      <p className={styles.hint}>
        This verification protects against man-in-the-middle attacks by ensuring
        you are connected to your actual wallet.
      </p>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          className={styles.cancelButton}
          onClick={cancelVerification}
          icon={<X size={iconSize()} />}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          className={styles.confirmButton}
          onClick={confirmVerification}
          icon={<ShieldCheck size={iconSize()} />}
        >
          Emojis Match
        </Button>
      </div>
    </div>
  );
};
