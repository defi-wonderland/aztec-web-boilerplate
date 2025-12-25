import { AztecAddress } from '@aztec/aztec.js/addresses';
import { type AztecAddressLike, type ContractArtifact, type FieldLike } from '@aztec/aztec.js/abi';
import { ContractBase, ContractFunctionInteraction, type ContractMethod, type ContractStorageLayout, DeployMethod } from '@aztec/aztec.js/contracts';
import { PublicKeys } from '@aztec/aztec.js/keys';
import type { Wallet } from '@aztec/aztec.js/wallet';
export declare const TokenContractArtifact: ContractArtifact;
/**
 * Type-safe interface for contract Token;
 */
export declare class TokenContract extends ContractBase {
    private constructor();
    /**
     * Creates a contract instance.
     * @param address - The deployed contract's address.
     * @param wallet - The wallet to use when interacting with the contract.
     * @returns A new Contract instance.
     */
    static at(address: AztecAddress, wallet: Wallet): TokenContract;
    /**
     * Creates a tx to deploy a new instance of this contract.
     */
    static deploy(wallet: Wallet, name: string, symbol: string, decimals: (bigint | number), asset: AztecAddressLike, upgrade_authority: AztecAddressLike): DeployMethod<TokenContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified public keys hash to derive the address.
     */
    static deployWithPublicKeys(publicKeys: PublicKeys, wallet: Wallet, name: string, symbol: string, decimals: (bigint | number), asset: AztecAddressLike, upgrade_authority: AztecAddressLike): DeployMethod<TokenContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified constructor method.
     */
    static deployWithOpts<M extends keyof TokenContract['methods']>(opts: {
        publicKeys?: PublicKeys;
        method?: M;
        wallet: Wallet;
    }, ...args: Parameters<TokenContract['methods'][M]>): DeployMethod<TokenContract>;
    /**
     * Returns this contract's artifact.
     */
    static get artifact(): ContractArtifact;
    /**
     * Returns this contract's artifact with public bytecode.
     */
    static get artifactForPublic(): ContractArtifact;
    static get storage(): ContractStorageLayout<'name' | 'symbol' | 'decimals' | 'private_balances' | 'total_supply' | 'public_balances' | 'minter' | 'upgrade_authority' | 'asset'>;
    /** Type-safe wrappers for the public methods exposed by the contract. */
    methods: {
        /** balance_of_private(owner: struct) */
        balance_of_private: ((owner: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** balance_of_public(owner: struct) */
        balance_of_public: ((owner: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** burn_private(from: struct, amount: integer, _nonce: field) */
        burn_private: ((from: AztecAddressLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** burn_public(from: struct, amount: integer, _nonce: field) */
        burn_public: ((from: AztecAddressLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** constructor_with_asset(name: string, symbol: string, decimals: integer, asset: struct, upgrade_authority: struct) */
        constructor_with_asset: ((name: string, symbol: string, decimals: (bigint | number), asset: AztecAddressLike, upgrade_authority: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** constructor_with_initial_supply(name: string, symbol: string, decimals: integer, initial_supply: integer, to: struct, upgrade_authority: struct) */
        constructor_with_initial_supply: ((name: string, symbol: string, decimals: (bigint | number), initial_supply: (bigint | number), to: AztecAddressLike, upgrade_authority: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** constructor_with_minter(name: string, symbol: string, decimals: integer, minter: struct, upgrade_authority: struct) */
        constructor_with_minter: ((name: string, symbol: string, decimals: (bigint | number), minter: AztecAddressLike, upgrade_authority: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** decimals() */
        decimals: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** deposit_private_to_private(from: struct, to: struct, assets: integer, shares: integer, _nonce: field) */
        deposit_private_to_private: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** deposit_private_to_private_exact(from: struct, to: struct, assets: integer, min_shares: integer, _nonce: field) */
        deposit_private_to_private_exact: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), min_shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** deposit_private_to_public(from: struct, to: struct, assets: integer, _nonce: field) */
        deposit_private_to_public: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** deposit_public_to_private(from: struct, to: struct, assets: integer, shares: integer, _nonce: field) */
        deposit_public_to_private: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** deposit_public_to_private_exact(from: struct, to: struct, assets: integer, min_shares: integer, _nonce: field) */
        deposit_public_to_private_exact: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), min_shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** deposit_public_to_public(from: struct, to: struct, assets: integer, _nonce: field) */
        deposit_public_to_public: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** initialize_transfer_commitment(to: struct, completer: struct) */
        initialize_transfer_commitment: ((to: AztecAddressLike, completer: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** issue_private_to_private_exact(from: struct, to: struct, shares: integer, max_assets: integer, _nonce: field) */
        issue_private_to_private_exact: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), max_assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** issue_private_to_public_exact(from: struct, to: struct, shares: integer, max_assets: integer, _nonce: field) */
        issue_private_to_public_exact: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), max_assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** issue_public_to_private(from: struct, to: struct, shares: integer, max_assets: integer, _nonce: field) */
        issue_public_to_private: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), max_assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** issue_public_to_public(from: struct, to: struct, shares: integer, max_assets: integer, _nonce: field) */
        issue_public_to_public: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), max_assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** mint_to_commitment(commitment: field, amount: integer) */
        mint_to_commitment: ((commitment: FieldLike, amount: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** mint_to_private(to: struct, amount: integer) */
        mint_to_private: ((to: AztecAddressLike, amount: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** mint_to_public(to: struct, amount: integer) */
        mint_to_public: ((to: AztecAddressLike, amount: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** name() */
        name: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** process_message(message_ciphertext: struct, message_context: struct) */
        process_message: ((message_ciphertext: FieldLike[], message_context: {
            tx_hash: FieldLike;
            unique_note_hashes_in_tx: FieldLike[];
            first_nullifier_in_tx: FieldLike;
            recipient: AztecAddressLike;
        }) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_dispatch(selector: field) */
        public_dispatch: ((selector: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** redeem_private_to_private_exact(from: struct, to: struct, shares: integer, min_assets: integer, _nonce: field) */
        redeem_private_to_private_exact: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), min_assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** redeem_private_to_public(from: struct, to: struct, shares: integer, _nonce: field) */
        redeem_private_to_public: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** redeem_public_to_private_exact(from: struct, to: struct, shares: integer, min_assets: integer, _nonce: field) */
        redeem_public_to_private_exact: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), min_assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** redeem_public_to_public(from: struct, to: struct, shares: integer, _nonce: field) */
        redeem_public_to_public: ((from: AztecAddressLike, to: AztecAddressLike, shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** symbol() */
        symbol: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** sync_private_state() */
        sync_private_state: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** total_supply() */
        total_supply: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_commitment(from: struct, commitment: field, amount: integer, _nonce: field) */
        transfer_private_to_commitment: ((from: AztecAddressLike, commitment: FieldLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_private(from: struct, to: struct, amount: integer, _nonce: field) */
        transfer_private_to_private: ((from: AztecAddressLike, to: AztecAddressLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_public(from: struct, to: struct, amount: integer, _nonce: field) */
        transfer_private_to_public: ((from: AztecAddressLike, to: AztecAddressLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_public_with_commitment(from: struct, to: struct, amount: integer, _nonce: field) */
        transfer_private_to_public_with_commitment: ((from: AztecAddressLike, to: AztecAddressLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_public_to_commitment(from: struct, commitment: field, amount: integer, _nonce: field) */
        transfer_public_to_commitment: ((from: AztecAddressLike, commitment: FieldLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_public_to_private(from: struct, to: struct, amount: integer, _nonce: field) */
        transfer_public_to_private: ((from: AztecAddressLike, to: AztecAddressLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_public_to_public(from: struct, to: struct, amount: integer, _nonce: field) */
        transfer_public_to_public: ((from: AztecAddressLike, to: AztecAddressLike, amount: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** upgrade_contract(new_contract_class_id: field) */
        upgrade_contract: ((new_contract_class_id: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** withdraw_private_to_private(from: struct, to: struct, assets: integer, shares: integer, _nonce: field) */
        withdraw_private_to_private: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** withdraw_private_to_private_exact(from: struct, to: struct, assets: integer, max_shares: integer, _nonce: field) */
        withdraw_private_to_private_exact: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), max_shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** withdraw_private_to_public_exact(from: struct, to: struct, assets: integer, max_shares: integer, _nonce: field) */
        withdraw_private_to_public_exact: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), max_shares: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** withdraw_public_to_private(from: struct, to: struct, assets: integer, _nonce: field) */
        withdraw_public_to_private: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** withdraw_public_to_public(from: struct, to: struct, assets: integer, _nonce: field) */
        withdraw_public_to_public: ((from: AztecAddressLike, to: AztecAddressLike, assets: (bigint | number), _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
    };
}
