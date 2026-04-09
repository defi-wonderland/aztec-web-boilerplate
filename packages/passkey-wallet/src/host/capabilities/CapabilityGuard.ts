import { matchesScope } from './PatternMatcher';

/**
 * Methods explicitly gated by the capability spec.
 * Only these methods are checked against grants.
 * All other wallet methods (createTxExecutionRequest, proveTx, getTxReceipt, etc.)
 * are internal SDK plumbing and pass through ungated.
 */
const GATED_METHODS = new Set([
  'getAccounts',
  'createAuthWit',
  'registerContract',
  'getContractMetadata',
  'getContractClassMetadata',
  'simulateTx',
  'profileTx',
  'executeUtility',
  'sendTx',
  'getAddressBook',
  'getPrivateEvents',
]);

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
    // Only gated methods are checked. Everything else (createTxExecutionRequest,
    // proveTx, getTxReceipt, etc.) passes through — these are internal SDK
    // plumbing, not user-facing operations in the capability spec.
    if (!GATED_METHODS.has(method)) return 'allowed';

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
        return 'allowed';
    }
  }

  private findCapability(type: string): Record<string, unknown> | undefined {
    return this.capabilities.find(
      (c: unknown) => (c as Record<string, unknown>).type === type,
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
    if (!cap || cap.canGetMetadata !== true) return 'prompt';
    if (!classId) return 'prompt';
    const classes = cap.classes as string | string[];
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
    const sub = cap[subType] as { scope?: unknown } | undefined;
    if (!sub?.scope) return 'prompt';
    // If we couldn't extract contract/function from the serialized args,
    // allow it — permissive mode should not break the flow. The dapp already
    // declared it needs simulation capability, and the wallet granted it.
    if (!payload?.contractAddress || !payload?.functionName) return 'allowed';
    return matchesScope(
      sub.scope as '*' | { contract: string; function: string }[],
      payload.contractAddress,
      payload.functionName,
    ) ? 'allowed' : 'prompt';
  }

  private checkTransaction(payload?: GuardPayload): 'allowed' | 'prompt' {
    const cap = this.findCapability('transaction');
    if (!cap) return 'prompt';
    const scope = cap.scope;
    if (!scope) return 'prompt';
    // Same as simulation: if payload extraction failed, allow it in permissive mode.
    if (!payload?.contractAddress || !payload?.functionName) return 'allowed';
    return matchesScope(
      scope as '*' | { contract: string; function: string }[],
      payload.contractAddress,
      payload.functionName,
    ) ? 'allowed' : 'prompt';
  }

  private checkDataEvents(contractAddress?: string): 'allowed' | 'prompt' {
    const cap = this.findCapability('data');
    if (!cap) return 'prompt';
    const pe = cap.privateEvents as { contracts?: string | string[] } | undefined;
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
