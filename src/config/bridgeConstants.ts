/**
 * Bridge Configuration
 * Constants and configuration for Aztec-EVM bridge operations
 * Based on Substance Labs Aztec-EVM Bridge
 */

// Gateway Contract Addresses
export const AZTEC_GATEWAY = '0x1b4f272b622a493184f6fbb83fc7631f1ce9bad68d4d4c150dc55eed5f100d73';
export const BASE_SEPOLIA_GATEWAY = '0x0Bf4eD5a115e6Ad789A88c21e9B75821Cc7B2e6f';

// WETH Token Addresses
export const AZTEC_WETH = '0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb';
export const BASE_SEPOLIA_WETH = '0x1BDD24840e119DC2602dCC587Dd182812427A5Cc';

// Chain IDs
export const AZTEC_SEPOLIA_CHAIN_ID = 999999;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Order Types
export const PUBLIC_ORDER = 0;
export const PRIVATE_ORDER = 1;

// Order Status
export const OPENED = 0;
export const FILLED = 1;
export const FILLED_PRIVATELY = 2;
export const REFUNDED = 3;

// Special Addresses
export const PRIVATE_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000001';

// EIP-712 Type Hash for Order Data
export const ORDER_DATA_TYPE = {
  OrderData: [
    { name: 'sender', type: 'bytes32' },
    { name: 'recipient', type: 'bytes32' },
    { name: 'inputToken', type: 'bytes32' },
    { name: 'outputToken', type: 'bytes32' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOut', type: 'uint256' },
    { name: 'senderNonce', type: 'uint256' },
    { name: 'originDomain', type: 'uint256' },
    { name: 'destinationDomain', type: 'uint256' },
    { name: 'destinationSettler', type: 'bytes32' },
    { name: 'fillDeadline', type: 'uint256' },
    { name: 'orderType', type: 'uint256' },
    { name: 'data', type: 'bytes32' },
  ],
};

// Default values
export const DEFAULT_FILL_DEADLINE_SECONDS = 3600; // 1 hour
export const POLLING_INTERVAL_MS = 5000; // 5 seconds