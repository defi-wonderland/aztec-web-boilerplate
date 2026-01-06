/**
 * EIP-712 Hash Functions for Aztec Account Contract
 *
 * This module computes EIP-712 hashes that match what viem/ethers compute in TypeScript.
 * The signature over these hashes provides cryptographic binding between what the user
 * sees in MetaMask and what the circuit verifies.
 */

use keccak256::keccak256;
use dep::aztec::protocol_types::{
    constants::{GENERATOR_INDEX__FUNCTION_ARGS, GENERATOR_INDEX__AUTHWIT_INNER},
    hash::{poseidon2_hash_subarray, poseidon2_hash_with_separator},
    traits::{Deserialize, Serialize},
};
use dep::aztec::oracle::capsules;

// =============================================================================
// Pre-computed Type Hashes (from verify-signature.ts)
// =============================================================================

// keccak256("FunctionCall(bytes32 contract,string functionSignature,uint256[] arguments)")
global FUNCTION_CALL_TYPE_HASH: [u8; 32] = [
    0xaa, 0xa2, 0xc3, 0x32, 0x66, 0x85, 0x9f, 0xb1,
    0xd3, 0x25, 0xcc, 0x19, 0xa3, 0xd3, 0x5f, 0xcb,
    0x37, 0xd2, 0x7e, 0xb1, 0xfd, 0x40, 0x78, 0x5e,
    0x8b, 0x2c, 0xa4, 0xd3, 0xdd, 0x2d, 0x23, 0xcb
];

// keccak256("AppDomain(string name,string version,uint256 chainId,bytes32 salt)")
global APP_DOMAIN_TYPE_HASH: [u8; 32] = [
    0xca, 0x22, 0x12, 0xa9, 0x3d, 0x16, 0xa0, 0x15,
    0x7a, 0xb9, 0xc7, 0x31, 0xe0, 0xce, 0x9d, 0x0a,
    0xe0, 0xcb, 0x45, 0x71, 0x38, 0x2c, 0x7b, 0xfe,
    0x48, 0xf9, 0xaf, 0x5d, 0x2c, 0xd4, 0xd9, 0xf7
];

// keccak256("EntrypointAuthorization(AppDomain appDomain,FunctionCall functionCall,uint256 txNonce)AppDomain(...)FunctionCall(...)")
// LEGACY: For single function call (backward compatibility)
global ENTRYPOINT_AUTHORIZATION_TYPE_HASH: [u8; 32] = [
    0x5b, 0x2c, 0xf5, 0x82, 0x9d, 0x8c, 0xc2, 0xbe,
    0x3e, 0xbf, 0x53, 0xd7, 0x14, 0x43, 0x05, 0xda,
    0xd4, 0xe0, 0xee, 0xd0, 0x71, 0xa6, 0x53, 0x11,
    0x57, 0xc0, 0xb7, 0xf7, 0x40, 0x07, 0x07, 0x09
];

// keccak256("EntrypointAuthorization(AppDomain appDomain,FunctionCall[5] functionCalls,uint256 txNonce)AppDomain(...)FunctionCall(...)")
// NEW: For 5 function calls array
global ENTRYPOINT_AUTHORIZATION_5_TYPE_HASH: [u8; 32] = [
    0x09, 0xa2, 0x6a, 0x7c, 0x85, 0x9d, 0x87, 0x4b,
    0x9a, 0x43, 0x94, 0xc2, 0xc4, 0x34, 0x6a, 0x55,
    0xca, 0xc6, 0x70, 0x4a, 0xd3, 0xd4, 0x50, 0x9f,
    0xf7, 0xa9, 0x3c, 0xbb, 0xb5, 0x5b, 0xca, 0xf5
];

// keccak256("AuthwitAppDomain(uint256 chainId,bytes32 verifyingContract)")
global AUTHWIT_APP_DOMAIN_TYPE_HASH: [u8; 32] = [
    0xa3, 0x78, 0x92, 0x02, 0x45, 0x0c, 0x41, 0x89,
    0x90, 0xe2, 0x37, 0x24, 0x23, 0xa0, 0xa0, 0xe5,
    0x4a, 0x0d, 0x05, 0x8d, 0xc6, 0xd9, 0x38, 0x32,
    0x00, 0xef, 0x42, 0xba, 0x77, 0x71, 0x66, 0x8c
];

// keccak256("FunctionCallAuthorization(AuthwitAppDomain appDomain,FunctionCall functionCall)AuthwitAppDomain(...)FunctionCall(...)")
global FUNCTION_CALL_AUTHORIZATION_TYPE_HASH: [u8; 32] = [
    0x08, 0xb1, 0xe6, 0x94, 0xdc, 0x7c, 0xf6, 0xb3,
    0xca, 0x85, 0xce, 0x79, 0xe4, 0xfb, 0x07, 0xd0,
    0x3e, 0x2d, 0x9f, 0xdd, 0xe0, 0xa3, 0xb7, 0xbb,
    0x73, 0x10, 0x4a, 0x81, 0x2f, 0x72, 0x7f, 0x12
];

// Hash of empty FunctionCall struct (for padding empty slots in 5-call array)
// hashStruct(FunctionCall{contract: 0, functionSignature: "", arguments: []})
pub global EMPTY_FUNCTION_CALL_HASH: [u8; 32] = [
    0xfc, 0xc9, 0x85, 0x08, 0xa7, 0x8b, 0xa8, 0x5f,
    0xe1, 0x4c, 0xeb, 0x88, 0x84, 0x2f, 0xb8, 0xfd,
    0xbf, 0xdf, 0x18, 0x4f, 0x6b, 0x44, 0x34, 0x15,
    0x65, 0x05, 0x97, 0xa4, 0x19, 0xd9, 0x63, 0x4b
];

// =============================================================================
// Constants
// =============================================================================

pub global MAX_SERIALIZED_ARGS: u32 = 20;      // Max function arguments
pub global MAX_SIGNATURE_SIZE: u32 = 128;       // Max function signature string length
pub global ACCOUNT_MAX_CALLS: u32 = 5;          // 5 function calls per entrypoint (per Aztec AppPayload spec)

// Capsule slots for EIP-712 witness data
// These are deterministic hashes to ensure uniqueness
pub global EIP712_WITNESS_SLOT: Field = 0x1234567890abcdef;    // Single call (legacy)
pub global EIP712_WITNESS_5_SLOT: Field = 0x1234567890abcdf0;  // 5-call entrypoint
pub global EIP712_AUTHWIT_SLOT: Field = 0xabcdef1234567890;    // Individual authwit

// =============================================================================
// Capsule-based Witness Structure
// =============================================================================

/// EIP-712 witness data passed via capsule from TypeScript
/// This struct contains all data needed to verify an EIP-712 signature
/// and bind it to the AppPayload.
pub struct Eip712Witness {
    // ECDSA signature (r || s), 64 bytes
    pub signature_r: [u8; 32],
    pub signature_s: [u8; 32],

    // Function signature string and its length
    pub function_signature: [u8; MAX_SIGNATURE_SIZE],
    pub signature_length: u32,

    // Function arguments (native Field elements)
    pub function_args: [Field; MAX_SERIALIZED_ARGS],
    pub args_length: u32,

    // Target contract address
    pub target_address: Field,

    // Chain ID for domain separation
    pub chain_id: Field,

    // Salt for domain separation
    pub salt: [u8; 32],
}

// Serialization size: 32 + 32 + 128 + 1 + 20 + 1 + 1 + 1 + 32 = 248 bytes
// In Fields: signature (3: 31+31+2) + func_sig (5: 31+31+31+31+4) + sig_len (1) + args (20) + args_len (1) + target (1) + chain_id (1) + salt (1: 31 bytes) = 33 Fields
global EIP712_WITNESS_SERIALIZED_LEN: u32 = 33;

impl Serialize for Eip712Witness {
    let N: u32 = EIP712_WITNESS_SERIALIZED_LEN;

    fn serialize(self) -> [Field; Self::N] {
        let mut result: [Field; EIP712_WITNESS_SERIALIZED_LEN] = [0; EIP712_WITNESS_SERIALIZED_LEN];

        // Pack signature_r into 2 fields (31 bytes + 1 byte)
        result[0] = pack_bytes_31(self.signature_r, 0);
        result[1] = self.signature_r[31] as Field;

        // Pack signature_s into 2 fields (31 bytes + 1 byte) - but we reuse field[1] for last byte of r
        // Actually, let's keep it simple: 32 bytes = 2 fields each
        // Field 0-1: signature_r (pack as 2 fields)
        // Field 2-3: signature_s (pack as 2 fields)
        // But to keep it simpler, let's pack 64 bytes into 3 fields (31+31+2)

        // Actually, simpler approach - pack into fields directly
        // signature_r[0..31] -> field[0], signature_r[31] + signature_s[0..30] -> field[1], signature_s[30..32] -> field[2]
        result[0] = pack_bytes_31(self.signature_r, 0);

        // Combine last byte of r with first 30 bytes of s
        let mut combined: [u8; 31] = [0; 31];
        combined[0] = self.signature_r[31];
        for i in 0..30 {
            combined[i + 1] = self.signature_s[i];
        }
        result[1] = pack_bytes_to_field(combined);

        // Last 2 bytes of s
        result[2] = (self.signature_s[30] as Field) * 256 + (self.signature_s[31] as Field);

        // Function signature (128 bytes = 5 fields: 31+31+31+31+4)
        for i in 0..4 {
            let mut chunk: [u8; 31] = [0; 31];
            for j in 0..31 {
                chunk[j] = self.function_signature[i * 31 + j];
            }
            result[3 + i] = pack_bytes_to_field(chunk);
        }
        // Last 4 bytes
        let mut last_chunk: Field = 0;
        for i in 0..4 {
            last_chunk = last_chunk * 256 + (self.function_signature[124 + i] as Field);
        }
        result[7] = last_chunk;

        // Signature length
        result[8] = self.signature_length as Field;

        // Function args (20 fields)
        for i in 0..MAX_SERIALIZED_ARGS {
            result[9 + i] = self.function_args[i];
        }

        // Args length
        result[29] = self.args_length as Field;

        // Target address
        result[30] = self.target_address;

        // Chain ID
        result[31] = self.chain_id;

        // Salt (32 bytes = 2 fields: 31+1)
        result[32] = pack_bytes_31(self.salt, 0);

        result
    }
}

impl Deserialize for Eip712Witness {
    let N: u32 = EIP712_WITNESS_SERIALIZED_LEN;

    fn deserialize(fields: [Field; Self::N]) -> Self {
        // Unpack signature (fields 0-2)
        let sig_bytes = unpack_signature_from_fields([fields[0], fields[1], fields[2]]);
        let mut signature_r: [u8; 32] = [0; 32];
        let mut signature_s: [u8; 32] = [0; 32];
        for i in 0..32 {
            signature_r[i] = sig_bytes[i];
            signature_s[i] = sig_bytes[32 + i];
        }

        // Unpack function signature (fields 3-7)
        let function_signature = unpack_func_sig_from_fields([fields[3], fields[4], fields[5], fields[6], fields[7]]);

        // Signature length
        let signature_length = fields[8] as u32;

        // Function args (fields 9-28)
        let mut function_args: [Field; MAX_SERIALIZED_ARGS] = [0; MAX_SERIALIZED_ARGS];
        for i in 0..MAX_SERIALIZED_ARGS {
            function_args[i] = fields[9 + i];
        }

        // Args length
        let args_length = fields[29] as u32;

        // Target address
        let target_address = fields[30];

        // Chain ID
        let chain_id = fields[31];

        // Salt (field 32 contains first 31 bytes, we need to reconstruct)
        let salt = unpack_salt_from_field(fields[32]);

        Eip712Witness {
            signature_r,
            signature_s,
            function_signature,
            signature_length,
            function_args,
            args_length,
            target_address,
            chain_id,
            salt,
        }
    }
}

/// Load EIP-712 witness from capsule storage (single call, legacy)
pub unconstrained fn load_eip712_witness(contract_address: dep::aztec::protocol_types::address::AztecAddress) -> Option<Eip712Witness> {
    capsules::load(contract_address, EIP712_WITNESS_SLOT)
}

// =============================================================================
// 5-Call Witness Structure (NEW)
// =============================================================================

/// EIP-712 witness data for 5 function calls (per Aztec AppPayload spec)
/// This struct contains all data needed to verify an EIP-712 signature
/// covering up to 5 function calls in a single entrypoint transaction.
pub struct Eip712Witness5 {
    // ECDSA signature (r || s), 64 bytes - shared across all calls
    pub signature_r: [u8; 32],
    pub signature_s: [u8; 32],

    // Per-call data (5 function calls)
    pub function_signatures: [[u8; MAX_SIGNATURE_SIZE]; ACCOUNT_MAX_CALLS],
    pub signature_lengths: [u32; ACCOUNT_MAX_CALLS],
    pub function_args: [[Field; MAX_SERIALIZED_ARGS]; ACCOUNT_MAX_CALLS],
    pub args_lengths: [u32; ACCOUNT_MAX_CALLS],
    pub target_addresses: [Field; ACCOUNT_MAX_CALLS],

    // Shared metadata
    pub chain_id: Field,
    pub salt: [u8; 32],
}

// Serialization layout for Eip712Witness5:
// [0-2]: Signature (64 bytes: 31+31+2) = 3 Fields
// Per call (x5):
//   - func_sig (128 bytes: 31+31+31+31+4) = 5 Fields
//   - sig_len = 1 Field
//   - args (20 Fields) = 20 Fields
//   - args_len = 1 Field
//   - target = 1 Field
//   Total per call = 28 Fields
// [3-142]: 5 calls * 28 = 140 Fields
// [143]: chain_id = 1 Field
// [144]: salt (31 bytes) = 1 Field
// Total = 3 + 140 + 1 + 1 = 145 Fields
pub global EIP712_WITNESS_5_SERIALIZED_LEN: u32 = 145;

impl Serialize for Eip712Witness5 {
    let N: u32 = EIP712_WITNESS_5_SERIALIZED_LEN;

    fn serialize(self) -> [Field; Self::N] {
        let mut result: [Field; EIP712_WITNESS_5_SERIALIZED_LEN] = [0; EIP712_WITNESS_5_SERIALIZED_LEN];

        // [0-2]: Signature (64 bytes: 31+31+2)
        result[0] = pack_bytes_31(self.signature_r, 0);
        let mut combined: [u8; 31] = [0; 31];
        combined[0] = self.signature_r[31];
        for i in 0..30 {
            combined[i + 1] = self.signature_s[i];
        }
        result[1] = pack_bytes_to_field(combined);
        result[2] = (self.signature_s[30] as Field) * 256 + (self.signature_s[31] as Field);

        // [3-142]: 5 calls, each 28 fields
        for call_idx in 0..ACCOUNT_MAX_CALLS {
            let base = 3 + call_idx * 28;

            // Function signature (128 bytes = 5 fields: 31+31+31+31+4)
            for i in 0..4 {
                let mut chunk: [u8; 31] = [0; 31];
                for j in 0..31 {
                    chunk[j] = self.function_signatures[call_idx][i * 31 + j];
                }
                result[base + i] = pack_bytes_to_field(chunk);
            }
            // Last 4 bytes
            let mut last_chunk: Field = 0;
            for i in 0..4 {
                last_chunk = last_chunk * 256 + (self.function_signatures[call_idx][124 + i] as Field);
            }
            result[base + 4] = last_chunk;

            // Signature length
            result[base + 5] = self.signature_lengths[call_idx] as Field;

            // Function args (20 fields)
            for i in 0..MAX_SERIALIZED_ARGS {
                result[base + 6 + i] = self.function_args[call_idx][i];
            }

            // Args length
            result[base + 26] = self.args_lengths[call_idx] as Field;

            // Target address
            result[base + 27] = self.target_addresses[call_idx];
        }

        // [143]: chain_id
        result[143] = self.chain_id;

        // [144]: salt (first 31 bytes)
        result[144] = pack_bytes_31(self.salt, 0);

        result
    }
}

impl Deserialize for Eip712Witness5 {
    let N: u32 = EIP712_WITNESS_5_SERIALIZED_LEN;

    fn deserialize(fields: [Field; Self::N]) -> Self {
        // [0-2]: Signature
        let sig_bytes = unpack_signature_from_fields([fields[0], fields[1], fields[2]]);
        let mut signature_r: [u8; 32] = [0; 32];
        let mut signature_s: [u8; 32] = [0; 32];
        for i in 0..32 {
            signature_r[i] = sig_bytes[i];
            signature_s[i] = sig_bytes[32 + i];
        }

        // [3-142]: 5 calls, each 28 fields
        let mut function_signatures: [[u8; MAX_SIGNATURE_SIZE]; ACCOUNT_MAX_CALLS] = [[0; MAX_SIGNATURE_SIZE]; ACCOUNT_MAX_CALLS];
        let mut signature_lengths: [u32; ACCOUNT_MAX_CALLS] = [0; ACCOUNT_MAX_CALLS];
        let mut function_args: [[Field; MAX_SERIALIZED_ARGS]; ACCOUNT_MAX_CALLS] = [[0; MAX_SERIALIZED_ARGS]; ACCOUNT_MAX_CALLS];
        let mut args_lengths: [u32; ACCOUNT_MAX_CALLS] = [0; ACCOUNT_MAX_CALLS];
        let mut target_addresses: [Field; ACCOUNT_MAX_CALLS] = [0; ACCOUNT_MAX_CALLS];

        for call_idx in 0..ACCOUNT_MAX_CALLS {
            let base = 3 + call_idx * 28;

            // Function signature (5 fields)
            function_signatures[call_idx] = unpack_func_sig_from_fields([
                fields[base], fields[base + 1], fields[base + 2], fields[base + 3], fields[base + 4]
            ]);

            // Signature length
            signature_lengths[call_idx] = fields[base + 5] as u32;

            // Function args (20 fields)
            for i in 0..MAX_SERIALIZED_ARGS {
                function_args[call_idx][i] = fields[base + 6 + i];
            }

            // Args length
            args_lengths[call_idx] = fields[base + 26] as u32;

            // Target address
            target_addresses[call_idx] = fields[base + 27];
        }

        // [143]: chain_id
        let chain_id = fields[143];

        // [144]: salt
        let salt = unpack_salt_from_field(fields[144]);

        Eip712Witness5 {
            signature_r,
            signature_s,
            function_signatures,
            signature_lengths,
            function_args,
            args_lengths,
            target_addresses,
            chain_id,
            salt,
        }
    }
}

/// Load EIP-712 witness for 5 calls from capsule storage
pub unconstrained fn load_eip712_witness_5(contract_address: dep::aztec::protocol_types::address::AztecAddress) -> Option<Eip712Witness5> {
    capsules::load(contract_address, EIP712_WITNESS_5_SLOT)
}

// =============================================================================
// Individual Authwit Witness Structure (NEW)
// =============================================================================

/// EIP-712 witness data for individual authorization (authwit)
/// Used by verify_private_authwit to verify a single function call authorization.
pub struct Eip712AuthwitWitness {
    // ECDSA signature (r || s), 64 bytes
    pub signature_r: [u8; 32],
    pub signature_s: [u8; 32],

    // Function call data
    pub function_signature: [u8; MAX_SIGNATURE_SIZE],
    pub signature_length: u32,
    pub function_args: [Field; MAX_SERIALIZED_ARGS],
    pub args_length: u32,
    pub target_address: Field,      // The contract calling assert_current_call_valid_authwit

    // Authwit-specific domain (different from entrypoint)
    pub chain_id: Field,
    pub verifying_contract: Field,  // The contract requesting the authwit

    // For verification against inner_hash
    pub inner_hash: Field,
}

// Serialization layout for Eip712AuthwitWitness:
// [0-2]: Signature (64 bytes: 31+31+2) = 3 Fields
// [3-7]: func_sig (128 bytes: 31+31+31+31+4) = 5 Fields
// [8]: sig_len = 1 Field
// [9-28]: args = 20 Fields
// [29]: args_len = 1 Field
// [30]: target = 1 Field
// [31]: chain_id = 1 Field
// [32]: verifying_contract = 1 Field
// [33]: inner_hash = 1 Field
// Total = 34 Fields
pub global EIP712_AUTHWIT_SERIALIZED_LEN: u32 = 34;

impl Serialize for Eip712AuthwitWitness {
    let N: u32 = EIP712_AUTHWIT_SERIALIZED_LEN;

    fn serialize(self) -> [Field; Self::N] {
        let mut result: [Field; EIP712_AUTHWIT_SERIALIZED_LEN] = [0; EIP712_AUTHWIT_SERIALIZED_LEN];

        // [0-2]: Signature
        result[0] = pack_bytes_31(self.signature_r, 0);
        let mut combined: [u8; 31] = [0; 31];
        combined[0] = self.signature_r[31];
        for i in 0..30 {
            combined[i + 1] = self.signature_s[i];
        }
        result[1] = pack_bytes_to_field(combined);
        result[2] = (self.signature_s[30] as Field) * 256 + (self.signature_s[31] as Field);

        // [3-7]: Function signature
        for i in 0..4 {
            let mut chunk: [u8; 31] = [0; 31];
            for j in 0..31 {
                chunk[j] = self.function_signature[i * 31 + j];
            }
            result[3 + i] = pack_bytes_to_field(chunk);
        }
        let mut last_chunk: Field = 0;
        for i in 0..4 {
            last_chunk = last_chunk * 256 + (self.function_signature[124 + i] as Field);
        }
        result[7] = last_chunk;

        // [8]: Signature length
        result[8] = self.signature_length as Field;

        // [9-28]: Function args
        for i in 0..MAX_SERIALIZED_ARGS {
            result[9 + i] = self.function_args[i];
        }

        // [29]: Args length
        result[29] = self.args_length as Field;

        // [30]: Target address
        result[30] = self.target_address;

        // [31]: Chain ID
        result[31] = self.chain_id;

        // [32]: Verifying contract
        result[32] = self.verifying_contract;

        // [33]: Inner hash
        result[33] = self.inner_hash;

        result
    }
}

impl Deserialize for Eip712AuthwitWitness {
    let N: u32 = EIP712_AUTHWIT_SERIALIZED_LEN;

    fn deserialize(fields: [Field; Self::N]) -> Self {
        // [0-2]: Signature
        let sig_bytes = unpack_signature_from_fields([fields[0], fields[1], fields[2]]);
        let mut signature_r: [u8; 32] = [0; 32];
        let mut signature_s: [u8; 32] = [0; 32];
        for i in 0..32 {
            signature_r[i] = sig_bytes[i];
            signature_s[i] = sig_bytes[32 + i];
        }

        // [3-7]: Function signature
        let function_signature = unpack_func_sig_from_fields([fields[3], fields[4], fields[5], fields[6], fields[7]]);

        // [8]: Signature length
        let signature_length = fields[8] as u32;

        // [9-28]: Function args
        let mut function_args: [Field; MAX_SERIALIZED_ARGS] = [0; MAX_SERIALIZED_ARGS];
        for i in 0..MAX_SERIALIZED_ARGS {
            function_args[i] = fields[9 + i];
        }

        // [29]: Args length
        let args_length = fields[29] as u32;

        // [30]: Target address
        let target_address = fields[30];

        // [31]: Chain ID
        let chain_id = fields[31];

        // [32]: Verifying contract
        let verifying_contract = fields[32];

        // [33]: Inner hash
        let inner_hash = fields[33];

        Eip712AuthwitWitness {
            signature_r,
            signature_s,
            function_signature,
            signature_length,
            function_args,
            args_length,
            target_address,
            chain_id,
            verifying_contract,
            inner_hash,
        }
    }
}

/// Load EIP-712 authwit witness from capsule storage
pub unconstrained fn load_eip712_authwit_witness(contract_address: dep::aztec::protocol_types::address::AztecAddress) -> Option<Eip712AuthwitWitness> {
    capsules::load(contract_address, EIP712_AUTHWIT_SLOT)
}

// =============================================================================
// Byte Packing/Unpacking Helpers
// =============================================================================

/// Pack first 31 bytes starting at offset into a Field (big-endian)
fn pack_bytes_31<let N: u32>(bytes: [u8; N], offset: u32) -> Field {
    let mut result: Field = 0;
    for i in 0..31 {
        if offset + i < N {
            result = result * 256 + (bytes[offset + i] as Field);
        }
    }
    result
}

/// Pack exactly 31 bytes into a Field (big-endian)
fn pack_bytes_to_field(bytes: [u8; 31]) -> Field {
    let mut result: Field = 0;
    for i in 0..31 {
        result = result * 256 + (bytes[i] as Field);
    }
    result
}

/// Unpack signature from 3 fields (64 bytes packed as 31+31+2)
fn unpack_signature_from_fields(fields: [Field; 3]) -> [u8; 64] {
    let mut sig: [u8; 64] = [0; 64];

    // First 31 bytes from field 0
    let b0: [u8; 31] = fields[0].to_be_bytes();
    for i in 0..31 {
        sig[i] = b0[i];
    }

    // Next 31 bytes from field 1
    let b1: [u8; 31] = fields[1].to_be_bytes();
    for i in 0..31 {
        sig[31 + i] = b1[i];
    }

    // Last 2 bytes from field 2
    let b2: [u8; 2] = fields[2].to_be_bytes();
    sig[62] = b2[0];
    sig[63] = b2[1];

    sig
}

/// Unpack function signature from 5 fields (128 bytes packed as 31+31+31+31+4)
fn unpack_func_sig_from_fields(fields: [Field; 5]) -> [u8; MAX_SIGNATURE_SIZE] {
    let mut func_sig: [u8; MAX_SIGNATURE_SIZE] = [0; MAX_SIGNATURE_SIZE];

    // First 4 fields, each with 31 bytes
    for f in 0..4 {
        let bytes: [u8; 31] = fields[f].to_be_bytes();
        for i in 0..31 {
            func_sig[f * 31 + i] = bytes[i];
        }
    }

    // Last 4 bytes from field 4
    let last: [u8; 4] = fields[4].to_be_bytes();
    for i in 0..4 {
        func_sig[124 + i] = last[i];
    }

    func_sig
}

/// Unpack salt from a single field (only first 31 bytes, last byte assumed 0)
fn unpack_salt_from_field(field: Field) -> [u8; 32] {
    let mut salt: [u8; 32] = [0; 32];
    let bytes: [u8; 31] = field.to_be_bytes();
    for i in 0..31 {
        salt[i] = bytes[i];
    }
    // salt[31] stays 0
    salt
}

// =============================================================================
// Legacy AuthWitness Layout Constants (for backward compatibility)
// =============================================================================
// The witness uses packed bytes (31 bytes per Fr field) for efficiency:
// - [0-2]: Signature r+s (64 bytes packed into 3 Fr: 31+31+2)
// - [3]: Function signature length
// - [4-8]: Function signature (128 bytes packed into 5 Fr: 31+31+31+31+4)
// - [9]: Arguments count
// - [10-29]: Function arguments (20 Fields, native Fr)
// - [30]: Target address (Fr)
// - [31]: Chain ID (Fr)
// - [32-33]: Salt (32 bytes packed into 2 Fr: 31+1)
// - [34]: Unused/padding

pub global WITNESS_SIZE: u32 = 35;
pub global W_SIG_START: u32 = 0;       // 3 fields (64 bytes packed)
pub global W_FUNC_SIG_LEN: u32 = 3;    // 1 field
pub global W_FUNC_SIG_START: u32 = 4;  // 5 fields (128 bytes packed)
pub global W_ARGS_LEN: u32 = 9;        // 1 field
pub global W_ARGS_START: u32 = 10;     // 20 fields
pub global W_TARGET: u32 = 30;         // 1 field
pub global W_CHAIN_ID: u32 = 31;       // 1 field
pub global W_SALT_START: u32 = 32;     // 2 fields (32 bytes packed)

// =============================================================================
// Byte Unpacking Helpers (31 bytes per Field)
// =============================================================================

/**
 * Unpack ECDSA signature (64 bytes from 3 fields: 31+31+2)
 */
fn unpack_signature(fields: [Field; 3]) -> [u8; 64] {
    let mut sig: [u8; 64] = [0; 64];

    // First 31 bytes from field 0
    let b0: [u8; 31] = fields[0].to_be_bytes();
    for i in 0..31 {
        sig[i] = b0[i];
    }

    // Next 31 bytes from field 1
    let b1: [u8; 31] = fields[1].to_be_bytes();
    for i in 0..31 {
        sig[31 + i] = b1[i];
    }

    // Last 2 bytes from field 2
    let b2: [u8; 2] = fields[2].to_be_bytes();
    sig[62] = b2[0];
    sig[63] = b2[1];

    sig
}

/**
 * Unpack function signature (128 bytes from 5 fields: 31+31+31+31+4)
 */
fn unpack_func_sig(fields: [Field; 5]) -> [u8; 128] {
    let mut func_sig: [u8; 128] = [0; 128];

    // First 4 fields, each with 31 bytes
    for f in 0..4 {
        let bytes: [u8; 31] = fields[f].to_be_bytes();
        for i in 0..31 {
            func_sig[f * 31 + i] = bytes[i];
        }
    }

    // Last 4 bytes from field 4
    let last: [u8; 4] = fields[4].to_be_bytes();
    for i in 0..4 {
        func_sig[124 + i] = last[i];
    }

    func_sig
}

/**
 * Unpack salt (32 bytes from 2 fields: 31+1)
 */
fn unpack_salt(fields: [Field; 2]) -> [u8; 32] {
    let mut salt: [u8; 32] = [0; 32];

    // First 31 bytes from field 0
    let b0: [u8; 31] = fields[0].to_be_bytes();
    for i in 0..31 {
        salt[i] = b0[i];
    }

    // Last byte from field 1
    let b1: [u8; 1] = fields[1].to_be_bytes();
    salt[31] = b1[0];

    salt
}

// =============================================================================
// AuthWitness Parsing Functions
// =============================================================================

/**
 * Parse an auth witness into its components (packed bytes format)
 *
 * Returns:
 * - ecdsa_signature: [u8; 64] (r || s)
 * - function_signature: [u8; 128]
 * - signature_length: u32
 * - function_args: [Field; 20]
 * - args_length: u32
 * - target_address: Field
 * - chain_id: Field
 * - salt: [u8; 32]
 */
pub fn parse_witness(witness: [Field; WITNESS_SIZE]) -> (
    [u8; 64],           // ecdsa_signature
    [u8; 128],          // function_signature
    u32,                // signature_length
    [Field; 20],        // function_args
    u32,                // args_length
    Field,              // target_address
    Field,              // chain_id
    [u8; 32]            // salt
) {
    // Unpack signature (fields 0-2)
    let sig = unpack_signature([witness[0], witness[1], witness[2]]);

    // Function signature length (field 3)
    let func_sig_len = witness[W_FUNC_SIG_LEN] as u32;

    // Unpack function signature (fields 4-8)
    let func_sig = unpack_func_sig([witness[4], witness[5], witness[6], witness[7], witness[8]]);

    // Args length (field 9)
    let args_len = witness[W_ARGS_LEN] as u32;

    // Args (fields 10-29) - native Fr, no unpacking needed
    let mut args: [Field; 20] = [0; 20];
    for i in 0..20 {
        args[i] = witness[W_ARGS_START + i];
    }

    // Metadata (fields 30-31)
    let target = witness[W_TARGET];
    let chain_id = witness[W_CHAIN_ID];

    // Unpack salt (fields 32-33)
    let salt = unpack_salt([witness[32], witness[33]]);

    (sig, func_sig, func_sig_len, args, args_len, target, chain_id, salt)
}

// =============================================================================
// EIP-712 Hash Functions
// =============================================================================

/**
 * Hash a dynamic-length string for EIP-712 encoding
 * enc(string) = keccak256(string)
 */
pub fn hash_string<let N: u32>(data: [u8; N], len: u32) -> [u8; 32] {
    // keccak256 accepts a length parameter, so we can pass the full array
    // and specify how many bytes to actually hash
    keccak256(data, len)
}

/**
 * Hash a uint256[] array for EIP-712 encoding
 * enc(uint256[]) = keccak256(enc(args[0]) || enc(args[1]) || ...)
 *
 * Each Field is converted to 32-byte big-endian representation
 */
pub fn hash_uint256_array(args: [Field; MAX_SERIALIZED_ARGS], len: u32) -> [u8; 32] {
    // Maximum encoded size: 20 args * 32 bytes = 640 bytes
    let mut encoded: [u8; 640] = [0; 640];

    // Loop over compile-time constant, use conditional for actual data
    for i in 0..MAX_SERIALIZED_ARGS {
        if i < len {
            // Convert Field to 32-byte big-endian
            let arg_bytes: [u8; 32] = args[i].to_be_bytes();
            for j in 0..32 {
                encoded[i * 32 + j] = arg_bytes[j];
            }
        }
    }

    // Hash the concatenated encoding
    // Note: keccak256 of empty data is a specific hash
    if len == 0 {
        // keccak256("") = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        [
            0xc5, 0xd2, 0x46, 0x01, 0x86, 0xf7, 0x23, 0x3c,
            0x92, 0x7e, 0x7d, 0xb2, 0xdc, 0xc7, 0x03, 0xc0,
            0xe5, 0x00, 0xb6, 0x53, 0xca, 0x82, 0x27, 0x3b,
            0x7b, 0xfa, 0xd8, 0x04, 0x5d, 0x85, 0xa4, 0x70
        ]
    } else {
        keccak256(encoded, len * 32)
    }
}

/**
 * Compute hashStruct(FunctionCall)
 *
 * hashStruct(s) = keccak256(typeHash || encodeData(s))
 * encodeData(FunctionCall) = contract || keccak256(functionSignature) || keccak256(arguments)
 */
pub fn hash_function_call(
    target_address: [u8; 32],
    function_signature: [u8; MAX_SIGNATURE_SIZE],
    sig_len: u32,
    arguments: [Field; MAX_SERIALIZED_ARGS],
    args_len: u32
) -> [u8; 32] {
    // 1. Hash function signature string
    let sig_hash = hash_string(function_signature, sig_len);

    // 2. Hash arguments array
    let args_hash = hash_uint256_array(arguments, args_len);

    // 3. Concatenate: typeHash (32) || contract (32) || sig_hash (32) || args_hash (32) = 128 bytes
    let mut data: [u8; 128] = [0; 128];

    // Copy type hash
    for i in 0..32 {
        data[i] = FUNCTION_CALL_TYPE_HASH[i];
    }

    // Copy target address (contract)
    for i in 0..32 {
        data[32 + i] = target_address[i];
    }

    // Copy signature hash
    for i in 0..32 {
        data[64 + i] = sig_hash[i];
    }

    // Copy arguments hash
    for i in 0..32 {
        data[96 + i] = args_hash[i];
    }

    keccak256(data, 128)
}

/**
 * Compute hashStruct(AppDomain)
 *
 * hashStruct(s) = keccak256(typeHash || encodeData(s))
 * encodeData(AppDomain) = keccak256(name) || keccak256(version) || chainId || salt
 */
pub fn hash_app_domain(
    name: [u8; 32],          // Pre-hashed name
    version: [u8; 32],       // Pre-hashed version
    chain_id: [u8; 32],      // uint256 as bytes32
    salt: [u8; 32]
) -> [u8; 32] {
    // Concatenate: typeHash (32) || name_hash (32) || version_hash (32) || chainId (32) || salt (32) = 160 bytes
    let mut data: [u8; 160] = [0; 160];

    // Copy type hash
    for i in 0..32 {
        data[i] = APP_DOMAIN_TYPE_HASH[i];
    }

    // Copy pre-hashed name
    for i in 0..32 {
        data[32 + i] = name[i];
    }

    // Copy pre-hashed version
    for i in 0..32 {
        data[64 + i] = version[i];
    }

    // Copy chainId
    for i in 0..32 {
        data[96 + i] = chain_id[i];
    }

    // Copy salt
    for i in 0..32 {
        data[128 + i] = salt[i];
    }

    keccak256(data, 160)
}

/**
 * Compute hashStruct(EntrypointAuthorization)
 *
 * encodeData = hashStruct(appDomain) || hashStruct(functionCall) || txNonce
 */
pub fn hash_entrypoint_authorization(
    app_domain_hash: [u8; 32],
    function_call_hash: [u8; 32],
    tx_nonce: [u8; 32]
) -> [u8; 32] {
    // Total size: typeHash (32) + appDomain (32) + functionCall (32) + txNonce (32) = 128 bytes
    let mut data: [u8; 128] = [0; 128];

    // Copy type hash
    for i in 0..32 {
        data[i] = ENTRYPOINT_AUTHORIZATION_TYPE_HASH[i];
    }

    // Copy app domain hash
    for i in 0..32 {
        data[32 + i] = app_domain_hash[i];
    }

    // Copy function call hash
    for i in 0..32 {
        data[64 + i] = function_call_hash[i];
    }

    // Copy tx nonce
    for i in 0..32 {
        data[96 + i] = tx_nonce[i];
    }

    keccak256(data, 128)
}

/**
 * Hash an array of FunctionCall hashes for EIP-712 encoding
 *
 * For fixed-size arrays like FunctionCall[5], EIP-712 encodes as:
 * enc(T[k]) = keccak256(enc(value[0]) || enc(value[1]) || ... || enc(value[k-1]))
 *
 * Since FunctionCall is a struct, each enc(value[i]) is the hashStruct(value[i]).
 */
pub fn hash_function_calls_array(call_hashes: [[u8; 32]; ACCOUNT_MAX_CALLS]) -> [u8; 32] {
    // Total size: 5 hashes * 32 bytes = 160 bytes
    let mut encoded: [u8; 160] = [0; 160];

    for i in 0..ACCOUNT_MAX_CALLS {
        for j in 0..32 {
            encoded[i * 32 + j] = call_hashes[i][j];
        }
    }

    keccak256(encoded, 160)
}

/**
 * Compute hashStruct(EntrypointAuthorization) for 5 function calls
 *
 * This is the new version that uses FunctionCall[5] instead of a single FunctionCall.
 * encodeData = hashStruct(appDomain) || enc(FunctionCall[5]) || txNonce
 */
pub fn hash_entrypoint_authorization_5(
    app_domain_hash: [u8; 32],
    function_calls_array_hash: [u8; 32],  // Result of hash_function_calls_array
    tx_nonce: [u8; 32]
) -> [u8; 32] {
    // Total size: typeHash (32) + appDomain (32) + functionCalls (32) + txNonce (32) = 128 bytes
    let mut data: [u8; 128] = [0; 128];

    // Copy type hash (5-call version)
    for i in 0..32 {
        data[i] = ENTRYPOINT_AUTHORIZATION_5_TYPE_HASH[i];
    }

    // Copy app domain hash
    for i in 0..32 {
        data[32 + i] = app_domain_hash[i];
    }

    // Copy function calls array hash
    for i in 0..32 {
        data[64 + i] = function_calls_array_hash[i];
    }

    // Copy tx nonce
    for i in 0..32 {
        data[96 + i] = tx_nonce[i];
    }

    keccak256(data, 128)
}

/**
 * Compute hashStruct(AuthwitAppDomain)
 *
 * This is the simplified domain for individual authwits, containing only:
 * - chainId: uint256
 * - verifyingContract: bytes32 (the contract requesting the authwit)
 */
pub fn hash_authwit_app_domain(
    chain_id: [u8; 32],
    verifying_contract: [u8; 32]
) -> [u8; 32] {
    // Total size: typeHash (32) + chainId (32) + verifyingContract (32) = 96 bytes
    let mut data: [u8; 96] = [0; 96];

    // Copy type hash
    for i in 0..32 {
        data[i] = AUTHWIT_APP_DOMAIN_TYPE_HASH[i];
    }

    // Copy chainId
    for i in 0..32 {
        data[32 + i] = chain_id[i];
    }

    // Copy verifyingContract
    for i in 0..32 {
        data[64 + i] = verifying_contract[i];
    }

    keccak256(data, 96)
}

/**
 * Compute hashStruct(FunctionCallAuthorization)
 *
 * This is used for individual authwits (verify_private_authwit).
 * encodeData = hashStruct(AuthwitAppDomain) || hashStruct(FunctionCall)
 */
pub fn hash_function_call_authorization(
    authwit_domain_hash: [u8; 32],
    function_call_hash: [u8; 32]
) -> [u8; 32] {
    // Total size: typeHash (32) + authwitDomain (32) + functionCall (32) = 96 bytes
    let mut data: [u8; 96] = [0; 96];

    // Copy type hash
    for i in 0..32 {
        data[i] = FUNCTION_CALL_AUTHORIZATION_TYPE_HASH[i];
    }

    // Copy authwit domain hash
    for i in 0..32 {
        data[32 + i] = authwit_domain_hash[i];
    }

    // Copy function call hash
    for i in 0..32 {
        data[64 + i] = function_call_hash[i];
    }

    keccak256(data, 96)
}

/**
 * Compute final EIP-712 payload
 *
 * payload = keccak256("\x19\x01" || domainSeparator || hashStruct(message))
 */
pub fn compute_eip712_payload(domain_separator: [u8; 32], message_hash: [u8; 32]) -> [u8; 32] {
    let mut payload: [u8; 66] = [0; 66];

    // EIP-712 prefix
    payload[0] = 0x19;
    payload[1] = 0x01;

    // Copy domain separator
    for i in 0..32 {
        payload[2 + i] = domain_separator[i];
    }

    // Copy message hash
    for i in 0..32 {
        payload[34 + i] = message_hash[i];
    }

    keccak256(payload, 66)
}

/**
 * Convert a Field to 32-byte big-endian representation
 */
pub fn field_to_bytes32(f: Field) -> [u8; 32] {
    f.to_be_bytes()
}

// =============================================================================
// Aztec Poseidon2 Hash Functions (for verification against AppPayload)
// =============================================================================

// These are adapted from the reference implementations in aztec-packages:
// - hash_args: aztec-nr/aztec/src/hash.nr
// - FunctionSelector::from_signature: noir-protocol-circuits/crates/types/src/abis/function_selector.nr
// - poseidon2_hash_bytes: noir-protocol-circuits/crates/types/src/hash.nr
//
// Modified to accept a `len: u32` parameter for variable-length hashing.

/**
 * Compute hash_args with variable length
 *
 * Reference: aztec-nr/aztec/src/hash.nr:60-66
 * ```
 * pub fn hash_args<let N: u32>(args: [Field; N]) -> Field {
 *     if args.len() == 0 {
 *         0
 *     } else {
 *         poseidon2_hash_with_separator(args, GENERATOR_INDEX__FUNCTION_ARGS)
 *     }
 * }
 * ```
 *
 * Modified to use poseidon2_hash_subarray with prepended separator for variable-length support.
 */
pub fn compute_aztec_args_hash(args: [Field; MAX_SERIALIZED_ARGS], len: u32) -> Field {
    if len == 0 {
        // hash_args returns 0 for empty array
        0
    } else {
        // Build array with separator prepended: [separator, args...]
        // Max size is 1 (separator) + MAX_SERIALIZED_ARGS = 21
        let mut input: [Field; 21] = [0; 21];
        input[0] = GENERATOR_INDEX__FUNCTION_ARGS as Field;
        for i in 0..MAX_SERIALIZED_ARGS {
            input[i + 1] = args[i];
        }

        // message_size = separator (1) + args (len)
        let message_size = len + 1;
        poseidon2_hash_subarray(input, message_size)
    }
}

/**
 * Compute function selector from signature bytes with variable length
 *
 * Reference: noir-protocol-circuits/crates/types/src/abis/function_selector.nr:33-39
 * ```
 * pub fn from_signature<let N: u32>(signature: str<N>) -> Self {
 *     let bytes = signature.as_bytes();
 *     let hash = crate::hash::poseidon2_hash_bytes(bytes);
 *     FunctionSelector::from_field(hash)
 * }
 * ```
 *
 * Reference: noir-protocol-circuits/crates/types/src/hash.nr:286-303
 * ```
 * pub fn poseidon2_hash_bytes<let N: u32>(inputs: [u8; N]) -> Field {
 *     let mut fields = [0; (N + 30) / 31];
 *     let mut field_index = 0;
 *     let mut current_field = [0; 31];
 *     for i in 0..inputs.len() {
 *         let index = i % 31;
 *         current_field[index] = inputs[i];
 *         if index == 30 {
 *             fields[field_index] = field_from_bytes(current_field, false);
 *             current_field = [0; 31];
 *             field_index += 1;
 *         }
 *     }
 *     if field_index != fields.len() {
 *         fields[field_index] = field_from_bytes(current_field, false);
 *     }
 *     poseidon2_hash(fields)
 * }
 * ```
 *
 * Modified to accept len: u32 for variable-length byte arrays.
 */
pub fn compute_function_selector(signature: [u8; MAX_SIGNATURE_SIZE], len: u32) -> u32 {
    if len == 0 {
        0
    } else {
        // Convert bytes to fields (31 bytes per field, little-endian as per field_from_bytes)
        // Maximum fields needed: (128 + 30) / 31 = 5 fields
        let mut fields: [Field; 5] = [0; 5];
        let mut field_index: u32 = 0;
        let mut current_field: [u8; 31] = [0; 31];

        for i in 0..MAX_SIGNATURE_SIZE {
            if i < len {
                let index = i % 31;
                current_field[index] = signature[i];
                if index == 30 {
                    fields[field_index] = field_from_bytes_31_le(current_field);
                    current_field = [0; 31];
                    field_index += 1;
                }
            }
        }

        // Handle remaining bytes (partial last field)
        let remaining = len % 31;
        if remaining != 0 {
            fields[field_index] = field_from_bytes_31_le(current_field);
            field_index += 1;
        }

        // Hash the fields using poseidon2_hash_subarray
        let hash = poseidon2_hash_subarray(fields, field_index);

        // Truncate to u32 (lower 32 bits)
        hash as u32
    }
}

/**
 * Convert up to 31 bytes to a Field (little-endian)
 *
 * Reference: noir-protocol-circuits/crates/types/src/utils/field.nr:3-17
 * This matches field_from_bytes(bytes, false) which uses little-endian.
 */
fn field_from_bytes_31_le(bytes: [u8; 31]) -> Field {
    let mut as_field: Field = 0;
    let mut offset: Field = 1;
    for i in 0..31 {
        as_field += (bytes[i] as Field) * offset;
        offset *= 256;
    }
    as_field
}

/**
 * Compute the Aztec inner_hash for authwit verification
 *
 * The inner_hash is computed by the consumer contract as:
 * inner_hash = poseidon2_hash_with_separator([caller, selector, args_hash], GENERATOR_INDEX__AUTHWIT_INNER)
 *
 * This is used by verify_private_authwit to verify the EIP-712 witness matches
 * the expected authwit request.
 *
 * Reference: aztec-nr/aztec/src/context/call_interfaces.nr (call hash computation)
 */
pub fn compute_inner_hash(caller: Field, selector: u32, args_hash: Field) -> Field {
    poseidon2_hash_with_separator(
        [caller, selector as Field, args_hash],
        GENERATOR_INDEX__AUTHWIT_INNER
    )
}

// =============================================================================
// AppPayload Serialization Helpers
// =============================================================================

/**
 * AppPayload serialization format (from aztec-nr):
 * - function_calls[0..ACCOUNT_MAX_CALLS]: each FunctionCall is 6 fields
 *   - args_hash: Field
 *   - function_selector: Field (u32 stored as Field)
 *   - target_address: Field
 *   - is_public: Field (bool as 0/1)
 *   - hide_msg_sender: Field (bool as 0/1)
 *   - is_static: Field (bool as 0/1)
 * - tx_nonce: Field
 *
 * For single call: 1 * 6 + 1 = 7 Fields
 * NOTE: AppPayload still uses 5 calls internally, we only verify 1
 */
pub global APP_PAYLOAD_SERIALIZED_LEN: u32 = 31;  // Keep original size for AppPayload compatibility
pub global FUNCTION_CALL_SERIALIZED_LEN: u32 = 6;

/**
 * Extract args_hash for a specific function call from serialized AppPayload
 */
pub fn extract_args_hash(serialized: [Field; APP_PAYLOAD_SERIALIZED_LEN], call_index: u32) -> Field {
    // args_hash is first field in each FunctionCall
    let offset = call_index * FUNCTION_CALL_SERIALIZED_LEN;
    serialized[offset]
}

/**
 * Extract function_selector for a specific function call from serialized AppPayload
 */
pub fn extract_function_selector(serialized: [Field; APP_PAYLOAD_SERIALIZED_LEN], call_index: u32) -> u32 {
    // function_selector is second field in each FunctionCall
    let offset = call_index * FUNCTION_CALL_SERIALIZED_LEN + 1;
    serialized[offset] as u32
}

/**
 * Extract target_address for a specific function call from serialized AppPayload
 */
pub fn extract_target_address(serialized: [Field; APP_PAYLOAD_SERIALIZED_LEN], call_index: u32) -> Field {
    // target_address is third field in each FunctionCall
    let offset = call_index * FUNCTION_CALL_SERIALIZED_LEN + 2;
    serialized[offset]
}

// =============================================================================
// Tests
// =============================================================================

#[test]
fn test_hash_empty_args() {
    let args: [Field; MAX_SERIALIZED_ARGS] = [0; MAX_SERIALIZED_ARGS];
    let hash = hash_uint256_array(args, 0);

    // keccak256("") = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
    assert(hash[0] == 0xc5);
    assert(hash[1] == 0xd2);
}

#[test]
fn test_aztec_args_hash_empty() {
    let args: [Field; MAX_SERIALIZED_ARGS] = [0; MAX_SERIALIZED_ARGS];
    let hash = compute_aztec_args_hash(args, 0);
    assert(hash == 0);
}

#[test]
fn test_aztec_args_hash_single() {
    let mut args: [Field; MAX_SERIALIZED_ARGS] = [0; MAX_SERIALIZED_ARGS];
    args[0] = 42;
    let hash = compute_aztec_args_hash(args, 1);
    // This should produce a non-zero hash
    assert(hash != 0);
}
