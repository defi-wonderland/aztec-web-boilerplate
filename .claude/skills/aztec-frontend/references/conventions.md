# Frontend conventions

These are the patterns the existing code already follows. Matching them is what
makes new code look like it was always here. Each has a reason — when in doubt,
open the file referenced and copy its shape.

## 1. Tailwind through a `styles` const

Every component declares a single `const styles = { ... } as const` at the **bottom
of the file, after the component**, mapping **semantic** names (not visual ones) to
Tailwind class strings, then references them in JSX. This keeps JSX scannable and
groups all presentation in one place, while letting the component read first.

```tsx
export function Card({ isActive }: { isActive: boolean }) {
  // usage — compose conditional classes with a template string:
  return <button className={`${styles.option} ${isActive ? styles.optionActive : ''}`} />;
}

// styles go at the bottom, after the component:
const styles = {
  card: 'w-full overflow-hidden rounded-[20px] border border-line bg-surface',
  title: 'm-0 text-[1.625rem] font-bold text-ink',
  option: 'flex w-full items-center gap-3.5 rounded-2xl border border-line bg-field p-4',
  optionActive: 'border-violet-line bg-[#1b1430]',
} as const;
```

Putting `styles` after the component is safe because it's only referenced at render
time, never during module evaluation. Don't inline long class strings in JSX, and
don't build a `clsx`/`cn` helper — the template-string pattern above is what the
codebase uses.

## 2. Theme tokens, not raw hex

The palette lives in `src/index.css` under `@theme` and is exposed as Tailwind
utilities. Prefer these so the dark theme stays coherent:

| Purpose | Tokens |
|---|---|
| Backgrounds | `bg-base` `bg-surface` `bg-elevated` `bg-field` |
| Text | `text-ink` (primary) `text-ink-soft` (secondary) `text-ink-dim` (muted) |
| Borders | `border-line` `border-violet-line` |
| Accent | `text-violet-300/400/500` `bg-violet-500` |
| Status | `text-success` (and `text-rose-*` for errors, as in WalletModal) |
| Fonts | `font-sans` (Inter) `font-mono` (JetBrains Mono, for addresses/hashes) |

Arbitrary values like `bg-[#1b1430]` or `shadow-[0_20px_50px_-12px_#00000080]`
appear only for one-off shades/shadows that aren't worth a token. Don't introduce a
new token for a single use; do reuse an existing token rather than re-deriving its hex.

## 3. Conditional rendering with `&&`

Render with short-circuit `&&`, guarding each case. This reads top-to-bottom and
diffs cleanly. Avoid `cond ? <X/> : null` and avoid nested ternaries in JSX.

```tsx
// BlockPanel renders mutually-exclusive states as a stack of guards:
{!node && <p className={styles.muted}>Connecting to node…</p>}
{node && isLoading && <Spinner />}
{node && isError && <p className={styles.errorText}>Failed: {message}</p>}
{node && !isLoading && !isError && <p className={styles.number}>#{data}</p>}
```

A genuine two-way `A : B` ternary is fine; a `... : null` is the smell to avoid.

## 4. Imports: `import type` and Aztec subpaths

`verbatimModuleSyntax` is on. A type imported as a value **fails the build**, so
type-only imports must use `import type`:

```ts
import type { Wallet } from '@aztec/aztec.js/wallet';
import { AztecAddress } from '@aztec/aztec.js/addresses';   // value: used at runtime
import type { ContractArtifact } from '@aztec/aztec.js/abi';
```

Always import Aztec symbols from their **subpath**, never the package root — it's
smaller and matches the package's `exports` map. Common subpaths:
`@aztec/aztec.js/node`, `/wallet`, `/contracts` (plural!), `/fields`, `/addresses`,
`/abi`, `/fee`, `/tx`, `/account`, `/keys`. (`createAztecNodeClient` is `/node`,
`Fr` is `/fields`, `AztecAddress` is `/addresses`, `Contract` is `/contracts`.)

## 5. Data fetching: react-query, not effects

Reads are `useQuery` hooks in `src/hooks/`; writes are `useMutation`. The model is
`src/hooks/useBlockNumber.ts`:

```ts
export function useBlockNumber() {
  const node = useWalletStore((s) => s.node);
  const networkId = useWalletStore((s) => s.networkId);
  return useQuery({
    queryKey: ['blockNumber', networkId],   // key on networkId so a switch refetches
    queryFn: async () => {
      if (!node) throw new Error('Node not initialized');
      return node.getBlockNumber();
    },
    enabled: !!node,                          // don't run until ready
    refetchInterval: 10_000,                  // poll if it's live data
  });
}
```

Never fetch chain data in `useEffect` + `setState`, and never mirror server/chain
state into component `useState`. Let react-query own loading/error/refetch.

## 6. State from the store

Connection state (`node`, `wallet`, `address`, `status`, `networkId`,
`connector`, `error`) lives in `src/state/walletStore.ts`. Read it via:

- `useWallet()` — the facade hook exposing the whole store; destructure what you
  need: `const { status, address, connect } = useWallet();`. It uses `useShallow`
  internally so multi-field reads don't over-render.
- `useWalletStore((s) => s.node)` — a direct selector when you want one field (as
  `BlockPanel` and `useBlockNumber` do). For several fields in a direct selector,
  wrap the selector in `useShallow`.

Add new global connection state to the store (with an action), not to component
`useState`. Keep UI out of the store — it holds state + actions only.

## 7. Components, providers, structure

- **Named exports** for components, hooks, and lib modules (`export function X`).
  `App` is the one default export.
- A **file-header comment** opens every file: one or two lines on its role and any
  non-obvious design decision. Match the tone of the existing files.
- **Radix** (`@radix-ui/react-*`) for dialogs/toasts/tooltips; **lucide-react** for
  icons. New app-wide providers go in `src/providers/AppProviders.tsx`, not in
  `main.tsx` and not scattered.
- Accessibility touches the existing code keeps: `type="button"` on non-submit
  buttons, `aria-hidden` on decorative icons, `role="alert"` on error banners.
- Fire-and-forget a promise with `void` (`void connect(kind)`), and wrap
  `localStorage` access in try/catch (it throws in private mode) — see the store.

## 8. TypeScript strictness to expect

`tsconfig.app.json` sets `noUnusedLocals`, `noUnusedParameters`, and
`erasableSyntaxOnly`; eslint adds `@typescript-eslint/no-unused-vars`. Prefix an
intentionally-unused binding with `_` to satisfy both (`(_e) => …`,
`function f(_unused: T)`). Don't leave dead imports or vars — the build fails on them.

## Quick checklist for a new component

- [ ] `const styles = { … } as const` after the component, semantic names; theme tokens used
- [ ] Conditional UI via `&&` guards, not `? : null`
- [ ] `import type` for types; Aztec symbols from subpaths
- [ ] Reads via a `useQuery` hook in `src/hooks/`; writes via `useMutation`
- [ ] Wallet/chain state read from the store (`useWallet` / selectors)
- [ ] Named export, file-header comment
- [ ] `yarn lint && yarn build` clean
