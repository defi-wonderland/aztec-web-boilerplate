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

const LOWERCASE_WORDS = new Set(['of', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but']);

export function prettifyFunctionName(name: string): string {
  const words = name.split('_');
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0 || !LOWERCASE_WORDS.has(lower)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return lower;
    })
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
