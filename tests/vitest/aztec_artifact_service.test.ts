import { describe, it, expect, beforeEach } from 'vitest';
import { AztecArtifactService } from '../../src/services/aztec/artifacts/AztecArtifactService';
import { AztecContractMetadata, AztecContractFunction } from '../../src/types';
import { ContractArtifact } from '@aztec/stdlib/abi';
import dripperArtifact from '../../src/artifacts/dripper-Dripper.json' with { type: 'json' };
import votingArtifact from '../../src/artifacts/easy_private_voting-EasyPrivateVoting.json';

describe('AztecArtifactService', () => {
  let service: AztecArtifactService;
  let testArtifact: ContractArtifact;

  beforeEach(() => {
    service = new AztecArtifactService();
    // Use the real Dripper artifact for testing
    testArtifact = dripperArtifact as ContractArtifact;
  });

  describe('parseArtifact', () => {
    it('parses a real Dripper artifact correctly', () => {
      const result = service.parseArtifact(testArtifact);

      expect(result.name).toBe('Dripper');
      expect(result.noirVersion).toBe('1.0.0-beta.7+0000000000000000000000000000000000000000');
      expect(result.isTranspiled).toBe(true);
      expect(result.functions).toHaveLength(6); // constructor, drip_to_private, drip_to_public, process_message, public_dispatch, sync_private_state
    });

    it('categorizes Dripper functions correctly', () => {
      const result = service.parseArtifact(testArtifact);

      expect(result.constructor?.name).toBe('constructor');
      expect(result.initializers).toHaveLength(1); // constructor is initializer
      expect(result.privateFunctions).toHaveLength(1); // drip_to_private
      expect(result.publicFunctions).toHaveLength(0); // none marked as public
      expect(result.unconstrainedFunctions).toHaveLength(5); // constructor, drip_to_public, process_message, public_dispatch, sync_private_state
    });

    it('parses constructor parameters correctly', () => {
      const result = service.parseArtifact(testArtifact);
      const constructorFunction = result.constructor;

      expect(constructorFunction?.parameters).toHaveLength(0); // Dripper constructor has no parameters
      expect(constructorFunction?.isConstructor).toBe(true);
      expect(constructorFunction?.isInitializer).toBe(true);
    });

    it('parses private function parameters correctly', () => {
      const result = service.parseArtifact(testArtifact);
      const dripToPrivate = result.functions.find(f => f.name === 'drip_to_private');

      expect(dripToPrivate?.parameters).toHaveLength(3); // inputs, token_address, amount
      expect(dripToPrivate?.parameters[0].name).toBe('inputs');
      expect(dripToPrivate?.parameters[0].type).toBe('struct');
      expect(dripToPrivate?.parameters[1].name).toBe('token_address');
      expect(dripToPrivate?.parameters[1].type).toBe('AztecAddress');
      expect(dripToPrivate?.parameters[2].name).toBe('amount');
      expect(dripToPrivate?.parameters[2].type).toBe('u64');
    });

    it('parses constructor error types correctly', () => {
      const result = service.parseArtifact(testArtifact);
      const constructorFunction = result.constructor;

      expect(constructorFunction?.errorTypes['2233873454491509486']).toEqual({
        errorKind: 'string',
        string: 'Initializer address is not the contract deployer'
      });
      expect(constructorFunction?.errorTypes['5019202896831570965']).toEqual({
        errorKind: 'string',
        string: 'attempt to add with overflow'
      });
    });

    it('should throw error for invalid artifact', () => {
      const invalidArtifact = {} as ContractArtifact;
      
      expect(() => service.parseArtifact(invalidArtifact)).toThrow();
    });
  });

  describe('validateArtifact', () => {
    it('validates real Dripper artifact', () => {
      expect(service.validateArtifact(testArtifact)).toBe(true);
    });

    it('rejects artifact without name', () => {
      const invalid = { ...testArtifact, name: undefined };
      expect(service.validateArtifact(invalid as ContractArtifact)).toBe(false);
    });

    it('rejects artifact without functions', () => {
      const invalid = { ...testArtifact, functions: undefined };
      expect(service.validateArtifact(invalid as ContractArtifact)).toBe(false);
    });

    it('rejects artifact with empty functions array', () => {
      const invalid = { ...testArtifact, functions: [] };
      expect(service.validateArtifact(invalid)).toBe(false);
    });
  });

  describe('extractFunctionMetadata', () => {
    it('extracts constructor metadata correctly', () => {
      const constructorFn = testArtifact.functions[0]; // constructor
      const result = service.extractFunctionMetadata(constructorFn);

      expect(result.name).toBe('constructor');
      expect(result.visibility).toBe('unconstrained');
      expect(result.isConstructor).toBe(true);
      expect(result.isInitializer).toBe(true);
    });

    it('extracts private function metadata correctly', () => {
      const privateFn = testArtifact.functions[1]; // drip_to_private
      const result = service.extractFunctionMetadata(privateFn);

      expect(result.name).toBe('drip_to_private');
      expect(result.visibility).toBe('private');
      expect(result.isConstructor).toBe(false);
      expect(result.isInitializer).toBe(false);
    });

    it('handles functions without custom attributes', () => {
      const fnWithoutAttrs = {
        ...testArtifact.functions[1],
        custom_attributes: undefined
      };
      
      const result = service.extractFunctionMetadata(fnWithoutAttrs);
      expect(result.visibility).toBe('private'); // Should default based on is_unconstrained
    });
  });

  describe('parseParameterType', () => {
    it('parses field type correctly', () => {
      const fieldType = { kind: 'field' };
      expect(service.parseParameterType(fieldType)).toBe('Field');
    });

    it('parses integer types correctly', () => {
      const u64Type = { kind: 'integer', sign: 'unsigned', width: 64 };
      expect(service.parseParameterType(u64Type)).toBe('u64');

      const i32Type = { kind: 'integer', sign: 'signed', width: 32 };
      expect(service.parseParameterType(i32Type)).toBe('i32');
    });

    it('parses boolean type correctly', () => {
      const boolType = { kind: 'boolean' };
      expect(service.parseParameterType(boolType)).toBe('bool');
    });

    it('parses array type correctly', () => {
      const arrayType = { kind: 'array', type: { kind: 'field' }, length: 10 };
      expect(service.parseParameterType(arrayType)).toBe('array');
    });

    it('handles unknown types', () => {
      const unknownType = { kind: 'custom_type' };
      expect(service.parseParameterType(unknownType)).toBe('unknown');
    });

    it('parses Aztec-specific types from path', () => {
      const aztecAddressType = { path: 'aztec::protocol_types::address::aztec_address::AztecAddress' };
      expect(service.parseParameterType(aztecAddressType)).toBe('AztecAddress');

      const publicKeyType = { path: 'aztec::types::PublicKey' };
      expect(service.parseParameterType(publicKeyType)).toBe('PublicKey');
    });
  });

  describe('getFunctionsByVisibility', () => {
    let metadata: AztecContractMetadata;

    beforeEach(() => {
      metadata = service.parseArtifact(testArtifact);
    });

    it('returns private functions', () => {
      const privateFunctions = service.getFunctionsByVisibility(metadata, 'private');
      expect(privateFunctions).toHaveLength(1);
      expect(privateFunctions[0].name).toBe('drip_to_private');
    });

    it('returns public functions', () => {
      const publicFunctions = service.getFunctionsByVisibility(metadata, 'public');
      expect(publicFunctions).toHaveLength(0); // Dripper has no functions marked as public
    });

    it('returns unconstrained functions', () => {
      const unconstrainedFunctions = service.getFunctionsByVisibility(metadata, 'unconstrained');
      expect(unconstrainedFunctions).toHaveLength(5);
      const names = unconstrainedFunctions.map(f => f.name);
      expect(names).toContain('constructor');
      expect(names).toContain('drip_to_public');
      expect(names).toContain('process_message');
      expect(names).toContain('public_dispatch');
      expect(names).toContain('sync_private_state');
    });
  });

  describe('getConstructorFunction', () => {
    it('returns constructor function', () => {
      const metadata = service.parseArtifact(testArtifact);
      const constructor = service.getConstructorFunction(metadata);

      expect(constructor).toBeDefined();
      expect(constructor?.name).toBe('constructor');
      expect(constructor?.isConstructor).toBe(true);
    });

    it('returns undefined if no constructor exists', () => {
      const artifactWithoutConstructor = {
        ...testArtifact,
        functions: testArtifact.functions.filter(f => f.name !== 'constructor')
      };
      
      const metadata = service.parseArtifact(artifactWithoutConstructor);
      const constructor = service.getConstructorFunction(metadata);

      expect(constructor).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('handles artifact with missing noir_version', () => {
      const artifactWithoutVersion = { ...testArtifact, noir_version: undefined };
      const result = service.parseArtifact(artifactWithoutVersion);
      expect(result.noirVersion).toBe('unknown');
    });

    it('handles functions with missing parameters', () => {
      const fnWithoutParams = {
        ...testArtifact.functions[0],
        abi: { ...testArtifact.functions[0].abi, parameters: undefined }
      };
      
      const result = service.extractFunctionMetadata(fnWithoutParams);
      expect(result.parameters).toEqual([]);
    });

    it('handles null or undefined type info', () => {
      expect(service.parseParameterType(null)).toBe('unknown');
      expect(service.parseParameterType(undefined)).toBe('unknown');
      expect(service.parseParameterType('string')).toBe('unknown');
    });

    it('parses real voting artifact correctly', () => {
      const result = service.parseArtifact(votingArtifact as ContractArtifact);
      expect(result.name).toBe('EasyPrivateVoting');
      expect(result.functions.length).toBeGreaterThan(0);
    });
  });
});
