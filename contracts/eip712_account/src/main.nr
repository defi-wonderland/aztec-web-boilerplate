/**
 * EIP-712 Account Contract
 *
 * This account contract verifies EIP-712 typed data signatures, enabling human-readable
 * authorization requests via MetaMask. Unlike standard account contracts that sign opaque
 * hashes, this contract:
 *
 * 1. Receives function arguments as plaintext via auth witness
 * 2. Computes EIP-712 hashStruct using keccak256
 * 3. Verifies the ECDSA signature over the EIP-712 payload
 *
 * This provides cryptographic binding between what users see in MetaMask and what
 * the circuit verifies.
 */

use dep::aztec::macros::aztec;

// =============================================================================
// Contract
// =============================================================================

#[aztec]
pub contract Eip712Account {
    use dep::aztec::{
        authwit::{account::AccountActions, entrypoint::app::AppPayload},
        context::PrivateContext,
        macros::{
            functions::{external, initializer, noinitcheck, nophasecheck, view},
            storage::storage,
        },
        oracle::{auth_witness::get_auth_witness, notes::{get_sender_for_tags, set_sender_for_tags}},
        protocol_types::{
            constants::GENERATOR_INDEX__TX_NULLIFIER,
            hash::poseidon2_hash_with_separator,
            traits::Serialize,
        },
        state_vars::SinglePrivateImmutable,
        messages::message_delivery::MessageDelivery,
    };

    use crate::ecdsa_public_key_note::EcdsaPublicKeyNote;
    use crate::eip712::{
        // Hash functions
        hash_function_call, hash_app_domain, hash_entrypoint_authorization,
        hash_function_calls_array, hash_entrypoint_authorization_5,
        hash_authwit_app_domain, hash_function_call_authorization,
        compute_eip712_payload, field_to_bytes32,
        compute_aztec_args_hash, compute_function_selector, compute_inner_hash,
        extract_args_hash, extract_function_selector, extract_target_address,
        // Constants
        APP_PAYLOAD_SERIALIZED_LEN, ACCOUNT_MAX_CALLS, EMPTY_FUNCTION_CALL_HASH,
        // Single-call witness (legacy)
        load_eip712_witness, Eip712Witness,
        // 5-call witness (new)
        load_eip712_witness_5, Eip712Witness5,
        // Authwit witness (new)
        load_eip712_authwit_witness, Eip712AuthwitWitness,
    };

    // =========================================================================
    // Constants
    // =========================================================================

    // Pre-computed hashes for AppDomain strings (computed once, used for all txs)
    // keccak256("EVM Aztec Wallet")
    global APP_DOMAIN_NAME_HASH: [u8; 32] = [
        0x35, 0xe6, 0xe0, 0x18, 0x69, 0xe8, 0x48, 0x54,
        0xdd, 0x01, 0x10, 0xc3, 0xf3, 0x33, 0x8d, 0xda,
        0x29, 0x49, 0x9e, 0xa7, 0xe6, 0x2e, 0x43, 0x38,
        0x33, 0x65, 0x55, 0xbe, 0xe5, 0x2e, 0xa8, 0xe9
    ];

    // keccak256("1.0.0")
    global APP_DOMAIN_VERSION_HASH: [u8; 32] = [
        0x06, 0xc0, 0x15, 0xbd, 0x22, 0xb4, 0xc6, 0x96,
        0x90, 0x93, 0x3c, 0x10, 0x58, 0x87, 0x8e, 0xbd,
        0xfe, 0xf3, 0x1f, 0x9a, 0xaa, 0xe4, 0x0b, 0xbe,
        0x86, 0xd8, 0xa0, 0x9f, 0xe1, 0xb2, 0x97, 0x2c
    ];

    // Pre-computed domain separator for "Aztec" rollup with chainId=31337
    // This should be computed dynamically in production based on actual chain
    global DOMAIN_SEPARATOR: [u8; 32] = [
        0xc2, 0xa0, 0xcd, 0x76, 0x09, 0xfb, 0x9e, 0xf8,
        0x1c, 0xa0, 0xdd, 0x20, 0x92, 0xed, 0x05, 0x53,
        0x5e, 0x5e, 0x9d, 0x75, 0xb0, 0x0f, 0x45, 0x90,
        0xf9, 0xe6, 0x35, 0xf9, 0x69, 0x3e, 0x32, 0x92
    ];

    // =========================================================================
    // Storage
    // =========================================================================

    #[storage]
    struct Storage<Context> {
        signing_public_key: SinglePrivateImmutable<EcdsaPublicKeyNote, Context>,
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    /// Creates a new account with an ECDSA secp256k1 public key for signature verification
    #[external("private")]
    #[initializer]
    fn constructor(signing_pub_key_x: [u8; 32], signing_pub_key_y: [u8; 32]) {
        let pub_key_note = EcdsaPublicKeyNote::new(signing_pub_key_x, signing_pub_key_y);

        // Safety: The sender for tags is only used for unconstrained tagging
        let original_sender = unsafe { get_sender_for_tags().unwrap_or(self.address) };
        // Safety: Same as above - only for unconstrained tagging
        unsafe { set_sender_for_tags(self.address) };

        self.storage.signing_public_key.initialize(pub_key_note).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );

        // Safety: Same as above - only for unconstrained tagging
        unsafe { set_sender_for_tags(original_sender) };
    }

    // =========================================================================
    // Entrypoint (Custom EIP-712 Verification)
    // =========================================================================

    /// Main entrypoint for executing transactions with EIP-712 signature verification.
    ///
    /// This entrypoint supports two modes:
    /// 1. EIP-712 clear signing (when capsule is present) - human-readable signing via MetaMask
    /// 2. Standard auth witness (fallback for deployment) - ECDSA signature over outer_hash
    ///
    /// The fallback mode enables deployment to work without requiring EIP-712 capsules,
    /// while still using the same ECDSA keys for signature verification.
    #[external("private")]
    #[noinitcheck]
    #[nophasecheck]
    fn entrypoint(app_payload: AppPayload, fee_payment_method: u8, cancellable: bool) {
        // Safety: The sender for tags is only used for unconstrained tagging
        unsafe { set_sender_for_tags(self.address) };

        // Try to load EIP-712 witness data from capsule
        // Safety: Capsule data will be validated against AppPayload below if present
        let maybe_witness: Option<Eip712Witness> = unsafe {
            load_eip712_witness(self.address)
        };

        // Branch based on whether EIP-712 capsule is present
        if maybe_witness.is_none() {
            // =====================================================================
            // Fallback mode: Standard auth witness verification (for deployment)
            // =====================================================================
            // Use standard AccountActions with ECDSA verification
            let actions = AccountActions::init(self.context, is_valid_impl);
            actions.entrypoint(app_payload, fee_payment_method, cancellable);
        } else {
            // =====================================================================
            // EIP-712 clear signing mode (human-readable signing)
            // =====================================================================
            let witness = maybe_witness.unwrap();

            // Load public key from storage
            let public_key = self.storage.signing_public_key.get_note();

            // Extract components from the witness struct
            // Combine signature_r and signature_s into a single 64-byte array for ECDSA verification
            let mut ecdsa_signature: [u8; 64] = [0; 64];
            for i in 0..32 {
                ecdsa_signature[i] = witness.signature_r[i];
                ecdsa_signature[32 + i] = witness.signature_s[i];
            }

            let function_signature = witness.function_signature;
            let signature_length = witness.signature_length;
            let function_args_0 = witness.function_args;
            let args_length = witness.args_length;
            let target_address = witness.target_address;
            let chain_id = witness.chain_id;
            let salt = witness.salt;

            // Convert to arrays for compatibility with existing verification code
            let function_signatures = [function_signature];
            let signature_lengths = [signature_length as u8];
            let function_args = [function_args_0];
            let args_lengths = [args_length as u8];
            let target_addresses = [target_address];

            // =====================================================================
            // CRITICAL: Verify auth witness data matches AppPayload
            // This binds the signed EIP-712 message to the actual transaction
            // =====================================================================

            // Serialize AppPayload to extract function call data
            let serialized_payload: [Field; APP_PAYLOAD_SERIALIZED_LEN] = app_payload.serialize();

            // Verify the single function call (index 0)
            let stored_target = extract_target_address(serialized_payload, 0);

            // Must have at least one non-empty call
            assert(stored_target != 0, "AppPayload must have at least one function call");

            // 1. Verify target address matches
            assert(
                target_addresses[0] == stored_target,
                "AuthWit target_address mismatch with AppPayload"
            );

            // 2. Verify args_hash matches (Poseidon2 hash of witness args)
            let computed_args_hash = compute_aztec_args_hash(
                function_args[0],
                args_lengths[0] as u32
            );
            let stored_args_hash = extract_args_hash(serialized_payload, 0);
            assert(
                computed_args_hash == stored_args_hash,
                "AuthWit args_hash mismatch with AppPayload"
            );

            // 3. Verify function_selector matches (Poseidon2 hash of signature, truncated)
            let computed_selector = compute_function_selector(
                function_signatures[0],
                signature_lengths[0] as u32
            );
            let stored_selector = extract_function_selector(serialized_payload, 0);
            assert(
                computed_selector == stored_selector,
                "AuthWit function_selector mismatch with AppPayload"
            );

            // =====================================================================
            // Compute EIP-712 hashes (now that auth witness data is verified)
            // =====================================================================

            // Compute EIP-712 hashStruct(FunctionCall) for the single call
            let target_bytes = field_to_bytes32(target_addresses[0]);
            let function_call_hash = hash_function_call(
                target_bytes,
                function_signatures[0],
                signature_lengths[0] as u32,
                function_args[0],
                args_lengths[0] as u32
            );

            // Compute AppDomain hash
            let chain_id_bytes = field_to_bytes32(chain_id);
            let app_domain_hash = hash_app_domain(
                APP_DOMAIN_NAME_HASH,
                APP_DOMAIN_VERSION_HASH,
                chain_id_bytes,
                salt
            );

            // Compute EntrypointAuthorization hash
            let tx_nonce_bytes = field_to_bytes32(app_payload.tx_nonce);
            let message_hash = hash_entrypoint_authorization(
                app_domain_hash,
                function_call_hash,
                tx_nonce_bytes
            );

            // Compute final EIP-712 payload
            let eip712_payload = compute_eip712_payload(DOMAIN_SEPARATOR, message_hash);

            // Verify ECDSA signature
            assert(
                std::ecdsa_secp256k1::verify_signature(
                    public_key.x,
                    public_key.y,
                    ecdsa_signature,
                    eip712_payload
                ),
                "Invalid EIP-712 signature"
            );

            // Handle fee payment
            if fee_payment_method == 1 {
                // PREEXISTING_FEE_JUICE
                self.context.set_as_fee_payer();
                self.context.end_setup();
            } else if fee_payment_method == 2 {
                // FEE_JUICE_WITH_CLAIM
                self.context.set_as_fee_payer();
            }

            // Execute the calls
            app_payload.execute_calls(self.context);

            // Handle cancellability
            if cancellable {
                let tx_nullifier = poseidon2_hash_with_separator(
                    [app_payload.tx_nonce],
                    GENERATOR_INDEX__TX_NULLIFIER,
                );
                self.context.push_nullifier(tx_nullifier);
            }
        }
    }

    // =========================================================================
    // Entrypoint5 (5-Call EIP-712 Verification) - NEW
    // =========================================================================

    /// Main entrypoint for executing transactions with EIP-712 signature verification.
    /// Supports up to 5 function calls in a single transaction.
    ///
    /// This function:
    /// 1. Gets all 5 function call details via auth witness capsule
    /// 2. Computes the EIP-712 hash over the array of calls
    /// 3. Verifies the single ECDSA signature covers all calls
    /// 4. Executes the calls from the app_payload
    #[external("private")]
    #[noinitcheck]
    #[nophasecheck]
    fn entrypoint5(app_payload: AppPayload, fee_payment_method: u8, cancellable: bool) {
        // Safety: The sender for tags is only used for unconstrained tagging
        unsafe { set_sender_for_tags(self.address) };

        // Load public key from storage
        let public_key = self.storage.signing_public_key.get_note();

        // Load EIP-712 witness data from capsule (5-call version)
        // Safety: Capsule data will be validated against AppPayload below
        let witness: Eip712Witness5 = unsafe {
            load_eip712_witness_5(self.address).expect(f"EIP-712 witness capsule (5-call) not found")
        };

        // Combine signature_r and signature_s into a single 64-byte array
        let mut ecdsa_signature: [u8; 64] = [0; 64];
        for i in 0..32 {
            ecdsa_signature[i] = witness.signature_r[i];
            ecdsa_signature[32 + i] = witness.signature_s[i];
        }

        // Serialize AppPayload to extract function call data
        let serialized_payload: [Field; APP_PAYLOAD_SERIALIZED_LEN] = app_payload.serialize();

        // =====================================================================
        // Verify all 5 calls and compute EIP-712 hashes
        // =====================================================================

        let mut call_hashes: [[u8; 32]; ACCOUNT_MAX_CALLS] = [[0; 32]; ACCOUNT_MAX_CALLS];
        let mut has_any_call = false;

        for call_idx in 0..ACCOUNT_MAX_CALLS {
            let stored_target = extract_target_address(serialized_payload, call_idx);

            if stored_target != 0 {
                has_any_call = true;

                // 1. Verify target address matches
                assert(
                    witness.target_addresses[call_idx] == stored_target,
                    "AuthWit target_address mismatch with AppPayload"
                );

                // 2. Verify args_hash matches
                let computed_args_hash = compute_aztec_args_hash(
                    witness.function_args[call_idx],
                    witness.args_lengths[call_idx]
                );
                let stored_args_hash = extract_args_hash(serialized_payload, call_idx);
                assert(
                    computed_args_hash == stored_args_hash,
                    "AuthWit args_hash mismatch with AppPayload"
                );

                // 3. Verify function_selector matches
                let computed_selector = compute_function_selector(
                    witness.function_signatures[call_idx],
                    witness.signature_lengths[call_idx]
                );
                let stored_selector = extract_function_selector(serialized_payload, call_idx);
                assert(
                    computed_selector == stored_selector,
                    "AuthWit function_selector mismatch with AppPayload"
                );

                // 4. Compute EIP-712 hashStruct(FunctionCall)
                let target_bytes = field_to_bytes32(witness.target_addresses[call_idx]);
                call_hashes[call_idx] = hash_function_call(
                    target_bytes,
                    witness.function_signatures[call_idx],
                    witness.signature_lengths[call_idx],
                    witness.function_args[call_idx],
                    witness.args_lengths[call_idx]
                );
            } else {
                // Empty call slot - use pre-computed empty hash
                call_hashes[call_idx] = EMPTY_FUNCTION_CALL_HASH;
            }
        }

        // Must have at least one non-empty call
        assert(has_any_call, "AppPayload must have at least one function call");

        // =====================================================================
        // Compute EIP-712 message hash over all 5 calls
        // =====================================================================

        // Hash the array of function calls
        let function_calls_array_hash = hash_function_calls_array(call_hashes);

        // Compute AppDomain hash
        let chain_id_bytes = field_to_bytes32(witness.chain_id);
        let app_domain_hash = hash_app_domain(
            APP_DOMAIN_NAME_HASH,
            APP_DOMAIN_VERSION_HASH,
            chain_id_bytes,
            witness.salt
        );

        // Compute EntrypointAuthorization hash (5-call version)
        let tx_nonce_bytes = field_to_bytes32(app_payload.tx_nonce);
        let message_hash = hash_entrypoint_authorization_5(
            app_domain_hash,
            function_calls_array_hash,
            tx_nonce_bytes
        );

        // Compute final EIP-712 payload
        let eip712_payload = compute_eip712_payload(DOMAIN_SEPARATOR, message_hash);

        // Verify ECDSA signature
        assert(
            std::ecdsa_secp256k1::verify_signature(
                public_key.x,
                public_key.y,
                ecdsa_signature,
                eip712_payload
            ),
            "Invalid EIP-712 signature"
        );

        // Handle fee payment
        if fee_payment_method == 1 {
            // PREEXISTING_FEE_JUICE
            self.context.set_as_fee_payer();
            self.context.end_setup();
        } else if fee_payment_method == 2 {
            // FEE_JUICE_WITH_CLAIM
            self.context.set_as_fee_payer();
        }

        // Execute the calls
        app_payload.execute_calls(self.context);

        // Handle cancellability
        if cancellable {
            let tx_nullifier = poseidon2_hash_with_separator(
                [app_payload.tx_nonce],
                GENERATOR_INDEX__TX_NULLIFIER,
            );
            self.context.push_nullifier(tx_nullifier);
        }
    }

    // =========================================================================
    // Authwit Verification
    // =========================================================================

    /// Verify a private authorization witness for EIP-712 signed authwits.
    ///
    /// This function is called by other contracts (e.g., Token.transfer_from)
    /// when they need authorization to act on behalf of this account.
    ///
    /// The verification flow is:
    /// 1. Consumer contract calls assert_current_call_valid_authwit
    /// 2. That computes inner_hash = hash(msg_sender, selector, args_hash)
    /// 3. It calls this function with the inner_hash
    /// 4. We verify an EIP-712 signature over the authwit data
    ///
    /// The EIP-712 structure for individual authwits is:
    /// FunctionCallAuthorization {
    ///     appDomain: AuthwitAppDomain { chainId, verifyingContract },
    ///     functionCall: FunctionCall { contract, functionSignature, arguments }
    /// }
    ///
    /// This provides human-readable authorization requests for individual actions.
    #[external("private")]
    #[noinitcheck]
    #[view]
    fn verify_private_authwit(inner_hash: Field) -> Field {
        // Load public key from storage
        let public_key = self.storage.signing_public_key.get_note();

        // Load EIP-712 authwit witness from capsule
        // Safety: Capsule data will be validated below
        let witness: Eip712AuthwitWitness = unsafe {
            load_eip712_authwit_witness(self.address).expect(f"EIP-712 authwit witness capsule not found")
        };

        // =====================================================================
        // Step 1: Verify witness inner_hash matches the parameter
        // =====================================================================
        // The witness must have been created for this specific authwit request
        assert(
            witness.inner_hash == inner_hash,
            "Authwit witness inner_hash does not match request"
        );

        // =====================================================================
        // Step 2: Verify the inner_hash can be reconstructed from witness data
        // =====================================================================
        // This binds the EIP-712 signed data to the actual authwit request

        // Compute args_hash from the witness args pre-image
        let computed_args_hash = compute_aztec_args_hash(
            witness.function_args,
            witness.args_length
        );

        // Compute function selector from the witness signature
        let computed_selector = compute_function_selector(
            witness.function_signature,
            witness.signature_length
        );

        // Reconstruct the inner_hash using Aztec's formula:
        // inner_hash = poseidon2_hash([caller, selector, args_hash], GENERATOR_INDEX__AUTHWIT_INNER)
        let reconstructed_inner_hash = compute_inner_hash(
            witness.target_address,
            computed_selector,
            computed_args_hash
        );

        assert(
            reconstructed_inner_hash == inner_hash,
            "Authwit witness data does not match inner_hash"
        );

        // =====================================================================
        // Step 3: Compute EIP-712 FunctionCallAuthorization hash
        // =====================================================================

        // Combine signature_r and signature_s into a single 64-byte array
        let mut ecdsa_signature: [u8; 64] = [0; 64];
        for i in 0..32 {
            ecdsa_signature[i] = witness.signature_r[i];
            ecdsa_signature[32 + i] = witness.signature_s[i];
        }

        // Compute hashStruct(FunctionCall)
        let target_bytes = field_to_bytes32(witness.target_address);
        let function_call_hash = hash_function_call(
            target_bytes,
            witness.function_signature,
            witness.signature_length,
            witness.function_args,
            witness.args_length
        );

        // Compute hashStruct(AuthwitAppDomain)
        let chain_id_bytes = field_to_bytes32(witness.chain_id);
        let verifying_contract_bytes = field_to_bytes32(witness.verifying_contract);
        let authwit_domain_hash = hash_authwit_app_domain(
            chain_id_bytes,
            verifying_contract_bytes
        );

        // Compute hashStruct(FunctionCallAuthorization)
        let message_hash = hash_function_call_authorization(
            authwit_domain_hash,
            function_call_hash
        );

        // Compute final EIP-712 payload
        let eip712_payload = compute_eip712_payload(DOMAIN_SEPARATOR, message_hash);

        // =====================================================================
        // Step 4: Verify ECDSA signature
        // =====================================================================
        assert(
            std::ecdsa_secp256k1::verify_signature(
                public_key.x,
                public_key.y,
                ecdsa_signature,
                eip712_payload
            ),
            "Invalid EIP-712 authwit signature"
        );

        // Return IS_VALID_SELECTOR (0x47dacd73) on success per AccountInterface spec
        0x47dacd73
    }

    // =========================================================================
    // Standard Auth Witness Verification (Fallback for deployment)
    // =========================================================================

    /// Standard ECDSA signature verification for fallback mode.
    ///
    /// This function verifies Ethereum-style personal_sign signatures over the outer_hash.
    /// It's used when no EIP-712 capsule is present (e.g., during deployment).
    ///
    /// The verification process:
    /// 1. Takes the outer_hash (Aztec Poseidon hash)
    /// 2. Prepends the Ethereum message prefix: "\x19Ethereum Signed Message:\n32"
    /// 3. Computes keccak256 of the prefixed message
    /// 4. Verifies the secp256k1 signature against this hash
    #[contract_library_method]
    fn is_valid_impl(context: &mut PrivateContext, outer_hash: Field) -> bool {
        // Load public key from storage
        let storage = Storage::init(context);
        let public_key = storage.signing_public_key.get_note();

        // Load auth witness (signature: 64 bytes = r[32] + s[32])
        // Safety: The witness is only used as a "magical value" that makes the signature verification below pass.
        let witness: [Field; 64] = unsafe { get_auth_witness(outer_hash) };
        let mut signature: [u8; 64] = [0; 64];
        for i in 0..64 {
            signature[i] = witness[i] as u8;
        }

        // Convert outer_hash to 32 bytes (big-endian)
        let outer_hash_bytes: [u8; 32] = outer_hash.to_be_bytes();

        // Construct the Ethereum signed message prefix
        // "\x19Ethereum Signed Message:\n32" = 28 bytes
        // This is what MetaMask prepends before hashing with keccak256
        let eth_prefix: [u8; 28] = [
            0x19, // \x19
            0x45, 0x74, 0x68, 0x65, 0x72, 0x65, 0x75, 0x6d, // "Ethereum"
            0x20, // space
            0x53, 0x69, 0x67, 0x6e, 0x65, 0x64, // "Signed"
            0x20, // space
            0x4d, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65, // "Message"
            0x3a, // ":"
            0x0a, // "\n"
            0x33, 0x32, // "32"
        ];

        // Concatenate prefix + outer_hash_bytes (total 60 bytes)
        let mut prefixed_message: [u8; 60] = [0; 60];
        for i in 0..28 {
            prefixed_message[i] = eth_prefix[i];
        }
        for i in 0..32 {
            prefixed_message[28 + i] = outer_hash_bytes[i];
        }

        // Compute keccak256 of the prefixed message
        // This matches what MetaMask computes when using personal_sign
        let eth_signed_message_hash: [u8; 32] = keccak256::keccak256(prefixed_message, 60);

        // Verify ECDSA secp256k1 signature
        std::ecdsa_secp256k1::verify_signature(
            public_key.x,
            public_key.y,
            signature,
            eth_signed_message_hash,
        )
    }
}

// =============================================================================
// Modules
// =============================================================================

mod ecdsa_public_key_note;
mod eip712;
