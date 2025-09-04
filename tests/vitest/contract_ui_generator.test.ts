import { describe, it, expect, beforeEach } from 'vitest';
import { ContractUIGenerator } from '../../src/services/aztec/ui/ContractUIGenerator';
import { AztecArtifactService } from '../../src/services/aztec/artifacts/AztecArtifactService';
import { AztecContractMetadata } from '../../src/types';
import { ContractArtifact } from '@aztec/stdlib/abi';
import dripperArtifact from '../../src/artifacts/dripper-Dripper.json' with { type: 'json' };

describe('ContractUIGenerator', () => {
  let generator: ContractUIGenerator;
  let artifactService: AztecArtifactService;
  let dripperMetadata: AztecContractMetadata;

  beforeEach(() => {
    generator = new ContractUIGenerator();
    artifactService = new AztecArtifactService();
    dripperMetadata = artifactService.parseArtifact(dripperArtifact as ContractArtifact);
  });

  describe('generateContractUI', () => {
    it('generates complete UI configuration for Dripper contract', () => {
      const uiConfig = generator.generateContractUI(dripperMetadata);

      expect(uiConfig.metadata).toBe(dripperMetadata);
      expect(uiConfig.functions).toHaveLength(6); // All 6 functions
      expect(uiConfig.categories.initializers).toHaveLength(1); // constructor is marked as initializer
      expect(uiConfig.categories.private).toHaveLength(1); // drip_to_private
      expect(uiConfig.categories.public).toHaveLength(0);
      expect(uiConfig.categories.unconstrained).toHaveLength(4); // Excluding initializer
      expect(uiConfig.validation.hasInitializers).toBe(true);
      expect(uiConfig.validation.initializerCount).toBe(1);
      expect(uiConfig.validation.totalFunctions).toBe(6);
      expect(uiConfig.validation.supportedFunctions).toBe(6);
    });

    it('categorizes functions correctly', () => {
      const uiConfig = generator.generateContractUI(dripperMetadata);
      
      expect(uiConfig.categories.initializers[0].function.name).toBe('constructor');
      expect(uiConfig.categories.private[0].function.name).toBe('drip_to_private');
      
      const unconstrainedNames = uiConfig.categories.unconstrained.map(f => f.function.name);
      expect(unconstrainedNames).toContain('drip_to_public');
      expect(unconstrainedNames).toContain('process_message');
      expect(unconstrainedNames).toContain('public_dispatch');
      expect(unconstrainedNames).toContain('sync_private_state');
    });
  });

  describe('generateFunctionUI', () => {
    it('generates UI for initializer function', () => {
      const constructorFn = dripperMetadata.constructor!;
      const uiConfig = generator.generateFunctionUI(constructorFn);

      expect(uiConfig.function).toBe(constructorFn);
      expect(uiConfig.inputFields).toHaveLength(0); // Constructor has no parameters
      expect(uiConfig.display.title).toBe('Constructor');
      expect(uiConfig.display.category).toBe('initializer');
      expect(uiConfig.display.icon).toBe('🚀');
      expect(uiConfig.display.color).toBe('#f59e0b');
    });

    it('generates UI for private function with parameters', () => {
      const dripToPrivate = dripperMetadata.functions.find(f => f.name === 'drip_to_private')!;
      const uiConfig = generator.generateFunctionUI(dripToPrivate);

      expect(uiConfig.function).toBe(dripToPrivate);
      expect(uiConfig.inputFields).toHaveLength(3); // inputs, token_address, amount
      expect(uiConfig.display.title).toBe('Drip To Private');
      expect(uiConfig.display.category).toBe('private');
      expect(uiConfig.display.icon).toBe('🔒');
      expect(uiConfig.display.color).toBe('#8b5cf6');
      expect(uiConfig.validation.hasRequiredFields).toBe(true);
    });

    it('generates UI for unconstrained function', () => {
      const dripToPublic = dripperMetadata.functions.find(f => f.name === 'drip_to_public')!;
      const uiConfig = generator.generateFunctionUI(dripToPublic);

      expect(uiConfig.display.category).toBe('unconstrained');
      expect(uiConfig.display.icon).toBe('⚡');
      expect(uiConfig.display.color).toBe('#10b981');
    });
  });

  describe('generateInputField', () => {
    let dripToPrivate: any;

    beforeEach(() => {
      dripToPrivate = dripperMetadata.functions.find(f => f.name === 'drip_to_private')!;
    });

    it('generates input field for struct parameter', () => {
      const inputsParam = dripToPrivate.parameters[0]; // inputs struct
      const fieldConfig = generator.generateInputField(inputsParam, 'drip_to_private');

      expect(fieldConfig.parameter).toBe(inputsParam);
      expect(fieldConfig.field.id).toBe('drip_to_private_inputs');
      expect(fieldConfig.field.name).toBe('inputs');
      expect(fieldConfig.field.label).toBe('Inputs');
      expect(fieldConfig.field.type).toBe('object');
      expect(fieldConfig.validation.required).toBe(true);
    });

    it('generates input field for AztecAddress parameter', () => {
      const tokenAddressParam = dripToPrivate.parameters[1]; // token_address
      const fieldConfig = generator.generateInputField(tokenAddressParam, 'drip_to_private');

      expect(fieldConfig.field.label).toBe('Token Address');
      expect(fieldConfig.field.type).toBe('address');
      expect(fieldConfig.field.placeholder).toBe('Enter Aztec address (0x...)');
      expect(fieldConfig.field.helpText).toBe('Aztec address format: 0x followed by 64 hexadecimal characters');
      expect(fieldConfig.validation.pattern).toBe('^0x[a-fA-F0-9]{64}$');
    });

    it('generates input field for u64 parameter', () => {
      const amountParam = dripToPrivate.parameters[2]; // amount
      const fieldConfig = generator.generateInputField(amountParam, 'drip_to_private');

      expect(fieldConfig.field.label).toBe('Amount');
      expect(fieldConfig.field.type).toBe('bigint');
      expect(fieldConfig.field.placeholder).toBe('Enter positive number');
    });
  });

  describe('mapParameterTypeToInputType', () => {
    it('maps Aztec types to correct input types', () => {
      // Access private method for testing
      const mapType = (generator as any).mapParameterTypeToInputType.bind(generator);

      expect(mapType('Field')).toBe('address');
      expect(mapType('AztecAddress')).toBe('address');
      expect(mapType('bool')).toBe('boolean');
      expect(mapType('u32')).toBe('number');
      expect(mapType('u64')).toBe('bigint');
      expect(mapType('string')).toBe('textarea');
      expect(mapType('array')).toBe('array');
      expect(mapType('struct')).toBe('object');
      expect(mapType('unknown')).toBe('text');
    });
  });

  describe('generateFieldLabel', () => {
    it('converts snake_case to Title Case', () => {
      // Access private method for testing
      const generateLabel = (generator as any).generateFieldLabel.bind(generator);

      expect(generateLabel({ name: 'token_address' })).toBe('Token Address');
      expect(generateLabel({ name: 'user_id' })).toBe('User Id');
      expect(generateLabel({ name: 'max_supply' })).toBe('Max Supply');
      expect(generateLabel({ name: 'inputs' })).toBe('Inputs');
    });
  });

  describe('generatePlaceholder', () => {
    it('generates appropriate placeholders for different types', () => {
      const generatePlaceholder = (generator as any).generatePlaceholder.bind(generator);

      expect(generatePlaceholder({ type: 'Field' })).toBe('Enter field value (0x...)');
      expect(generatePlaceholder({ type: 'AztecAddress' })).toBe('Enter Aztec address (0x...)');
      expect(generatePlaceholder({ type: 'u64' })).toBe('Enter positive number');
      expect(generatePlaceholder({ type: 'bool' })).toBe('Select true or false');
      expect(generatePlaceholder({ type: 'string' })).toBe('Enter text');
      expect(generatePlaceholder({ type: 'array' })).toBe('Enter comma-separated values');
    });
  });

  describe('generateFieldValidation', () => {
    it('generates validation for AztecAddress fields', () => {
      const generateValidation = (generator as any).generateFieldValidation.bind(generator);
      
      const addressParam = { type: 'AztecAddress', required: true };
      const validation = generateValidation(addressParam);

      expect(validation.required).toBe(true);
      expect(validation.pattern).toBe('^0x[a-fA-F0-9]{64}$');
    });

    it('generates validation for integer fields', () => {
      const generateValidation = (generator as any).generateFieldValidation.bind(generator);
      
      const u8Param = { type: 'u8', required: true };
      const u8Validation = generateValidation(u8Param);
      expect(u8Validation.min).toBe(0);
      expect(u8Validation.max).toBe(255);

      const i16Param = { type: 'i16', required: false };
      const i16Validation = generateValidation(i16Param);
      expect(i16Validation.min).toBe(-32768);
      expect(i16Validation.max).toBe(32767);
      expect(i16Validation.required).toBe(false);
    });
  });

  describe('formatFunctionTitle', () => {
    it('formats function names to Title Case', () => {
      const formatTitle = (generator as any).formatFunctionTitle.bind(generator);

      expect(formatTitle('drip_to_private')).toBe('Drip To Private');
      expect(formatTitle('process_message')).toBe('Process Message');
      expect(formatTitle('constructor')).toBe('Constructor');
      expect(formatTitle('get_balance')).toBe('Get Balance');
    });
  });

  describe('generateFunctionDescription', () => {
    it('generates descriptions for different function types', () => {
      const generateDesc = (generator as any).generateFunctionDescription.bind(generator);

      const initializerFn = { isInitializer: true, parameters: [] };
      expect(generateDesc(initializerFn)).toBe('Initialize the contract');

      const privateFn = { isInitializer: false, visibility: 'private', parameters: [{}, {}] };
      expect(generateDesc(privateFn)).toBe('Execute privately - requires 2 parameters');

      const unconstrainedFn = { isInitializer: false, visibility: 'unconstrained', parameters: [{}] };
      expect(generateDesc(unconstrainedFn)).toBe('View/query function - requires 1 parameter');
    });
  });

  describe('edge cases and validation', () => {
    it('handles contract with no initializers', () => {
      // Create metadata without initializers
      const functionsWithoutInitializers = dripperMetadata.functions.filter(f => !f.isInitializer);
      const noInitializerMetadata: AztecContractMetadata = {
        ...dripperMetadata,
        constructor: undefined,
        functions: functionsWithoutInitializers,
        initializers: [],
      };

      const uiConfig = generator.generateContractUI(noInitializerMetadata);
      expect(uiConfig.categories.initializers).toHaveLength(0);
      expect(uiConfig.validation.hasInitializers).toBe(false);
      expect(uiConfig.validation.initializerCount).toBe(0);
      expect(uiConfig.functions).toHaveLength(functionsWithoutInitializers.length);
    });

    it('handles functions with no parameters', () => {
      const constructorFn = dripperMetadata.constructor!;
      const uiConfig = generator.generateFunctionUI(constructorFn);

      expect(uiConfig.inputFields).toHaveLength(0);
      expect(uiConfig.validation.hasRequiredFields).toBe(false);
    });

    it('generates validation patterns correctly', () => {
      const dripToPrivate = dripperMetadata.functions.find(f => f.name === 'drip_to_private')!;
      const uiConfig = generator.generateFunctionUI(dripToPrivate);

      expect(uiConfig.validation.patterns).toBeDefined();
      expect(Object.keys(uiConfig.validation.patterns).length).toBeGreaterThan(0);
    });
  });
});
