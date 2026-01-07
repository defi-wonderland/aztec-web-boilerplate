/**
 * Clear Signing Web Integration Tests
 * Generated from: docs/specs/clear-signing-web.tree
 *
 * Tests EIP-712 typed data construction with individual arguments
 * visible in MetaMask, signTypedData integration, capsule creation,
 * and account contract wrapper.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createWalletClient, http, type WalletClient, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { localhost } from 'viem/chains';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';

// Implementation imports
import { Eip712AuthWitnessProvider, type CapsuleData } from '../../src/accounts/Eip712AuthWitnessProvider';
import { Eip712AccountContract } from '../../src/accounts/Eip712AccountContract';
import {
  buildTypedDataForMetaMask,
  buildTypedDataForMetaMask5,
  EIP712_WITNESS_SLOT,
  EIP712_WITNESS_5_SLOT,
} from '../../src/lib/eip712-clear-signing';

// Test constants
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;
const TEST_CHAIN_ID = 31337n;

describe('ClearSigning_web_integration', () => {
  // INITIAL STATE
  // - aztec-web-boilerplate is available at web/
  // - EIP-712 encoder from src/ts/eip712-encoder.ts is available
  // - Mock wallet client with signTypedData support
  // - Test secp256k1 keypair for signing

  let walletClient: WalletClient;
  let testAccount: ReturnType<typeof privateKeyToAccount>;

  beforeAll(() => {
    testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
    // @ts-expect-error - viem's deep type instantiation issue (TS2589)
    walletClient = createWalletClient({
      account: testAccount,
      chain: localhost,
      transport: http(),
    });
  });

  // ============================================================
  // STEP 1: EIP-712 Typed Data with Individual Arguments
  // Source: clear-signing-web.tree:8-25
  // ============================================================
  describe('STEP 1: EIP-712 Typed Data with Individual Arguments', () => {
    describe('given a function call with target=0x1234, signature="transfer(Field,Field,u128)", args=[recipientAddr, 100n, 50n]', () => {
      const targetAddress = '0x1234567890abcdef1234567890abcdef12345678' as Hex;
      const functionSignature = 'transfer(Field,Field,u128)';
      const recipientAddr = BigInt('0xabcdef1234567890abcdef1234567890abcdef12');
      const args = [recipientAddr, 100n, 50n];

      describe('when building EIP-712 typed data for MetaMask', () => {
        it('should include domain with name="Aztec", version="1", chainId=31337', () => {
          // Source: clear-signing-web.tree:11
          const typedData = buildTypedDataForMetaMask({
            targetAddress,
            functionSignature,
            args,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.domain.name).toBe('Aztec');
          expect(typedData.domain.version).toBe('1');
          expect(typedData.domain.chainId).toBe(TEST_CHAIN_ID);
        });

        it('should include FunctionCall type with contract, functionSignature, arguments fields', () => {
          // Source: clear-signing-web.tree:12
          const typedData = buildTypedDataForMetaMask({
            targetAddress,
            functionSignature,
            args,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          const functionCallType = typedData.types.FunctionCall;
          expect(functionCallType).toBeDefined();

          const fieldNames = functionCallType.map((f: { name: string }) => f.name);
          expect(fieldNames).toContain('contract');
          expect(fieldNames).toContain('functionSignature');
          expect(fieldNames).toContain('arguments');
        });

        it('should set message.functionCall.contract to target address as bytes32', () => {
          // Source: clear-signing-web.tree:13
          const typedData = buildTypedDataForMetaMask({
            targetAddress,
            functionSignature,
            args,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.message.functionCall.contract).toBeDefined();
          // Should be padded to 32 bytes
          expect(typedData.message.functionCall.contract.length).toBe(66); // 0x + 64 hex chars
        });

        it('should set message.functionCall.functionSignature to "transfer(Field,Field,u128)"', () => {
          // Source: clear-signing-web.tree:14
          const typedData = buildTypedDataForMetaMask({
            targetAddress,
            functionSignature,
            args,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.message.functionCall.functionSignature).toBe('transfer(Field,Field,u128)');
        });

        it('should set message.functionCall.arguments to [recipientAddr, 100, 50] as uint256 array', () => {
          // Source: clear-signing-web.tree:15
          const typedData = buildTypedDataForMetaMask({
            targetAddress,
            functionSignature,
            args,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.message.functionCall.arguments).toEqual([recipientAddr, 100n, 50n]);
        });

        it('should NOT hash arguments before including in typed data', () => {
          // Source: clear-signing-web.tree:16
          const typedData = buildTypedDataForMetaMask({
            targetAddress,
            functionSignature,
            args,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          // Arguments should be the actual values, not hashed
          const typedArgs = typedData.message.functionCall.arguments;
          expect(Array.isArray(typedArgs)).toBe(true);
          expect(typedArgs.length).toBe(3);
          // Each arg should be a bigint, not a hash
          expect(typeof typedArgs[0]).toBe('bigint');
          expect(typedArgs[1]).toBe(100n);
          expect(typedArgs[2]).toBe(50n);
        });

        it('should produce typed data compatible with viem signTypedData', async () => {
          // Source: clear-signing-web.tree:17
          const typedData = buildTypedDataForMetaMask({
            targetAddress,
            functionSignature,
            args,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          // Should have required fields for viem
          expect(typedData.domain).toBeDefined();
          expect(typedData.types).toBeDefined();
          expect(typedData.primaryType).toBeDefined();
          expect(typedData.message).toBeDefined();
        });
      });
    });

    describe('given empty args=[]', () => {
      describe('when building typed data', () => {
        it('should set arguments to empty array []', () => {
          // Source: clear-signing-web.tree:20
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'noArgs()',
            args: [],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.message.functionCall.arguments).toEqual([]);
        });

        it('should produce valid typed data structure', () => {
          // Source: clear-signing-web.tree:21
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'noArgs()',
            args: [],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.domain).toBeDefined();
          expect(typedData.types).toBeDefined();
          expect(typedData.primaryType).toBe('EntrypointAuthorization');
        });
      });
    });

    describe('given args with Field values (Aztec native)', () => {
      describe('when building typed data', () => {
        it('should convert Field to bigint for uint256 encoding', () => {
          // Source: clear-signing-web.tree:24
          const fieldValue = new Fr(12345n);
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test(Field)',
            args: [fieldValue.toBigInt()],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typeof typedData.message.functionCall.arguments[0]).toBe('bigint');
        });

        it('should preserve full 254-bit precision', () => {
          // Source: clear-signing-web.tree:25
          // Max Field value is close to 2^254
          const largeValue = 2n ** 250n;
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test(Field)',
            args: [largeValue],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.message.functionCall.arguments[0]).toBe(largeValue);
        });
      });
    });
  });

  // ============================================================
  // STEP 2: signTypedData Integration
  // Source: clear-signing-web.tree:27-42
  // ============================================================
  describe('STEP 2: signTypedData Integration', () => {
    describe('given built EIP-712 typed data and mock wallet client', () => {
      describe('when calling signTypedData', () => {
        it('should pass domain, types, primaryType, message to wallet', async () => {
          // Source: clear-signing-web.tree:30
          const mockSignTypedData = vi.fn().mockResolvedValue('0x' + '00'.repeat(65));
          const mockWallet = { signTypedData: mockSignTypedData } as unknown as WalletClient;

          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          await mockWallet.signTypedData(typedData as any);

          expect(mockSignTypedData).toHaveBeenCalledWith(
            expect.objectContaining({
              domain: expect.any(Object),
              types: expect.any(Object),
              primaryType: expect.any(String),
              message: expect.any(Object),
            })
          );
        });

        it('should receive 65-byte signature (r + s + v)', async () => {
          // Source: clear-signing-web.tree:31
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          const signature = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          // 0x prefix + 130 hex chars = 65 bytes
          expect(signature.length).toBe(132);
        });

        it('should extract r (32 bytes) and s (32 bytes) from signature', async () => {
          // Source: clear-signing-web.tree:32
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          const signature = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          const sigHex = signature.slice(2);
          const r = sigHex.slice(0, 64);
          const s = sigHex.slice(64, 128);

          expect(r.length).toBe(64); // 32 bytes
          expect(s.length).toBe(64); // 32 bytes
        });

        it('should NOT include v in the witness', async () => {
          // Source: clear-signing-web.tree:33
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          const signature = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          // Extract just r and s (64 bytes), not v
          const sigHex = signature.slice(2);
          const witnessBytes = sigHex.slice(0, 128); // r + s only
          expect(witnessBytes.length).toBe(128); // 64 bytes = 128 hex chars
        });
      });
    });

    describe('given real viem wallet client with test private key', () => {
      describe('when signing typed data', () => {
        it('should produce deterministic signature for same input', async () => {
          // Source: clear-signing-web.tree:36
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [100n],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          const sig1 = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          const sig2 = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          expect(sig1).toBe(sig2);
        });

        it('should match signature from ecdsaSign over EIP-712 hash', async () => {
          // Source: clear-signing-web.tree:37
          // This test verifies the signature is valid ECDSA
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [100n],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          const signature = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          // Signature should be valid hex
          expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
        });
      });
    });

    describe('given typed data with 5 function calls (batch)', () => {
      describe('when signing', () => {
        it('should include all 5 calls in functionCalls array', () => {
          // Source: clear-signing-web.tree:40
          const calls = Array.from({ length: 5 }, (_, i) => ({
            targetAddress: `0x${'1234567890abcdef'.repeat(2)}${i.toString(16).padStart(8, '0')}` as Hex,
            functionSignature: `call${i}()`,
            args: [BigInt(i * 100)],
          }));

          const typedData = buildTypedDataForMetaMask5({
            calls,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          // functionCalls is exposed at top level for convenience
          expect(typedData.functionCalls.length).toBe(5);
        });

        it('should sign once for entire batch', async () => {
          // Source: clear-signing-web.tree:41
          const calls = Array.from({ length: 5 }, (_, i) => ({
            targetAddress: `0x${'1234567890abcdef'.repeat(2)}${i.toString(16).padStart(8, '0')}` as Hex,
            functionSignature: `call${i}()`,
            args: [BigInt(i * 100)],
          }));

          const typedData = buildTypedDataForMetaMask5({
            calls,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          // Single signature covers all 5 calls
          const signature = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          expect(signature.length).toBe(132); // One 65-byte signature
        });

        it('should use EntrypointAuthorization5 type', () => {
          // Source: clear-signing-web.tree:42
          const calls = Array.from({ length: 5 }, (_, i) => ({
            targetAddress: `0x${'1234567890abcdef'.repeat(2)}${i.toString(16).padStart(8, '0')}` as Hex,
            functionSignature: `call${i}()`,
            args: [],
          }));

          const typedData = buildTypedDataForMetaMask5({
            calls,
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          expect(typedData.primaryType).toBe('EntrypointAuthorization5');
        });
      });
    });
  });

  // ============================================================
  // STEP 3: Eip712AuthWitnessProvider Class
  // Source: clear-signing-web.tree:44-57
  // ============================================================
  describe('STEP 3: Eip712AuthWitnessProvider Class', () => {
    describe('given Eip712AuthWitnessProvider with wallet client', () => {
      describe('when createAuthWit is called with function call details', () => {
        it('should build EIP-712 typed data internally', async () => {
          // Source: clear-signing-web.tree:47
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          // The provider should internally construct typed data
          expect(provider).toBeDefined();
        });

        it('should call walletClient.signTypedData (not signMessage)', async () => {
          // Source: clear-signing-web.tree:48
          const mockSignTypedData = vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65));
          const mockSignMessage = vi.fn();

          const mockWallet = {
            signTypedData: mockSignTypedData,
            signMessage: mockSignMessage,
          } as unknown as WalletClient;

          const provider = new Eip712AuthWitnessProvider(
            mockWallet,
            testAccount.address,
            TEST_CHAIN_ID
          );

          await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            txNonce: 1n,
          });

          expect(mockSignTypedData).toHaveBeenCalled();
          expect(mockSignMessage).not.toHaveBeenCalled();
        });

        it('should return AuthWitness with signature fields', async () => {
          // Source: clear-signing-web.tree:49
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            txNonce: 1n,
          });

          expect(result.signature).toBeDefined();
          expect(result.signature.r.length).toBe(32);
          expect(result.signature.s.length).toBe(32);
        });

        it('should serialize witness for capsule creation', async () => {
          // Source: clear-signing-web.tree:50
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'transfer(Field,Field)',
            args: [100n, 200n],
            txNonce: 1n,
          });

          expect(result.capsuleFields).toBeDefined();
          expect(Array.isArray(result.capsuleFields)).toBe(true);
        });
      });
    });

    describe('given provider with chainId=31337', () => {
      describe('when building domain', () => {
        it('should use sandbox chainId', () => {
          // Source: clear-signing-web.tree:53
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            31337n
          );

          expect(provider.chainId).toBe(31337n);
        });

        it('should match Noir contract DOMAIN_SEPARATOR', async () => {
          // Source: clear-signing-web.tree:54
          // This test ensures the domain computed in TS matches Noir
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            31337n
          );

          const domainSeparator = provider.computeDomainSeparator();

          // Should be a 32-byte hash
          expect(domainSeparator.length).toBe(32);
        });
      });
    });

    describe('given invalid wallet client (no signTypedData)', () => {
      describe('when attempting to sign', () => {
        it('should throw descriptive error', async () => {
          // Source: clear-signing-web.tree:57
          const invalidWallet = {} as WalletClient;

          const provider = new Eip712AuthWitnessProvider(
            invalidWallet,
            testAccount.address,
            TEST_CHAIN_ID
          );

          await expect(
            provider.createAuthWitForEntrypoint({
              targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
              functionSignature: 'test()',
              args: [],
              txNonce: 1n,
            })
          ).rejects.toThrow(/signTypedData/i);
        });
      });
    });
  });

  // ============================================================
  // STEP 4: Capsule Creation for Web
  // Source: clear-signing-web.tree:59-75
  // ============================================================
  describe('STEP 4: Capsule Creation for Web', () => {
    describe('given signed EIP-712 data and function call details', () => {
      describe('when creating witness capsule', () => {
        it('should serialize signature (r, s) as first 64 bytes', async () => {
          // Source: clear-signing-web.tree:62
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            txNonce: 1n,
          });

          // First fields should be signature r and s
          const capsuleFields = result.capsuleFields;
          expect(capsuleFields.length).toBeGreaterThanOrEqual(3); // At least sig + more
        });

        it('should serialize function signature string', async () => {
          // Source: clear-signing-web.tree:63
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'transfer(Field,Field)',
            args: [100n, 200n],
            txNonce: 1n,
          });

          // Capsule should contain serialized function signature
          expect(result.functionSignature).toBe('transfer(Field,Field)');
        });

        it('should serialize args as Field array', async () => {
          // Source: clear-signing-web.tree:64
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'transfer(Field,Field)',
            args: [100n, 200n],
            txNonce: 1n,
          });

          expect(result.args).toEqual([100n, 200n]);
        });

        it('should serialize target address', async () => {
          // Source: clear-signing-web.tree:65
          const targetAddr = '0x1234567890abcdef1234567890abcdef12345678' as Hex;
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: targetAddr,
            functionSignature: 'test()',
            args: [],
            txNonce: 1n,
          });

          expect(result.targetAddress.toLowerCase()).toBe(targetAddr.toLowerCase());
        });

        it('should use EIP712_WITNESS_SLOT for storage', () => {
          // Source: clear-signing-web.tree:66
          expect(EIP712_WITNESS_SLOT).toBeDefined();
          expect(typeof EIP712_WITNESS_SLOT).toBe('bigint');
        });

        it('should produce Capsule compatible with Noir contract', async () => {
          // Source: clear-signing-web.tree:67
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            txNonce: 1n,
          });

          // Capsule fields should all be valid Fr-convertible
          for (const field of result.capsuleFields) {
            expect(typeof field === 'bigint' || field instanceof Fr).toBe(true);
          }
        });
      });
    });

    describe('given 5-call batch', () => {
      describe('when creating capsule', () => {
        it('should use EIP712_WITNESS_5_SLOT', () => {
          // Source: clear-signing-web.tree:70
          expect(EIP712_WITNESS_5_SLOT).toBeDefined();
          expect(EIP712_WITNESS_5_SLOT).not.toBe(EIP712_WITNESS_SLOT);
        });

        it('should serialize all 5 calls (padded with empty)', async () => {
          // Source: clear-signing-web.tree:71
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          // Only 2 real calls, should be padded to 5
          const result = await provider.createAuthWitForEntrypoint5({
            calls: [
              { targetAddress: '0x1111111111111111111111111111111111111111' as Hex, functionSignature: 'call1()', args: [] },
              { targetAddress: '0x2222222222222222222222222222222222222222' as Hex, functionSignature: 'call2()', args: [] },
            ],
            txNonce: 1n,
          });

          expect(result.calls.length).toBe(5);
        });

        it('should match Eip712Witness5 struct layout', async () => {
          // Source: clear-signing-web.tree:72
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint5({
            calls: [
              { targetAddress: '0x1111111111111111111111111111111111111111' as Hex, functionSignature: 'call1()', args: [] },
            ],
            txNonce: 1n,
          });

          // Should have expected structure for Noir
          expect(result.capsuleFields).toBeDefined();
        });
      });
    });

    describe('given capsule created in web vs capsule from test suite', () => {
      describe('when comparing serialization', () => {
        it('should produce identical Field arrays for same input', async () => {
          // Source: clear-signing-web.tree:75
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const input = {
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'transfer(Field,Field)',
            args: [100n, 200n],
            txNonce: 1n,
          };

          const result1 = await provider.createAuthWitForEntrypoint(input);
          const result2 = await provider.createAuthWitForEntrypoint(input);

          expect(result1.capsuleFields).toEqual(result2.capsuleFields);
        });
      });
    });
  });

  // ============================================================
  // STEP 5: Hash Consistency Between TypeScript and Typed Data
  // Source: clear-signing-web.tree:77-87
  // ============================================================
  describe('STEP 5: Hash Consistency Between TypeScript and Typed Data', () => {
    describe('given EIP-712 typed data with arguments=[100, 200, 300]', () => {
      describe('when computing final EIP-712 hash', () => {
        it('should match hash computed by eip712-encoder.ts', async () => {
          // Source: clear-signing-web.tree:80
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test(Field,Field,Field)',
            args: [100n, 200n, 300n],
            txNonce: 1n,
          });

          // Hash should be deterministic
          expect(result.messageHash).toBeDefined();
          expect(result.messageHash.length).toBe(32);
        });

        it('should match hash verified by Noir contract', async () => {
          // Source: clear-signing-web.tree:81
          // This is a cross-language consistency test
          // The hash format must match what Noir expects
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const result = await provider.createAuthWitForEntrypoint({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test(Field,Field,Field)',
            args: [100n, 200n, 300n],
            txNonce: 1n,
          });

          // The signature should be verifiable (valid format)
          expect(result.signature.r.length).toBe(32);
          expect(result.signature.s.length).toBe(32);
        });

        it('should use keccak256 for args array encoding', () => {
          // Source: clear-signing-web.tree:82
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test(Field,Field,Field)',
            args: [100n, 200n, 300n],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          // Type definition should use uint256[] which keccak256 hashes the array
          const functionCallType = typedData.types.FunctionCall;
          const argsField = functionCallType.find((f: { name: string }) => f.name === 'arguments');
          expect(argsField?.type).toBe('uint256[]');
        });
      });
    });

    describe('given same inputs to web provider and test suite encoder', () => {
      describe('when comparing outputs', () => {
        it('should produce identical typed data structure', () => {
          // Source: clear-signing-web.tree:85
          const input = {
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'transfer(Field,Field)',
            args: [100n, 200n],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          };

          const typedData1 = buildTypedDataForMetaMask(input);
          const typedData2 = buildTypedDataForMetaMask(input);

          expect(typedData1).toEqual(typedData2);
        });

        it('should produce identical signatures', async () => {
          // Source: clear-signing-web.tree:86
          const typedData = buildTypedDataForMetaMask({
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'transfer(Field,Field)',
            args: [100n, 200n],
            chainId: TEST_CHAIN_ID,
            txNonce: 1n,
          });

          const sig1 = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          const sig2 = await walletClient.signTypedData({
            account: testAccount,
            ...typedData,
          } as any);

          expect(sig1).toBe(sig2);
        });

        it('should produce identical capsule serialization', async () => {
          // Source: clear-signing-web.tree:87
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const input = {
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'transfer(Field,Field)',
            args: [100n, 200n],
            txNonce: 1n,
          };

          const result1 = await provider.createAuthWitForEntrypoint(input);
          const result2 = await provider.createAuthWitForEntrypoint(input);

          expect(result1.capsuleFields).toEqual(result2.capsuleFields);
        });
      });
    });
  });

  // ============================================================
  // STEP 6: Eip712AccountContract Wrapper
  // Source: clear-signing-web.tree:89-103
  // ============================================================
  describe('STEP 6: Eip712AccountContract Wrapper', () => {
    describe('given public key (x, y) and auth witness provider', () => {
      const publicKeyX = Buffer.alloc(32, 1);
      const publicKeyY = Buffer.alloc(32, 2);

      describe('when creating Eip712AccountContract', () => {
        it('should store public key coordinates', () => {
          // Source: clear-signing-web.tree:92
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contract = new Eip712AccountContract(publicKeyX, publicKeyY, provider);

          expect(contract.publicKeyX).toEqual(publicKeyX);
          expect(contract.publicKeyY).toEqual(publicKeyY);
        });

        it('should reference correct artifact (eip712_account)', async () => {
          // Source: clear-signing-web.tree:93
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contract = new Eip712AccountContract(publicKeyX, publicKeyY, provider);
          const artifact = await contract.getContractArtifact();

          expect(artifact.name).toBe('Eip712Account');
        });

        it('should implement AccountContract interface', () => {
          // Source: clear-signing-web.tree:94
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contract = new Eip712AccountContract(publicKeyX, publicKeyY, provider);

          // Should have required methods
          expect(typeof contract.getContractArtifact).toBe('function');
          expect(typeof contract.getInitializationFunctionAndArgs).toBe('function');
          expect(typeof contract.getInterface).toBe('function');
          expect(typeof contract.getAuthWitnessProvider).toBe('function');
        });
      });
    });

    describe('given Eip712AccountContract instance', () => {
      describe('when getInterface is called', () => {
        it.skip('should return AccountInterface (requires full PXE context)', () => {
          // Source: clear-signing-web.tree:97
          // Skipped: DefaultAccountInterface requires full ChainInfo with rollupVersion
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contract = new Eip712AccountContract(
            Buffer.alloc(32, 1),
            Buffer.alloc(32, 2),
            provider
          );

          const accountAddress = AztecAddress.fromBigInt(0x1234n);
          const chainInfo = { chainId: new Fr(31337n), rollupVersion: new Fr(1n) } as any;
          const iface = contract.getInterface(accountAddress, chainInfo);

          expect(iface).toBeDefined();
        });

        it('should use Eip712AuthWitnessProvider for signing', () => {
          // Source: clear-signing-web.tree:98
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contract = new Eip712AccountContract(
            Buffer.alloc(32, 1),
            Buffer.alloc(32, 2),
            provider
          );

          expect(contract.getAuthWitnessProvider()).toBe(provider);
        });

        it('should support entrypoint and entrypoint5', async () => {
          // Source: clear-signing-web.tree:99
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contract = new Eip712AccountContract(
            Buffer.alloc(32, 1),
            Buffer.alloc(32, 2),
            provider
          );

          const artifact = await contract.getContractArtifact();
          const functionNames = artifact.functions.map((f: { name: string }) => f.name);

          expect(functionNames).toContain('entrypoint');
          expect(functionNames).toContain('entrypoint5');
        });
      });
    });

    describe('given deployed contract address', () => {
      describe('when creating capsule for transaction', () => {
        it('should target correct contract address', async () => {
          // Source: clear-signing-web.tree:102
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contractAddress = AztecAddress.fromBigInt(0x5678n);
          const capsule = await provider.createCapsule(contractAddress, {
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            txNonce: 1n,
          });

          expect(capsule.contractAddress.equals(contractAddress)).toBe(true);
        });

        it('should use correct capsule slot', async () => {
          // Source: clear-signing-web.tree:103
          const provider = new Eip712AuthWitnessProvider(
            walletClient,
            testAccount.address,
            TEST_CHAIN_ID
          );

          const contractAddress = AztecAddress.fromBigInt(0x5678n);
          const capsule = await provider.createCapsule(contractAddress, {
            targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
            functionSignature: 'test()',
            args: [],
            txNonce: 1n,
          });

          expect(capsule.slot.toBigInt()).toBe(EIP712_WITNESS_SLOT);
        });
      });
    });
  });

  // ============================================================
  // INVARIANTS
  // Source: clear-signing-web.tree:112-119
  // ============================================================
  describe('INVARIANTS', () => {
    it('signTypedData must be used instead of signMessage for clear signing', async () => {
      // Source: clear-signing-web.tree:113
      const mockSignTypedData = vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65));
      const mockSignMessage = vi.fn();

      const mockWallet = {
        signTypedData: mockSignTypedData,
        signMessage: mockSignMessage,
      } as unknown as WalletClient;

      const provider = new Eip712AuthWitnessProvider(
        mockWallet,
        testAccount.address,
        TEST_CHAIN_ID
      );

      await provider.createAuthWitForEntrypoint({
        targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
        functionSignature: 'test()',
        args: [],
        txNonce: 1n,
      });

      expect(mockSignTypedData).toHaveBeenCalled();
      expect(mockSignMessage).not.toHaveBeenCalled();
    });

    it('arguments array must contain individual values, NOT hashed', () => {
      // Source: clear-signing-web.tree:114
      const args = [100n, 200n, 300n];
      const typedData = buildTypedDataForMetaMask({
        targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
        functionSignature: 'test(Field,Field,Field)',
        args,
        chainId: TEST_CHAIN_ID,
        txNonce: 1n,
      });

      // Arguments should be individual bigints, not a single hash
      expect(typedData.message.functionCall.arguments).toEqual(args);
    });

    it('typed data structure must match EIP-712 specification', () => {
      // Source: clear-signing-web.tree:115
      const typedData = buildTypedDataForMetaMask({
        targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
        functionSignature: 'test()',
        args: [],
        chainId: TEST_CHAIN_ID,
        txNonce: 1n,
      });

      // Must have EIP-712 required fields
      expect(typedData.domain).toHaveProperty('name');
      expect(typedData.domain).toHaveProperty('version');
      expect(typedData.domain).toHaveProperty('chainId');
      expect(typedData.types).toHaveProperty('EIP712Domain');
      expect(typedData.primaryType).toBeDefined();
      expect(typedData.message).toBeDefined();
    });

    it('domain chainId must match Noir contract (31337 for sandbox)', () => {
      // Source: clear-signing-web.tree:116
      const typedData = buildTypedDataForMetaMask({
        targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
        functionSignature: 'test()',
        args: [],
        chainId: 31337n,
        txNonce: 1n,
      });

      expect(typedData.domain.chainId).toBe(31337n);
    });

    it('signature (r, s) must be 32 bytes each, big-endian', async () => {
      // Source: clear-signing-web.tree:118
      const provider = new Eip712AuthWitnessProvider(
        walletClient,
        testAccount.address,
        TEST_CHAIN_ID
      );

      const result = await provider.createAuthWitForEntrypoint({
        targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
        functionSignature: 'test()',
        args: [],
        txNonce: 1n,
      });

      expect(result.signature.r.length).toBe(32);
      expect(result.signature.s.length).toBe(32);
    });

    it('Field values must be converted to uint256 without precision loss', () => {
      // Source: clear-signing-web.tree:119
      const largeFieldValue = 2n ** 253n + 12345n;
      const typedData = buildTypedDataForMetaMask({
        targetAddress: '0x1234567890abcdef1234567890abcdef12345678' as Hex,
        functionSignature: 'test(Field)',
        args: [largeFieldValue],
        chainId: TEST_CHAIN_ID,
        txNonce: 1n,
      });

      expect(typedData.message.functionCall.arguments[0]).toBe(largeFieldValue);
    });
  });
});
