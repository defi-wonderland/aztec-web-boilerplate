import { Fr } from '@aztec/foundation/fields';
import { type FunctionAbi, FunctionSelector, encodeArguments } from '@aztec/stdlib/abi';
import type { AztecAddress } from '@aztec/stdlib/aztec-address';
import type { GasSettings } from '@aztec/stdlib/gas';
import { HashedValues, TxContext, TxExecutionRequest } from '@aztec/stdlib/tx';
import { computeVarArgsHash } from '@aztec/stdlib/hash';
import type { EntrypointInterface } from '@aztec/entrypoints/interfaces';
import { ExecutionPayload } from '@aztec/entrypoints/payload';
import { EncodedAppEntrypointCalls } from '@aztec/entrypoints/encoding';
import type { EIP712AuthWitnessProvider } from './EIP712Types';

/** Default L1 chain ID (matches hardhat/anvil default) */
const DEFAULT_CHAIN_ID = 31337;
/** Default protocol version */
const DEFAULT_VERSION = 1;

/**
 * Options for the EIP712 account entrypoint.
 */
export interface EIP712EntrypointOptions {
  /** Whether the transaction can be cancelled */
  cancellable?: boolean;
  /** Transaction nonce for cancellation */
  txNonce?: Fr;
  /** Fee payment method option */
  feePaymentMethodOptions: number;
}

/**
 * Account entrypoint that extracts call metadata for EIP-712 signing.
 *
 * Before createTxExecutionRequest is called, setCallContext() must be called
 * on the auth provider with the function signature to display to users.
 */
export class EIP712AccountEntrypoint implements EntrypointInterface {
  constructor(
    private address: AztecAddress,
    private auth: EIP712AuthWitnessProvider,
    private chainId: number = DEFAULT_CHAIN_ID,
    private version: number = DEFAULT_VERSION
  ) {}

  async createTxExecutionRequest(
    exec: ExecutionPayload,
    gasSettings: GasSettings,
    options: EIP712EntrypointOptions
  ): Promise<TxExecutionRequest> {
    const { calls, authWitnesses, capsules, extraHashedArgs } = exec;
    const { cancellable, txNonce, feePaymentMethodOptions } = options;

    // Get the primary call for context
    const primaryCall = calls[0];
    if (primaryCall) {
      // Compute args hash for the primary call
      const argsHash = await computeVarArgsHash(primaryCall.args);

      // Set the call context on the auth provider
      // Note: The function signature must be set separately via setCallContext
      // before this method is called. Here we set the other fields.
      this.auth.setCallContext({
        targetContract: primaryCall.to,
        // This will be overwritten if the caller already set a full context
        // If not set, we use the function name as a fallback
        functionSignature: primaryCall.name + '(...)',
        argsHash,
        nonce: txNonce ?? Fr.random(),
      });
    }

    // Encode the calls for the app payload
    const encodedCalls = await EncodedAppEntrypointCalls.create(
      calls,
      txNonce
    );

    // Build entrypoint args
    const abi = this.getEntrypointAbi();
    const entrypointHashedArgs = await HashedValues.fromArgs(
      encodeArguments(abi, [
        encodedCalls,
        feePaymentMethodOptions,
        !!cancellable,
      ])
    );

    // Generate the auth witness by signing the payload hash
    const appPayloadAuthwitness = await this.auth.createAuthWit(
      await encodedCalls.hash()
    );

    // Assemble the tx request
    const txRequest = TxExecutionRequest.from({
      firstCallArgsHash: entrypointHashedArgs.hash,
      origin: this.address,
      functionSelector: await FunctionSelector.fromNameAndParameters(
        abi.name,
        abi.parameters
      ),
      txContext: new TxContext(this.chainId, this.version, gasSettings),
      argsOfCalls: [
        ...encodedCalls.hashedArguments,
        entrypointHashedArgs,
        ...extraHashedArgs,
      ],
      authWitnesses: [...authWitnesses, appPayloadAuthwitness],
      capsules,
      salt: Fr.random(),
    });

    return txRequest;
  }

  private getEntrypointAbi(): FunctionAbi {
    return {
      name: 'entrypoint',
      isInitializer: false,
      functionType: 'private',
      isInternal: false,
      isStatic: false,
      parameters: [
        {
          name: 'app_payload',
          type: {
            kind: 'struct',
            path: 'authwit::entrypoint::app::AppPayload',
            fields: [
              {
                name: 'function_calls',
                type: {
                  kind: 'array',
                  length: 5,
                  type: {
                    kind: 'struct',
                    path: 'authwit::entrypoint::function_call::FunctionCall',
                    fields: [
                      { name: 'args_hash', type: { kind: 'field' } },
                      {
                        name: 'function_selector',
                        type: {
                          kind: 'struct',
                          path: 'authwit::aztec::protocol_types::abis::function_selector::FunctionSelector',
                          fields: [
                            {
                              name: 'inner',
                              type: {
                                kind: 'integer',
                                sign: 'unsigned',
                                width: 32,
                              },
                            },
                          ],
                        },
                      },
                      {
                        name: 'target_address',
                        type: {
                          kind: 'struct',
                          path: 'authwit::aztec::protocol_types::address::AztecAddress',
                          fields: [{ name: 'inner', type: { kind: 'field' } }],
                        },
                      },
                      { name: 'is_public', type: { kind: 'boolean' } },
                      { name: 'hide_msg_sender', type: { kind: 'boolean' } },
                      { name: 'is_static', type: { kind: 'boolean' } },
                    ],
                  },
                },
              },
              { name: 'tx_nonce', type: { kind: 'field' } },
            ],
          },
          visibility: 'public',
        },
        {
          name: 'fee_payment_method',
          type: { kind: 'integer', sign: 'unsigned', width: 8 },
        },
        { name: 'cancellable', type: { kind: 'boolean' } },
      ],
      returnTypes: [],
      errorTypes: {},
    } as FunctionAbi;
  }
}
