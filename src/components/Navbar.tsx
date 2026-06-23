// Navbar: top app bar. Left brand, right wallet control.
// - Not connected: "Connect Wallet" button opens the WalletModal (local state).
// - connecting / selecting: spinner + "Connecting…".
// - connected: address pill + Disconnect button.
import { useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Wallet } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useCopyToast } from '../hooks/useCopyToast';
import { truncateAddress } from '../lib/format';
import { WalletModal } from './WalletModal';
import { NetworkSwitcher } from './NetworkSwitcher';

export function Navbar() {
  const { status, address, disconnect } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const { copy } = useCopyToast();

  // 'selecting' (picking an account) is still in-flight — show the busy state.
  const busy = status === 'connecting' || status === 'selecting';
  const connected = status === 'connected' && address;

  return (
    <header className={styles.bar}>
      <p className={styles.brand}>🐣 boiler</p>

      <div className={styles.right}>
        <NetworkSwitcher />

        {connected && (
          <div className={styles.connectedRow}>
            {/* Tooltip.Provider is global (see providers/AppProviders). */}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={() => void copy(address.toString(), 'Address copied to clipboard')}
                  className={styles.addressPill}
                >
                  <span className={styles.statusDot} aria-hidden />
                  <span className={styles.address}>
                    {truncateAddress(address.toString())}
                  </span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={8}>
                  {address.toString()}
                  <Tooltip.Arrow className={styles.tooltipArrow} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <button
              type="button"
              onClick={() => void disconnect()}
              className={styles.disconnectButton}
            >
              Disconnect
            </button>
          </div>
        )}

        {!connected && busy && (
          <span className={styles.connectingTag}>
            <span className={styles.spinner} aria-hidden />
            Connecting…
          </span>
        )}

        {!connected && !busy && (
          <button type="button" onClick={() => setModalOpen(true)} className={styles.connectButton}>
            <Wallet className={styles.connectIcon} />
            Connect Wallet
          </button>
        )}
      </div>

      <WalletModal open={modalOpen} onOpenChange={setModalOpen} />
    </header>
  );
}

const styles = {
  bar: 'sticky top-0 z-30 flex h-[84px] w-full items-center justify-between border-b border-line bg-[#0e0a16e6] px-10 backdrop-blur',
  brand: 'm-0 flex items-center gap-2 text-base font-semibold text-ink',
  right: 'flex items-center gap-3',
  connectButton:
    'inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-linear-to-b from-violet-500 to-violet-600 px-[18px] text-sm font-medium text-white shadow-[0_4px_16px_-2px_#7c3aed66] transition-opacity hover:opacity-90',
  connectIcon: 'h-4 w-4',
  connectingTag:
    'flex h-10 items-center gap-2 rounded-xl border border-line bg-field px-3.5 text-sm text-ink-soft',
  connectedRow: 'flex items-center gap-2',
  addressPill:
    'flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-field px-3.5',
  statusDot: 'inline-block h-2 w-2 rounded-full bg-success',
  address: 'font-mono text-sm text-ink',
  tooltip:
    'z-50 select-text rounded-lg border border-line bg-elevated px-3 py-1.5 font-mono text-xs text-ink shadow-[0_8px_24px_-6px_#000000b3]',
  tooltipArrow: 'fill-elevated',
  disconnectButton:
    'inline-flex h-10 cursor-pointer items-center rounded-xl border border-line bg-transparent px-3.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink',
  spinner:
    'inline-block h-[0.875rem] w-[0.875rem] rounded-full border-2 border-line border-t-ink animate-spin',
} as const;
