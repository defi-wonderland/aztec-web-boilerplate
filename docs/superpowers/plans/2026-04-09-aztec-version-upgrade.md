# Aztec Version Upgrade: 4.0.0-devnet.2-patch.1 → 4.2.0-aztecnr-rc.2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all Aztec dependencies from `4.0.0-devnet.2-patch.1` to `4.2.0-aztecnr-rc.2`, adapting to breaking API changes across two major version jumps (4.0→4.1→4.2).

**Architecture:** The upgrade touches three layers: (1) npm packages + Noir compiler tags, (2) runtime API changes (simulate return type, gas estimation), and (3) browser wallet rewrite replacing `@azguardwallet/*` with `@aztec/wallet-sdk`. The feejuice-frontend repo (PR #16 and #19) serves as the reference implementation for all changes.

**Tech Stack:** TypeScript, React, Vite, Aztec SDK, Noir, `@aztec/wallet-sdk`, `@defi-wonderland/aztec-fee-payment`

**Reference:** Changes are modeled after `defi-wonderland/aztec-feejuice-frontend` PRs:
- PR #16: `chore: upgrade v4.1.0-rc.4` (simulate changes, gas estimation, network URL, fee payment renames)
- PR #19: `feat: migrate browser wallet integration from @azguardwallet/client to @aztec/wallet-sdk` (wallet-sdk, two-phase connection, emoji verification)

---

## File Structure Overview

### Files to Modify
- `package.json` — version bumps, dependency swap
- `contracts/ecdsa_k_eth_signer_account/Nargo.toml` — Noir tag
- `src/config/networks/devnet.ts` — RPC URL
- `src/config/networks/constants.ts` — chain IDs if changed
- `vite.config.ts` — optimizeDeps, dedupe, aliases
- `src/aztec-wallet/execution/executeRead.ts` — simulate() destructuring
- `src/aztec-wallet/execution/executeBatchRead.ts` — simulate() destructuring
- `src/aztec-wallet/execution/executeWrite.ts` — simulate() + gas estimation
- `src/aztec-wallet/connectors/BrowserWalletConnector.ts` — full rewrite for wallet-sdk
- `src/aztec-wallet/config/walletPresets.ts` — simplify presets for wallet-sdk
- `src/aztec-wallet/types/walletConnector.ts` — remove CaipAccount import, add hasWallet()
- `src/aztec-wallet/types/browserWallet.ts` — may simplify or remove
- `src/aztec-wallet/types/browserWalletAdapter.ts` — remove (replaced by wallet-sdk)
- `src/services/aztec/feePayment/index.ts` — rename Metered → FPC classes
- `src/services/aztec/feePayment/FeePaymentRegister.ts` — rename MeteredContractArtifact → BridgedFPCContractArtifact (or PrivateFPCContractArtifact)
- `src/config/feePaymentContracts.ts` — update type names/labels
- `src/types/azguard.ts` — remove (Azguard types no longer needed)

### Files to Delete
- `src/aztec-wallet/adapters/azguard/AzguardAdapter.ts`
- `src/aztec-wallet/adapters/azguard/AzguardWalletService.ts`
- `src/aztec-wallet/adapters/azguard/index.ts`
- `src/aztec-wallet/adapters/index.ts`
- `src/aztec-wallet/types/browserWalletAdapter.ts`
- `src/types/azguard.ts`

### Files to Create
- `src/aztec-wallet/components/EmojiVerifyView.tsx` — emoji hash verification UI for two-phase connection

---

## Phase 1: Package Versions & Build Config

### Task 1: Bump all package versions

**Files:**
- Modify: `package.json`
- Modify: `contracts/ecdsa_k_eth_signer_account/Nargo.toml`

- [ ] **Step 1: Update package.json dependencies**

In `package.json`, make these changes:

```jsonc
// Remove these two packages entirely:
// "@azguardwallet/client": "0.7.0",
// "@azguardwallet/types": "0.7.0",

// Update all @aztec/* to 4.2.0-aztecnr-rc.2:
"@aztec/accounts": "4.2.0-aztecnr-rc.2",
"@aztec/aztec.js": "4.2.0-aztecnr-rc.2",
"@aztec/constants": "4.2.0-aztecnr-rc.2",
"@aztec/foundation": "4.2.0-aztecnr-rc.2",
"@aztec/kv-store": "4.2.0-aztecnr-rc.2",
"@aztec/noir-contracts.js": "4.2.0-aztecnr-rc.2",
"@aztec/pxe": "4.2.0-aztecnr-rc.2",
"@aztec/stdlib": "4.2.0-aztecnr-rc.2",
"@aztec/wallet-sdk": "4.2.0-aztecnr-rc.2",

// Update @defi-wonderland packages:
// Check for a matching aztec-fee-payment release at 4.2.0-aztecnr-rc.2
// The feejuice-frontend uses a prerelease TGZ — find the correct URL from:
// https://github.com/defi-wonderland/aztec-fee-payment/releases
"@defi-wonderland/aztec-fee-payment": "<TGZ URL for 4.2.0-aztecnr-rc.2 prerelease>",
"@defi-wonderland/aztec-standards": "4.2.0-aztecnr-rc.2",

// Update config.aztecVersion:
"config": {
  "aztecVersion": "4.2.0-aztecnr-rc.2"
}
```

**Important:** The exact TGZ URL for `@defi-wonderland/aztec-fee-payment` must be looked up from https://github.com/defi-wonderland/aztec-fee-payment/releases — the feejuice-frontend uses `prerelease-07982ed` tag. Use the same one.

- [ ] **Step 2: Update Nargo.toml**

In `contracts/ecdsa_k_eth_signer_account/Nargo.toml`, change line 8:

```toml
# Before:
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v4.0.0-devnet.2-patch.1", directory = "noir-projects/aztec-nr/aztec" }

# After:
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v4.2.0-aztecnr-rc.2", directory = "noir-projects/aztec-nr/aztec" }
```

- [ ] **Step 3: Install dependencies**

```bash
yarn install
```

Expected: Lockfile updates. Watch for peer dependency warnings or resolution failures. If `@defi-wonderland/aztec-fee-payment` or `@defi-wonderland/aztec-standards` don't have matching versions yet, check their repos for the correct tags/releases.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock contracts/ecdsa_k_eth_signer_account/Nargo.toml
git commit -m "chore: bump aztec dependencies to 4.2.0-aztecnr-rc.2"
```

---

### Task 2: Update Vite config for new package structure

**Files:**
- Modify: `vite.config.ts`

The new Aztec version may introduce additional packages that need deduplication and CommonJS handling. Compare with feejuice-frontend's vite.config.ts.

- [ ] **Step 1: Add new packages to optimizeDeps.exclude**

In `vite.config.ts`, update the `optimizeDeps.exclude` array:

```typescript
exclude: [
  '@aztec/noir-acvm_js',
  '@aztec/noir-noirc_abi',
  '@aztec/bb.js',
  // Add these for 4.2.x compatibility:
  '@aztec/pxe/client/lazy',
  '@aztec/noir-contracts.js',
  '@aztec/accounts',
  '@aztec/stdlib',
  '@aztec/entrypoints',
  '@aztec/l1-artifacts',
  '@aztec/protocol-contracts',
  '@defi-wonderland/aztec-standards',
],
```

- [ ] **Step 2: Extend commonjsOptions.exclude**

In the `build.commonjsOptions.exclude` array, add new packages:

```typescript
exclude: [
  '@aztec/stdlib/**',
  '@aztec/foundation/**',
  '@aztec/aztec.js/**',
  // Add for 4.2.x:
  '@aztec/entrypoints/**',
  '@aztec/l1-artifacts/**',
  '@aztec/protocol-contracts/**',
  '@aztec/wallet-sdk/**',
],
```

- [ ] **Step 3: Verify dev server starts**

```bash
yarn dev
```

Expected: Dev server starts on localhost:3000 without build errors. There may be runtime errors if APIs changed — those are addressed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "chore: update vite config for aztec 4.2.x packages"
```

---

### Task 3: Update network configuration

**Files:**
- Modify: `src/config/networks/devnet.ts`

- [ ] **Step 1: Update devnet RPC URL**

In `src/config/networks/devnet.ts`, line 14:

```typescript
// Before:
nodeUrl: 'https://v4-devnet-2.aztec-labs.com',

// After:
nodeUrl: 'https://rpc.testnet.aztec-labs.com',
```

**Note:** Contract addresses (dripper, token) will also need updating since they're deployed on the new network. These addresses must be obtained by deploying to the new testnet or checking if pre-deployed contracts exist. For now, update the URL; addresses will be validated after deployment.

- [ ] **Step 2: Verify the new endpoint is reachable**

```bash
curl -s -o /dev/null -w "%{http_code}" https://rpc.testnet.aztec-labs.com
```

Expected: HTTP 200 or similar success response.

- [ ] **Step 3: Commit**

```bash
git add src/config/networks/devnet.ts
git commit -m "chore: update devnet RPC URL to testnet endpoint"
```

---

## Phase 2: Runtime API Changes

### Task 4: Fix simulate() return type in executeRead

**Files:**
- Modify: `src/aztec-wallet/execution/executeRead.ts:45`

In Aztec 4.1+, `.simulate()` returns `{ result: T }` instead of `T` directly.

- [ ] **Step 1: Update executeAppManagedRead**

In `src/aztec-wallet/execution/executeRead.ts`, change line 45:

```typescript
// Before:
return method(...args).simulate({ from: fromAddress });

// After:
const { result } = await method(...args).simulate({ from: fromAddress });
return result;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/aztec-wallet/execution/executeRead.ts
git commit -m "fix: destructure simulate() result in executeRead"
```

---

### Task 5: Fix simulate() return type in executeBatchRead

**Files:**
- Modify: `src/aztec-wallet/execution/executeBatchRead.ts:198`

- [ ] **Step 1: Update executeAppManagedBatch**

In `src/aztec-wallet/execution/executeBatchRead.ts`, change lines 198-201:

```typescript
// Before:
const result = await method(...contract.args).simulate({
  from: fromAddress,
});
results.push({ status: 'success' as const, result });

// After:
const { result } = await method(...contract.args).simulate({
  from: fromAddress,
});
results.push({ status: 'success' as const, result });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/aztec-wallet/execution/executeBatchRead.ts
git commit -m "fix: destructure simulate() result in executeBatchRead"
```

---

### Task 6: Fix simulate() and add gas estimation in executeWrite

**Files:**
- Modify: `src/aztec-wallet/execution/executeWrite.ts:148`

In 4.1+, `simulate()` returns an object and gas estimation is needed before `send()`.

- [ ] **Step 1: Update executeAppManagedWrite simulation and send**

In `src/aztec-wallet/execution/executeWrite.ts`, update the simulation + send block (lines 146-161):

```typescript
// Before:
const tx = method(...args);
try {
  await tx.simulate({ from: fromAddress });
} catch (simErr) {
  const simErrorMsg =
    simErr instanceof Error ? simErr.message : 'Simulation failed';
  throw new Error(`Simulation failed: ${simErrorMsg}`);
}

const result = await tx.send({
  from: fromAddress,
  ...(paymentMethod ? { fee: { paymentMethod } } : {}),
  wait: { timeout: timeout ?? 900, waitForStatus: TxStatus.PROPOSED },
});

// After:
const tx = method(...args);

// Simulate with gas estimation to get proper gas settings
let estimatedGas;
try {
  const simResult = await tx.simulate({
    from: fromAddress,
    ...(paymentMethod ? { fee: { paymentMethod, estimateGas: true } } : {}),
  });
  estimatedGas = simResult.estimatedGas;
} catch (simErr) {
  const simErrorMsg =
    simErr instanceof Error ? simErr.message : 'Simulation failed';
  throw new Error(`Simulation failed: ${simErrorMsg}`);
}

const result = await tx.send({
  from: fromAddress,
  ...(paymentMethod
    ? {
        fee: {
          paymentMethod,
          ...(estimatedGas ? { gasSettings: estimatedGas } : {}),
        },
      }
    : {}),
  wait: { timeout: timeout ?? 900, waitForStatus: TxStatus.PROPOSED },
});
```

**Why gas estimation:** In 4.1+, `GasSettings.default()` can produce gas limits that exceed fee balance. Estimating during simulation provides accurate limits.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/aztec-wallet/execution/executeWrite.ts
git commit -m "fix: add gas estimation to executeWrite for aztec 4.1+ compatibility"
```

---

## Phase 3: Fee Payment Renames

### Task 7: Rename Metered → FPC fee payment classes

**Files:**
- Modify: `src/services/aztec/feePayment/index.ts`
- Modify: `src/services/aztec/feePayment/FeePaymentRegister.ts`
- Modify: `src/config/feePaymentContracts.ts`

The `@defi-wonderland/aztec-fee-payment` library renamed its exports:
- `MeteredFeePaymentMethod` → `FPCFeePaymentMethod`
- `MeteredExactFeePaymentMethod` → `FPCExactFeePaymentMethod`
- `MeteredContractArtifact` → `BridgedFPCContractArtifact` (and potentially → `PrivateFPCContractArtifact` per PR #20)

**Important:** Check the actual export names in the installed `@defi-wonderland/aztec-fee-payment` package after installing. The exact rename depends on which version/tag we end up with. The steps below use `FPCFeePaymentMethod` / `FPCExactFeePaymentMethod` / `BridgedFPCContractArtifact` which match PR #16. If PR #20 is merged, use `PrivateFPCContractArtifact` instead.

- [ ] **Step 1: Verify available exports from aztec-fee-payment**

After `yarn install` from Task 1, check what the package actually exports:

```bash
# Check the fee-payment-methods exports
ls node_modules/@defi-wonderland/aztec-fee-payment/dist/ 2>/dev/null || echo "Check package structure"
grep -r "export" node_modules/@defi-wonderland/aztec-fee-payment/dist/fee-payment-methods/ 2>/dev/null | head -20
```

- [ ] **Step 2: Update fee payment service imports**

In `src/services/aztec/feePayment/index.ts`, update imports (lines 6-8):

```typescript
// Before:
import {
  MeteredFeePaymentMethod,
  MeteredExactFeePaymentMethod,
} from '@defi-wonderland/aztec-fee-payment/fee-payment-methods';

// After (adjust names based on Step 1 findings):
import {
  FPCFeePaymentMethod,
  FPCExactFeePaymentMethod,
} from '@defi-wonderland/aztec-fee-payment/fee-payment-methods';
```

And update usages on lines 36 and 44:

```typescript
// Before: return new MeteredFeePaymentMethod(...)
return new FPCFeePaymentMethod(AztecAddress.fromString(config.metered.address));

// Before: return new MeteredExactFeePaymentMethod(...)
return new FPCExactFeePaymentMethod(AztecAddress.fromString(config.metered.address));
```

- [ ] **Step 3: Update FeePaymentRegister artifact import**

In `src/services/aztec/feePayment/FeePaymentRegister.ts`, line 7:

```typescript
// Before:
import { MeteredContractArtifact } from '@defi-wonderland/aztec-fee-payment/artifacts';

// After (adjust based on Step 1):
import { BridgedFPCContractArtifact } from '@defi-wonderland/aztec-fee-payment/artifacts';
```

And update the usage on line 56:

```typescript
// Before: artifact: MeteredContractArtifact,
artifact: BridgedFPCContractArtifact,
```

- [ ] **Step 4: Optionally update labels in feePaymentContracts.ts**

In `src/config/feePaymentContracts.ts`, the type names and labels can be updated to match the new naming:

```typescript
// The type can stay as 'metered' internally if preferred, or rename to 'fpc'/'bridged'
// At minimum, update the comments on lines 14-15:
| 'metered' // FPCFeePaymentMethod from aztec-fee-payment
| 'meteredExact'; // FPCExactFeePaymentMethod with gas refund
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/services/aztec/feePayment/ src/config/feePaymentContracts.ts
git commit -m "refactor: rename Metered fee payment classes to FPC for aztec-fee-payment compatibility"
```

---

## Phase 4: Browser Wallet Rewrite (wallet-sdk Migration)

This is the largest change. The entire Azguard adapter pattern is replaced by `@aztec/wallet-sdk`.

### Task 8: Remove old Azguard adapter files

**Files:**
- Delete: `src/aztec-wallet/adapters/azguard/AzguardAdapter.ts`
- Delete: `src/aztec-wallet/adapters/azguard/AzguardWalletService.ts`
- Delete: `src/aztec-wallet/adapters/azguard/index.ts`
- Delete: `src/aztec-wallet/adapters/index.ts`
- Delete: `src/aztec-wallet/types/browserWalletAdapter.ts`
- Delete: `src/types/azguard.ts`

- [ ] **Step 1: Delete adapter files**

```bash
rm -rf src/aztec-wallet/adapters/
rm src/aztec-wallet/types/browserWalletAdapter.ts
rm src/types/azguard.ts
```

- [ ] **Step 2: Find and note all broken imports**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -E "Cannot find module|has no exported member" | head -30
```

Expected: Multiple import errors in BrowserWalletConnector, walletPresets, walletConnector types, and any components that referenced these. These will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove azguard adapter pattern (replaced by wallet-sdk)"
```

---

### Task 9: Update wallet connector types

**Files:**
- Modify: `src/aztec-wallet/types/walletConnector.ts`

- [ ] **Step 1: Remove CaipAccount import and simplify BrowserWalletConnector interface**

In `src/aztec-wallet/types/walletConnector.ts`:

```typescript
// Remove this import:
// import type { CaipAccount } from '@azguardwallet/types';

// Replace BrowserWalletConnector interface with wallet-sdk version:
export interface BrowserWalletConnector extends WalletConnector {
  readonly type: typeof WalletType.BROWSER_WALLET;

  getWallet: () => Wallet | null;
}
```

Add the `Wallet` import at top if not already present:

```typescript
import type { Wallet } from '@aztec/aztec.js/wallet';
```

Remove these imports that are no longer needed on the BrowserWalletConnector:
- `BrowserWalletOperation`
- `BrowserWalletOperationResult`
- `ConnectorTransactionRequest`
- `ConnectorTransactionResult`

Add `hasWallet` type guard:

```typescript
/**
 * Type guard: returns true for any connector that exposes a standard Wallet.
 * With wallet-sdk, all three connector types provide getWallet().
 */
export const hasWallet = (
  connector: WalletConnector | null | undefined
): connector is EmbeddedWalletConnector | ExternalSignerWalletConnector | BrowserWalletConnector => {
  return (
    connector?.type === WalletType.EMBEDDED ||
    connector?.type === WalletType.EXTERNAL_SIGNER ||
    connector?.type === WalletType.BROWSER_WALLET
  );
};
```

- [ ] **Step 2: Verify no type errors in this file**

```bash
npx tsc --noEmit --pretty 2>&1 | grep walletConnector
```

- [ ] **Step 3: Commit**

```bash
git add src/aztec-wallet/types/walletConnector.ts
git commit -m "refactor: simplify BrowserWalletConnector types for wallet-sdk"
```

---

### Task 10: Rewrite BrowserWalletConnector for wallet-sdk

**Files:**
- Modify: `src/aztec-wallet/connectors/BrowserWalletConnector.ts`

This is the core rewrite. The new connector uses `WalletManager` from `@aztec/wallet-sdk/manager` for discovery and two-phase connection (emoji hash verification).

- [ ] **Step 1: Rewrite BrowserWalletConnector**

Replace `src/aztec-wallet/connectors/BrowserWalletConnector.ts` entirely. The new implementation should:

1. **Import from wallet-sdk:**
   ```typescript
   import { WalletManager } from '@aztec/wallet-sdk/manager';
   import type { WalletProvider, PendingConnection } from '@aztec/wallet-sdk/manager';
   ```

2. **Discovery flow:** Use `WalletManager.configure({ extensions: { enabled: true } })` and iterate `discovery.wallets` to find providers matching `providerId`.

3. **Two-phase connection:**
   - `startConnect()` → discovers wallet, calls `provider.connect()` to get `PendingConnection` with emoji hash data
   - `confirmConnect()` → calls `pending.confirm()`, requests capabilities, extracts account address
   - `connect()` → throws error directing callers to use two-phase flow

4. **Capabilities request:** After confirmation, request capabilities:
   ```typescript
   { accounts: {}, contracts: { '*': {} }, transaction: { '*': {} }, simulation: { '*': {} } }
   ```

5. **Wallet access:** `getWallet()` returns the `Wallet` interface from wallet-sdk after connection.

6. **Disconnect handling:** Subscribe to `provider.onDisconnect()`, reset wallet store state, trigger auto-reconnect modal.

**Reference:** Model after `defi-wonderland/aztec-feejuice-frontend/src/aztec-wallet/connectors/BrowserWalletConnector.ts` (dev branch). Key differences for our boilerplate:
- Use `APP_ID = 'aztec-web-boilerplate'` instead of `'aztec-fee-juice'`
- Adapt store interactions to match our Zustand store shape

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/aztec-wallet/connectors/BrowserWalletConnector.ts
git commit -m "refactor: rewrite BrowserWalletConnector for wallet-sdk two-phase connection"
```

---

### Task 11: Simplify wallet presets for wallet-sdk

**Files:**
- Modify: `src/aztec-wallet/config/walletPresets.ts`

- [ ] **Step 1: Update AztecWalletPreset type and presets**

```typescript
// Before:
export interface AztecWalletPreset {
  id: string;
  name: string;
  icon: IconType;
  getAdapter: () => Promise<IBrowserWalletAdapter>;
  checkInstalled?: () => Promise<boolean>;
}

// After (wallet-sdk uses providerId for discovery):
export interface AztecWalletPreset {
  id: string;
  name: string;
  icon: IconType;
  /** Provider ID for wallet-sdk discovery */
  providerId: string;
}
```

Update the `AZTEC_WALLET_PRESETS`:

```typescript
export const AZTEC_WALLET_PRESETS: Record<string, AztecWalletPreset> = {
  azguard: {
    id: 'azguard',
    name: 'Azguard',
    icon: AzguardIcon,
    providerId: 'azguard-wallet',
  },
  // Optionally add demo wallet:
  // 'demo-wallet': {
  //   id: 'demo-wallet',
  //   name: 'Aztec Keychain',
  //   icon: KeychainIcon,
  //   providerId: 'aztec-keychain',
  // },
};
```

Remove the `IBrowserWalletAdapter` import.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/aztec-wallet/config/walletPresets.ts
git commit -m "refactor: simplify wallet presets for wallet-sdk discovery"
```

---

### Task 12: Create emoji verification UI component

**Files:**
- Create: `src/aztec-wallet/components/EmojiVerifyView.tsx`

The two-phase connection flow requires an emoji hash verification step in the UI. After `startConnect()`, the user sees matching emojis in both the dApp and wallet extension, and must confirm they match before `confirmConnect()` proceeds.

- [ ] **Step 1: Create EmojiVerifyView component**

```tsx
import { Button } from '../../components/ui';

const styles = {
  container: 'flex flex-col items-center gap-4 p-6',
  title: 'text-lg font-semibold text-default',
  description: 'text-sm text-muted text-center max-w-sm',
  emojiRow: 'flex gap-3 text-4xl py-4',
  actions: 'flex gap-3 w-full',
} as const;

interface EmojiVerifyViewProps {
  emojis: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export const EmojiVerifyView = ({
  emojis,
  onConfirm,
  onCancel,
  isConfirming,
}: EmojiVerifyViewProps) => (
  <div className={styles.container}>
    <h3 className={styles.title}>Verify Connection</h3>
    <p className={styles.description}>
      Confirm that these emojis match the ones shown in your wallet extension.
    </p>
    <div className={styles.emojiRow}>
      {emojis.map((emoji, i) => (
        <span key={i}>{emoji}</span>
      ))}
    </div>
    <div className={styles.actions}>
      <Button variant="secondary" onClick={onCancel} disabled={isConfirming}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onConfirm} disabled={isConfirming}>
        {isConfirming ? 'Connecting...' : 'They Match'}
      </Button>
    </div>
  </div>
);
```

- [ ] **Step 2: Wire into connect modal**

Update the wallet connection modal to show `EmojiVerifyView` when in the verification phase. The modal store should track a `pendingConnection` state with the emoji data from `startConnect()`.

This step requires checking the existing modal implementation and adapting accordingly. The key flow:
1. User clicks "Connect" on Azguard preset
2. Modal calls `connector.startConnect()` → gets emoji data
3. Modal shows `EmojiVerifyView` with the emojis
4. User clicks "They Match" → modal calls `connector.confirmConnect()`
5. Connection completes → modal closes

- [ ] **Step 3: Commit**

```bash
git add src/aztec-wallet/components/EmojiVerifyView.tsx
git commit -m "feat: add emoji verification UI for wallet-sdk two-phase connection"
```

---

### Task 13: Update execution layer for wallet-sdk

**Files:**
- Modify: `src/aztec-wallet/execution/executeRead.ts`
- Modify: `src/aztec-wallet/execution/executeWrite.ts`
- Modify: `src/aztec-wallet/execution/executeBatchRead.ts`

With wallet-sdk, browser wallets now provide a standard `Wallet` interface, so browser wallet execution can use the same app-managed code path. The custom browser wallet operation protocol may no longer be needed.

- [ ] **Step 1: Evaluate if browser wallet execution functions are still needed**

With `hasWallet()` returning true for all connector types and `getWallet()` available on `BrowserWalletConnector`, the `executeBrowserWalletRead`, `executeBrowserWalletWrite`, and `executeBrowserWalletBatch` functions may be replaceable with their app-managed equivalents.

Check how the `createExecutionClient.ts` dispatches between app-managed and browser wallet:

```bash
grep -n "browserWallet\|executeAppManaged\|executeBrowserWallet" src/aztec-wallet/client/createExecutionClient.ts
```

If the execution client can be simplified to always use the `Wallet` interface (no more operation protocol), update accordingly. If the browser wallet operations are still used for contract registration or other purposes, keep them but simplify.

- [ ] **Step 2: Simplify or remove browser wallet execution paths**

If wallet-sdk provides a standard `Wallet` everywhere, the execution layer collapses to a single path. Remove `BrowserWalletReadParams`, `BrowserWalletWriteParams`, `BrowserWalletBatchParams` and their implementations. Update `createExecutionClient.ts` to always use the wallet's `Wallet` interface.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/aztec-wallet/execution/ src/aztec-wallet/client/
git commit -m "refactor: simplify execution layer using wallet-sdk unified Wallet interface"
```

---

### Task 14: Update remaining imports and re-exports

**Files:**
- Modify: `src/aztec-wallet/index.ts`
- Modify: any files that import from deleted modules

- [ ] **Step 1: Find all broken imports**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "Cannot find module" | sort -u
```

- [ ] **Step 2: Fix each broken import**

Common fixes:
- Remove imports of `IBrowserWalletAdapter`, `BrowserWalletAdapterFactory` — no longer exist
- Remove imports from `@azguardwallet/types` or `@azguardwallet/client` — packages removed
- Remove imports of `CaipAccount` — wallet-sdk manages accounts internally
- Update `src/aztec-wallet/index.ts` to remove re-exports of deleted modules
- Update any component that references `getCaipAccount`, `sendTransaction`, `executeOperation` on BrowserWalletConnector — these are replaced by `getWallet()`

- [ ] **Step 3: Verify clean compile**

```bash
npx tsc --noEmit --pretty 2>&1
```

Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve all broken imports after wallet-sdk migration"
```

---

## Phase 5: Verification & Cleanup

### Task 15: Verify build succeeds

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Expected: Zero errors.

- [ ] **Step 2: Run linting**

```bash
yarn lint
```

Fix any lint errors that arise from the changes.

- [ ] **Step 3: Run production build**

```bash
yarn build
```

Expected: Build completes successfully. Watch for:
- Vite resolution errors for new/renamed packages
- CommonJS interop issues
- Missing polyfills

- [ ] **Step 4: Fix any build issues and commit**

```bash
yarn lint:fix
git add -A
git commit -m "fix: resolve build issues after aztec version upgrade"
```

---

### Task 16: Run tests

**Files:** None (verification only)

- [ ] **Step 1: Run unit tests**

```bash
yarn test:unit
```

Fix any failures related to changed APIs, updated mocks, or removed types.

- [ ] **Step 2: Fix test failures and commit**

```bash
git add -A
git commit -m "test: fix unit tests for aztec 4.2.0 compatibility"
```

---

### Task 17: Contract compilation check

**Files:** None (verification only)

- [ ] **Step 1: Verify Noir contract compiles with new tag**

```bash
yarn build:contracts 2>&1 | tail -20
```

This requires the Noir compiler version matching `4.2.0-aztecnr-rc.2`. If the aztec-nr dependency at the new tag has breaking changes to the ECDSA account contract, the contract code may need updating.

- [ ] **Step 2: If compilation fails, check for aztec-nr API changes**

Common issues:
- Import path changes in aztec-nr modules
- New required methods on account contract interfaces
- Changed function signatures

Fix based on error messages and reference the aztec-packages repo at tag `v4.2.0-aztecnr-rc.2`.

- [ ] **Step 3: Commit fixes if needed**

```bash
git add contracts/ src/artifacts/ src/target/
git commit -m "fix: update noir contract for aztec-nr 4.2.0 compatibility"
```

---

## Summary of Breaking Changes

| Change | Version | Impact | Task |
|--------|---------|--------|------|
| Package versions | 4.0→4.2 | All @aztec/* deps | Task 1 |
| Noir tag | 4.0→4.2 | Contract compilation | Task 1, 17 |
| Vite optimizeDeps | 4.0→4.2 | Build config | Task 2 |
| Network URL | 4.0→4.1 | RPC endpoint | Task 3 |
| `simulate()` returns `{ result }` | 4.0→4.1 | Read/write execution | Tasks 4-6 |
| Gas estimation required | 4.0→4.1 | Write execution | Task 6 |
| Fee class renames (Metered→FPC) | 4.0→4.1 | Fee payment service | Task 7 |
| `@azguardwallet/*` → `@aztec/wallet-sdk` | 4.1→4.2 | Entire browser wallet layer | Tasks 8-14 |
| Two-phase connection (emoji verify) | 4.1→4.2 | Connect UX | Tasks 10, 12 |
| `hasWallet()` unified interface | 4.1→4.2 | Execution dispatch | Tasks 9, 13 |
