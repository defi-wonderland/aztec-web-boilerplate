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
