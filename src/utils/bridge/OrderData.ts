/**
 * OrderData Class
 * Handles encoding and decoding of bridge order data
 */

import { encodeAbiParameters, decodeAbiParameters, keccak256 } from 'viem';
import { type OrderDataParams } from '../../types';
import { ORDER_DATA_TYPE } from '../../config';

export class OrderData {
  public sender: string;
  public recipient: string;
  public inputToken: string;
  public outputToken: string;
  public amountIn: bigint;
  public amountOut: bigint;
  public senderNonce: bigint;
  public originDomain: number;
  public destinationDomain: number;
  public destinationSettler: string;
  public fillDeadline: bigint;
  public orderType: number;
  public data: string;

  constructor(params: OrderDataParams) {
    this.sender = this.padAddress(params.sender);
    this.recipient = this.padAddress(params.recipient);
    this.inputToken = this.padAddress(params.inputToken);
    this.outputToken = this.padAddress(params.outputToken);
    this.amountIn = params.amountIn;
    this.amountOut = params.amountOut;
    this.senderNonce = params.senderNonce;
    this.originDomain = params.originDomain;
    this.destinationDomain = params.destinationDomain;
    this.destinationSettler = this.padAddress(params.destinationSettler);
    this.fillDeadline = params.fillDeadline;
    this.orderType = params.orderType;
    this.data = this.padAddress(params.data || '0x');
  }

  /**
   * Pad address to 32 bytes
   */
  private padAddress(address: string): string {
    if (address.startsWith('0x')) {
      // Remove 0x prefix, pad to 64 chars (32 bytes), add 0x back
      return `0x${address.slice(2).padStart(64, '0')}`;
    }
    return `0x${address.padStart(64, '0')}`;
  }

  /**
   * Encode order data for contract interaction
   */
  encode(): string {
    const types = [
      'bytes32', // sender
      'bytes32', // recipient
      'bytes32', // inputToken
      'bytes32', // outputToken
      'uint256', // amountIn
      'uint256', // amountOut
      'uint256', // senderNonce
      'uint256', // originDomain
      'uint256', // destinationDomain
      'bytes32', // destinationSettler
      'uint256', // fillDeadline
      'uint256', // orderType
      'bytes32', // data
    ] as const;

    const values = [
      this.sender as `0x${string}`,
      this.recipient as `0x${string}`,
      this.inputToken as `0x${string}`,
      this.outputToken as `0x${string}`,
      this.amountIn,
      this.amountOut,
      this.senderNonce,
      BigInt(this.originDomain),
      BigInt(this.destinationDomain),
      this.destinationSettler as `0x${string}`,
      this.fillDeadline,
      BigInt(this.orderType),
      this.data as `0x${string}`,
    ] as const;

    return encodeAbiParameters(types, values);
  }

  /**
   * Get order ID (hash of encoded data)
   */
  getOrderId(): string {
    return keccak256(this.encode());
  }

  /**
   * Decode order data from encoded string
   */
  static decode(encodedData: string): OrderData {
    const types = [
      'bytes32', // sender
      'bytes32', // recipient
      'bytes32', // inputToken
      'bytes32', // outputToken
      'uint256', // amountIn
      'uint256', // amountOut
      'uint256', // senderNonce
      'uint256', // originDomain
      'uint256', // destinationDomain
      'bytes32', // destinationSettler
      'uint256', // fillDeadline
      'uint256', // orderType
      'bytes32', // data
    ] as const;

    const decoded = decodeAbiParameters(types, encodedData as `0x${string}`);

    return new OrderData({
      sender: decoded[0],
      recipient: decoded[1],
      inputToken: decoded[2],
      outputToken: decoded[3],
      amountIn: decoded[4],
      amountOut: decoded[5],
      senderNonce: decoded[6],
      originDomain: Number(decoded[7]),
      destinationDomain: Number(decoded[8]),
      destinationSettler: decoded[9],
      fillDeadline: decoded[10],
      orderType: Number(decoded[11]),
      data: decoded[12],
    });
  }

  /**
   * Convert to plain object
   */
  toObject(): OrderDataParams {
    return {
      sender: this.sender,
      recipient: this.recipient,
      inputToken: this.inputToken,
      outputToken: this.outputToken,
      amountIn: this.amountIn,
      amountOut: this.amountOut,
      senderNonce: this.senderNonce,
      originDomain: this.originDomain,
      destinationDomain: this.destinationDomain,
      destinationSettler: this.destinationSettler,
      fillDeadline: this.fillDeadline,
      orderType: this.orderType,
      data: this.data,
    };
  }
}