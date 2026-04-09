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
