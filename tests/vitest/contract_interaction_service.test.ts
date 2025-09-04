import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractInteractionService } from '../../src/services/aztec/interaction/ContractInteractionService';
import { ContractUIGenerator } from '../../src/services/aztec/ui/ContractUIGenerator';
import { AztecArtifactService } from '../../src/services/aztec/artifacts/AztecArtifactService';
import { Contract, AztecAddress, Fr, PXE, Wallet } from '@aztec/aztec.js';
import { ContractArtifact } from '@aztec/stdlib/abi';
import { AztecContractMetadata, FunctionUIConfig } from '../../src/types';
// Import real artifacts for testing
import dripperArtifact from '../../src/artifacts/dripper-Dripper.json' with { type: 'json' };

// Mock Aztec.js modules
vi.mock('@aztec/aztec.js', () => ({
  Contract: {
    at: vi.fn(),
    deploy: vi.fn(),
  },
  AztecAddress: {
    fromString: vi.fn(),
  },
  Fr: {
    fromString: vi.fn(),
  },
}));

describe('ContractInteractionService', () => {
  let service: ContractInteractionService;
  let mockPXE: PXE;
  let mockWallet: Wallet;
  let uiGenerator: ContractUIGenerator;
  let artifactService: AztecArtifactService;
  let dripperMetadata: AztecContractMetadata;
  let dripToPrivateFunction: FunctionUIConfig;

  beforeEach(() => {
    // Create mock PXE and Wallet
    mockPXE = {} as PXE;
    mockWallet = {} as Wallet;

    // Initialize services
    service = new ContractInteractionService(mockPXE, mockWallet);
    uiGenerator = new ContractUIGenerator();
    artifactService = new AztecArtifactService();

    // Parse test data
    dripperMetadata = artifactService.parseArtifact(dripperArtifact as ContractArtifact);
    const dripToPrivateFunc = dripperMetadata.functions.find(f => f.name === 'drip_to_private')!;
    dripToPrivateFunction = uiGenerator.generateFunctionUI(dripToPrivateFunc);

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('validates required parameters', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      
      // Test with missing required parameters
      const result = await service.executeFunction(
        contractAddress,
        dripToPrivateFunction,
        {} // Empty inputs - should fail validation
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation errors');
      expect(result.error).toContain('required');
    });

    it('validates AztecAddress format', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      
      const result = await service.executeFunction(
        contractAddress,
        dripToPrivateFunction,
        {
          inputs: '{}',
          token_address: 'invalid-address', // Invalid format
          amount: '100'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a valid hex string');
    });

    it('validates numeric types', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      
      const result = await service.executeFunction(
        contractAddress,
        dripToPrivateFunction,
        {
          inputs: '{}',
          token_address: '0x' + '1'.repeat(64),
          amount: 'not-a-number' // Invalid numeric value
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a valid big integer');
    });

    it('passes validation with correct inputs', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      const mockContract = {
        methods: {
          drip_to_private: vi.fn().mockReturnValue({
            send: vi.fn().mockReturnValue({
              wait: vi.fn().mockResolvedValue({
                txHash: 'mock-tx-hash'
              })
            })
          })
        }
      };

      vi.mocked(Contract.at).mockResolvedValue(mockContract as any);

      const result = await service.executeFunction(
        contractAddress,
        dripToPrivateFunction,
        {
          inputs: '{}',
          token_address: '0x' + '1'.repeat(64),
          amount: '100'
        }
      );

      expect(result.success).toBe(true);
      expect(result.txHash).toBe('mock-tx-hash');
    });
  });

  describe('Type Parsing', () => {
    it('parses Field types correctly', () => {
      const mockFr = { value: 'mock-field' };
      vi.mocked(Fr.fromString).mockReturnValue(mockFr as any);

      // Access private method for testing
      const parseValue = (service as any).parseValueToAztecType.bind(service);
      const result = parseValue('Field', '0x123');

      expect(Fr.fromString).toHaveBeenCalledWith('0x123');
      expect(result).toBe(mockFr);
    });

    it('parses AztecAddress types correctly', () => {
      const mockAddress = { address: 'mock-address' };
      vi.mocked(AztecAddress.fromString).mockReturnValue(mockAddress as any);

      const parseValue = (service as any).parseValueToAztecType.bind(service);
      const result = parseValue('AztecAddress', '0x' + '1'.repeat(64));

      expect(AztecAddress.fromString).toHaveBeenCalledWith('0x' + '1'.repeat(64));
      expect(result).toBe(mockAddress);
    });

    it('parses boolean types correctly', () => {
      const parseValue = (service as any).parseValueToAztecType.bind(service);

      expect(parseValue('bool', true)).toBe(true);
      expect(parseValue('bool', false)).toBe(false);
      expect(parseValue('bool', 'true')).toBe(true);
      expect(parseValue('bool', 'false')).toBe(false);
    });

    it('parses numeric types correctly', () => {
      const parseValue = (service as any).parseValueToAztecType.bind(service);

      expect(parseValue('u32', '42')).toBe(42);
      expect(parseValue('u64', '999999999999')).toBe(999999999999n);
      expect(parseValue('i32', '-42')).toBe(-42);
    });

    it('parses array types correctly', () => {
      const parseValue = (service as any).parseValueToAztecType.bind(service);

      // Array input
      expect(parseValue('array', [1, 2, 3])).toEqual([1, 2, 3]);
      
      // Comma-separated string input
      expect(parseValue('array', '1,2,3')).toEqual([1, 2, 3]);
    });

    it('parses struct types correctly', () => {
      const parseValue = (service as any).parseValueToAztecType.bind(service);

      // Object input
      const obj = { field1: 'value1', field2: 42 };
      expect(parseValue('struct', obj)).toEqual(obj);
      
      // JSON string input
      expect(parseValue('struct', '{"field1":"value1","field2":42}')).toEqual(obj);
    });
  });

  describe('Function Execution', () => {
    it('executes private functions correctly', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      const mockReceipt = { txHash: 'mock-private-tx-hash', blockNumber: 12345 };
      const mockContract = {
        methods: {
          drip_to_private: vi.fn().mockReturnValue({
            send: vi.fn().mockReturnValue({
              wait: vi.fn().mockResolvedValue(mockReceipt)
            })
          })
        }
      };

      vi.mocked(Contract.at).mockResolvedValue(mockContract as any);

      const result = await service.executeFunction(
        contractAddress,
        dripToPrivateFunction,
        {
          inputs: '{}',
          token_address: '0x' + '1'.repeat(64),
          amount: '100'
        }
      );

      expect(result.success).toBe(true);
      expect(result.txHash).toBe('mock-private-tx-hash');
      expect(result.executionBlock).toBeGreaterThanOrEqual(0);
      expect(mockContract.methods.drip_to_private).toHaveBeenCalled();
    });

    it('executes unconstrained functions correctly', async () => {
      // Create an unconstrained function configuration
      const unconstrainedFunc = dripperMetadata.functions.find(f => f.visibility === 'unconstrained')!;
      const unconstrainedConfig = uiGenerator.generateFunctionUI(unconstrainedFunc);

      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      const mockReturnValue = { balance: 1000n };
      const mockContract = {
        methods: {
          [unconstrainedFunc.name]: vi.fn().mockReturnValue({
            simulate: vi.fn().mockResolvedValue(mockReturnValue)
          })
        }
      };

      vi.mocked(Contract.at).mockResolvedValue(mockContract as any);

      const result = await service.executeFunction(
        contractAddress,
        unconstrainedConfig,
        {}
      );

      expect(result.success).toBe(true);
      expect(result.returnValue).toBe(mockReturnValue);
      expect(result.txHash).toBeUndefined(); // Unconstrained functions don't produce tx hashes

    });

    it('handles execution errors gracefully', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      
      vi.mocked(Contract.at).mockRejectedValue(new Error('Contract not found'));

      const result = await service.executeFunction(
        contractAddress,
        dripToPrivateFunction,
        {
          inputs: '{}',
          token_address: '0x' + '1'.repeat(64),
          amount: '100'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contract not found');

    });
  });

  describe('Contract Deployment', () => {
    it('deploys contract without initializer', async () => {
      const mockReceipt = {
        contractAddress: AztecAddress.fromString('0x' + '2'.repeat(64)),
        txHash: 'mock-deploy-tx-hash',
        blockNumber: 54321
      };
      const mockDeploymentTx = {
        send: vi.fn().mockReturnValue({
          wait: vi.fn().mockResolvedValue(mockReceipt)
        })
      };

      vi.mocked(Contract.deploy).mockReturnValue(mockDeploymentTx as any);

      const result = await service.deployContract(dripperArtifact as ContractArtifact);

      expect(result.success).toBe(true);
      expect(result.contractAddress).toBe(mockReceipt.contractAddress);
      expect(result.txHash).toBe('mock-deploy-tx-hash');
      expect(result.deploymentBlock).toBeGreaterThanOrEqual(0);
      expect(Contract.deploy).toHaveBeenCalledWith(mockWallet, dripperArtifact);
    });

    it('deploys contract with initializer', async () => {
      const constructorFunc = dripperMetadata.constructor!;
      const initializerConfig = uiGenerator.generateFunctionUI(constructorFunc);

      const mockReceipt = {
        contractAddress: AztecAddress.fromString('0x' + '2'.repeat(64)),
        txHash: 'mock-deploy-tx-hash',
        blockNumber: 54322
      };
      const mockDeploymentTx = {
        send: vi.fn().mockReturnValue({
          wait: vi.fn().mockResolvedValue(mockReceipt)
        })
      };

      vi.mocked(Contract.deploy).mockReturnValue(mockDeploymentTx as any);

      const result = await service.deployContract(
        dripperArtifact as ContractArtifact,
        initializerConfig,
        {} // No constructor parameters for dripper
      );

      expect(result.success).toBe(true);
      expect(result.contractAddress).toBe(mockReceipt.contractAddress);
      expect(Contract.deploy).toHaveBeenCalledWith(mockWallet, dripperArtifact);
    });

    it('handles deployment validation errors', async () => {
      // Create a mock initializer that requires parameters
      const mockInitializerConfig = {
        ...dripToPrivateFunction,
        function: { ...dripToPrivateFunction.function, isInitializer: true }
      };

      const result = await service.deployContract(
        dripperArtifact as ContractArtifact,
        mockInitializerConfig,
        {} // Missing required parameters
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Initializer validation errors');
      expect(result.deploymentBlock).toBeUndefined();
    });

    it('handles deployment errors gracefully', async () => {
      vi.mocked(Contract.deploy).mockImplementation(() => {
        throw new Error('Deployment failed');
      });

      const result = await service.deployContract(dripperArtifact as ContractArtifact);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Deployment failed');
      expect(result.deploymentBlock).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles unsupported function visibility', async () => {
      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      
      // Mock the contract to exist so we get to the visibility check
      const mockContract = {
        methods: {
          drip_to_private: vi.fn()
        }
      };
      vi.mocked(Contract.at).mockResolvedValue(mockContract as any);
      
      const invalidConfig = {
        ...dripToPrivateFunction,
        function: { 
          ...dripToPrivateFunction.function, 
          visibility: 'invalid' as any 
        }
      };

      const result = await service.executeFunction(
        contractAddress,
        invalidConfig,
        {
          inputs: '{}',
          token_address: '0x' + '1'.repeat(64),
          amount: '100'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported function visibility');
    });

    it('validates hex strings correctly', () => {
      const isValidHex = (service as any).isValidHexString.bind(service);

      expect(isValidHex('0x' + '1'.repeat(64), 64)).toBe(true);
      expect(isValidHex('0x' + 'a'.repeat(64), 64)).toBe(true);
      expect(isValidHex('0x' + 'F'.repeat(64), 64)).toBe(true);
      
      expect(isValidHex('1'.repeat(64), 64)).toBe(false); // Missing 0x
      expect(isValidHex('0x' + '1'.repeat(63), 64)).toBe(false); // Wrong length
      expect(isValidHex('0x' + '1'.repeat(65), 64)).toBe(false); // Wrong length
      expect(isValidHex('0x' + 'g'.repeat(64), 64)).toBe(false); // Invalid hex character
    });

    it('handles JSON parsing errors gracefully', () => {
      const validateType = (service as any).validateParameterType.bind(service);
      
      const structParam = { name: 'test', type: 'struct' };
      const error = validateType(structParam, '{invalid json}');

      expect(error).not.toBeNull();
      expect(error.message).toContain('must be valid JSON');
    });

    it('handles array parsing errors gracefully', () => {
      const validateType = (service as any).validateParameterType.bind(service);
      
      const arrayParam = { name: 'test', type: 'array' };
      const error = validateType(arrayParam, '{not an array}');

      expect(error).not.toBeNull();
      expect(error.message).toContain('must be a valid array');
    });

    it('handles empty optional parameters correctly', async () => {
      // Create a function config with optional parameters
      const optionalConfig = {
        ...dripToPrivateFunction,
        inputFields: dripToPrivateFunction.inputFields.map(field => ({
          ...field,
          validation: { ...field.validation, required: false }
        }))
      };

      const contractAddress = AztecAddress.fromString('0x' + '1'.repeat(64));
      const mockContract = {
        methods: {
          drip_to_private: vi.fn().mockReturnValue({
            send: vi.fn().mockReturnValue({
              wait: vi.fn().mockResolvedValue({ txHash: 'mock-tx', blockNumber: 12345 })
            })
          })
        }
      };

      vi.mocked(Contract.at).mockResolvedValue(mockContract as any);

      const result = await service.executeFunction(
        contractAddress,
        optionalConfig,
        {
          inputs: '{}',
          token_address: '0x' + '1'.repeat(64),
          amount: '0'
        } // Valid minimal values for optional parameters
      );

      expect(result.success).toBe(true);
    });
  });
});
