import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import {
  createContractConfig,
  getContractsForConfig,
} from '../../src/contract-registry/helpers';
import { ContractRegistry } from '../../src/contract-registry/ContractRegistry';
import type { NetworkConfig } from '../../src/config/networks';

const TEST_ADDR =
  '0xa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf';

vi.mock('@aztec/aztec.js/addresses', () => {
  class MockAddress {
    constructor(private readonly value: string) {}
    static ZERO = new MockAddress('0x0');
    static fromString(value: string) {
      return new MockAddress(value);
    }
    toString() {
      return this.value;
    }
    equals(other: { toString: () => string }) {
      return other.toString() === this.value;
    }
  }
  return { AztecAddress: MockAddress };
});

const instanceAddress = (value: string) => ({
  address: AztecAddress.fromString(value),
  version: 1 as 1,
  salt: Fr.ZERO,
  deployer: AztecAddress.fromString(value),
  currentContractClassId: Fr.ZERO,
  originalContractClassId: Fr.ZERO,
  initializationHash: Fr.ZERO,
  publicKeys: {
    masterNullifierPublicKey: { toBuffer: () => Buffer.alloc(0), equals: () => true } as any,
    masterIncomingViewingPublicKey: { toBuffer: () => Buffer.alloc(0), equals: () => true } as any,
    masterOutgoingViewingPublicKey: { toBuffer: () => Buffer.alloc(0), equals: () => true } as any,
    masterTaggingPublicKey: { toBuffer: () => Buffer.alloc(0), equals: () => true } as any,
    masterPartialAddressViewingPublicKey: { toBuffer: () => Buffer.alloc(0), equals: () => true } as any,
    nullifierKeys: [],
    incomingViewingKeys: [],
    outgoingViewingKeys: [],
    taggingKeys: [],
    partialAddressViewingKeys: [],
    hash: () => Fr.ZERO,
    isEmpty: () => false,
    equals: () => true,
    toBuffer: () => Buffer.alloc(0),
    toPublicKeysBuffer: () => Buffer.alloc(0),
    toJSON: () => ({}),
    toNoirStruct: () => ({} as any),
    toFields: () => [Fr.ZERO],
    encodeToNoir: () => [Fr.ZERO],
    toString: () => `0x${'a'.repeat(64)}` as `0x${string}`,
  },
});

const contractArtifact = {
  name: 'Mock',
  functions: [],
  nonDispatchPublicFunctions: [],
  outputs: { structs: {}, globals: {} },
  constructor: { name: 'constructor', inputs: [], functionType: 'secret' },
  storageLayout: {},
  fileMap: {},
};

vi.mock('@aztec/aztec.js/contracts', () => {
  const getContractInstanceFromInstantiationParams = vi
    .fn()
    .mockImplementation(async (_artifact, params) => instanceAddress(params.deployer || TEST_ADDR));
  return {
    getContractInstanceFromInstantiationParams,
  };
});

const baseDeployParams = (config: NetworkConfig) => ({
  salt: Fr.fromString(String(config.dripperDeploymentSalt)),
  deployer: AztecAddress.fromString(String(config.deployerAddress)),
  constructorArgs: [],
  constructorArtifact: 'ctor',
});

const sandboxConfig: NetworkConfig = {
  name: 'sandbox',
  deployerAddress: TEST_ADDR,
  dripperContractAddress: TEST_ADDR,
  tokenContractAddress: TEST_ADDR,
  dripperDeploymentSalt: '0x' + '1'.repeat(64),
  tokenDeploymentSalt: '0x' + '2'.repeat(64),
} as unknown as NetworkConfig;

const contracts = createContractConfig({
  dripper: {
    artifact: contractArtifact,
    contract: class {
      static at = vi.fn();
    },
    address: () => TEST_ADDR,
    deployParams: () => ({
      salt: Fr.fromString('0x' + '3'.repeat(64)),
      deployer: AztecAddress.fromString(TEST_ADDR),
      constructorArgs: [],
      constructorArtifact: 'ctor',
    }),
    lazyRegister: false,
  },
});

const mockPXE = () => {
  const pxe = {
    registerContract: vi.fn(async () => {}),
    getContractInstance: vi.fn(async () => undefined),
  };
  return pxe;
};

describe('contract-registry helpers', () => {

  it('getContractsForConfig applies overrides without mutating base map', () => {
    const base = createContractConfig({
      token: {
        artifact: contractArtifact,
        contract: class {
          static at = vi.fn();
        },
        address: () => '0x1',
        deployParams: baseDeployParams,
        lazyRegister: false,
      },
    });

    const overrides = {
      token: { ...contractArtifact, name: 'Override' },
    };

    const result = getContractsForConfig(base, overrides);

    expect(result.token.artifact).toEqual({ ...contractArtifact, name: 'Override' });
    expect(base.token.artifact).toEqual(contractArtifact);
  });
});

describe('ContractRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates concurrent registrations of the same contract', async () => {
    const pxe = mockPXE();
    const registry = new ContractRegistry(pxe as any, contracts, sandboxConfig);
    const registerInstanceSpy = vi
      .spyOn(ContractRegistry.prototype as any, 'registerInstanceWithPXE')
      .mockImplementation(async () => {
        await pxe.registerContract();
        return instanceAddress(TEST_ADDR) as any;
      });

    await Promise.all([registry.register('dripper'), registry.register('dripper')]);

    expect(pxe.registerContract).toHaveBeenCalledTimes(1);
    registerInstanceSpy.mockRestore();
  });

  it('registerAll marks contracts as ready when already in storage', async () => {
    const pxe = mockPXE();
    pxe.getContractInstance.mockResolvedValueOnce(instanceAddress('0xabc'));

    const registry = new ContractRegistry(pxe as any, contracts, sandboxConfig);
    await registry.registerAll();

    expect(registry.getStatus('dripper')).toBe('ready');
    expect(pxe.registerContract).not.toHaveBeenCalled();
  });

  it('does not re-register after an initial successful register', async () => {
    const pxe = mockPXE();
    const registry = new ContractRegistry(pxe as any, contracts, sandboxConfig);
    const registerInstanceSpy = vi
      .spyOn(ContractRegistry.prototype as any, 'registerInstanceWithPXE')
      .mockImplementation(async () => {
        await pxe.registerContract();
        return instanceAddress(TEST_ADDR) as any;
      });

    await registry.register('dripper');
    await registry.registerAll();

    expect(pxe.registerContract).toHaveBeenCalledTimes(1);
    expect(registry.getStatus('dripper')).toBe('ready');
    registerInstanceSpy.mockRestore();
  });

  it('sets status to error when registered address mismatches expected', async () => {
    const pxe = mockPXE();
    const registry = new ContractRegistry(pxe as any, contracts, sandboxConfig);

    const contractsModule = await import('@aztec/aztec.js/contracts');
    const spy = vi.spyOn(contractsModule, 'getContractInstanceFromInstantiationParams');
    spy.mockResolvedValueOnce(instanceAddress('0xdead'));

    await expect(registry.register('dripper')).rejects.toThrow(/mismatch/);
    expect(registry.getStatus('dripper')).toBe('error');
  });
});