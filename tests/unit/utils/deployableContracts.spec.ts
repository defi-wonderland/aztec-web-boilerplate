import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { loadDeployableContracts } from '../../../src/utils/deployableContracts';
import type { DeployableContractConfig } from '../../../src/types/deployableContract';

vi.mock('@aztec/aztec.js/abi', () => ({
  loadContractArtifact: vi.fn(() => ({
    name: 'MockArtifact',
    functions: [],
  })),
}));

const mockedLoadContractArtifact = vi.mocked(loadContractArtifact);

describe('loadDeployableContracts', () => {
  beforeEach(() => {
    mockedLoadContractArtifact.mockClear();
  });

  it('extracts constructors from raw compiled artifact format', () => {
    const configs: DeployableContractConfig[] = [
      {
        id: 'raw-contract',
        label: 'Raw Contract',
        artifact: {
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
              },
              custom_attributes: ['abi_initializer'],
            },
          ],
        },
      },
    ];

    const contracts = loadDeployableContracts(configs);

    expect(mockedLoadContractArtifact).toHaveBeenCalledTimes(1);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.constructors).toHaveLength(1);
    expect(contracts[0]?.constructors[0]?.name).toBe(
      'constructor_initial_owner'
    );
    expect(contracts[0]?.constructors[0]?.label).toBe('Initial Owner');
  });

  it('extracts constructors from processed ContractArtifact format', () => {
    const configs: DeployableContractConfig[] = [
      {
        id: 'processed-contract',
        label: 'Processed Contract',
        artifact: {
          functions: [
            {
              name: 'constructor_register',
              functionType: 'private',
              isInitializer: true,
              isStatic: false,
              parameters: [
                {
                  name: 'value',
                  visibility: 'public',
                  type: { kind: 'field' },
                },
              ],
              returnTypes: [],
            },
          ],
        },
      },
    ];

    const contracts = loadDeployableContracts(configs);

    expect(mockedLoadContractArtifact).not.toHaveBeenCalled();
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.constructors).toHaveLength(1);
    expect(contracts[0]?.constructors[0]?.name).toBe('constructor_register');
    expect(contracts[0]?.constructors[0]?.label).toBe('Register');
  });

  it('returns empty constructors when artifact cannot be parsed', () => {
    const configs: DeployableContractConfig[] = [
      {
        id: 'broken-contract',
        label: 'Broken Contract',
        artifact: '{not-valid-json',
      },
    ];

    const contracts = loadDeployableContracts(configs);

    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.constructors).toHaveLength(0);
    expect(contracts[0]?.artifactJson).toBe(JSON.stringify('{not-valid-json'));
  });
});
