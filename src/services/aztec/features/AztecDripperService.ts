import {
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
  AztecAddress,
  Fr,
  getContractInstanceFromInstantiationParams,
  type PXE,
} from '@aztec/aztec.js';
import { IDripperService } from '../../../types';
import { DripperContract } from '@defi-wonderland/aztec-standards/current/artifacts/Dripper.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/Token.js';
import type { AppConfig } from '../../../config/networks';

/**
 * Service for handling Aztec Dripper operations
 */
export class AztecDripperService implements IDripperService {
  private dripperRegistered = false;
  private tokenRegistered = false;

  constructor(
    private getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>,
    private contractAddress: string,
    private getConnectedAccount: () => any,
    private getPXE: () => PXE,
    private config: AppConfig
  ) {}

  /**
   * Ensure the Dripper contract is registered with PXE before use
   */
  private async ensureDripperRegistered(): Promise<void> {
    if (this.dripperRegistered) {
      return;
    }

    const pxe = this.getPXE();
    const address = AztecAddress.fromString(this.contractAddress);

    // Check if already registered in PXE
    try {
      const metadata = await pxe.getContractMetadata(address);
      if (metadata?.contractInstance) {
        this.dripperRegistered = true;
        console.log('✅ Dripper contract already registered in PXE');
        return;
      }
    } catch {
      // Not registered, continue to register
    }

    // Compute proper contract instance from deployment params
    console.log('📝 Registering Dripper contract with PXE...');
    
    const instance = await getContractInstanceFromInstantiationParams(
      DripperContract.artifact,
      {
        salt: Fr.fromString(this.config.dripperDeploymentSalt),
        deployer: AztecAddress.fromString(this.config.deployerAddress),
        constructorArgs: [],
        constructorArtifact: 'constructor',
      }
    );

    // Verify computed address matches expected
    if (!instance.address.equals(address)) {
      console.warn(
        `⚠️ Dripper contract address mismatch! ` +
        `Computed: ${instance.address.toString()}, Expected: ${address.toString()}`
      );
    }

    await pxe.registerContract({
      instance,
      artifact: DripperContract.artifact,
    });
    
    this.dripperRegistered = true;
    console.log('✅ Dripper contract registered with PXE at', instance.address.toString());
  }

  /**
   * Ensure the Token contract is registered with PXE before use
   */
  private async ensureTokenRegistered(tokenAddress: string): Promise<void> {
    if (this.tokenRegistered) {
      return;
    }

    const pxe = this.getPXE();
    const address = AztecAddress.fromString(tokenAddress);

    // Check if already registered in PXE
    try {
      const metadata = await pxe.getContractMetadata(address);
      if (metadata?.contractInstance) {
        this.tokenRegistered = true;
        console.log('✅ Token contract already registered in PXE');
        return;
      }
    } catch {
      // Not registered, continue to register
    }

    // Compute proper contract instance from deployment params
    console.log('📝 Registering Token contract with PXE...');
    
    const instance = await getContractInstanceFromInstantiationParams(
      TokenContract.artifact,
      {
        salt: Fr.fromString(this.config.tokenDeploymentSalt),
        deployer: AztecAddress.fromString(this.config.deployerAddress),
        constructorArgs: [
          'Yield Token', // name
          'YT', // symbol
          18, // decimals
          AztecAddress.fromString(this.config.dripperContractAddress), // minter (Dripper address)
          AztecAddress.ZERO, // upgrade_authority
        ],
        constructorArtifact: 'constructor_with_minter',
      }
    );

    // Verify computed address matches expected
    if (!instance.address.equals(address)) {
      console.warn(
        `⚠️ Token contract address mismatch! ` +
        `Computed: ${instance.address.toString()}, Expected: ${address.toString()}`
      );
    }

    await pxe.registerContract({
      instance,
      artifact: TokenContract.artifact,
    });
    
    this.tokenRegistered = true;
    console.log('✅ Token contract registered with PXE at', instance.address.toString());
  }

  /**
   * Ensure both Dripper and Token contracts are registered
   */
  private async ensureContractsRegistered(tokenAddress: string): Promise<void> {
    await Promise.all([
      this.ensureDripperRegistered(),
      this.ensureTokenRegistered(tokenAddress),
    ]);
  }

  /**
   * Mint tokens to private balance
   */
  async dripToPrivate(tokenAddress: string, amount: bigint): Promise<void> {
    const connectedAccount = this.getConnectedAccount();
    if (!connectedAccount) {
      throw new Error('No account connected');
    }

    // Ensure both Dripper and Token contracts are registered before use
    await this.ensureContractsRegistered(tokenAddress);

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

    // Ensure both Dripper and Token contracts are registered before use
    await this.ensureContractsRegistered(tokenAddress);

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

    // Ensure Dripper contract is registered before use
    await this.ensureDripperRegistered();

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
    const connectedAccount = this.getConnectedAccount();
    const paymentMethod = await this.getSponsoredFeePaymentMethod();
    
    await interaction.send({
      from: connectedAccount.getAddress(),
      fee: {
        paymentMethod,
      },
    }).wait({ timeout: 120 });
  }
}
