// AccountModal: account picker for the connecting flow. Opens when the store is
// in the 'selecting' phase — i.e. the wallet exposed more than one account and
// the user must choose which one to use. Dismissing it (overlay/Escape) cancels
// the connection (disconnect), so we never end up "connected" without an account.
//
// Self-contained: reads `status`/`pendingAccounts` and calls `selectAccount` /
// `disconnect` from the store.
import * as Dialog from '@radix-ui/react-dialog';
import { Wallet } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { truncateAddress } from '../lib/format';

export function AccountModal() {
  const { status, pendingAccounts, selectAccount, disconnect } = useWallet();
  const open = status === 'selecting' && !!pendingAccounts && pendingAccounts.length > 0;

  return (
    <Dialog.Root
      open={open}
      // Closing without choosing cancels the connection.
      onOpenChange={(next) => {
        if (!next) disconnect();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Select an account</Dialog.Title>
          <Dialog.Description className={styles.desc}>
            Your wallet exposed multiple accounts. Choose which one to connect.
          </Dialog.Description>

          <div className={styles.list}>
            {pendingAccounts?.map((account, i) => {
              const addressStr = account.item.toString();
              return (
                <button
                  key={addressStr}
                  type="button"
                  onClick={() => selectAccount(account.item)}
                  className={styles.item}
                >
                  <span className={styles.iconBox} aria-hidden>
                    <Wallet className={styles.icon} />
                  </span>
                  <span className={styles.textCol}>
                    <span className={styles.alias}>{account.alias || `Account ${i + 1}`}</span>
                    <span className={styles.addr}>{truncateAddress(addressStr, 10, 6)}</span>
                  </span>
                  <span className={styles.arrow} aria-hidden>
                    →
                  </span>
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
  overlay: 'fixed inset-0 z-40 bg-[#06040ad9] backdrop-blur-[2px]',
  content:
    'fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-line bg-elevated p-8 shadow-[0_24px_60px_-10px_#8b5cf640] outline-none',
  title: 'm-0 text-[1.375rem] font-semibold text-ink',
  desc: 'mt-1.5 mb-0 text-sm leading-relaxed text-ink-soft',
  list: 'mt-5 flex max-h-[18rem] flex-col gap-2.5 overflow-y-auto',
  item: 'group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-field p-3 text-left transition-colors hover:border-violet-line hover:bg-[#1b1430]',
  iconBox: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated',
  icon: 'h-4 w-4 text-violet-300',
  textCol: 'flex flex-1 flex-col gap-0.5 overflow-hidden',
  alias: 'truncate text-sm font-medium text-ink',
  addr: 'truncate font-mono text-xs text-ink-dim',
  arrow: 'text-violet-400 opacity-0 transition-opacity group-hover:opacity-100',
} as const;
