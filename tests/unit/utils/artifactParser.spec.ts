import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { parseArtifactSource } from '../../../src/utils/artifactParser';
import { ArtifactError, ArtifactErrorCode } from '../../../src/utils/errors';

vi.mock('@aztec/aztec.js/abi', () => ({
  loadContractArtifact: vi.fn(() => ({
    name: 'MockArtifact',
    functions: [],
  })),
}));

const mockedLoadContractArtifact = vi.mocked(loadContractArtifact);

describe('parseArtifactSource', () => {
  beforeEach(() => {
    mockedLoadContractArtifact.mockClear();
  });

  it('parses processed ContractArtifact format', () => {
    const source = JSON.stringify({
      address: '0xabc',
      functions: [
        {
          name: 'initialize',
          functionType: 'private',
          isInitializer: true,
          isStatic: false,
          parameters: [
            {
              name: 'owner',
              visibility: 'public',
              type: { kind: 'field' },
            },
          ],
          returnTypes: [],
        },
      ],
      nonDispatchPublicFunctions: [
        {
          name: 'get_owner',
          functionType: 'utility',
          isInitializer: false,
          isStatic: true,
          parameters: [],
          returnTypes: [{ kind: 'field' }],
        },
      ],
    });

    const parsed = parseArtifactSource(source);

    expect(parsed.discoveredAddress).toBe('0xabc');
    expect(parsed.functions).toHaveLength(2);
    expect(parsed.functions[0]?.name).toBe('initialize');
    expect(parsed.functions[0]?.attributes).toContain('abi_initializer');
    expect(mockedLoadContractArtifact).not.toHaveBeenCalled();
  });

  it('parses raw NoirCompiledContract format', () => {
    const source = JSON.stringify({
      address: '0xdef',
      functions: [
        {
          name: 'constructor_initial_owner',
          abi: {
            parameters: [
              {
                name: 'owner',
                visibility: 'public',
                type: { kind: 'field' },
              },
            ],
            return_type: { abi_type: { kind: 'field' } },
          },
          custom_attributes: ['abi_initializer'],
          is_unconstrained: false,
        },
      ],
    });

    const parsed = parseArtifactSource(source);

    expect(mockedLoadContractArtifact).toHaveBeenCalledTimes(1);
    expect(parsed.discoveredAddress).toBe('0xdef');
    expect(parsed.functions).toHaveLength(1);
    expect(parsed.functions[0]?.name).toBe('constructor_initial_owner');
    expect(parsed.functions[0]?.inputs[0]?.path).toBe('owner');
  });

  it('throws typed error for invalid JSON', () => {
    try {
      parseArtifactSource('{invalid');
      throw new Error('Expected parseArtifactSource to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      expect((error as ArtifactError).code).toBe(
        ArtifactErrorCode.ARTIFACT_INVALID_JSON
      );
    }
  });

  it('throws typed error when functions array is missing', () => {
    try {
      parseArtifactSource(JSON.stringify({ name: 'NoFunctions' }));
      throw new Error('Expected parseArtifactSource to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ArtifactError);
      expect((error as ArtifactError).code).toBe(
        ArtifactErrorCode.ARTIFACT_MISSING_FUNCTIONS
      );
    }
  });
});
