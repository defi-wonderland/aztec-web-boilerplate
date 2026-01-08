import { AztecAddress } from '@aztec/aztec.js/addresses';
import {
  type AztecAddressLike,
  type ContractArtifact,
  type FieldLike,
} from '@aztec/aztec.js/abi';
import {
  ContractBase,
  ContractFunctionInteraction,
  type ContractMethod,
  DeployMethod,
} from '@aztec/aztec.js/contracts';
import { PublicKeys } from '@aztec/aztec.js/keys';
import type { Wallet } from '@aztec/aztec.js/wallet';
export declare const DripperContractArtifact: ContractArtifact;
/**
 * Type-safe interface for contract Dripper;
 */
export declare class DripperContract extends ContractBase {
  private constructor();
  /**
   * Creates a contract instance.
   * @param address - The deployed contract's address.
   * @param wallet - The wallet to use when interacting with the contract.
   * @returns A new Contract instance.
   */
  static at(address: AztecAddress, wallet: Wallet): DripperContract;
  /**
   * Creates a tx to deploy a new instance of this contract.
   */
  static deploy(wallet: Wallet): DeployMethod<DripperContract>;
  /**
   * Creates a tx to deploy a new instance of this contract using the specified public keys hash to derive the address.
   */
  static deployWithPublicKeys(
    publicKeys: PublicKeys,
    wallet: Wallet
  ): DeployMethod<DripperContract>;
  /**
   * Creates a tx to deploy a new instance of this contract using the specified constructor method.
   */
  static deployWithOpts<M extends keyof DripperContract['methods']>(
    opts: {
      publicKeys?: PublicKeys;
      method?: M;
      wallet: Wallet;
    },
    ...args: Parameters<DripperContract['methods'][M]>
  ): DeployMethod<DripperContract>;
  /**
   * Returns this contract's artifact.
   */
  static get artifact(): ContractArtifact;
  /**
   * Returns this contract's artifact with public bytecode.
   */
  static get artifactForPublic(): ContractArtifact;
  /** Type-safe wrappers for the public methods exposed by the contract. */
  methods: {
    /** constructor() */
    constructor: (() => ContractFunctionInteraction) &
      Pick<ContractMethod, 'selector'>;
    /** drip_to_private(token_address: struct, amount: integer) */
    drip_to_private: ((
      token_address: AztecAddressLike,
      amount: bigint | number
    ) => ContractFunctionInteraction) &
      Pick<ContractMethod, 'selector'>;
    /** drip_to_public(token_address: struct, amount: integer) */
    drip_to_public: ((
      token_address: AztecAddressLike,
      amount: bigint | number
    ) => ContractFunctionInteraction) &
      Pick<ContractMethod, 'selector'>;
    /** process_message(message_ciphertext: struct, message_context: struct) */
    process_message: ((
      message_ciphertext: FieldLike[],
      message_context: {
        tx_hash: FieldLike;
        unique_note_hashes_in_tx: FieldLike[];
        first_nullifier_in_tx: FieldLike;
        recipient: AztecAddressLike;
      }
    ) => ContractFunctionInteraction) &
      Pick<ContractMethod, 'selector'>;
    /** public_dispatch(selector: field) */
    public_dispatch: ((selector: FieldLike) => ContractFunctionInteraction) &
      Pick<ContractMethod, 'selector'>;
    /** sync_private_state() */
    sync_private_state: (() => ContractFunctionInteraction) &
      Pick<ContractMethod, 'selector'>;
  };
}
