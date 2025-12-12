// Account contract that uses ECDSA signatures for authentication on the same curve as Ethereum.
// This contract verifies EIP-712 typed data signatures, enabling MetaMask to display
// human-readable transaction information to users.
//
// Users see in MetaMask:
// - Target contract address
// - Function signature (e.g., "drip_to_private(Field,Field)")
// - Arguments hash
// - Transaction nonce
//
// The contract verifies:
// 1. Computes EIP-712 hash from the signed data
// 2. Verifies secp256k1 ECDSA signature against this hash
use dep::aztec::macros::aztec;

#[aztec]
pub contract EcdsaKEthSignerAccount {
    use dep::aztec::{
        authwit::{account::AccountActions, entrypoint::app::AppPayload},
        context::PrivateContext,
        macros::{functions::{external, initializer, noinitcheck, view}, storage::storage},
        messages::message_delivery::MessageDelivery,
        oracle::{auth_witness::get_auth_witness, notes::{get_sender_for_tags, set_sender_for_tags}},
        protocol_types::traits::ToField,
        state_vars::PrivateImmutable,
    };

    use crate::ecdsa_public_key_note::EcdsaPublicKeyNote;

    // ========== EIP-712 Constants ==========

    // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    global EIP712_DOMAIN_TYPEHASH: [u8; 32] = [
        0x8b, 0x73, 0xc3, 0xc6, 0x9b, 0xb8, 0xfe, 0x3d,
        0x51, 0x2e, 0xcc, 0x4c, 0xf7, 0x59, 0xcc, 0x79,
        0x23, 0x9f, 0x7b, 0x17, 0x9b, 0x0f, 0xfa, 0xca,
        0xa9, 0xa7, 0x5d, 0x52, 0x2b, 0x39, 0x40, 0x0f
    ];

    // keccak256("AztecTransaction(bytes32 outerHash,bytes32 targetContract,string functionSignature,bytes32 argsHash,uint256 nonce)")
    global AZTEC_TX_TYPEHASH: [u8; 32] = [
        0x0d, 0x22, 0xb9, 0xaa, 0x19, 0x03, 0xe3, 0xd5,
        0x8e, 0x57, 0x7e, 0x4c, 0x8b, 0x9a, 0xcc, 0x37,
        0x14, 0xff, 0x31, 0x01, 0x93, 0x86, 0x09, 0x26,
        0xcd, 0x60, 0x17, 0xee, 0x6d, 0x58, 0xd5, 0x83
    ];

    // keccak256("Aztec Account")
    global DOMAIN_NAME_HASH: [u8; 32] = [
        0x73, 0x45, 0x30, 0x54, 0x0b, 0x01, 0x6a, 0x9b,
        0xf1, 0x1d, 0x57, 0xc1, 0x5a, 0xe3, 0x28, 0x6f,
        0x28, 0x94, 0x68, 0xe4, 0xd5, 0x54, 0x71, 0xca,
        0x76, 0x51, 0xf6, 0xb1, 0x84, 0xde, 0xfa, 0xd4
    ];

    // keccak256("1")
    global DOMAIN_VERSION_HASH: [u8; 32] = [
        0xc8, 0x9e, 0xfd, 0xaa, 0x54, 0xc0, 0xf2, 0x0c,
        0x7a, 0xdf, 0x61, 0x28, 0x82, 0xdf, 0x09, 0x50,
        0xf5, 0xa9, 0x51, 0x63, 0x7e, 0x03, 0x07, 0xcd,
        0xcb, 0x4c, 0x67, 0x2f, 0x29, 0x8b, 0x8b, 0xc6
    ];

    // Maximum function signature length in bytes
    global MAX_FUNC_SIG_LEN: u32 = 128;

    // Auth witness format (290 fields total):
    // [0-63]:    Signature (r + s, 64 bytes)
    // [64]:      Function signature length
    // [65-192]:  Function signature bytes (zero-padded to 128)
    // [193]:     Chain ID
    // [194-225]: Target contract (32 bytes)
    // [226-257]: Args hash (32 bytes)
    // [258-289]: Nonce (32 bytes)
    global WITNESS_SIZE: u32 = 290;

    #[storage]
    struct Storage<Context> {
        signing_public_key: PrivateImmutable<EcdsaPublicKeyNote, Context>,
    }

    // Creates a new account out of an ECDSA public key to use for signature verification
    #[external("private")]
    #[initializer]
    fn constructor(signing_pub_key_x: [u8; 32], signing_pub_key_y: [u8; 32]) {
        let this = context.this_address();
        let pub_key_note = EcdsaPublicKeyNote::new(signing_pub_key_x, signing_pub_key_y, this);

        // Safety: The sender for tags is only used to compute unconstrained shared secrets for emitting logs.
        let original_sender = unsafe { get_sender_for_tags().unwrap_or(this) };

        // Safety: Same as above
        unsafe { set_sender_for_tags(this) };
        storage.signing_public_key.initialize(pub_key_note).emit(
            this,
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
        // Safety: Same as above
        unsafe { set_sender_for_tags(original_sender) };
    }

    // Main entrypoint for executing transactions
    #[external("private")]
    #[noinitcheck]
    fn entrypoint(app_payload: AppPayload, fee_payment_method: u8, cancellable: bool) {
        // Safety: Only used for unconstrained tagging
        unsafe { set_sender_for_tags(context.this_address()) };

        let actions = AccountActions::init(&mut context, is_valid_impl);
        actions.entrypoint(app_payload, fee_payment_method, cancellable);
    }

    #[external("private")]
    #[noinitcheck]
    #[view]
    fn verify_private_authwit(inner_hash: Field) -> Field {
        let actions = AccountActions::init(&mut context, is_valid_impl);
        actions.verify_private_authwit(inner_hash)
    }

    // ========== EIP-712 Hash Functions ==========

    // Compute EIP-712 domain separator
    // domainSeparator = keccak256(typeHash || nameHash || versionHash || chainId || verifyingContract)
    #[contract_library_method]
    fn compute_domain_separator(chain_id: u32, verifying_contract: [u8; 32]) -> [u8; 32] {
        let mut encoded: [u8; 160] = [0; 160];

        // Copy type hash [0-31]
        for i in 0..32 {
            encoded[i] = EIP712_DOMAIN_TYPEHASH[i];
        }

        // Copy name hash [32-63]
        for i in 0..32 {
            encoded[32 + i] = DOMAIN_NAME_HASH[i];
        }

        // Copy version hash [64-95]
        for i in 0..32 {
            encoded[64 + i] = DOMAIN_VERSION_HASH[i];
        }

        // Chain ID as 32-byte big-endian [96-127]
        let chain_id_field: Field = chain_id as Field;
        let chain_id_bytes: [u8; 32] = chain_id_field.to_be_bytes();
        for i in 0..32 {
            encoded[96 + i] = chain_id_bytes[i];
        }

        // Verifying contract [128-159]
        for i in 0..32 {
            encoded[128 + i] = verifying_contract[i];
        }

        keccak256::keccak256(encoded, 160)
    }

    // Compute EIP-712 struct hash for AztecTransaction
    // structHash = keccak256(typeHash || outerHash || targetContract || keccak256(functionSignature) || argsHash || nonce)
    #[contract_library_method]
    fn compute_struct_hash(
        outer_hash: [u8; 32],
        target_contract: [u8; 32],
        func_sig: [u8; 128],
        func_sig_len: u32,
        args_hash: [u8; 32],
        nonce: Field
    ) -> [u8; 32] {
        // Hash the function signature string (EIP-712 dynamic type encoding)
        let func_sig_hash: [u8; 32] = keccak256::keccak256(func_sig, func_sig_len);

        // Encode struct: typeHash + outerHash + targetContract + funcSigHash + argsHash + nonce
        // Total: 32 * 6 = 192 bytes
        let mut encoded: [u8; 192] = [0; 192];

        for i in 0..32 { encoded[i] = AZTEC_TX_TYPEHASH[i]; }
        for i in 0..32 { encoded[32 + i] = outer_hash[i]; }
        for i in 0..32 { encoded[64 + i] = target_contract[i]; }
        for i in 0..32 { encoded[96 + i] = func_sig_hash[i]; }
        for i in 0..32 { encoded[128 + i] = args_hash[i]; }

        // Nonce as 32-byte big-endian
        let nonce_bytes: [u8; 32] = nonce.to_be_bytes();
        for i in 0..32 { encoded[160 + i] = nonce_bytes[i]; }

        keccak256::keccak256(encoded, 192)
    }

    // Compute final EIP-712 hash
    // hash = keccak256("\x19\x01" || domainSeparator || structHash)
    #[contract_library_method]
    fn compute_eip712_hash(domain_separator: [u8; 32], struct_hash: [u8; 32]) -> [u8; 32] {
        let mut message: [u8; 66] = [0; 66];
        message[0] = 0x19;
        message[1] = 0x01;
        for i in 0..32 { message[2 + i] = domain_separator[i]; }
        for i in 0..32 { message[34 + i] = struct_hash[i]; }

        keccak256::keccak256(message, 66)
    }

    // Core signature verification logic using EIP-712 typed data.
    //
    // Verifies that:
    // 1. The EIP-712 hash is correctly computed from witness data
    // 2. The ECDSA signature is valid for this hash
    //
    // The outer_hash binding ensures the signature authorizes the actual transaction.
    #[contract_library_method]
    fn is_valid_impl(context: &mut PrivateContext, outer_hash: Field) -> bool {
        // Load public key from storage
        let storage = Storage::init(context);
        let public_key = storage.signing_public_key.get_note();

        // Load extended auth witness (290 fields)
        // Safety: The witness is only used as a "magical value" for signature verification
        let witness: [Field; 290] = unsafe { get_auth_witness(outer_hash) };

        // Extract signature (64 bytes = r[32] + s[32])
        let mut signature: [u8; 64] = [0; 64];
        for i in 0..64 {
            signature[i] = witness[i] as u8;
        }

        // Extract function signature length
        let func_sig_len = witness[64] as u32;
        assert(func_sig_len <= MAX_FUNC_SIG_LEN, "Function signature too long");

        // Extract function signature bytes [65-192]
        let mut func_sig: [u8; 128] = [0; 128];
        for i in 0..128 {
            func_sig[i] = witness[65 + i] as u8;
        }

        // Extract chain ID [193]
        let chain_id = witness[193] as u32;

        // Extract target contract [194-225]
        let mut target_contract: [u8; 32] = [0; 32];
        for i in 0..32 {
            target_contract[i] = witness[194 + i] as u8;
        }

        // Extract args hash [226-257]
        let mut args_hash: [u8; 32] = [0; 32];
        for i in 0..32 {
            args_hash[i] = witness[226 + i] as u8;
        }

        // Extract nonce [258-289] - convert from bytes to Field
        let mut nonce_bytes: [u8; 32] = [0; 32];
        for i in 0..32 {
            nonce_bytes[i] = witness[258 + i] as u8;
        }
        let nonce = bytes_to_field(nonce_bytes);

        // Get verifying contract for EIP-712 domain
        // EIP-712 uses 20-byte address, so we take the last 20 bytes of the 32-byte Aztec address
        // and left-pad with 12 zeros (standard EIP-712 address encoding)
        let full_address: [u8; 32] = context.this_address().to_field().to_be_bytes();
        let mut verifying_contract: [u8; 32] = [0; 32];
        // Copy last 20 bytes to positions [12-31] (left-pad with zeros)
        for i in 0..20 {
            verifying_contract[12 + i] = full_address[12 + i];
        }

        // Compute domain separator
        let domain_separator = compute_domain_separator(chain_id, verifying_contract);

        // Convert outer_hash to bytes
        let outer_hash_bytes: [u8; 32] = outer_hash.to_be_bytes();

        // Compute struct hash with all extracted values
        let struct_hash = compute_struct_hash(
            outer_hash_bytes,
            target_contract,
            func_sig,
            func_sig_len,
            args_hash,
            nonce
        );

        // Compute final EIP-712 hash
        let eip712_hash = compute_eip712_hash(domain_separator, struct_hash);

        // Verify ECDSA secp256k1 signature
        std::ecdsa_secp256k1::verify_signature(
            public_key.x,
            public_key.y,
            signature,
            eip712_hash,
        )
    }

    // Helper to convert 32 bytes (big-endian) to Field
    #[contract_library_method]
    fn bytes_to_field(bytes: [u8; 32]) -> Field {
        let mut result: Field = 0;
        for i in 0..32 {
            result = result * 256 + (bytes[i] as Field);
        }
        result
    }
}

mod ecdsa_public_key_note;
