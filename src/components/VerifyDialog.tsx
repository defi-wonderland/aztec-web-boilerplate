// VerifyDialog: external-wallet connection dialog. Two phases, driven by props:
//   1. Waiting  (open, emojiGrid === null): discovering the wallet / waiting for
//      the user to approve the connection request (e.g. Azguard). Shows a spinner.
//   2. Verify   (open, emojiGrid !== null): the secure channel is established;
//      show the 3x3 emoji grid to compare against the wallet (anti-MITM). We use
//      the real emojis from hashToEmoji — NOT design icons.
//
// Non-dismissable: closes only when the connection settles (or the user rejects
// in their wallet -> error -> closed). Purely presentational.
import * as Dialog from '@radix-ui/react-dialog';
import { splitGraphemes } from '../lib/format';

export interface VerifyDialogProps {
  /** Whether the external connection is in progress. */
  open: boolean;
  /** Handshake emoji grid; null until the secure channel is established. */
  emojiGrid: string | null;
}

export function VerifyDialog({ open, emojiGrid }: VerifyDialogProps) {
  const verifying = emojiGrid !== null;

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        {/* Non-dismissable: it closes only when the connection settles. */}
        <Dialog.Content
          className={styles.content}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {verifying && (
            <>
              <Dialog.Title className={styles.title}>Verify your wallet</Dialog.Title>
              <Dialog.Description className={styles.desc}>
                Check that these emojis match the ones shown in your wallet, then approve the
                connection there.
              </Dialog.Description>

              <div className={styles.grid}>
                {splitGraphemes(emojiGrid ?? '').map((emoji, i) => (
                  <span key={i} className={styles.cell}>
                    {emoji}
                  </span>
                ))}
              </div>

              <div className={styles.waitingRow}>
                <span className={styles.spinner} aria-hidden />
                Waiting for confirmation in your wallet…
              </div>
            </>
          )}

          {!verifying && (
            <>
              <Dialog.Title className={styles.title}>Connecting…</Dialog.Title>
              <Dialog.Description className={styles.desc}>
                Approve the connection request in your wallet (e.g. Azguard) to continue.
              </Dialog.Description>

              <div className={styles.waitingBox}>
                <span className={styles.bigSpinner} aria-hidden />
                <span className={styles.waitingText}>Waiting for your approval…</span>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const styles = {
  overlay: 'fixed inset-0 z-40 bg-[#06040ad9] backdrop-blur-[2px]',
  content:
    'fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-line bg-elevated p-8 shadow-[0_24px_60px_-10px_#8b5cf640] outline-none',
  title: 'm-0 text-xl font-semibold text-ink',
  desc: 'mt-1.5 mb-0 text-sm text-ink-soft',
  grid: 'mx-auto mt-5 grid w-fit grid-cols-3 gap-1.5 rounded-2xl border border-line bg-base p-3',
  cell: 'flex h-[3.25rem] w-[3.25rem] select-none items-center justify-center rounded-xl border border-line bg-surface text-[1.75rem] leading-none',
  waitingRow: 'mt-6 flex items-center justify-center gap-2 text-[0.8125rem] text-ink-soft',
  waitingBox:
    'mt-5 flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-base px-4 py-9',
  waitingText: 'text-sm text-ink-soft',
  spinner:
    'inline-block h-[0.875rem] w-[0.875rem] rounded-full border-2 border-line border-t-ink animate-spin',
  bigSpinner: 'inline-block h-8 w-8 rounded-full border-[3px] border-line border-t-violet-400 animate-spin',
} as const;
