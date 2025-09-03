/**
 * Bridge Types
 * Type definitions for Aztec-EVM bridge operations
 */

import { type Address } from 'viem';
import { type AztecAddress, type Fr } from '@aztec/aztec.js';

export interface OrderDataParams {
  sender: string;
  recipient: string;
  inputToken: string;
  outputToken: string;
  amountIn: bigint;
  amountOut: bigint;
  senderNonce: bigint;
  originDomain: number;
  destinationDomain: number;
  destinationSettler: string;
  fillDeadline: bigint;
  orderType: number;
  data: string;
}

export interface Order {
  chainIdIn: number;
  chainIdOut: number;
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: string;
  tokenOut: string;
  mode: 'private' | 'public';
  recipient?: string;
  data?: string;
}

export interface FillOrderDetails {
  orderId: string;
  orderData: OrderDataParams;
}

export interface RefundOrderDetails {
  orderId: string;
  chainIdIn: number;
  chainIdOut: number;
}

export interface OrderStatus {
  status: 'pending' | 'opened' | 'filled' | 'refunded' | 'failed';
  orderId?: string;
  txHash?: string;
  fillTxHash?: string;
  error?: string;
}

export interface BridgeCallbacks {
  onOrderOpened?: (orderId: string, txHash: string) => void;
  onOrderFilled?: (orderId: string, fillTxHash: string) => void;
  onStatusUpdate?: (status: OrderStatus) => void;
  onError?: (error: Error) => void;
}

export interface AztecToEvmOrderParams {
  confidential: boolean;
  sourceAmount: bigint;
  targetAmount: bigint;
  recipientAddress: Address;
  nonce: Fr;
  callbacks?: BridgeCallbacks;
}