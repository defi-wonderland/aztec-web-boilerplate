/**
 * WalletProxy creates an Aztec Wallet interface backed by a SecureChannel.
 *
 * Follows the same pattern as ExtensionWallet from @aztec/wallet-sdk:
 * - Uses WalletSchema to detect valid Wallet methods
 * - Uses jsonStringify to serialize Aztec types (Fr, AztecAddress, Buffer, etc.)
 * - Uses WalletSchema[method].returnType() to deserialize responses
 *
 * The serialization approach:
 * - SDK → Worker: args are serialized via jsonStringify into a JSON string,
 *   then sent as a single string param over SecureChannel (which uses JSON.stringify
 *   internally — a string just becomes a quoted string, so no double-encoding issues).
 * - Worker → SDK: result is serialized via jsonStringify, returned as a string,
 *   then parsed via WalletSchema's Zod schemas on this side.
 */
import type { Wallet } from '@aztec/aztec.js/wallet';
import { WalletSchema } from '@aztec/aztec.js/wallet';
import { jsonStringify } from '@aztec/foundation/json-rpc';
import { schemaHasMethod } from '@aztec/foundation/schemas';

import type { SecureChannel } from '../shared/SecureChannel';

/**
 * Creates a Proxy that implements the Wallet interface by forwarding all
 * method calls through the SecureChannel to the iframe → Worker.
 *
 * @param channel - The established SecureChannel to the wallet host iframe
 * @returns A Wallet-compatible proxy
 */
export function createWalletProxy(channel: SecureChannel): Wallet {
  return new Proxy({} as Wallet, {
    get: (_target, prop: string | symbol) => {
      if (typeof prop === 'symbol') return undefined;

      // Do not intercept Promise-related properties — this prevents the proxy
      // from being mistaken for a thenable, which causes infinite await loops.
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;

      if (schemaHasMethod(WalletSchema, prop)) {
        return async (...args: unknown[]) => {
          // Pad args with undefined to match the schema's expected tuple length.
          // Zod tuples are strict about length — optional params must be present
          // as undefined/null, otherwise parseAsync rejects.
          const schema = WalletSchema[prop as keyof typeof WalletSchema];
          if (schema && typeof schema.parameters === 'function') {
            try {
              const shape = schema.parameters();
              // Access the _def.items array to get the expected tuple length
              const expectedLength = (shape as any)?._def?.items?.length;
              if (expectedLength && args.length < expectedLength) {
                while (args.length < expectedLength) {
                  args.push(undefined);
                }
              }
            } catch {
              // If we can't determine length, proceed with original args
            }
          }

          // Serialize args with jsonStringify to handle Aztec types (Fr, Buffer, etc.)
          const serializedArgs = jsonStringify(args);

          // Send via SecureChannel: method='wallet', params=[methodName, serializedArgsString]
          const rawResult = await channel.send('wallet', [prop, serializedArgs]);

          // The worker returns a jsonStringify'd result string.
          // Parse the raw JSON string, then validate with WalletSchema.
          const parsed = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
          return WalletSchema[prop as keyof typeof WalletSchema]
            .returnType()
            .parseAsync(parsed);
        };
      }

      return undefined;
    },
  });
}
