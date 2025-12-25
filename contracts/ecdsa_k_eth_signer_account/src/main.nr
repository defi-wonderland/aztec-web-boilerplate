// Account contract that uses ECDSA signatures for authentication on the same curve as Ethereum.
// Unlike the standard EcdsaKAccount which uses sha256, this contract verifies Ethereum-style
// personal_sign signatures using keccak256 with the standard Ethereum message prefix.
//
// This enables MetaMask to be used as an external signer without exposing private keys to the browser.
use dep::aztec::macros::aztec;

#[aztec]
pub contract EcdsaKEthSignerAccount {
    use dep::aztec::{
        authwit::{account::AccountActions, entrypoint::app::AppPayload},
        context::PrivateContext,
        macros::{
            functions::{external, initializer, noinitcheck, nophasecheck, view},
            storage::storage,
        },
        messages::message_delivery::MessageDelivery,
        oracle::{auth_witness::get_auth_witness, notes::{get_sender_for_tags, set_sender_for_tags}},
        state_vars::SinglePrivateImmutable,
    };

    use crate::ecdsa_public_key_note::EcdsaPublicKeyNote;

    #[storage]
    struct Storage<Context> {
        signing_public_key: SinglePrivateImmutable<EcdsaPublicKeyNote, Context>,
    }

    // Creates a new account out of an ECDSA public key to use for signature verification
    #[external("private")]
    #[initializer]
    fn constructor(signing_pub_key_x: [u8; 32], signing_pub_key_y: [u8; 32]) {
        let pub_key_note = EcdsaPublicKeyNote { x: signing_pub_key_x, y: signing_pub_key_y };

        // Safety: The sender for tags is only used to compute unconstrained shared secrets for emitting logs.
        // Since this value is only used for unconstrained tagging and not for any constrained logic,
        // it is safe to load from an unconstrained context.
        let original_sender = unsafe { get_sender_for_tags().unwrap_or(self.address) };

        // We set the sender for tags to this contract because we don't want to force the user corresponding to this
        // account to add the account deployer as a sender to their PXE. By setting it to this contract, user's PXE
        // will manage to find the note even if the account deployer is not registered as a sender.

        // Safety: Comment from above applies here as well.
        unsafe { set_sender_for_tags(self.address) };
        self.storage.signing_public_key.initialize(pub_key_note).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
        // Safety: Comment from above applies here as well.
        unsafe { set_sender_for_tags(original_sender) };
    }

    // Main entrypoint for executing transactions
    #[external("private")]
    #[noinitcheck]
    #[nophasecheck]
    fn entrypoint(app_payload: AppPayload, fee_payment_method: u8, cancellable: bool) {
        // Safety: The sender for tags is only used to compute unconstrained shared secrets for emitting logs.
        // Since this value is only used for unconstrained tagging and not for any constrained logic,
        // it is safe to set from a constrained context.
        unsafe { set_sender_for_tags(self.address) };

        let actions = AccountActions::init(self.context, is_valid_impl);
        actions.entrypoint(app_payload, fee_payment_method, cancellable);
    }

    #[external("private")]
    #[noinitcheck]
    #[view]
    fn verify_private_authwit(inner_hash: Field) -> Field {
        let actions = AccountActions::init(self.context, is_valid_impl);
        actions.verify_private_authwit(inner_hash)
    }

    // Core signature verification logic that verifies Ethereum-style personal_sign signatures.
    //
    // Unlike the standard EcdsaKAccount which uses sha256(outer_hash), this contract:
    // 1. Takes the outer_hash (Aztec Poseidon hash)
    // 2. Prepends the Ethereum message prefix: "\x19Ethereum Signed Message:\n32"
    // 3. Computes keccak256 of the prefixed message
    // 4. Verifies the secp256k1 signature against this hash
    //
    // This matches exactly what MetaMask's personal_sign does internally.
    #[contract_library_method]
    fn is_valid_impl(context: &mut PrivateContext, outer_hash: Field) -> bool {
        // Load public key from storage
        let storage = Storage::init(context);
        let public_key = storage.signing_public_key.get_note();

        // Load auth witness (signature: 64 bytes = r[32] + s[32])
        // Safety: The witness is only used as a "magical value" that makes the signature verification below pass.
        // Hence it's safe.
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

        // Verify ECDSA secp256k1 signature (not secp256r1 like the SDK's EcdsaRAccount)
        std::ecdsa_secp256k1::verify_signature(
            public_key.x,
            public_key.y,
            signature,
            eth_signed_message_hash,
        )
    }
}

mod ecdsa_public_key_note;
