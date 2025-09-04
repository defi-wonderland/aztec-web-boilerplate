import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AztecContractService } from '../../src/services/aztec/core/AztecContractService';
import { AztecAddress, Fr, PXE, Wallet } from '@aztec/aztec.js';
import { ContractArtifact } from '@aztec/stdlib/abi';
import dripperArtifact from '../../src/artifacts/dripper-Dripper.json' with { type: 'json' };

// Create basic mocks
const mockPXE = {
  registerContract: vi.fn()
} as unknown as PXE;

const mockWallet = {} as Wallet;

describe('AztecContractService', () => {
  let service: AztecContractService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AztecContractService(mockPXE);
  });

  describe('Initialization', () => {
    it('creates service without wallet', () => {
      const serviceWithoutWallet = new AztecContractService(mockPXE);
      expect(serviceWithoutWallet.isReadyForInteraction()).toBe(false);
    });

    it('creates service with wallet', () => {
      const serviceWithWallet = new AztecContractService(mockPXE, mockWallet);
      expect(serviceWithWallet.isReadyForInteraction()).toBe(true);
    });
  });

  describe('Wallet Management', () => {
    it('sets wallet and enables interactions', () => {
      expect(service.isReadyForInteraction()).toBe(false);
      
      service.setWallet(mockWallet);
      
      expect(service.isReadyForInteraction()).toBe(true);
    });
  });

  describe('Service Integration', () => {
    it('has parseContractArtifact method', () => {
      expect(typeof service.parseContractArtifact).toBe('function');
    });

    it('has generateContractUI method', () => {
      expect(typeof service.generateContractUI).toBe('function');
    });

    it('has parseAndGenerateUI method', () => {
      expect(typeof service.parseAndGenerateUI).toBe('function');
    });

    it('has prepareContractForInteraction method', () => {
      expect(typeof service.prepareContractForInteraction).toBe('function');
    });

    it('has executeContractFunction method', () => {
      expect(typeof service.executeContractFunction).toBe('function');
    });

    it('has deployContract method', () => {
      expect(typeof service.deployContract).toBe('function');
    });
  });

  describe('Error Handling for Wallet-Required Operations', () => {
    it('throws error when executing function without wallet', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      const functionConfig = { name: 'testFunction' };
      const inputs = { param1: 'value1' };

      await expect(
        service.executeContractFunction(contractAddress, functionConfig, inputs)
      ).rejects.toThrow('Wallet required for contract function execution');
    });

    it('throws error when deploying contract without wallet', async () => {
      const mockArtifact = { name: 'TestContract' } as ContractArtifact;

      await expect(
        service.deployContract(mockArtifact)
      ).rejects.toThrow('Wallet required for contract deployment');
    });
  });

  describe('prepareContractForInteraction', () => {
    it('returns correct structure without wallet', () => {
      const result = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('uiConfig');
      expect(result.canExecute).toBe(false);
      expect(result.canDeploy).toBe(false);
    });

    it('returns correct structure with wallet', () => {
      service.setWallet(mockWallet);
      const result = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('uiConfig');
      expect(result.canExecute).toBe(true);
      expect(result.canDeploy).toBe(true);
    });
  });
});
