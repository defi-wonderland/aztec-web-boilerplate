// src/components/CounterPanel.tsx
// Reads the on-chain counter and lets a connected wallet increment it. Mirrors
// BlockPanel's card style; uses the useCounter hooks for all chain access.
import { Plus } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useCounterValue, useIncrement } from '../hooks/useCounter';

export function CounterPanel({ contractAddress }: { contractAddress: string }) {
  const { status } = useWallet();
  const connected = status === 'connected';
  const { data, isLoading, isError, error } = useCounterValue(contractAddress);
  const increment = useIncrement(contractAddress);

  return (
    <section className={styles.card}>
      <div className={styles.accent} aria-hidden />
      <div className={styles.body}>
        <span className={styles.label}>Counter</span>

        <div className={styles.numberWrap}>
          {!connected && <p className={styles.muted}>Connect a wallet to read the counter.</p>}
          {connected && isLoading && (
            <div className={styles.loadingRow}>
              <span className={styles.spinner} aria-hidden />
              <span>Reading counter…</span>
            </div>
          )}
          {connected && isError && (
            <p className={styles.errorText}>
              Failed to read: {error instanceof Error ? error.message : 'unknown error'}
            </p>
          )}
          {connected && !isLoading && !isError && (
            <p className={styles.number}>{(data ?? 0n).toString()}</p>
          )}
        </div>

        <button
          type="button"
          className={styles.button}
          disabled={!connected || increment.isPending}
          onClick={() => increment.mutate()}
        >
          <Plus className={styles.buttonIcon} aria-hidden />
          {increment.isPending ? 'Incrementing…' : 'Increment'}
        </button>

        {increment.isError && (
          <p className={styles.errorText}>
            {increment.error instanceof Error ? increment.error.message : 'Transaction failed'}
          </p>
        )}
      </div>
    </section>
  );
}

const styles = {
  card: 'w-full overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_20px_50px_-12px_#00000080]',
  accent: 'h-[3px] w-full bg-linear-to-r from-violet-500 to-violet-400',
  body: 'flex flex-col gap-2.5 p-8',
  label: 'text-xs font-medium uppercase tracking-[0.12em] text-ink-dim',
  numberWrap: 'flex min-h-[3.75rem] items-center',
  number: 'm-0 font-mono text-[3.25rem] font-bold leading-none text-ink',
  loadingRow: 'flex items-center gap-2 text-ink-soft',
  spinner: 'inline-block h-4 w-4 rounded-full border-2 border-line border-t-ink animate-spin',
  errorText: 'm-0 text-sm text-rose-400',
  muted: 'm-0 text-sm text-ink-dim',
  button:
    'mt-2 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-medium text-ink transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50',
  buttonIcon: 'h-4 w-4',
} as const;
