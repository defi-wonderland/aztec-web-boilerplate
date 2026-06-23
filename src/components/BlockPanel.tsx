// BlockPanel: shows the current testnet block with polling (configured in
// useBlockNumber). Works WITHOUT a connected wallet: it only depends on the
// store's node client. Also shows the node URL from config.
import { useBlockNumber } from '../hooks/useBlockNumber';
import { useWalletStore } from '../state/walletStore';
import { getNetwork } from '../config/app';

export function BlockPanel() {
  const node = useWalletStore((s) => s.node);
  const networkId = useWalletStore((s) => s.networkId);
  const { data, isLoading, isError, error, isFetching } = useBlockNumber();
  const nodeUrl = getNetwork(networkId).nodeUrl;
  // Background refetch (not the initial load): show "updating…" instead of "live".
  const updating = isFetching && !isLoading;

  return (
    <section className={styles.card}>
      <div className={styles.accent} aria-hidden />
      <div className={styles.body}>
        <div className={styles.labelRow}>
          <span className={styles.label}>Current block</span>
          {node && !isError && (
            <span className={styles.live}>
              {updating && <span className={styles.updating}>updating…</span>}
              {!updating && (
                <>
                  <span className={styles.liveDot} aria-hidden />
                  live
                </>
              )}
            </span>
          )}
        </div>

        <div className={styles.numberWrap}>
          {!node && <p className={styles.muted}>Connecting to node…</p>}

          {node && isLoading && (
            <div className={styles.loadingRow}>
              <span className={styles.spinner} aria-hidden />
              <span className={styles.loadingText}>Reading current block…</span>
            </div>
          )}

          {node && isError && (
            <p className={styles.errorText}>
              Failed to read block: {error instanceof Error ? error.message : 'unknown error'}
            </p>
          )}

          {node && !isLoading && !isError && (
            <p className={styles.number}>#{Number(data).toLocaleString()}</p>
          )}
        </div>

        <div className={styles.meta}>
          <p className={styles.nodeLine}>
            <span className={styles.nodeLabel}>node:</span> {nodeUrl}
          </p>
          <p className={styles.refreshLine}>Auto-refreshing · no wallet required</p>
        </div>
      </div>
    </section>
  );
}

const styles = {
  card: 'w-full overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_20px_50px_-12px_#00000080]',
  accent: 'h-[3px] w-full bg-linear-to-r from-violet-500 to-violet-400',
  body: 'flex flex-col gap-2.5 p-8',
  labelRow: 'flex items-center justify-between',
  label: 'text-xs font-medium uppercase tracking-[0.12em] text-ink-dim',
  live: 'flex items-center gap-1.5 text-xs text-success',
  liveDot: 'inline-block h-2 w-2 rounded-full bg-success',
  numberWrap: 'flex min-h-[3.75rem] items-center',
  number: 'm-0 font-mono text-[3.25rem] font-bold leading-none text-ink',
  loadingRow: 'flex items-center gap-2 text-ink-soft',
  loadingText: 'text-sm',
  errorText: 'm-0 text-sm text-rose-400',
  muted: 'm-0 text-sm text-ink-dim',
  meta: 'flex flex-col gap-1 pt-3',
  nodeLine: 'm-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-ink-dim',
  nodeLabel: 'text-ink-dim/70',
  refreshLine: 'm-0 text-xs text-ink-dim/70',
  updating: 'text-xs text-ink-dim',
  spinner:
    'inline-block h-4 w-4 rounded-full border-2 border-line border-t-ink animate-spin',
} as const;
