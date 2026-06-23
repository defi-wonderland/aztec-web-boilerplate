// NetworkSwitcher: button + Radix dialog to pick the Aztec network (node RPC).
// Switching recreates the node client and disconnects the wallet (chainInfo
// differs per network). The active network is highlighted with a check.
import { useState, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { NETWORKS } from '../config/app';
import { useWallet } from '../hooks/useWallet';

export function NetworkSwitcher(): ReactElement {
  const { networkId, setNetwork } = useWallet();
  const [open, setOpen] = useState(false);
  const active = NETWORKS.find((n) => n.id === networkId) ?? NETWORKS[0];

  const pick = (id: string) => {
    setNetwork(id);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.trigger}>
          <Globe className={styles.triggerIcon} />
          {active.label}
          <ChevronDown className={styles.chevron} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Select a network</Dialog.Title>
          <Dialog.Description className={styles.desc}>
            Choose which Aztec node to connect to. Switching disconnects your wallet.
          </Dialog.Description>

          <div className={styles.list}>
            {NETWORKS.map((n) => {
              const isActive = n.id === networkId;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => pick(n.id)}
                  className={`${styles.option} ${isActive ? styles.optionActive : ''}`}
                >
                  <span className={styles.iconBox} aria-hidden>
                    <Globe className={styles.icon} />
                  </span>
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{n.label}</span>
                    <span className={styles.optionSub}>{n.nodeUrl}</span>
                  </span>
                  {isActive && <Check className={styles.check} />}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const styles = {
  trigger:
    'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-field px-3.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink',
  triggerIcon: 'h-4 w-4 text-violet-300',
  chevron: 'h-4 w-4 text-ink-dim',
  overlay: 'fixed inset-0 z-40 bg-[#06040ad9] backdrop-blur-[2px]',
  content:
    'fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border border-line bg-surface p-8 shadow-[0_30px_70px_-10px_#000000b3] outline-none',
  title: 'm-0 text-[1.625rem] font-bold text-ink',
  desc: 'mt-1.5 mb-0 text-base text-ink-soft',
  list: 'mt-[18px] flex flex-col gap-3',
  option:
    'flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-line bg-field p-4 text-left transition-colors hover:border-violet-line hover:bg-[#1b1430]',
  optionActive: 'border-violet-line bg-[#1b1430]',
  iconBox: 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-base',
  icon: 'h-5 w-5 text-violet-300',
  optionText: 'flex flex-1 flex-col gap-0.5 overflow-hidden',
  optionLabel: 'text-sm font-medium text-ink',
  optionSub: 'truncate font-mono text-xs text-ink-dim',
  check: 'h-4 w-4 shrink-0 text-violet-300',
} as const;
