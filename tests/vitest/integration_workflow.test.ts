import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AztecContractService } from '../../src/services/aztec/core/AztecContractService';
import { AztecAddress, Fr, PXE, Wallet } from '@aztec/aztec.js';
import { ContractArtifact } from '@aztec/stdlib/abi';

// Import real artifacts for comprehensive testing
import dripperArtifact from '../../src/artifacts/dripper-Dripper.json' with { type: 'json' };

// Mock Aztec.js modules
vi.mock('@aztec/aztec.js', () => ({
  AztecAddress: {
    fromString: vi.fn((addr: string) => ({ toString: () => addr })),
  },
  Fr: {
    fromString: vi.fn((val: string) => ({ toString: () => val })),
  },
  Contract: {
    at: vi.fn(),
    deploy: vi.fn(),
  },
}));

/**
 * Integration Tests for Complete Workflow
 * 
 * These tests verify that all Phase 1 services work together correctly:
 * 1. Artifact parsing → Metadata extraction
 * 2. Metadata → UI configuration generation  
 * 3. UI configuration → Contract interaction readiness
 * 4. End-to-end error handling across all services
 */
describe('complete workflow', () => {
  let service: AztecContractService;
  let mockPXE: PXE;
  let mockWallet: Wallet;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create comprehensive mocks
    mockPXE = {
      registerContract: vi.fn().mockResolvedValue({}),
    } as unknown as PXE;

    mockWallet = {
      getAddress: vi.fn().mockReturnValue(AztecAddress.fromString('0x' + '1'.repeat(64))),
    } as unknown as Wallet;

    service = new AztecContractService(mockPXE);
  });

  it('processes Dripper contract through complete workflow without wallet', () => {
    // Step 1: Parse artifact → metadata
    const metadata = service.parseContractArtifact(dripperArtifact as ContractArtifact);
    
    // Verify metadata structure
    expect(metadata).toHaveProperty('name', 'Dripper');
    expect(metadata).toHaveProperty('functions');
    expect(metadata.functions).toBeInstanceOf(Array);
    expect(metadata.functions.length).toBeGreaterThan(0);

    // Step 2: Generate UI configuration from metadata
    const uiConfig = service.generateContractUI(metadata);
    
    // Verify UI configuration structure
    expect(uiConfig).toHaveProperty('metadata');
    expect(uiConfig).toHaveProperty('categories');
    expect(uiConfig.categories).toHaveProperty('initializers');
    expect(uiConfig.categories).toHaveProperty('private');
    expect(uiConfig.categories).toHaveProperty('public');
    expect(uiConfig.categories).toHaveProperty('unconstrained');

    // Step 3: Prepare for interaction (without wallet)
    const prepared = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);
    
    // Verify complete preparation
    expect(prepared.metadata).toEqual(metadata);
    expect(prepared.uiConfig).toEqual(uiConfig);
    expect(prepared.canExecute).toBe(false); // No wallet
    expect(prepared.canDeploy).toBe(false);  // No wallet
  });

  it('processes Dripper contract through complete workflow with wallet', () => {
    // Add wallet to service
    service.setWallet(mockWallet);
    
    // Complete workflow test
    const prepared = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);
    
    // Verify metadata parsing worked
    expect(prepared.metadata.name).toBe('Dripper');
    expect(prepared.metadata.functions.length).toBeGreaterThan(0);
    
    // Verify UI generation worked
    expect(prepared.uiConfig.categories).toBeDefined();
    
    // Verify interaction readiness with wallet
    expect(prepared.canExecute).toBe(true);  // Has wallet
    expect(prepared.canDeploy).toBe(true);   // Has wallet
    expect(service.isReadyForInteraction()).toBe(true);
  });

  it('handles one-step artifact parsing and UI generation', () => {
    const result = service.parseAndGenerateUI(dripperArtifact as ContractArtifact);
    
    // Verify both parsing and UI generation happened
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('uiConfig');
    
    // Verify metadata is properly structured
    expect(result.metadata.name).toBe('Dripper');
    expect(result.metadata.functions).toBeInstanceOf(Array);
    
    // Verify UI config references the metadata
    expect(result.uiConfig.metadata).toEqual(result.metadata);
  });

  it('handles invalid artifact across all services', () => {
    const invalidArtifact = { invalid: 'artifact' } as unknown as ContractArtifact;
    
    // Should throw during artifact parsing, before reaching UI generation
    expect(() => {
      service.parseContractArtifact(invalidArtifact);
    }).toThrow();
  });

  it('prevents function execution without wallet across service boundary', async () => {
    // Parse valid contract but try to execute without wallet
    const prepared = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);
    
    // Should indicate cannot execute
    expect(prepared.canExecute).toBe(false);
    
    // Attempting execution should fail
    const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
    const functionConfig = prepared.uiConfig.categories.private[0]; // Get first private function
    
    await expect(
      service.executeContractFunction(contractAddress, functionConfig, {})
    ).rejects.toThrow('Wallet required for contract function execution');
  });

  it('prevents deployment without wallet across service boundary', async () => {
    const prepared = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);
    
    // Should indicate cannot deploy
    expect(prepared.canDeploy).toBe(false);
    
    // Attempting deployment should fail
    await expect(
      service.deployContract(dripperArtifact as ContractArtifact)
    ).rejects.toThrow('Wallet required for contract deployment');
  });

  it('handles Dripper contract consistently', () => {
    // Test Dripper contract processing
    const dripperPrepared = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);
    
    // Should have consistent structure
    expect(dripperPrepared).toHaveProperty('metadata');
    expect(dripperPrepared).toHaveProperty('uiConfig');
    expect(dripperPrepared).toHaveProperty('canExecute');
    expect(dripperPrepared).toHaveProperty('canDeploy');
    
    // Should have correct name and structure
    expect(dripperPrepared.metadata.name).toBe('Dripper');
    expect(dripperPrepared.uiConfig.categories).toBeDefined();
  });

  it('generates valid UI configuration for Dripper contract', () => {
    const dripperUI = service.parseAndGenerateUI(dripperArtifact as ContractArtifact);
    
    // Should have valid metadata
    expect(dripperUI.metadata.name).toBe('Dripper');
    expect(dripperUI.metadata.functions.length).toBeGreaterThan(0);
    
    // Should have valid UI configuration
    expect(dripperUI.uiConfig.categories).toBeDefined();
  });

  it('properly transitions from no-wallet to wallet state', () => {
    // Start without wallet
    expect(service.isReadyForInteraction()).toBe(false);
    
    const preparedBefore = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);
    expect(preparedBefore.canExecute).toBe(false);
    expect(preparedBefore.canDeploy).toBe(false);
    
    // Add wallet
    service.setWallet(mockWallet);
    
    // Should now be ready
    expect(service.isReadyForInteraction()).toBe(true);
    
    const preparedAfter = service.prepareContractForInteraction(dripperArtifact as ContractArtifact);
    expect(preparedAfter.canExecute).toBe(true);
    expect(preparedAfter.canDeploy).toBe(true);
    
    // Metadata and UI config should be the same
    expect(preparedAfter.metadata).toEqual(preparedBefore.metadata);
    expect(preparedAfter.uiConfig).toEqual(preparedBefore.uiConfig);
  });

  it('verifies all services are properly integrated', () => {
    // Verify all expected methods exist and are functions
    expect(typeof service.parseContractArtifact).toBe('function');
    expect(typeof service.generateContractUI).toBe('function');
    expect(typeof service.parseAndGenerateUI).toBe('function');
    expect(typeof service.prepareContractForInteraction).toBe('function');
    expect(typeof service.executeContractFunction).toBe('function');
    expect(typeof service.deployContract).toBe('function');
    expect(typeof service.setWallet).toBe('function');
    expect(typeof service.isReadyForInteraction).toBe('function');
  });

  it('verifies service dependencies are properly initialized', () => {
    // Test that internal services work by calling methods
    const metadata = service.parseContractArtifact(dripperArtifact as ContractArtifact);
    const uiConfig = service.generateContractUI(metadata);
    
    // If we get here without errors, services are properly initialized
    expect(metadata).toBeDefined();
    expect(uiConfig).toBeDefined();
  });
});