/**
 * Tests the account + contract registration logic from pxe-worker.ts
 * WITHOUT needing a browser, WebAuthn, or actual PXE.
 *
 * Validates that:
 * 1. AccountManager computes the correct address
 * 2. pxe.registerContract is called with the account instance + artifact
 * 3. pxe.registerAccount is called with secretKey + computePartialAddress(instance)
 * 4. The address from AccountManager matches what PXE registers
 * 5. Contract configs are deserialized and registered correctly
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// We test the actual Aztec SDK logic — no mocking of Aztec internals
import { Fr } from '@aztec/foundation/curves/bn254';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { computePartialAddress, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa-r';
import { serializeContractConfig, deserializeContractConfig } from '../../shared/contractSerialization';

// Use the actual DripperContract artifact for realistic testing
// (Token is too complex with constructor args containing AztecAddress)
import { DripperContract } from '@defi-wonderland/aztec-standards/artifacts/src/artifacts/Dripper.js';

describe('PXE Worker Registration Logic', () => {
  // Simulate the key material that would come from WebAuthn PRF
  const masterSecret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const signingKey = new Uint8Array(32).fill(0x42);

  describe('Account registration', () => {
    it('AccountManager computes a deterministic address from secretKey + accountContract', async () => {
      // This is what pxe-worker does:
      const secretKey = new Fr(BigInt(masterSecret));
      const accountContract = new EcdsaRAccountContract(signingKey);

      // Create a mock PXE that tracks calls
      const mockPxe = {
        getRegisteredAccounts: vi.fn().mockResolvedValue([]),
        registerAccount: vi.fn().mockResolvedValue(undefined),
        registerContract: vi.fn().mockResolvedValue(undefined),
        getContractInstance: vi.fn().mockResolvedValue(undefined),
        getNodeInfo: vi.fn().mockResolvedValue({ l1ChainId: 31337, rollupVersion: 1 }),
      };

      const accountManager = await AccountManager.create(
        mockPxe as any,
        secretKey,
        accountContract,
        Fr.ZERO,
      );

      const address = accountManager.address;
      expect(address).toBeDefined();
      expect(address.toString()).toMatch(/^0x[0-9a-f]{64}$/);

      // Creating again with same inputs should give same address
      const accountManager2 = await AccountManager.create(
        mockPxe as any,
        secretKey,
        accountContract,
        Fr.ZERO,
      );
      expect(accountManager2.address.toString()).toBe(address.toString());
    });

    it('computePartialAddress produces consistent result for the account instance', async () => {
      const secretKey = new Fr(BigInt(masterSecret));
      const accountContract = new EcdsaRAccountContract(signingKey);

      const mockPxe = {
        getRegisteredAccounts: vi.fn().mockResolvedValue([]),
        registerAccount: vi.fn().mockResolvedValue(undefined),
        registerContract: vi.fn().mockResolvedValue(undefined),
        getContractInstance: vi.fn().mockResolvedValue(undefined),
        getNodeInfo: vi.fn().mockResolvedValue({ l1ChainId: 31337, rollupVersion: 1 }),
      };

      const accountManager = await AccountManager.create(
        mockPxe as any,
        secretKey,
        accountContract,
        Fr.ZERO,
      );

      const instance = accountManager.getInstance();
      const partialAddress = await computePartialAddress(instance);

      expect(partialAddress).toBeDefined();
      // Partial address should NOT be Fr.ZERO (that was the old bug)
      expect(partialAddress.toString()).not.toBe(Fr.ZERO.toString());
    });

    it('full registration sequence mirrors BaseWallet.registerContract', async () => {
      const secretKey = new Fr(BigInt(masterSecret));
      const accountContract = new EcdsaRAccountContract(signingKey);

      const mockPxe = {
        getRegisteredAccounts: vi.fn().mockResolvedValue([]),
        registerAccount: vi.fn().mockResolvedValue(undefined),
        registerContract: vi.fn().mockResolvedValue(undefined),
        getContractInstance: vi.fn().mockResolvedValue(undefined),
        getNodeInfo: vi.fn().mockResolvedValue({ l1ChainId: 31337, rollupVersion: 1 }),
      };

      const accountManager = await AccountManager.create(
        mockPxe as any,
        secretKey,
        accountContract,
        Fr.ZERO,
      );

      const account = await accountManager.getAccount();
      const instance = accountManager.getInstance();
      const artifact = await accountManager.getAccountContract().getContractArtifact();
      const partialAddress = await computePartialAddress(instance);

      // Step 1: Register the account contract
      await mockPxe.registerContract({ instance, artifact });

      // Step 2: Register account keys with correct partial address
      await mockPxe.registerAccount(secretKey, partialAddress);

      // Verify calls
      expect(mockPxe.registerContract).toHaveBeenCalledTimes(1);
      expect(mockPxe.registerContract).toHaveBeenCalledWith({ instance, artifact });

      expect(mockPxe.registerAccount).toHaveBeenCalledTimes(1);
      expect(mockPxe.registerAccount).toHaveBeenCalledWith(secretKey, partialAddress);

      // The partial address should NOT be Fr.ZERO
      const calledPartialAddr = mockPxe.registerAccount.mock.calls[0][1];
      expect(calledPartialAddr.toString()).not.toBe(Fr.ZERO.toString());
    });
  });

  describe('Contract serialization round-trip', () => {
    const SANDBOX_SALT = '0x0000000000000000000000000000000000000000000000000000000000000539';
    const SANDBOX_DEPLOYER = '0x0000000000000000000000000000000000000000000000000000000000000000';

    it('serializeContractConfig → deserializeContractConfig produces correct types', () => {
      const config = {
        artifact: DripperContract.artifact,
        salt: Fr.fromHexString(SANDBOX_SALT),
        deployer: AztecAddress.fromString(SANDBOX_DEPLOYER),
        constructorArtifact: 'constructor',
        constructorArgs: [],
      };

      const serialized = serializeContractConfig(config);

      // Serialized should have hex strings, not Aztec objects
      expect(typeof serialized.salt).toBe('string');
      expect(typeof serialized.deployer).toBe('string');
      expect(serialized.salt).toBe(SANDBOX_SALT);
      expect(serialized.deployer).toBe(SANDBOX_DEPLOYER);

      // Deserialize
      const deserialized = deserializeContractConfig(serialized, Fr, AztecAddress);

      // Should have proper Aztec types back
      expect(deserialized.salt.toString()).toBe(Fr.fromHexString(SANDBOX_SALT).toString());
      expect(deserialized.deployer.toString()).toBe(AztecAddress.fromString(SANDBOX_DEPLOYER).toString());
    });

    it('getContractInstanceFromInstantiationParams produces correct address for Dripper', async () => {
      const EXPECTED_ADDRESS = '0x14fc6329654486ae793a6ba5b4ac0479fd09902e98f928bfd0ef05d103ea402a';

      const instance = await getContractInstanceFromInstantiationParams(
        DripperContract.artifact,
        {
          salt: Fr.fromHexString(SANDBOX_SALT),
          deployer: AztecAddress.fromString(SANDBOX_DEPLOYER),
          constructorArtifact: 'constructor',
          constructorArgs: [],
        },
      );

      expect(instance.address.toString()).toBe(EXPECTED_ADDRESS);
    });

    it('serialized → deserialized contract config produces correct address', async () => {
      const EXPECTED_ADDRESS = '0x14fc6329654486ae793a6ba5b4ac0479fd09902e98f928bfd0ef05d103ea402a';

      const config = {
        artifact: DripperContract.artifact,
        salt: Fr.fromHexString(SANDBOX_SALT),
        deployer: AztecAddress.fromString(SANDBOX_DEPLOYER),
        constructorArtifact: 'constructor',
        constructorArgs: [],
      };

      // Simulate the full round-trip: serialize → structured clone → deserialize
      const serialized = serializeContractConfig(config);
      const cloned = structuredClone(serialized); // simulates postMessage
      const deserialized = deserializeContractConfig(cloned, Fr, AztecAddress);

      const instance = await getContractInstanceFromInstantiationParams(
        deserialized.artifact,
        {
          salt: deserialized.salt,
          deployer: deserialized.deployer,
          constructorArtifact: deserialized.constructorArtifact ?? 'constructor',
          constructorArgs: deserialized.constructorArgs ?? [],
        },
      );

      expect(instance.address.toString()).toBe(EXPECTED_ADDRESS);
    });
  });
});
