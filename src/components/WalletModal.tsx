// WalletModal: dismissable Radix Dialog for picking a wallet connector.
// One row per entry in the connectors registry (embedded + external).
// Clicking calls connect(kind); successful connections close the modal, while
// failures leave it open so the error banner is visible.
import { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Wallet, Puzzle, type LucideIcon } from 'lucide-react';
import { connectors } from '../lib/connectors';
import type { ConnectorKind } from '../lib/connectors';
import { useWallet } from '../hooks/useWallet';
import { useWalletStore } from '../state/walletStore';

export interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Per-connector presentation (the registry only carries kind + label).
const META: Record<ConnectorKind, { Icon: LucideIcon; sub: string; recommended?: boolean }> = {
  embedded: { Icon: Wallet, sub: 'In-browser account · best for testing & dev', recommended: true },
  external: { Icon: Puzzle, sub: 'Connect your Azguard extension' },
};

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { status, error, connect } = useWallet();
  const connecting = status === 'connecting';

  const handleConnect = useCallback(
    async (k: ConnectorKind) => {
      await connect(k);

      const nextStatus = useWalletStore.getState().status;
      if (nextStatus === 'connected' || nextStatus === 'selecting') {
        onOpenChange(false);
      }
    },
    [connect, onOpenChange],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <span className={styles.glow} aria-hidden />
          <Dialog.Title className={styles.title}>Connect a wallet</Dialog.Title>
          <Dialog.Description className={styles.desc}>
            Choose how you would like to connect.
          </Dialog.Description>

          <div className={styles.list}>
            {connectors.map((c) => {
              const meta = META[c.kind];
              return (
                <button
                  key={c.kind}
                  type="button"
                  onClick={() => void handleConnect(c.kind)}
                  disabled={connecting}
                  className={styles.option}
                >
                  <span className={styles.iconBox} aria-hidden>
                    <meta.Icon className={styles.icon} />
                  </span>
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{c.label}</span>
                    <span className={styles.optionSub}>{meta.sub}</span>
                  </span>
                  {meta.recommended && <span className={styles.badge}>Recommended</span>}
                </button>
              );
            })}
          </div>

          {status === 'error' && error && (
            <p role="alert" className={styles.errorBanner}>
              {error}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const styles = {
  overlay: 'fixed inset-0 z-40 bg-[#06040ad9] backdrop-blur-[2px]',
  content:
    'fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border border-line bg-surface p-8 shadow-[0_30px_70px_-10px_#000000b3] outline-none',
  glow: 'pointer-events-none absolute left-1/2 top-0 h-44 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#8b5cf640,transparent_70%)]',
  title: 'm-0 text-[1.625rem] font-bold text-ink',
  desc: 'mt-1.5 mb-0 text-base text-ink-soft',
  list: 'mt-[18px] flex flex-col gap-3',
  // Both options share the same resting style; the violet only shows on hover.
  option:
    'flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-line bg-field p-4 text-left transition-colors hover:border-violet-line hover:bg-[#1b1430] disabled:cursor-not-allowed disabled:opacity-60',
  iconBox: 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-base',
  icon: 'h-5 w-5 text-violet-300',
  optionText: 'flex flex-1 flex-col gap-0.5',
  optionLabel: 'text-sm font-medium text-ink',
  optionSub: 'text-xs text-ink-dim',
  badge:
    'rounded-full bg-violet-500/15 px-2 py-0.5 text-[0.6875rem] font-medium text-violet-300',
  errorBanner:
    'mt-4 mb-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300',
} as const;
