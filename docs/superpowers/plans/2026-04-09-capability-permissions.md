# Capability-Based Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement capability-based permission enforcement in the passkey wallet so dapps declare what operations they need, users review and approve at connect time, and a guard in the iframe enforces permissions on every RPC call.

**Architecture:** A `CapabilityGuard` middleware in `RPCHandler.ts` checks every incoming wallet method call against grants stored in memory. Grants come from the `AppCapabilities` manifest the dapp passes to `connect()`. The fused connect popup shows a permission review screen before the biometric. Out-of-scope operations trigger runtime prompts via bidirectional SecureChannel messaging (iframe asks SDK to open popup, SDK returns approval).

**Tech Stack:** TypeScript, React 18 (inline CSS-in-JS styles), `@aztec/aztec.js/wallet` types (`AppCapabilities`, `WalletCapabilities`, `ContractFunctionPattern`), Vitest for testing.

**Spec:** `docs/superpowers/specs/2026-04-09-capability-permissions-design.md`

---

### Task 1: PatternMatcher

Pure utility that matches a `{contract, function}` pair against `ContractFunctionPattern` arrays. Zero dependencies beyond Aztec address types.

**Files:**
- Create: `packages/passkey-wallet/src/host/capabilities/PatternMatcher.ts`
- Test: `packages/passkey-wallet/src/host/capabilities/__tests__/PatternMatcher.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/passkey-wallet/src/host/capabilities/__tests__/PatternMatcher.test.ts
import { describe, it, expect } from 'vitest';
import { matchesPattern, matchesScope } from '../PatternMatcher';

describe('matchesPattern', () => {
  const addr = '0x1f4b000000000000000000000000000000000000000000000000000000000001';

  it('matches exact contract + exact function', () => {
    expect(matchesPattern({ contract: addr, function: 'transfer' }, addr, 'transfer')).toBe(true);
  });

  it('rejects wrong function', () => {
    expect(matchesPattern({ contract: addr, function: 'transfer' }, addr, 'mint')).toBe(false);
  });

  it('rejects wrong contract', () => {
    const other = '0x2b68000000000000000000000000000000000000000000000000000000000002';
    expect(matchesPattern({ contract: addr, function: 'transfer' }, other, 'transfer')).toBe(false);
  });

  it('matches wildcard function', () => {
    expect(matchesPattern({ contract: addr, function: '*' }, addr, 'anything')).toBe(true);
  });

  it('matches wildcard contract', () => {
    const other = '0x0000000000000000000000000000000000000000000000000000000000000099';
    expect(matchesPattern({ contract: '*', function: 'transfer' }, other, 'transfer')).toBe(true);
  });

  it('matches double wildcard', () => {
    expect(matchesPattern({ contract: '*', function: '*' }, addr, 'anything')).toBe(true);
  });
});

describe('matchesScope', () => {
  const addr = '0x1f4b000000000000000000000000000000000000000000000000000000000001';

  it('global wildcard scope matches everything', () => {
    expect(matchesScope('*', addr, 'transfer')).toBe(true);
  });

  it('matches if any pattern in array matches', () => {
    const scope = [
      { contract: addr, function: 'transfer' },
      { contract: addr, function: 'mint' },
    ];
    expect(matchesScope(scope, addr, 'mint')).toBe(true);
  });

  it('rejects if no pattern matches', () => {
    const scope = [
      { contract: addr, function: 'transfer' },
    ];
    expect(matchesScope(scope, addr, 'burn')).toBe(false);
  });

  it('empty array matches nothing', () => {
    expect(matchesScope([], addr, 'transfer')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/passkey-wallet && npx vitest run src/host/capabilities/__tests__/PatternMatcher.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PatternMatcher**

```typescript
// packages/passkey-wallet/src/host/capabilities/PatternMatcher.ts

interface PatternLike {
  contract: string | { toString(): string };
  function: string;
}

/**
 * Check if a single ContractFunctionPattern matches a given contract + function.
 * Handles '*' wildcards for both contract and function.
 */
export function matchesPattern(
  pattern: PatternLike,
  contractAddress: string,
  functionName: string,
): boolean {
  const patternContract = typeof pattern.contract === 'string'
    ? pattern.contract
    : pattern.contract.toString();

  const contractMatch = patternContract === '*' || patternContract === contractAddress;
  const functionMatch = pattern.function === '*' || pattern.function === functionName;
  return contractMatch && functionMatch;
}

/**
 * Check if a scope (global '*' or pattern array) matches a contract + function.
 */
export function matchesScope(
  scope: '*' | PatternLike[],
  contractAddress: string,
  functionName: string,
): boolean {
  if (scope === '*') return true;
  return scope.some(p => matchesPattern(p, contractAddress, functionName));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/passkey-wallet && npx vitest run src/host/capabilities/__tests__/PatternMatcher.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/host/capabilities/PatternMatcher.ts packages/passkey-wallet/src/host/capabilities/__tests__/PatternMatcher.test.ts
git commit -m "feat(passkey-wallet): add PatternMatcher for capability scope matching"
```

---

### Task 2: CapabilityGuard

Core middleware that maps wallet methods to capability types and checks grants. Returns `'allowed'` or `'prompt'`. Uses PatternMatcher for scope checks.

**Files:**
- Create: `packages/passkey-wallet/src/host/capabilities/CapabilityGuard.ts`
- Test: `packages/passkey-wallet/src/host/capabilities/__tests__/CapabilityGuard.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/passkey-wallet/src/host/capabilities/__tests__/CapabilityGuard.test.ts
import { describe, it, expect } from 'vitest';
import { CapabilityGuard } from '../CapabilityGuard';

const TOKEN_ADDR = '0x1f4b000000000000000000000000000000000000000000000000000000000001';
const DRIP_ADDR = '0x2b68000000000000000000000000000000000000000000000000000000000002';

function makeGuard(capabilities: unknown[] = []) {
  return new CapabilityGuard(capabilities);
}

describe('CapabilityGuard', () => {
  describe('ungated methods', () => {
    it('allows getChainInfo with no grants', () => {
      const guard = makeGuard();
      expect(guard.check('getChainInfo')).toBe('allowed');
    });

    it('allows registerSender with no grants', () => {
      const guard = makeGuard();
      expect(guard.check('registerSender')).toBe('allowed');
    });
  });

  describe('no grants (no manifest)', () => {
    it('prompts for getAccounts', () => {
      const guard = makeGuard();
      expect(guard.check('getAccounts')).toBe('prompt');
    });

    it('prompts for simulateTx', () => {
      const guard = makeGuard();
      expect(guard.check('simulateTx', { contractAddress: TOKEN_ADDR, functionName: 'transfer' })).toBe('prompt');
    });

    it('prompts for sendTx', () => {
      const guard = makeGuard();
      expect(guard.check('sendTx', { contractAddress: TOKEN_ADDR, functionName: 'transfer' })).toBe('prompt');
    });
  });

  describe('accounts capability', () => {
    it('allows getAccounts when canGet is true', () => {
      const guard = makeGuard([{ type: 'accounts', canGet: true }]);
      expect(guard.check('getAccounts')).toBe('allowed');
    });

    it('prompts for getAccounts when canGet is false', () => {
      const guard = makeGuard([{ type: 'accounts', canGet: false }]);
      expect(guard.check('getAccounts')).toBe('prompt');
    });

    it('allows createAuthWit when canCreateAuthWit is true', () => {
      const guard = makeGuard([{ type: 'accounts', canCreateAuthWit: true }]);
      expect(guard.check('createAuthWit')).toBe('allowed');
    });
  });

  describe('simulation capability', () => {
    it('allows simulateTx within transaction scope', () => {
      const guard = makeGuard([{
        type: 'simulation',
        transactions: { scope: [{ contract: TOKEN_ADDR, function: 'balance_of_public' }] },
      }]);
      expect(guard.check('simulateTx', { contractAddress: TOKEN_ADDR, functionName: 'balance_of_public' })).toBe('allowed');
    });

    it('prompts for simulateTx outside scope', () => {
      const guard = makeGuard([{
        type: 'simulation',
        transactions: { scope: [{ contract: TOKEN_ADDR, function: 'balance_of_public' }] },
      }]);
      expect(guard.check('simulateTx', { contractAddress: TOKEN_ADDR, functionName: 'transfer' })).toBe('prompt');
    });

    it('allows executeUtility within utility scope', () => {
      const guard = makeGuard([{
        type: 'simulation',
        utilities: { scope: [{ contract: TOKEN_ADDR, function: 'balance_of_private' }] },
      }]);
      expect(guard.check('executeUtility', { contractAddress: TOKEN_ADDR, functionName: 'balance_of_private' })).toBe('allowed');
    });
  });

  describe('transaction capability', () => {
    it('allows sendTx within scope', () => {
      const guard = makeGuard([{
        type: 'transaction',
        scope: [{ contract: TOKEN_ADDR, function: 'transfer' }],
      }]);
      expect(guard.check('sendTx', { contractAddress: TOKEN_ADDR, functionName: 'transfer' })).toBe('allowed');
    });

    it('prompts for sendTx outside scope', () => {
      const guard = makeGuard([{
        type: 'transaction',
        scope: [{ contract: TOKEN_ADDR, function: 'transfer' }],
      }]);
      expect(guard.check('sendTx', { contractAddress: DRIP_ADDR, functionName: 'drip' })).toBe('prompt');
    });

    it('allows sendTx with global wildcard scope', () => {
      const guard = makeGuard([{ type: 'transaction', scope: '*' }]);
      expect(guard.check('sendTx', { contractAddress: DRIP_ADDR, functionName: 'anything' })).toBe('allowed');
    });
  });

  describe('contracts capability', () => {
    it('allows registerContract within address list', () => {
      const guard = makeGuard([{
        type: 'contracts',
        contracts: [TOKEN_ADDR],
        canRegister: true,
      }]);
      expect(guard.check('registerContract', { contractAddress: TOKEN_ADDR })).toBe('allowed');
    });

    it('prompts for registerContract outside address list', () => {
      const guard = makeGuard([{
        type: 'contracts',
        contracts: [TOKEN_ADDR],
        canRegister: true,
      }]);
      expect(guard.check('registerContract', { contractAddress: DRIP_ADDR })).toBe('prompt');
    });

    it('allows registerContract with wildcard', () => {
      const guard = makeGuard([{
        type: 'contracts',
        contracts: '*',
        canRegister: true,
      }]);
      expect(guard.check('registerContract', { contractAddress: DRIP_ADDR })).toBe('allowed');
    });
  });

  describe('data capability', () => {
    it('allows getAddressBook when granted', () => {
      const guard = makeGuard([{ type: 'data', addressBook: true }]);
      expect(guard.check('getAddressBook')).toBe('allowed');
    });

    it('allows getPrivateEvents within contract scope', () => {
      const guard = makeGuard([{
        type: 'data',
        privateEvents: { contracts: [TOKEN_ADDR] },
      }]);
      expect(guard.check('getPrivateEvents', { contractAddress: TOKEN_ADDR })).toBe('allowed');
    });

    it('prompts for getPrivateEvents outside scope', () => {
      const guard = makeGuard([{
        type: 'data',
        privateEvents: { contracts: [TOKEN_ADDR] },
      }]);
      expect(guard.check('getPrivateEvents', { contractAddress: DRIP_ADDR })).toBe('prompt');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/passkey-wallet && npx vitest run src/host/capabilities/__tests__/CapabilityGuard.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CapabilityGuard**

```typescript
// packages/passkey-wallet/src/host/capabilities/CapabilityGuard.ts
import { matchesScope } from './PatternMatcher';

/** Ungated methods — always allowed regardless of grants. */
const UNGATED_METHODS = new Set(['getChainInfo', 'registerSender']);

/** Payload shape expected by the guard for scope checks. */
export interface GuardPayload {
  contractAddress?: string;
  functionName?: string;
  classId?: string;
}

/**
 * Capability enforcement middleware.
 * Constructed with granted capabilities after connect.
 * check() returns 'allowed' or 'prompt' for every incoming wallet method.
 */
export class CapabilityGuard {
  constructor(private capabilities: unknown[] = []) {}

  check(method: string, payload?: GuardPayload): 'allowed' | 'prompt' {
    if (UNGATED_METHODS.has(method)) return 'allowed';

    switch (method) {
      case 'getAccounts':
        return this.checkBoolean('accounts', 'canGet');
      case 'createAuthWit':
        return this.checkBoolean('accounts', 'canCreateAuthWit');
      case 'registerContract':
        return this.checkContracts('canRegister', payload?.contractAddress);
      case 'getContractMetadata':
        return this.checkContracts('canGetMetadata', payload?.contractAddress);
      case 'getContractClassMetadata':
        return this.checkContractClasses(payload?.classId);
      case 'simulateTx':
      case 'profileTx':
        return this.checkSimulation('transactions', payload);
      case 'executeUtility':
        return this.checkSimulation('utilities', payload);
      case 'sendTx':
        return this.checkTransaction(payload);
      case 'getAddressBook':
        return this.checkBoolean('data', 'addressBook');
      case 'getPrivateEvents':
        return this.checkDataEvents(payload?.contractAddress);
      default:
        return 'prompt';
    }
  }

  private findCapability(type: string): Record<string, unknown> | undefined {
    return this.capabilities.find(
      (c: any) => c.type === type,
    ) as Record<string, unknown> | undefined;
  }

  private checkBoolean(capType: string, field: string): 'allowed' | 'prompt' {
    const cap = this.findCapability(capType);
    return cap && cap[field] === true ? 'allowed' : 'prompt';
  }

  private checkContracts(field: string, contractAddress?: string): 'allowed' | 'prompt' {
    const cap = this.findCapability('contracts');
    if (!cap || cap[field] !== true) return 'prompt';
    if (!contractAddress) return 'prompt';
    const contracts = cap.contracts as string | string[];
    if (contracts === '*') return 'allowed';
    if (Array.isArray(contracts)) {
      const addrStr = (addr: unknown) => typeof addr === 'string' ? addr : String(addr);
      return contracts.some(c => addrStr(c) === contractAddress) ? 'allowed' : 'prompt';
    }
    return 'prompt';
  }

  private checkContractClasses(classId?: string): 'allowed' | 'prompt' {
    const cap = this.findCapability('contractClasses');
    if (!cap || (cap as any).canGetMetadata !== true) return 'prompt';
    if (!classId) return 'prompt';
    const classes = (cap as any).classes as string | string[];
    if (classes === '*') return 'allowed';
    if (Array.isArray(classes)) {
      const idStr = (id: unknown) => typeof id === 'string' ? id : String(id);
      return classes.some(c => idStr(c) === classId) ? 'allowed' : 'prompt';
    }
    return 'prompt';
  }

  private checkSimulation(
    subType: 'transactions' | 'utilities',
    payload?: GuardPayload,
  ): 'allowed' | 'prompt' {
    const cap = this.findCapability('simulation');
    if (!cap) return 'prompt';
    const sub = (cap as any)[subType];
    if (!sub?.scope) return 'prompt';
    if (!payload?.contractAddress || !payload?.functionName) return 'prompt';
    return matchesScope(sub.scope, payload.contractAddress, payload.functionName);
  }

  private checkTransaction(payload?: GuardPayload): 'allowed' | 'prompt' {
    const cap = this.findCapability('transaction');
    if (!cap) return 'prompt';
    const scope = (cap as any).scope;
    if (!scope) return 'prompt';
    if (!payload?.contractAddress || !payload?.functionName) return 'prompt';
    return matchesScope(scope, payload.contractAddress, payload.functionName);
  }

  private checkDataEvents(contractAddress?: string): 'allowed' | 'prompt' {
    const cap = this.findCapability('data');
    if (!cap) return 'prompt';
    const pe = (cap as any).privateEvents;
    if (!pe) return 'prompt';
    if (!contractAddress) return 'prompt';
    const contracts = pe.contracts as string | string[];
    if (contracts === '*') return 'allowed';
    if (Array.isArray(contracts)) {
      const addrStr = (addr: unknown) => typeof addr === 'string' ? addr : String(addr);
      return contracts.some(c => addrStr(c) === contractAddress) ? 'allowed' : 'prompt';
    }
    return 'prompt';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/passkey-wallet && npx vitest run src/host/capabilities/__tests__/CapabilityGuard.test.ts`
Expected: All 18 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/host/capabilities/CapabilityGuard.ts packages/passkey-wallet/src/host/capabilities/__tests__/CapabilityGuard.test.ts
git commit -m "feat(passkey-wallet): add CapabilityGuard for permission enforcement"
```

---

### Task 3: PermissionDisplay

Transforms raw `AppCapabilities` into grouped-by-contract UI data for the popup. Pure function, no React.

**Files:**
- Create: `packages/passkey-wallet/src/host/capabilities/PermissionDisplay.ts`
- Test: `packages/passkey-wallet/src/host/capabilities/__tests__/PermissionDisplay.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/passkey-wallet/src/host/capabilities/__tests__/PermissionDisplay.test.ts
import { describe, it, expect } from 'vitest';
import { transformCapabilities, prettifyFunctionName, abbreviateAddress } from '../PermissionDisplay';

const TOKEN = '0x1f4b000000000000000000000000000000000000000000000000000000000001';
const DRIPPER = '0x2b68000000000000000000000000000000000000000000000000000000000002';

describe('prettifyFunctionName', () => {
  it('converts snake_case to Title Case', () => {
    expect(prettifyFunctionName('balance_of_private')).toBe('Balance of Private');
  });

  it('handles single word', () => {
    expect(prettifyFunctionName('transfer')).toBe('Transfer');
  });

  it('handles already capitalized', () => {
    expect(prettifyFunctionName('Transfer')).toBe('Transfer');
  });
});

describe('abbreviateAddress', () => {
  it('abbreviates long addresses', () => {
    expect(abbreviateAddress(TOKEN)).toBe('0x1f4b...0001');
  });

  it('returns short strings as-is', () => {
    expect(abbreviateAddress('0x1234')).toBe('0x1234');
  });
});

describe('transformCapabilities', () => {
  it('returns empty result for empty capabilities', () => {
    const result = transformCapabilities([]);
    expect(result.accountAccess).toBeUndefined();
    expect(result.contractRegistration).toBeUndefined();
    expect(result.contractGroups).toEqual([]);
    expect(result.wildcardFunctions).toEqual([]);
  });

  it('extracts account access', () => {
    const result = transformCapabilities([
      { type: 'accounts', canGet: true, canCreateAuthWit: true },
    ]);
    expect(result.accountAccess).toEqual({ canGet: true, canCreateAuthWit: true });
  });

  it('groups reads and writes by contract', () => {
    const result = transformCapabilities([
      {
        type: 'simulation',
        transactions: { scope: [{ contract: TOKEN, function: 'balance_of_public' }] },
        utilities: { scope: [{ contract: TOKEN, function: 'balance_of_private' }] },
      },
      {
        type: 'transaction',
        scope: [{ contract: TOKEN, function: 'transfer' }],
      },
    ]);

    expect(result.contractGroups).toHaveLength(1);
    const group = result.contractGroups[0];
    expect(group.fullAddress).toBe(TOKEN);
    expect(group.reads).toContain('Balance of Public');
    expect(group.reads).toContain('Balance of Private');
    expect(group.writes).toContain('Transfer');
  });

  it('separates wildcard patterns', () => {
    const result = transformCapabilities([
      {
        type: 'transaction',
        scope: [
          { contract: TOKEN, function: 'transfer' },
          { contract: '*', function: 'constructor' },
        ],
      },
    ]);

    expect(result.contractGroups).toHaveLength(1);
    expect(result.wildcardFunctions).toContain('Constructor');
  });

  it('handles global wildcard scope', () => {
    const result = transformCapabilities([
      { type: 'transaction', scope: '*' },
    ]);
    expect(result.wildcardFunctions).toContain('All Functions');
  });

  it('extracts contract registration info', () => {
    const result = transformCapabilities([
      { type: 'contracts', contracts: [TOKEN, DRIPPER], canRegister: true, canGetMetadata: true },
    ]);
    expect(result.contractRegistration).toEqual({
      contracts: [TOKEN, DRIPPER],
      count: 2,
    });
  });

  it('groups multiple contracts correctly', () => {
    const result = transformCapabilities([
      {
        type: 'simulation',
        transactions: { scope: [
          { contract: TOKEN, function: 'balance_of_public' },
          { contract: DRIPPER, function: 'drip' },
        ]},
      },
      {
        type: 'transaction',
        scope: [{ contract: TOKEN, function: 'transfer' }],
      },
    ]);

    expect(result.contractGroups).toHaveLength(2);
    const tokenGroup = result.contractGroups.find(g => g.fullAddress === TOKEN);
    const dripperGroup = result.contractGroups.find(g => g.fullAddress === DRIPPER);
    expect(tokenGroup?.reads).toContain('Balance of Public');
    expect(tokenGroup?.writes).toContain('Transfer');
    expect(dripperGroup?.reads).toContain('Drip');
    expect(dripperGroup?.writes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/passkey-wallet && npx vitest run src/host/capabilities/__tests__/PermissionDisplay.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PermissionDisplay**

```typescript
// packages/passkey-wallet/src/host/capabilities/PermissionDisplay.ts

export interface ContractGroup {
  address: string;
  fullAddress: string;
  reads: string[];
  writes: string[];
}

export interface PermissionDisplayData {
  accountAccess?: { canGet: boolean; canCreateAuthWit: boolean };
  contractRegistration?: { contracts: unknown[] | '*'; count: number };
  contractGroups: ContractGroup[];
  wildcardFunctions: string[];
}

export function prettifyFunctionName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function abbreviateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function addToGroup(
  groups: Map<string, { reads: Set<string>; writes: Set<string> }>,
  address: string,
  category: 'reads' | 'writes',
  functionName: string,
) {
  if (!groups.has(address)) {
    groups.set(address, { reads: new Set(), writes: new Set() });
  }
  groups.get(address)![category].add(prettifyFunctionName(functionName));
}

function collectPatterns(
  scope: unknown,
  groups: Map<string, { reads: Set<string>; writes: Set<string> }>,
  wildcards: Set<string>,
  category: 'reads' | 'writes',
) {
  if (scope === '*') {
    wildcards.add('All Functions');
    return;
  }
  if (!Array.isArray(scope)) return;
  for (const pattern of scope) {
    const contract = typeof pattern.contract === 'string' ? pattern.contract : String(pattern.contract);
    const fn = pattern.function as string;
    if (contract === '*') {
      wildcards.add(prettifyFunctionName(fn));
    } else {
      addToGroup(groups, contract, category, fn);
    }
  }
}

export function transformCapabilities(capabilities: unknown[]): PermissionDisplayData {
  const groups = new Map<string, { reads: Set<string>; writes: Set<string> }>();
  const wildcards = new Set<string>();
  let accountAccess: PermissionDisplayData['accountAccess'];
  let contractRegistration: PermissionDisplayData['contractRegistration'];

  for (const cap of capabilities) {
    const c = cap as Record<string, unknown>;

    switch (c.type) {
      case 'accounts':
        accountAccess = {
          canGet: c.canGet === true,
          canCreateAuthWit: c.canCreateAuthWit === true,
        };
        break;

      case 'contracts': {
        const contracts = c.contracts as unknown[] | '*';
        contractRegistration = {
          contracts,
          count: contracts === '*' ? -1 : contracts.length,
        };
        break;
      }

      case 'simulation': {
        const txs = c.transactions as { scope: unknown } | undefined;
        const utils = c.utilities as { scope: unknown } | undefined;
        if (txs?.scope) collectPatterns(txs.scope, groups, wildcards, 'reads');
        if (utils?.scope) collectPatterns(utils.scope, groups, wildcards, 'reads');
        break;
      }

      case 'transaction': {
        collectPatterns(c.scope, groups, wildcards, 'writes');
        break;
      }
    }
  }

  const contractGroups: ContractGroup[] = Array.from(groups.entries()).map(
    ([address, { reads, writes }]) => ({
      address: abbreviateAddress(address),
      fullAddress: address,
      reads: Array.from(reads),
      writes: Array.from(writes),
    }),
  );

  return {
    accountAccess,
    contractRegistration,
    contractGroups,
    wildcardFunctions: Array.from(wildcards),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/passkey-wallet && npx vitest run src/host/capabilities/__tests__/PermissionDisplay.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/host/capabilities/PermissionDisplay.ts packages/passkey-wallet/src/host/capabilities/__tests__/PermissionDisplay.test.ts
git commit -m "feat(passkey-wallet): add PermissionDisplay for capability UI transformation"
```

---

### Task 4: Shared Types Update

Add capability manifest to the connect flow types. Add new popup flow types for runtime prompts.

**Files:**
- Modify: `packages/passkey-wallet/src/shared/types.ts`

- [ ] **Step 1: Update PopupFlow type to include runtime-prompt**

In `packages/passkey-wallet/src/shared/types.ts`, change line 65:

```typescript
// Before:
export type PopupFlow = 'connect' | 'sign' | 'read';

// After:
export type PopupFlow = 'connect' | 'sign' | 'read' | 'runtime-prompt';
```

- [ ] **Step 2: Add runtime prompt response types to PopupResponse**

In `packages/passkey-wallet/src/shared/types.ts`, after line 63 (`| { type: 'read-cancelled' };`), add:

```typescript
  | { type: 'prompt-approved' }
  | { type: 'prompt-denied' };
```

- [ ] **Step 3: Add RuntimePromptSummary type**

In `packages/passkey-wallet/src/shared/types.ts`, after the `ReadSummary` interface (after line 78), add:

```typescript
export interface RuntimePromptSummary {
  /** The wallet method being called */
  methodName: string;
  /** Contract address (if applicable) */
  contractAddress?: string;
  /** Function name (if applicable) */
  functionName?: string;
  /** Origin of the requesting dapp */
  dappOrigin: string;
  /** Whether this is a read or write operation */
  operationType: 'read' | 'write';
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/shared/types.ts
git commit -m "feat(passkey-wallet): add capability types to shared popup types"
```

---

### Task 5: PermissionReview Popup Component

New React component for the permission review screen shown during connect. Uses inline CSS-in-JS styles (same pattern as ConnectFlow, SignFlow, ReadFlow — no Tailwind in popup).

**Files:**
- Create: `packages/passkey-wallet/src/popup/PermissionReview.tsx`
- Modify: `packages/passkey-wallet/src/popup/styles.ts` (add permission styles)

- [ ] **Step 1: Add permission review styles to styles.ts**

In `packages/passkey-wallet/src/popup/styles.ts`, after the `infoStyles` block (after line 424), add:

```typescript
/* ---------------------------------------------------------------------------
   PERMISSION REVIEW
   --------------------------------------------------------------------------- */

export const permissionStyles = {
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  } as CSSProperties,

  permissionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    marginBottom: '6px',
  } as CSSProperties,

  permissionIcon: {
    fontSize: '16px',
    flexShrink: 0,
  } as CSSProperties,

  permissionTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  } as CSSProperties,

  permissionDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  } as CSSProperties,

  contractCard: {
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    marginBottom: '6px',
  } as CSSProperties,

  contractHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  } as CSSProperties,

  contractAddress: {
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    color: 'var(--text-primary)',
  } as CSSProperties,

  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
    paddingLeft: '28px',
  } as CSSProperties,

  readBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  } as CSSProperties,

  writeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  } as CSSProperties,

  functionList: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  } as CSSProperties,

  warningBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '12px',
  } as CSSProperties,

  approveButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 85%, black) 100%)',
    color: 'var(--button-text)',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 2px 8px var(--shadow-color)',
    border: 'none',
    cursor: 'pointer',
  } as CSSProperties,

  warningApproveButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  } as CSSProperties,
};
```

- [ ] **Step 2: Create PermissionReview component**

```typescript
// packages/passkey-wallet/src/popup/PermissionReview.tsx
import { Shield, FileText, Globe as GlobeIcon, Users } from 'lucide-react';
import {
  transformCapabilities,
  type PermissionDisplayData,
} from '../host/capabilities/PermissionDisplay';
import {
  layoutStyles,
  headerStyles,
  originStyles,
  buttonStyles,
  permissionStyles,
} from './styles';

const styles = {
  shell: layoutStyles.shell,
  card: { ...layoutStyles.card, maxHeight: '90vh', overflowY: 'auto' } as React.CSSProperties,
  section: layoutStyles.section,
  headerRow: headerStyles.row,
  logoWrap: headerStyles.logoWrap,
  logoText: headerStyles.logoText,
  wordmark: headerStyles.wordmark,
  originWrap: originStyles.wrap,
  originLabel: originStyles.label,
  originBadge: originStyles.badge,
  rejectButton: buttonStyles.danger,
  ...permissionStyles,
} as const;

interface PermissionReviewProps {
  manifest: { metadata: { name: string; url?: string }; capabilities: unknown[] };
  onApprove: () => void;
  onReject: () => void;
}

export function PermissionReview({ manifest, onApprove, onReject }: PermissionReviewProps) {
  const display = transformCapabilities(manifest.capabilities);

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.headerRow}>
          <div style={styles.logoWrap} aria-hidden="true">
            <span style={styles.logoText}>A</span>
          </div>
          <span style={styles.wordmark}>Aztec Wallet</span>
        </div>

        {/* App info */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {manifest.metadata.name}
          </h1>
          {manifest.metadata.url && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {manifest.metadata.url}
            </p>
          )}
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            wants to connect to your wallet
          </p>
        </div>

        {/* Requested permissions label */}
        <div style={styles.sectionLabel}>Requested Permissions</div>

        {/* Account access */}
        {display.accountAccess && (
          <div style={styles.permissionRow}>
            <span style={styles.permissionIcon}><Users size={16} /></span>
            <div>
              <div style={styles.permissionTitle}>Account Access</div>
              <div style={styles.permissionDesc}>
                {[
                  display.accountAccess.canGet && 'View accounts',
                  display.accountAccess.canCreateAuthWit && 'Create auth witnesses',
                ].filter(Boolean).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Per-contract groups */}
        {display.contractGroups.map((group) => (
          <div key={group.fullAddress} style={styles.contractCard}>
            <div style={styles.contractHeader}>
              <span style={styles.permissionIcon}><FileText size={16} /></span>
              <div>
                <div style={styles.contractAddress}>{group.address}</div>
              </div>
            </div>
            {group.reads.length > 0 && (
              <div style={styles.badgeRow}>
                <span style={styles.readBadge}>READ</span>
                <span style={styles.functionList}>{group.reads.join(', ')}</span>
              </div>
            )}
            {group.writes.length > 0 && (
              <div style={styles.badgeRow}>
                <span style={styles.writeBadge}>WRITE</span>
                <span style={styles.functionList}>{group.writes.join(', ')}</span>
              </div>
            )}
          </div>
        ))}

        {/* Wildcard functions */}
        {display.wildcardFunctions.length > 0 && (
          <div style={styles.permissionRow}>
            <span style={styles.permissionIcon}><GlobeIcon size={16} /></span>
            <div>
              <div style={styles.permissionTitle}>Any Contract</div>
              <div style={styles.permissionDesc}>{display.wildcardFunctions.join(', ')}</div>
            </div>
          </div>
        )}

        {/* Contract registration */}
        {display.contractRegistration && (
          <div style={styles.permissionRow}>
            <span style={styles.permissionIcon}><Shield size={16} /></span>
            <div>
              <div style={styles.permissionTitle}>Contract Registration</div>
              <div style={styles.permissionDesc}>
                {display.contractRegistration.contracts === '*'
                  ? 'Register any contract'
                  : `Register ${display.contractRegistration.count} contract${display.contractRegistration.count !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ ...styles.section, marginTop: '16px' }}>
          <button type="button" onClick={onApprove} style={styles.approveButton}>
            <Shield size={16} strokeWidth={2} aria-hidden="true" />
            <span>Approve & Continue</span>
          </button>
          <button type="button" onClick={onReject} style={styles.rejectButton}>
            <span>Reject</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/popup/PermissionReview.tsx packages/passkey-wallet/src/popup/styles.ts
git commit -m "feat(passkey-wallet): add PermissionReview popup component"
```

---

### Task 6: RuntimePrompt Popup Component

Popup component for out-of-scope operations. Shows "NOT PRE-APPROVED" warning + operation details.

**Files:**
- Create: `packages/passkey-wallet/src/popup/RuntimePrompt.tsx`

- [ ] **Step 1: Create RuntimePrompt component**

```typescript
// packages/passkey-wallet/src/popup/RuntimePrompt.tsx
import { AlertTriangle, CheckCircle, X, Globe } from 'lucide-react';
import { prettifyFunctionName, abbreviateAddress } from '../host/capabilities/PermissionDisplay';
import type { PopupResponse, RuntimePromptSummary } from '../shared/types';
import {
  layoutStyles,
  headerStyles,
  originStyles,
  detailCardStyles,
  buttonStyles,
  permissionStyles,
} from './styles';

const styles = {
  shell: layoutStyles.shell,
  card: layoutStyles.card,
  section: layoutStyles.section,
  headerRow: headerStyles.row,
  logoWrap: headerStyles.logoWrap,
  logoText: headerStyles.logoText,
  wordmark: headerStyles.wordmark,
  originWrap: originStyles.wrap,
  originLabel: originStyles.label,
  originBadge: originStyles.badge,
  detailCard: detailCardStyles.card,
  detailRow: detailCardStyles.row,
  detailLabel: detailCardStyles.label,
  detailValue: detailCardStyles.value,
  readBadge: permissionStyles.readBadge,
  writeBadge: permissionStyles.writeBadge,
  warningBadge: permissionStyles.warningBadge,
  approveButton: buttonStyles.primary,
  warningApproveButton: permissionStyles.warningApproveButton,
  rejectButton: buttonStyles.danger,
} as const;

interface RuntimePromptProps {
  summary: RuntimePromptSummary;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

export function RuntimePrompt({ summary, onComplete, onCancel }: RuntimePromptProps) {
  const isWrite = summary.operationType === 'write';
  const handleApprove = () => onComplete({ type: 'prompt-approved' });
  const handleDeny = () => onComplete({ type: 'prompt-denied' });

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.headerRow}>
          <div style={styles.logoWrap} aria-hidden="true">
            <span style={styles.logoText}>A</span>
          </div>
          <span style={styles.wordmark}>Aztec Wallet</span>
        </div>

        {/* Warning badge */}
        <div style={{ textAlign: 'center' }}>
          <span style={styles.warningBadge}>
            <AlertTriangle size={12} />
            NOT PRE-APPROVED
          </span>
        </div>

        {/* Origin */}
        <div style={styles.originWrap}>
          <span style={styles.originLabel}>Requested by</span>
          <span style={styles.originBadge}>
            <Globe size={10} strokeWidth={2} aria-hidden="true" />
            {summary.dappOrigin}
          </span>
        </div>

        {/* Operation details */}
        <div style={styles.detailCard}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Operation</span>
            <span style={isWrite ? styles.writeBadge : styles.readBadge}>
              {isWrite ? 'WRITE' : 'READ'}
            </span>
          </div>
          {summary.functionName && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Function</span>
              <span style={styles.detailValue}>{prettifyFunctionName(summary.functionName)}</span>
            </div>
          )}
          {summary.contractAddress && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Contract</span>
              <span style={styles.detailValue}>{abbreviateAddress(summary.contractAddress)}</span>
            </div>
          )}
          {isWrite && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              This operation was not in the app's permission request. Biometric confirmation required.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ ...styles.section, marginTop: '16px' }}>
          <button type="button" onClick={handleApprove} style={isWrite ? styles.warningApproveButton : styles.approveButton}>
            <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
            <span>{isWrite ? 'Approve & Sign' : 'Allow'}</span>
          </button>
          <button type="button" onClick={handleDeny} style={styles.rejectButton}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
            <span>Deny</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/popup/RuntimePrompt.tsx
git commit -m "feat(passkey-wallet): add RuntimePrompt popup component"
```

---

### Task 7: ConnectFlow + PopupShell Integration

Modify ConnectFlow to add a permission review step before biometric. Modify PopupShell to parse the manifest from URL params and route the runtime-prompt flow.

**Files:**
- Modify: `packages/passkey-wallet/src/popup/ConnectFlow.tsx`
- Modify: `packages/passkey-wallet/src/popup/PopupShell.tsx`

- [ ] **Step 1: Add manifest prop and review step to ConnectFlow**

In `packages/passkey-wallet/src/popup/ConnectFlow.tsx`:

Add import at top (after line 12):
```typescript
import { PermissionReview } from './PermissionReview';
```

Update the props interface (replace lines 66-71):
```typescript
interface ConnectFlowProps {
  credentialId?: ArrayBuffer;
  rpId?: string;
  manifest?: { metadata: { name: string; url?: string }; capabilities: unknown[] };
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}
```

Update the component to add review state (replace line 77-81):
```typescript
export function ConnectFlow({ credentialId, rpId, manifest, onComplete, onCancel }: ConnectFlowProps) {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionsApproved, setPermissionsApproved] = useState(!manifest);
  const isReturningUser = !!credentialId;
  const isAuthenticating = status === 'authenticating';
```

Before the return statement (before line 179), add the permission review gate:
```typescript
  // Show permission review first if manifest was provided and not yet approved
  if (!permissionsApproved && manifest) {
    return (
      <PermissionReview
        manifest={manifest}
        onApprove={() => setPermissionsApproved(true)}
        onReject={onCancel}
      />
    );
  }
```

- [ ] **Step 2: Update PopupShell to parse manifest and route runtime-prompt**

In `packages/passkey-wallet/src/popup/PopupShell.tsx`:

Add import (after line 10):
```typescript
import { RuntimePrompt } from './RuntimePrompt';
import type { RuntimePromptSummary } from '../shared/types';
```

Add manifest state (after line 24):
```typescript
const [manifest, setManifest] = useState<{ metadata: { name: string; url?: string }; capabilities: unknown[] } | undefined>();
```

In the useEffect URL parsing block (after line 56, the `contextParam` parsing), add:
```typescript
    const manifestParam = params.get('manifest');
    if (manifestParam) {
      try { setManifest(JSON.parse(atob(manifestParam))); } catch { /* ignore */ }
    }
```

Pass manifest to ConnectFlow (replace lines 88-94):
```typescript
    case 'connect':
      return (
        <ConnectFlow
          rpId={rpId}
          manifest={manifest}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
```

Add runtime-prompt case (after the `'read'` case, before the closing `}`):
```typescript
    case 'runtime-prompt':
      return (
        <RuntimePrompt
          summary={context as RuntimePromptSummary}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/popup/ConnectFlow.tsx packages/passkey-wallet/src/popup/PopupShell.tsx
git commit -m "feat(passkey-wallet): integrate permission review into connect flow"
```

---

### Task 8: PopupManager + SDK connect() Modification

Update PopupManager to pass manifest param. Update `createPasskeyWallet.connect()` to accept manifest and return `WalletCapabilities`. Register runtime-prompt handler on the SDK side of SecureChannel.

**Files:**
- Modify: `packages/passkey-wallet/src/sdk/PopupManager.ts`
- Modify: `packages/passkey-wallet/src/sdk/createPasskeyWallet.ts`

- [ ] **Step 1: Update PopupManager to accept manifest**

In `packages/passkey-wallet/src/sdk/PopupManager.ts`, update the `openPopup` method signature (replace lines 26-30):

```typescript
  openPopup(
    flow: PopupFlow,
    context?: TxSummary | ReadSummary | RuntimePromptSummary,
    credentialId?: string,
    manifest?: unknown,
  ): Promise<PopupResponse> {
```

Add import for `RuntimePromptSummary` (update line 1):
```typescript
import type { PopupFlow, PopupResponse, TxSummary, ReadSummary, RuntimePromptSummary } from '../shared/types';
```

Add manifest to URL params (after line 39, the context line):
```typescript
    if (manifest) url.searchParams.set('manifest', btoa(JSON.stringify(manifest)));
```

- [ ] **Step 2: Update createPasskeyWallet connect() to accept manifest**

In `packages/passkey-wallet/src/sdk/createPasskeyWallet.ts`:

Update the import (replace line 2):
```typescript
import type { PasskeyWalletConfig, PopupResponse, RuntimePromptSummary } from '../shared/types';
```

Update connect() signature and return type (replace lines 42-43):
```typescript
  async connect(manifest?: unknown): Promise<{ wallet: Wallet; capabilities: unknown }> {
    if (this.wallet) return { wallet: this.wallet, capabilities: this.buildCapabilitiesResponse(manifest) };
    this._isConnecting = true;
```

Pass manifest to popup (replace lines 52-56):
```typescript
      const popupResultPromise = this.popupManager.openPopup(
        'connect',
        undefined,
        storedCredentialId ?? undefined,
        manifest,
      );
```

Send manifest alongside initWithKeys (replace line 75):
```typescript
      const result = (await this.pxeProxy.call('initWithKeys', [popupResponse, manifest])) as { address: string };
```

Register runtime-prompt handler on the SDK-side SecureChannel. Replace lines 76-79 with:
```typescript
      this._address = result.address;

      // Register SDK-side handler for runtime prompt requests from iframe
      channel.onRequest(async (method: string, params: unknown[]) => {
        if (method === 'runtime-prompt') {
          const summary = params[0] as RuntimePromptSummary;
          const response = await this.popupManager.openPopup('runtime-prompt', summary);
          return response.type === 'prompt-approved';
        }
        throw new Error(`Unknown SDK request: ${method}`);
      });

      this.wallet = createWalletProxy(channel);
      return { wallet: this.wallet, capabilities: this.buildCapabilitiesResponse(manifest) };
```

Add helper method to build WalletCapabilities (after the `disconnect` method, before `getWallet`):
```typescript
  private buildCapabilitiesResponse(manifest?: unknown): unknown {
    if (!manifest || typeof manifest !== 'object') {
      return { version: '1.0', granted: [], wallet: { name: 'Passkey Wallet', version: '1.0.0' } };
    }
    // v1: grant exactly what was requested (no narrowing)
    const m = manifest as { capabilities?: unknown[] };
    return {
      version: '1.0',
      granted: m.capabilities ?? [],
      wallet: { name: 'Passkey Wallet', version: '1.0.0' },
    };
  }
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/sdk/PopupManager.ts packages/passkey-wallet/src/sdk/createPasskeyWallet.ts
git commit -m "feat(passkey-wallet): connect() accepts manifest, SDK handles runtime prompts"
```

---

### Task 9: RPCHandler Integration

Insert CapabilityGuard middleware into RPCHandler. Use bidirectional SecureChannel to request runtime prompts from the SDK when guard returns `'prompt'`.

**Files:**
- Modify: `packages/passkey-wallet/src/host/RPCHandler.ts`

- [ ] **Step 1: Update RPCHandler to create guard and intercept wallet calls**

Replace the full content of `packages/passkey-wallet/src/host/RPCHandler.ts`:

```typescript
import type { SecureChannel } from '../shared/SecureChannel';
import type { PopupResponse } from '../shared/types';
import type { PXEManager } from './PXEManager';
import type { CredentialStore } from './CredentialStore';
import { fromBase64 } from '../shared/encoding';
import { CapabilityGuard, type GuardPayload } from './capabilities/CapabilityGuard';

/** Methods that are write operations (need biometric regardless of scope). */
const WRITE_METHODS = new Set(['sendTx', 'createAuthWit']);

/**
 * Processes RPC messages from the SDK over the SecureChannel.
 *
 * - initWithKeys: receives passkey-derived keys + capability manifest, initializes PXE Worker
 * - disconnect: tears down PXE Worker, clears grants
 * - wallet methods: checked against CapabilityGuard before forwarding to Worker
 * - All other methods: forwarded to the PXE Worker
 */
export class RPCHandler {
  // TIER-2-UPGRADE: Remove signingKey field.
  private signingKey: Uint8Array | null = null;
  private guard: CapabilityGuard = new CapabilityGuard();
  private channel: SecureChannel | null = null;

  constructor(
    private pxeManager: PXEManager,
    private credentialStore: CredentialStore,
    private contractConfigs: any[],
    private nodeUrl: string,
  ) {}

  register(channel: SecureChannel): void {
    this.channel = channel;

    channel.onRequest(async (method, params) => {
      try {
        if (method === 'initWithKeys') return await this.handleInitWithKeys(params[0] as PopupResponse, params[1]);
        if (method === 'disconnect') return await this.handleDisconnect();

        // Wallet method calls: params = [walletMethodName, serializedArgs]
        if (method === 'wallet') {
          if (!this.pxeManager.isInitialized()) {
            throw new Error('Wallet not initialized. Call connect() first.');
          }
          const walletMethod = params[0] as string;
          const serializedArgs = params[1] as string;

          // Extract payload info for guard check
          const payload = this.extractPayload(walletMethod, serializedArgs);

          // Capability guard check
          const decision = this.guard.check(walletMethod, payload);
          if (decision === 'prompt') {
            const approved = await this.requestRuntimePrompt(walletMethod, payload);
            if (!approved) throw new Error('User denied: operation not authorized');
          }

          return this.pxeManager.callWallet(walletMethod, serializedArgs);
        }

        // All other methods are forwarded to the PXE Worker
        if (!this.pxeManager.isInitialized()) {
          throw new Error('PXE not initialized. Call connect() first.');
        }
        return this.pxeManager.callPXE(method, params);
      } catch (err) {
        console.error(`[RPCHandler] Error in ${method}:`, err);
        throw err;
      }
    });
  }

  /**
   * Extract contract address and function name from serialized wallet call args.
   * Best-effort parsing — returns partial payload if extraction fails.
   */
  private extractPayload(method: string, serializedArgs: string): GuardPayload {
    try {
      const parsed = JSON.parse(serializedArgs);
      // Wallet method args vary by method. For tx-related methods, the first arg
      // is typically an ExecutionPayload-like object with calls[].
      // For simpler methods like registerContract, args are positional.
      // This is a best-effort extraction — the guard falls back to 'prompt' if missing.
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        // ExecutionPayload shape: { calls: [{ to, functionSelector, ... }] }
        if (first?.calls && Array.isArray(first.calls) && first.calls.length > 0) {
          const call = first.calls[0];
          return {
            contractAddress: call.to?.toString?.() ?? call.to,
            functionName: call.name ?? call.functionName,
          };
        }
        // registerContract: first arg is the contract instance with address
        if (first?.address) {
          return { contractAddress: first.address.toString?.() ?? first.address };
        }
        // Simple address arg (getContractMetadata, getPrivateEvents)
        if (typeof first === 'string' && first.startsWith('0x')) {
          return { contractAddress: first };
        }
      }
    } catch {
      // JSON parse failed — return empty payload, guard will default to 'prompt'
    }
    return {};
  }

  /**
   * Send a runtime prompt request to the SDK via the bidirectional SecureChannel.
   * The SDK opens a popup for the user to approve/deny.
   */
  private async requestRuntimePrompt(method: string, payload: GuardPayload): Promise<boolean> {
    if (!this.channel) return false;
    try {
      const isWrite = WRITE_METHODS.has(method);
      const result = await this.channel.send('runtime-prompt', [{
        methodName: method,
        contractAddress: payload.contractAddress,
        functionName: payload.functionName,
        dappOrigin: window.location.origin,
        operationType: isWrite ? 'write' : 'read',
      }]);
      return result === true;
    } catch {
      return false;
    }
  }

  private async handleInitWithKeys(authKeys: PopupResponse, manifest?: unknown): Promise<{ address: string }> {
    if (authKeys.type !== 'auth-keys') {
      throw new Error(`Expected auth-keys, got: ${authKeys.type}`);
    }

    // Store capability grants from manifest
    if (manifest && typeof manifest === 'object' && 'capabilities' in manifest) {
      this.guard = new CapabilityGuard((manifest as { capabilities: unknown[] }).capabilities);
      console.log('[RPCHandler] Capability grants stored from manifest');
    } else {
      this.guard = new CapabilityGuard(); // No grants — everything prompts
      console.log('[RPCHandler] No manifest provided — all operations will prompt');
    }

    // Decode base64-encoded binary fields
    const credentialIdBytes = fromBase64(authKeys.credentialId);
    const publicKeyBytes = fromBase64(authKeys.publicKey);
    const signingKeyBytes = fromBase64(authKeys.signingKey);
    const encryptionKeyBytes = fromBase64(authKeys.encryptionKey);

    // Store credential for future visits
    this.credentialStore.saveCredentialId(credentialIdBytes);
    this.credentialStore.savePublicKey(publicKeyBytes);

    // TIER-2-UPGRADE: Remove signingKey storage.
    this.signingKey = signingKeyBytes;

    // Initialize PXE in Worker — send raw encryption key bytes
    console.log('[RPCHandler] Initializing PXE Worker for', this.nodeUrl);
    const address = await this.pxeManager.initialize(
      this.nodeUrl,
      encryptionKeyBytes,
      authKeys.masterSecret,
      authKeys.accountSalt,
      signingKeyBytes,
      this.contractConfigs,
    );
    console.log('[RPCHandler] PXE Worker initialized, address:', address);

    return { address };
  }

  private async handleDisconnect(): Promise<void> {
    this.signingKey = null;
    this.guard = new CapabilityGuard(); // Clear grants
    await this.pxeManager.destroy();
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/host/RPCHandler.ts
git commit -m "feat(passkey-wallet): integrate CapabilityGuard into RPCHandler"
```

---

### Task 10: Barrel Export + Verification

Create barrel export for capabilities module. Run all tests to verify nothing is broken.

**Files:**
- Create: `packages/passkey-wallet/src/host/capabilities/index.ts`

- [ ] **Step 1: Create barrel export**

```typescript
// packages/passkey-wallet/src/host/capabilities/index.ts
export { CapabilityGuard } from './CapabilityGuard';
export type { GuardPayload } from './CapabilityGuard';
export { matchesPattern, matchesScope } from './PatternMatcher';
export { transformCapabilities, prettifyFunctionName, abbreviateAddress } from './PermissionDisplay';
export type { ContractGroup, PermissionDisplayData } from './PermissionDisplay';
```

- [ ] **Step 2: Run all capability tests**

Run: `cd packages/passkey-wallet && npx vitest run src/host/capabilities/__tests__/`
Expected: All tests PASS

- [ ] **Step 3: Run existing tests to check for regressions**

Run: `cd packages/passkey-wallet && npx vitest run`
Expected: All existing tests still PASS. If the integration test fails due to the RPCHandler signature change (`handleInitWithKeys` now accepts 2 params), update the test's inline handler to match.

- [ ] **Step 4: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/host/capabilities/index.ts
git commit -m "feat(passkey-wallet): add capabilities barrel export"
```

---

### Task 11: Integration Test — CapabilityGuard + RPCHandler

Test the full flow: connect with manifest → guard allows scoped calls → guard prompts for out-of-scope calls.

**Files:**
- Create: `packages/passkey-wallet/src/integration/__tests__/capability-guard.integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// packages/passkey-wallet/src/integration/__tests__/capability-guard.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityGuard } from '../../host/capabilities/CapabilityGuard';

const TOKEN = '0x1f4b000000000000000000000000000000000000000000000000000000000001';
const DRIPPER = '0x2b68000000000000000000000000000000000000000000000000000000000002';
const UNKNOWN = '0x9999000000000000000000000000000000000000000000000000000000000009';

/**
 * Simulates a GregoSwap-like manifest with specific function permissions.
 */
const GREGOSWAP_CAPABILITIES = [
  { type: 'accounts', canGet: true, canCreateAuthWit: false },
  { type: 'contracts', contracts: [TOKEN, DRIPPER], canRegister: true, canGetMetadata: true },
  {
    type: 'simulation',
    transactions: {
      scope: [
        { contract: TOKEN, function: 'balance_of_public' },
        { contract: DRIPPER, function: 'balance_of_public' },
      ],
    },
    utilities: {
      scope: [
        { contract: TOKEN, function: 'balance_of_private' },
        { contract: DRIPPER, function: 'balance_of_private' },
      ],
    },
  },
  {
    type: 'transaction',
    scope: [
      { contract: TOKEN, function: 'transfer' },
      { contract: DRIPPER, function: 'drip' },
    ],
  },
];

describe('CapabilityGuard integration (GregoSwap manifest)', () => {
  let guard: CapabilityGuard;

  beforeEach(() => {
    guard = new CapabilityGuard(GREGOSWAP_CAPABILITIES);
  });

  // Ungated methods always pass
  it('getChainInfo is always allowed', () => {
    expect(guard.check('getChainInfo')).toBe('allowed');
  });

  // Account access
  it('allows getAccounts (canGet: true)', () => {
    expect(guard.check('getAccounts')).toBe('allowed');
  });

  it('prompts for createAuthWit (canCreateAuthWit: false)', () => {
    expect(guard.check('createAuthWit')).toBe('prompt');
  });

  // Contract registration
  it('allows registerContract for TOKEN', () => {
    expect(guard.check('registerContract', { contractAddress: TOKEN })).toBe('allowed');
  });

  it('prompts for registerContract for unknown contract', () => {
    expect(guard.check('registerContract', { contractAddress: UNKNOWN })).toBe('prompt');
  });

  // Simulation
  it('allows simulateTx for balance_of_public on TOKEN', () => {
    expect(guard.check('simulateTx', { contractAddress: TOKEN, functionName: 'balance_of_public' })).toBe('allowed');
  });

  it('prompts for simulateTx for transfer on TOKEN (not in simulation scope)', () => {
    expect(guard.check('simulateTx', { contractAddress: TOKEN, functionName: 'transfer' })).toBe('prompt');
  });

  it('allows executeUtility for balance_of_private on DRIPPER', () => {
    expect(guard.check('executeUtility', { contractAddress: DRIPPER, functionName: 'balance_of_private' })).toBe('allowed');
  });

  // Transactions
  it('allows sendTx for transfer on TOKEN', () => {
    expect(guard.check('sendTx', { contractAddress: TOKEN, functionName: 'transfer' })).toBe('allowed');
  });

  it('allows sendTx for drip on DRIPPER', () => {
    expect(guard.check('sendTx', { contractAddress: DRIPPER, functionName: 'drip' })).toBe('allowed');
  });

  it('prompts for sendTx for unknown function on TOKEN', () => {
    expect(guard.check('sendTx', { contractAddress: TOKEN, functionName: 'mint' })).toBe('prompt');
  });

  it('prompts for sendTx on unknown contract', () => {
    expect(guard.check('sendTx', { contractAddress: UNKNOWN, functionName: 'transfer' })).toBe('prompt');
  });
});

describe('CapabilityGuard with no manifest (secure default)', () => {
  let guard: CapabilityGuard;

  beforeEach(() => {
    guard = new CapabilityGuard();
  });

  it('allows ungated methods', () => {
    expect(guard.check('getChainInfo')).toBe('allowed');
    expect(guard.check('registerSender')).toBe('allowed');
  });

  it('prompts for everything else', () => {
    expect(guard.check('getAccounts')).toBe('prompt');
    expect(guard.check('simulateTx', { contractAddress: TOKEN, functionName: 'balance_of_public' })).toBe('prompt');
    expect(guard.check('sendTx', { contractAddress: TOKEN, functionName: 'transfer' })).toBe('prompt');
    expect(guard.check('registerContract', { contractAddress: TOKEN })).toBe('prompt');
    expect(guard.check('getAddressBook')).toBe('prompt');
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `cd packages/passkey-wallet && npx vitest run src/integration/__tests__/capability-guard.integration.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/mapache/defi/worktrees/passkey
git add packages/passkey-wallet/src/integration/__tests__/capability-guard.integration.test.ts
git commit -m "test(passkey-wallet): add capability guard integration tests"
```

---

## Summary

| Task | What | New/Modified Files |
|------|------|-------------------|
| 1 | PatternMatcher | `host/capabilities/PatternMatcher.ts` + test |
| 2 | CapabilityGuard | `host/capabilities/CapabilityGuard.ts` + test |
| 3 | PermissionDisplay | `host/capabilities/PermissionDisplay.ts` + test |
| 4 | Shared types | `shared/types.ts` |
| 5 | PermissionReview UI | `popup/PermissionReview.tsx`, `popup/styles.ts` |
| 6 | RuntimePrompt UI | `popup/RuntimePrompt.tsx` |
| 7 | ConnectFlow + PopupShell | `popup/ConnectFlow.tsx`, `popup/PopupShell.tsx` |
| 8 | SDK connect + PopupManager | `sdk/createPasskeyWallet.ts`, `sdk/PopupManager.ts` |
| 9 | RPCHandler guard | `host/RPCHandler.ts` |
| 10 | Barrel export + verify | `host/capabilities/index.ts` |
| 11 | Integration test | `integration/__tests__/capability-guard.integration.test.ts` |
