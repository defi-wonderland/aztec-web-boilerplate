import {
  AztecAddress,
  ContractInstanceWithAddress,
  Fr,
  type PXE,
  type Wallet,
} from '@aztec/aztec.js';
import {
  type ContractArtifact,
  FunctionAbi,
  getDefaultInitializer,
} from '@aztec/stdlib/abi';
import { IAztecContractService } from '../../../types';
import { AztecArtifactService } from '../artifacts/AztecArtifactService';
import { ContractUIGenerator } from '../ui/ContractUIGenerator';
import { ContractInteractionService } from '../interaction/ContractInteractionService';
import type { AztecContractMetadata } from '../../../types';
import type { ContractUIConfig } from '../ui/ContractUIGenerator';
import type {
  FunctionExecutionInputs,
  FunctionExecutionResult,
  ContractDeploymentResult,
} from '../interaction/ContractInteractionService';

/**
 * Enhanced service for managing Aztec contract operations
 * Integrates artifact parsing, UI generation, and contract interaction
 */
export class AztecContractService implements IAztecContractService {
  private artifactService: AztecArtifactService;
  private uiGenerator: ContractUIGenerator;
  private interactionService?: ContractInteractionService;

  constructor(private pxe: PXE, private wallet?: Wallet) {
    this.artifactService = new AztecArtifactService();
    this.uiGenerator = new ContractUIGenerator();
    if (wallet) {
      this.interactionService = new ContractInteractionService(pxe, wallet);
    }
  }

  /**
   * Register a contract with PXE
   */
  async registerContract(
    artifact: ContractArtifact,
    deployer: AztecAddress,
    deploymentSalt: Fr,
    constructorArgs: any[],
    constructor: FunctionAbi | string
  ): Promise<ContractInstanceWithAddress> {
    const instance = await this.#getContractInstanceFromDeployParams(artifact, {
      constructor: constructor,
      constructorArgs: constructorArgs,
      deployer: deployer,
      salt: deploymentSalt,
    });

    await this.pxe.registerContract({
      instance,
      artifact,
    });

    return instance;
  }

  /**
   * Parse a contract artifact into structured metadata
   * 
   * @param artifact - Raw contract artifact
   * @returns Parsed contract metadata
   */
  parseContractArtifact(artifact: ContractArtifact): AztecContractMetadata {
    return this.artifactService.parseArtifact(artifact);
  }

  /**
   * Generate UI configuration from contract metadata
   * 
   * @param metadata - Parsed contract metadata
   * @returns UI configuration for the contract
   */
  generateContractUI(metadata: AztecContractMetadata): ContractUIConfig {
    return this.uiGenerator.generateContractUI(metadata);
  }

  /**
   * Parse artifact and generate UI configuration in one step
   * 
   * @param artifact - Raw contract artifact
   * @returns UI configuration for the contract
   */
  parseAndGenerateUI(artifact: ContractArtifact): {
    metadata: AztecContractMetadata;
    uiConfig: ContractUIConfig;
  } {
    const metadata = this.parseContractArtifact(artifact);
    const uiConfig = this.generateContractUI(metadata);
    return { metadata, uiConfig };
  }

  /**
   * Execute a contract function
   * 
   * @param contractAddress - Address of the deployed contract
   * @param functionConfig - Function UI configuration
   * @param inputs - Function input values
   * @returns Execution result
   */
  async executeContractFunction(
    contractAddress: AztecAddress,
    functionConfig: any, // FunctionUIConfig from ui generator
    inputs: FunctionExecutionInputs
  ): Promise<FunctionExecutionResult> {
    if (!this.interactionService) {
      throw new Error('Wallet required for contract function execution');
    }
    return this.interactionService.executeFunction(contractAddress, functionConfig, inputs);
  }

  /**
   * Deploy a new contract
   * 
   * @param artifact - Contract artifact
   * @param initializerConfig - Initializer function configuration (optional)
   * @param inputs - Initializer input values (optional)
   * @returns Deployment result
   */
  async deployContract(
    artifact: ContractArtifact,
    initializerConfig?: any, // FunctionUIConfig from ui generator
    inputs?: FunctionExecutionInputs
  ): Promise<ContractDeploymentResult> {
    if (!this.interactionService) {
      throw new Error('Wallet required for contract deployment');
    }
    return this.interactionService.deployContract(artifact, initializerConfig, inputs);
  }

  /**
   * Complete workflow: Parse artifact, generate UI, and prepare for interaction
   * 
   * @param artifact - Raw contract artifact
   * @returns Complete contract information ready for UI rendering
   */
  prepareContractForInteraction(artifact: ContractArtifact): {
    metadata: AztecContractMetadata;
    uiConfig: ContractUIConfig;
    canExecute: boolean;
    canDeploy: boolean;
  } {
    const { metadata, uiConfig } = this.parseAndGenerateUI(artifact);
    
    return {
      metadata,
      uiConfig,
      canExecute: !!this.interactionService,
      canDeploy: !!this.interactionService,
    };
  }

  /**
   * Set or update the wallet for contract interactions
   * 
   * @param wallet - Aztec wallet instance
   */
  setWallet(wallet: Wallet): void {
    this.wallet = wallet;
    this.interactionService = new ContractInteractionService(this.pxe, wallet);
  }

  /**
   * Check if the service is ready for contract interactions
   * 
   * @returns True if wallet is available for interactions
   */
  isReadyForInteraction(): boolean {
    return !!this.interactionService;
  }


  // TODO: We could define a type for this function
  /**
   * Helper method to create contract instance from deploy params
   */
  async #getContractInstanceFromDeployParams(artifact: ContractArtifact, params: {
    deployer?: AztecAddress,
    salt: Fr,
    constructorArgs: any[],
    constructor: FunctionAbi | string
  }) {
    const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
    return await getContractInstanceFromDeployParams(artifact, {
      constructorArgs: params.constructorArgs,
      salt: params.salt,
      constructorArtifact: params.constructor,
      deployer: params.deployer,
    });
  }
}
