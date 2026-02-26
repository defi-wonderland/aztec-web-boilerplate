# AGENTS.md

## Repository Purpose
- React + Vite + TypeScript boilerplate for Aztec v4 dApps.
- Includes:
  - `src/aztec-wallet`: modular wallet layer (embedded + Azguard; EVM wallet path exists but is currently disabled in app config).
  - `src/use-aztec`: contract interaction hooks and provider bridge.
  - `src/contract-registry`: artifact loading + contract registration.
  - `scripts/deploy.ts`: deploys Dripper + Token and writes `src/config/deployments/{network}.json`.

## Runtime and Tooling Baseline
- Node: `>=22.0.0` (enforced in `package.json`).
- Package manager: Yarn 1 (`yarn.lock`, `packageManager` field).
- Frontend: React 19, Vite 7, Tailwind CSS v4, Radix primitives.
- State/data: Zustand + TanStack Query.
- Tests: Vitest (unit/integration) + Playwright (e2e).

## Important File Map
- Entrypoint: `src/main.tsx`, `src/App.tsx`.
- Provider composition: `src/providers/AppProvider.tsx`.
- Wallet config: `src/config/aztecWalletConfig.ts`.
- Network constants: `src/config/networks/constants.ts`.
- Contract config: `src/config/contracts.ts`, `src/config/boilerplateContracts.ts`.
- Deploy outputs: `src/config/deployments/sandbox.json`, `src/config/deployments/devnet.json`.
- Build/runtime polyfill and proxy behavior: `vite.config.ts`.
- Vercel proxy + SPA routing: `middleware.ts`, `vercel.json`.
- UI theme tokens and utilities: `src/styles/globals.css`.

## Commands (Current, Verified)
- Install: `yarn install`
- Dev server: `yarn dev`
- Build app: `yarn build` (currently aliased to `build-app`, not full contracts pipeline)
- Serve build: `yarn serve`
- Deploy contracts: `yarn deploy-contracts`
- Tests:
  - `yarn test`
  - `yarn test:unit`
  - `yarn test:integration`
  - `yarn test:e2e`
- Lint/format check: `yarn lint`
- Auto-fix lint/format: `yarn lint:fix`

## Known Gotchas (Read Before Editing)
- README command drift:
  - README mentions `build-standards` / `build-contracts` scripts, but `package.json` currently exposes `build:contracts` and not `build-standards`.
  - Treat `package.json` scripts as source of truth.
- Default network mismatch:
  - `DEFAULT_NETWORK` is `devnet`, but local workflow + deploy script default target is `sandbox`.
- Wallet config status:
  - EVM wallets are commented out in `src/config/aztecWalletConfig.ts` with a TODO note.
- E2E status:
  - `tests/e2e/walletless.spec.ts` suite is fully skipped.
- Generated artifacts:
  - `src/artifacts/**` and `src/target/**` are generated and ignored by ESLint.
  - Avoid manual edits unless intentionally patching generated output.
- Vite define override:
  - `vite.config.ts` rewrites `import.meta.env.VITE_ARTIFACT_REGISTRY_URL` to `'/artifact-registry'` at build time.

## Coding Conventions in This Repo
- TypeScript-first; functional React components.
- Styling convention documented in README:
  - Keep Tailwind class strings in top-level `styles` objects (avoid ad-hoc inline utility strings in JSX).
- Shared UI primitives live in `src/components/ui/*`; prefer extending these instead of bespoke controls.
- Keep import order ESLint-compliant (`import/order` is enforced).

## Agent Workflow Guidance
- For UI/logic changes:
  1. Edit source files.
  2. Run `yarn lint`.
  3. Run targeted tests (`yarn test:unit` / `yarn test:integration`) when relevant.
- For Aztec contract/deployment changes:
  1. Update contracts and/or deploy script.
  2. Run `yarn deploy-contracts` against intended network.
  3. Verify `src/config/deployments/*.json` output is coherent.
- For artifact-loading issues:
  - Check `vite.config.ts` proxies (`/github-releases`, `/artifact-registry`) and `middleware.ts` behavior first.

## Environment Variables (Commonly Used)
- `VITE_AZTEC_NODE_URL`
- `VITE_PROVER_ENABLED`
- `VITE_ARTIFACT_REGISTRY_URL`
- `VITE_EXTERNAL_TGZ_URL`
- `VITE_EMBEDDED_ACCOUNT_SECRET_PHRASE`
- `VITE_EMBEDDED_ACCOUNT_SECRET_KEY`
- `VITE_COMMON_SALT`

## Safe Assumptions for Future Iterations
- Prioritize sandbox-compatible changes unless user explicitly targets devnet.
- Keep contract addresses/config network-scoped in `src/config/deployments`.
- Preserve provider layering in `AppProvider` unless there is a clear dependency reason to reorder.
