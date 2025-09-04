import React, { useState, useCallback, useMemo } from 'react';
import { ContractInput } from './ContractInput';
import { ContractInfoPanel } from './ContractInfoPanel';
import { DynamicContractForm } from './DynamicContractForm';
import { ExecutionResults, ExecutionResult } from './ExecutionResults';
import { ContractDeployer } from './ContractDeployer';
import { AztecContractMetadata } from '../../types';
import { AztecArtifactService } from '../../services/aztec/artifacts/AztecArtifactService';
import { AztecContractService } from '../../services/aztec/core/AztecContractService';
import { ContractUIGenerator } from '../../services/aztec/ui/ContractUIGenerator';
import { useAztecWallet } from '../../hooks';
import { useError } from '../../providers/ErrorProvider';
import { AztecAddress } from '@aztec/aztec.js';
import { ContractArtifact } from '@aztec/stdlib/abi';

interface LoadedContract {
  address: string;
  metadata: AztecContractMetadata;
  rawArtifact: ContractArtifact;
  uiConfig: any; // ContractUIConfig from ui generator
}

/**
 * Main interface component for the Aztec-95 app
 * Provides complete contract interaction functionality
 */
export const AztecWebInterface: React.FC = () => {
  const [mode, setMode] = useState<'interact' | 'deploy'>('interact');
  const [loadedContract, setLoadedContract] = useState<LoadedContract | null>(null);
  const [isLoadingContract, setIsLoadingContract] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [recentContracts, setRecentContracts] = useState<Array<{
    address: string;
    name: string;
    artifact: unknown;
  }>>([]);

  const { 
    connectedAccount, 
    isInitialized
  } = useAztecWallet();
  
  const { addError } = useError();
  const artifactService = useMemo(() => new AztecArtifactService(), []);
  const uiGenerator = useMemo(() => new ContractUIGenerator(), []);
  
  // TODO: Integrate with full contract service when we have access to PXE
  const contractService = null;

  // Load contract from address and artifact
  const handleLoadContract = useCallback(async (address: string, artifact: unknown) => {
    setIsLoadingContract(true);
    
    try {
      // Parse the artifact to get contract metadata
      const contractArtifact = artifact as ContractArtifact;
      const metadata = artifactService.parseArtifact(contractArtifact);
      
      // Generate UI configuration
      const uiConfig = uiGenerator.generateContractUI(metadata);
      
      // Store the loaded contract with UI configuration
      const contract: LoadedContract = {
        address,
        metadata,
        rawArtifact: contractArtifact,
        uiConfig,
      };
      
      setLoadedContract(contract);
      
      // Add to recent contracts (avoiding duplicates)
      const existingIndex = recentContracts.findIndex(c => c.address === address);
      const newRecent = [...recentContracts];
      
      if (existingIndex >= 0) {
        newRecent.splice(existingIndex, 1);
      }
      
      newRecent.unshift({
        address,
        name: metadata.name,
        artifact,
      });
      
      // Keep only last 10 recent contracts
      setRecentContracts(newRecent.slice(0, 10));
      
      addError({
        message: `Successfully loaded contract: ${metadata.name}`,
        type: 'info',
        source: 'contract-loader'
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load contract';
      addError({
        message: errorMessage,
        type: 'error',
        source: 'contract-loader',
        details: 'Please check that the artifact is valid and the address format is correct.'
      });
      throw error;
    } finally {
      setIsLoadingContract(false);
    }
  }, [artifactService, uiGenerator, recentContracts, addError]);

  // Execute contract function
  const handleExecuteFunction = useCallback(async (functionName: string, parameters: Record<string, unknown>) => {
    if (!loadedContract || !connectedAccount) {
      addError({
        message: 'No contract loaded or wallet not connected',
        type: 'error',
        source: 'function-execution'
      });
      return;
    }

    const resultId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Add pending result
    const pendingResult: ExecutionResult = {
      id: resultId,
      functionName,
      parameters,
      status: 'pending',
      timestamp: new Date(),
    };

    setExecutionResults(prev => [pendingResult, ...prev]);

    try {
      // Find the function definition
      const functionDef = loadedContract.metadata.functions.find(f => f.name === functionName);
      if (!functionDef) {
        throw new Error(`Function ${functionName} not found in contract`);
      }

      // TODO: Replace with actual contract execution using AztecContractService
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      const executionTime = Date.now() - startTime;
      const mockResult = `Function ${functionName} executed with parameters: ${JSON.stringify(parameters)}`;

      // Update result with success
      const successResult: ExecutionResult = {
        ...pendingResult,
        status: 'success',
        result: mockResult,
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Mock transaction hash
        executionTime,
      };

      setExecutionResults(prev => 
        prev.map(r => r.id === resultId ? successResult : r)
      );

      addError({
        message: `Successfully executed ${functionName}`,
        type: 'info',
        source: 'function-execution'
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Function execution failed';

      // Update result with error
      const errorResult: ExecutionResult = {
        ...pendingResult,
        status: 'error',
        error: errorMessage,
        executionTime,
      };

      setExecutionResults(prev => 
        prev.map(r => r.id === resultId ? errorResult : r)
      );

      addError({
        message: `Failed to execute ${functionName}: ${errorMessage}`,
        type: 'error',
        source: 'function-execution'
      });
    }
  }, [loadedContract, connectedAccount, addError]);

  // Clear execution results
  const handleClearResults = useCallback(() => {
    setExecutionResults([]);
  }, []);

  // Clear loaded contract
  const handleClearContract = useCallback(() => {
    setLoadedContract(null);
    setExecutionResults([]);
  }, []);

  // Handle contract deployment
  const handleContractDeployed = useCallback(async (contractAddress: string, contractType: string, artifact: any) => {
    // Add to recent contracts
    const newContract = {
      address: contractAddress,
      name: contractType,
      artifact,
    };
    
    setRecentContracts(prev => {
      const filtered = prev.filter(c => c.address !== contractAddress);
      return [newContract, ...filtered].slice(0, 10);
    });

    // Optionally auto-load the deployed contract
    try {
      await handleLoadContract(contractAddress, artifact);
      setMode('interact'); // Switch to interaction mode
    } catch (error) {
      console.error('Failed to auto-load deployed contract:', error);
    }
  }, [handleLoadContract]);

  const isWalletReady = connectedAccount && isInitialized;

  return (
    <div className="aztec-eth95-interface">
      {/* Mode Switcher */}
      <div className="mode-switcher">
        <button
          type="button"
          onClick={() => setMode('interact')}
          className={`mode-btn ${mode === 'interact' ? 'active' : ''}`}
        >
          <span className="mode-icon">🔗</span>
          <span className="mode-title">Interact with Contract</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('deploy')}
          className={`mode-btn ${mode === 'deploy' ? 'active' : ''}`}
        >
          <span className="mode-icon">🚀</span>
          <span className="mode-title">Deploy New Contract</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="interface-body">
        {mode === 'deploy' ? (
          /* Contract Deployment Phase */
          <div className="deployment-phase">
            <ContractDeployer
              onContractDeployed={handleContractDeployed}
              disabled={!isWalletReady}
            />
          </div>
        ) : !loadedContract ? (
          /* Contract Input Phase */
          <div className="input-phase">
            <div className="input-container">
              <ContractInput
                onLoadContract={handleLoadContract}
                isLoading={isLoadingContract}
                disabled={!isWalletReady}
                recentContracts={recentContracts}
              />
            </div>
            
            {!isWalletReady && (
              <div className="wallet-notice">
                <div className="notice-icon">⚠️</div>
                <div className="notice-content">
                  <h3>Wallet Connection Required</h3>
                  <p>Please connect your Aztec wallet using the controls in the header above. You can:</p>
                  <ul>
                    <li><strong>Connect Test Account</strong> - Use a local sandbox account</li>
                    <li><strong>Create Account</strong> - Generate a new local account</li>
                    <li><strong>AzGuard Wallet</strong> - Connect with the AzGuard browser wallet</li>
                  </ul>
                  <p>Don't forget to select the right network (Sandbox/Testnet) before connecting!</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Contract Interaction Phase */
          <div className="interaction-phase">
            {/* Left Panel: Contract Info */}
            <div className="left-panel">
              <div className="panel-header">
                <button
                  type="button"
                  onClick={handleClearContract}
                  className="btn btn-secondary btn-sm back-btn"
                >
                  <span className="btn-icon">←</span>
                  Load Different Contract
                </button>
              </div>
              
              <ContractInfoPanel
                contractMetadata={loadedContract.metadata}
                contractAddress={loadedContract.address}
                network="sandbox" // TODO: Get from config
                isVerified={false} // TODO: Implement verification check
              />
            </div>

            {/* Right Panel: Function Interface */}
            <div className="right-panel">
              <div className="function-interface">
                <DynamicContractForm
                  contractMetadata={loadedContract.metadata}
                  onExecuteFunction={handleExecuteFunction}
                  disabled={!isWalletReady}
                />
              </div>
            </div>

            {/* Bottom Panel: Execution Results */}
            <div className="bottom-panel">
              <ExecutionResults
                results={executionResults}
                onClearResults={handleClearResults}
                maxResults={20}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
