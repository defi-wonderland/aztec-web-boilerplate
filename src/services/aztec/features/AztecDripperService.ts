import {
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
  AztecAddress,
} from '@aztec/aztec.js';
import { IDripperService } from '../../../types';
import { DripperContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Dripper.js';

/**
 * Service for handling Aztec Dripper operations
 */
export class AztecDripperService implements IDripperService {
  constructor(
    private getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>,
    private contractAddress: string,
    private getConnectedAccount: () => any
  ) {}

  /**
   * Mint tokens to private balance
   */
  async dripToPrivate(tokenAddress: string, amount: bigint): Promise<void> {
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    const dripperContract = await DripperContract.at(
      AztecAddress.fromString(this.contractAddress),
      connectedAccount
    );
    
    const interaction = dripperContract.methods.drip_to_private(
      AztecAddress.fromString(tokenAddress),
      amount
    );
    await this.sendTransaction(interaction);
  }

  /**
   * Mint tokens to public balance
   */
  async dripToPublic(tokenAddress: string, amount: bigint): Promise<void> {
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    const dripperContract = await DripperContract.at(
      AztecAddress.fromString(this.contractAddress),
      connectedAccount
    );
    
    const interaction = dripperContract.methods.drip_to_public(
      AztecAddress.fromString(tokenAddress),
      amount
    );
    await this.sendTransaction(interaction);
  }

  /**
   * Sync private state
   */
  async syncPrivateState(): Promise<void> {
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    const dripperContract = await DripperContract.at(
      AztecAddress.fromString(this.contractAddress),
      connectedAccount
    );
    
    const interaction = dripperContract.methods.sync_private_state();
    await this.sendTransaction(interaction);
  }

  /**
   * Send a transaction with the Sponsored FPC Contract for fee payment
   */
  private async sendTransaction(interaction: ContractFunctionInteraction): Promise<void> {
    const paymentMethod = await this.getSponsoredFeePaymentMethod();
    const provenInteraction = await interaction.prove({
      fee: {
        paymentMethod,
      },
    });

    await provenInteraction.send().wait({ timeout: 120 });
  }
}
