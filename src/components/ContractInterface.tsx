import React, { useState } from 'react';
import { ContractFunction } from './ContractFunction';
import { useAztecWallet, useAzguardWallet } from '../hooks';
import { AztecAddress, Contract } from '@aztec/aztec.js';
import { loadContractArtifact } from '@aztec/stdlib/abi';

interface AbiInput {
  name: string;
  type: string;
  internalType?: string;
}

interface AbiFunction {
  name: string;
  type: 'function';
  inputs: AbiInput[];
  outputs?: AbiInput[];
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
}

interface ContractArtifact {
  contractName: string;
  abi: any[];
  bytecode?: string;
  address?: string;
  format: 'aztec-noir' | 'unknown';
  metadata?: {
    noir_version?: string;
    transpiled?: boolean;
  };
}

interface ContractInterfaceProps {
  contract: ContractArtifact;
  onClose: () => void;
}

export const ContractInterface: React.FC<ContractInterfaceProps> = ({
  contract,
  onClose
}) => {
  const [executingFunction, setExecutingFunction] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState(contract.address || '');
  const [activeTab, setActiveTab] = useState<'read' | 'write'>('read');
  
  // Get wallet services
  const { connectedAccount } = useAztecWallet();
  const { state: azguardState, executeOperations } = useAzguardWallet();

  // Filter and parse ABI functions
  const functions = contract.abi
    .filter((item): item is AbiFunction => 
      item.type === 'function' && 
      item.name && 
      typeof item.name === 'string'
    )
    .sort((a, b) => {
      // Sort read functions first, then write functions
      const aIsRead = a.stateMutability === 'view' || a.stateMutability === 'pure';
      const bIsRead = b.stateMutability === 'view' || b.stateMutability === 'pure';
      
      if (aIsRead && !bIsRead) return -1;
      if (!aIsRead && bIsRead) return 1;
      return a.name.localeCompare(b.name);
    });

  const readFunctions = functions.filter(f => 
    f.stateMutability === 'view' || f.stateMutability === 'pure'
  );
  
  const writeFunctions = functions.filter(f => 
    f.stateMutability === 'nonpayable' || f.stateMutability === 'payable'
  );

  const handleFunctionExecute = async (functionName: string, args: any[]): Promise<any> => {
    setExecutingFunction(functionName);
    
    try {
      // Validate contract address
      if (!contractAddress) {
        throw new Error('Contract address is required');
      }

      // Check if we have a connected wallet
      if (!connectedAccount && !azguardState.isConnected) {
        throw new Error('No wallet connected. Please connect a wallet first.');
      }

      console.log(`Executing ${functionName} with args:`, args);
      
      const func = functions.find(f => f.name === functionName);
      if (!func) throw new Error('Function not found');

      const contractAddr = AztecAddress.fromString(contractAddress);

      // Execute Aztec transactions
      if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
        // Read functions - use view/simulate calls
        if (azguardState.isConnected && azguardState.selectedAccount) {
          // Use Azguard wallet for view calls
          const viewOperation = {
            kind: 'simulate_views' as const,
            account: azguardState.selectedAccount!,
            calls: [{
              kind: 'call' as const,
              contract: contractAddr.toString(),
              method: functionName,
              args
            }]
          };
          
          const results = await executeOperations([viewOperation]);
          const result = results[0];
          
          if (result.status === 'ok') {
            return {
              success: true,
              result: result.result,
              timestamp: new Date().toISOString(),
              method: 'azguard_view'
            };
          } else {
            throw new Error((result as any).error || 'View call failed');
          }
        } else if (connectedAccount) {
          // Use embedded wallet for view calls
          try {
            // Create a contract instance using the loaded artifact
            const contractArtifact = loadContractArtifact(contract as any);
            const contractInstance = await Contract.at(contractAddr, contractArtifact, connectedAccount);
            
            // Execute the view function
            const result = await contractInstance.methods[functionName](...args).simulate();
            
            return {
              success: true,
              result: result,
              timestamp: new Date().toISOString(),
              method: 'embedded_view',
              note: 'Aztec view call via embedded wallet'
            };
          } catch (error) {
            console.error('Failed to execute view call with embedded wallet:', error);
            throw new Error(`View call failed: ${error.message}`);
          }
        }
      } else {
        // Write functions - execute transactions
        if (azguardState.isConnected && azguardState.selectedAccount) {
          // Use Azguard wallet for transactions
          const txOperation = {
            kind: 'send_transaction' as const,
            account: azguardState.selectedAccount!,
            actions: [{
              kind: 'call' as const,
              contract: contractAddr.toString(),
              method: functionName,
              args
            }]
          };
          
          const results = await executeOperations([txOperation]);
          const result = results[0];
          
          if (result.status !== 'ok') {
            throw new Error((result as any).error || 'Transaction failed');
          }
          
          const txHash = result.result;
          
          return {
            success: true,
            transactionHash: txHash,
            timestamp: new Date().toISOString(),
            method: 'azguard_transaction',
            note: 'Aztec transaction executed via Azguard wallet'
          };
        } else if (connectedAccount) {
          // Use embedded wallet for transactions
          try {
            // Create a contract instance using the loaded artifact
            const contractArtifact = loadContractArtifact(contract as any);
            const contractInstance = await Contract.at(contractAddr, contractArtifact, connectedAccount);
            
            // Execute the transaction
            const tx = await contractInstance.methods[functionName](...args).send().wait();
            
            return {
              success: true,
              transactionHash: tx.txHash.toString(),
              blockNumber: tx.blockNumber,
              timestamp: new Date().toISOString(),
              method: 'embedded_transaction',
              note: 'Aztec transaction executed via embedded wallet'
            };
          } catch (error) {
            console.error('Failed to execute transaction with embedded wallet:', error);
            throw new Error(`Transaction failed: ${error.message}`);
          }
        }
      }
      
      throw new Error('No suitable wallet available for transaction execution');
    } catch (error) {
      console.error('❌ Function execution failed:', error);
      throw error;
    } finally {
      setExecutingFunction(null);
    }
  };

  // Generate more realistic mock results based on function signature
  const generateMockResult = (func: AbiFunction, args: any[]): any => {
    if (!func.outputs || func.outputs.length === 0) {
      return null;
    }

    const output = func.outputs[0];
    switch (output.type) {
      case 'uint256':
      case 'uint':
        return (BigInt(Math.floor(Math.random() * 1000000))).toString();
      case 'bool':
        return Math.random() > 0.5;
      case 'address':
        return '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      case 'string':
        return `Result for ${func.name}(${args.join(', ')})`;
      case 'bytes32':
        return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      default:
        return `Mock ${output.type} result`;
    }
  };

  return (
    <div className="contract-interface">
      <div className="contract-interface-header">
        <div className="contract-info">
          <h3 className="contract-title">{contract.contractName}</h3>
          <p className="contract-description">
            {functions.length} functions • {readFunctions.length} read • {writeFunctions.length} write • {contract.format}
            {contract.metadata?.noir_version && ` • Noir ${contract.metadata.noir_version}`}
          </p>
        </div>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="contract-address-section">
        <label className="address-label">Contract Address:</label>
        <input
          type="text"
          className="address-input"
          placeholder="0x1234...abcd (required for execution)"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
          <strong>Required:</strong> Enter the deployed contract address to enable function execution.
          {!contractAddress && <span style={{ color: 'var(--accent-secondary)' }}> ⚠️ Address required</span>}
        </small>
      </div>

      {/* Function Tabs */}
      <div className="function-tabs">
        <button 
          className={`tab-button ${activeTab === 'read' ? 'active' : ''}`}
          onClick={() => setActiveTab('read')}
          disabled={readFunctions.length === 0}
        >
          <span className="tab-icon">👁️</span>
          Read Functions ({readFunctions.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'write' ? 'active' : ''}`}
          onClick={() => setActiveTab('write')}
          disabled={writeFunctions.length === 0}
        >
          <span className="tab-icon">✍️</span>
          Write Functions ({writeFunctions.length})
        </button>
      </div>

      {/* Function Content */}
      <div className="functions-container">
        {activeTab === 'read' && readFunctions.length > 0 && (
          <div className="function-section">
            <div className="functions-list">
              {readFunctions.map((func, index) => (
                <ContractFunction
                  key={`read-${index}`}
                  func={func}
                  onExecute={handleFunctionExecute}
                  isExecuting={executingFunction === func.name}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'write' && writeFunctions.length > 0 && (
          <div className="function-section">
            <div className="functions-list">
              {writeFunctions.map((func, index) => (
                <ContractFunction
                  key={`write-${index}`}
                  func={func}
                  onExecute={handleFunctionExecute}
                  isExecuting={executingFunction === func.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state messages */}
        {activeTab === 'read' && readFunctions.length === 0 && (
          <div className="empty-functions">
            <p>No read functions available in this contract.</p>
          </div>
        )}

        {activeTab === 'write' && writeFunctions.length === 0 && (
          <div className="empty-functions">
            <p>No write functions available in this contract.</p>
          </div>
        )}

        {functions.length === 0 && (
          <div className="no-functions">
            <div className="no-functions-icon">🤷‍♂️</div>
            <h4>No Functions Found</h4>
            <p>This contract doesn't have any callable functions in its ABI.</p>
          </div>
        )}
      </div>
    </div>
  );
};
