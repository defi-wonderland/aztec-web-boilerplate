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

  it('getChainInfo is always allowed', () => {
    expect(guard.check('getChainInfo')).toBe('allowed');
  });

  it('allows getAccounts (canGet: true)', () => {
    expect(guard.check('getAccounts')).toBe('allowed');
  });

  it('prompts for createAuthWit (canCreateAuthWit: false)', () => {
    expect(guard.check('createAuthWit')).toBe('prompt');
  });

  it('allows registerContract for TOKEN', () => {
    expect(guard.check('registerContract', { contractAddress: TOKEN })).toBe('allowed');
  });

  it('prompts for registerContract for unknown contract', () => {
    expect(guard.check('registerContract', { contractAddress: UNKNOWN })).toBe('prompt');
  });

  it('allows simulateTx for balance_of_public on TOKEN', () => {
    expect(guard.check('simulateTx', { contractAddress: TOKEN, functionName: 'balance_of_public' })).toBe('allowed');
  });

  it('prompts for simulateTx for transfer on TOKEN (not in simulation scope)', () => {
    expect(guard.check('simulateTx', { contractAddress: TOKEN, functionName: 'transfer' })).toBe('prompt');
  });

  it('allows executeUtility for balance_of_private on DRIPPER', () => {
    expect(guard.check('executeUtility', { contractAddress: DRIPPER, functionName: 'balance_of_private' })).toBe('allowed');
  });

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
