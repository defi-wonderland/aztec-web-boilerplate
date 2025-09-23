import React, { useState, useMemo, useCallback } from 'react';
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

// Utility functions
const filterFunctions = (abi: any[]) => 
  abi.filter((item): item is AbiFunction => 
    item.type === 'function' && 
    item.name && 
    typeof item.name === 'string'
  ).sort((a, b) => {
    const aIsRead = a.stateMutability === 'view' || a.stateMutability === 'pure';
    const bIsRead = b.stateMutability === 'view' || b.stateMutability === 'pure';
    
    if (aIsRead && !bIsRead) return -1;
    if (!aIsRead && bIsRead) return 1;
    return a.name.localeCompare(b.name);
  });

const generateMockResult = (func: AbiFunction, args: any[]): any => {
  if (!func.outputs || func.outputs.length === 0) return null;

  const output = func.outputs[0];
  switch (output.type) {
    case 'uint256': case 'uint':
      return (BigInt(Math.floor(Math.random() * 1000000))).toString();
    case 'bool': return Math.random() > 0.5;
    case 'address': 
      return '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    case 'string': return `Result for ${func.name}(${args.join(', ')})`;
    case 'bytes32': 
      return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    default: return `Mock ${output.type} result`;
  }
};

// Sub-components
const ContractHeader: React.FC<{ 
  contract: ContractArtifact; 
  readCount: number; 
  writeCount: number; 
  onClose: () => void; 
}> = ({ contract, readCount, writeCount, onClose }) => (
  <div className="contract-interface-header">
    <div className="contract-info">
      <h3 className="contract-title">{contract.contractName}</h3>
      <p className="contract-description">
        {contract.abi.length} functions • {readCount} read • {writeCount} write • {contract.format}
        {contract.metadata?.noir_version && ` • Noir ${contract.metadata.noir_version}`}
      </p>
    </div>
    <button className="close-button" onClick={onClose}>✕</button>
  </div>
);

const AddressInput: React.FC<{ 
  address: string; 
  onChange: (address: string) => void; 
}> = ({ address, onChange }) => (
  <div className="contract-address-section">
    <label className="address-label">Contract Address:</label>
    <input
      type="text"
      className="address-input"
      placeholder="0x1234...abcd (required for execution)"
      value={address}
      onChange={(e) => onChange(e.target.value)}
    />
    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
      <strong>Required:</strong> Enter the deployed contract address to enable function execution.
      {!address && <span style={{ color: 'var(--accent-secondary)' }}> ⚠️ Address required</span>}
    </small>
  </div>
);

const FunctionTabs: React.FC<{ 
  activeTab: 'read' | 'write'; 
  onTabChange: (tab: 'read' | 'write') => void; 
  readCount: number; 
  writeCount: number; 
}> = ({ activeTab, onTabChange, readCount, writeCount }) => (
  <div className="function-tabs">
    <button 
      className={`tab-button ${activeTab === 'read' ? 'active' : ''}`}
      onClick={() => onTabChange('read')}
      disabled={readCount === 0}
    >
      <span className="tab-icon">👁️</span>
      Read Functions ({readCount})
    </button>
    <button 
      className={`tab-button ${activeTab === 'write' ? 'active' : ''}`}
      onClick={() => onTabChange('write')}
      disabled={writeCount === 0}
    >
      <span className="tab-icon">✍️</span>
      Write Functions ({writeCount})
    </button>
  </div>
);

const FunctionsList: React.FC<{ 
  functions: AbiFunction[]; 
  onExecute: (name: string, args: any[]) => Promise<any>; 
  executingFunction: string | null; 
}> = ({ functions, onExecute, executingFunction }) => (
  <div className="function-section">
    <div className="functions-list">
      {functions.map((func, index) => (
        <ContractFunction
          key={index}
          func={func}
          onExecute={onExecute}
          isExecuting={executingFunction === func.name}
        />
      ))}
    </div>
  </div>
);

const EmptyState: React.FC<{ type: 'read' | 'write' | 'none' }> = ({ type }) => {
  if (type === 'none') {
    return (
      <div className="no-functions">
        <div className="no-functions-icon">🤷‍♂️</div>
        <h4>No Functions Found</h4>
        <p>This contract doesn't have any callable functions in its ABI.</p>
      </div>
    );
  }

  return (
    <div className="empty-functions">
      <p>No {type} functions available in this contract.</p>
    </div>
  );
};

export const ContractInterface: React.FC<ContractInterfaceProps> = ({
  contract,
  onClose
}) => {
  const [executingFunction, setExecutingFunction] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState(contract.address || '');
  const [activeTab, setActiveTab] = useState<'read' | 'write'>('read');
  
  const { connectedAccount } = useAztecWallet();
  const { state: azguardState, executeOperations } = useAzguardWallet();

  const { functions, readFunctions, writeFunctions } = useMemo(() => {
    const functions = filterFunctions(contract.abi);
    return {
      functions,
      readFunctions: functions.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure'),
      writeFunctions: functions.filter(f => f.stateMutability === 'nonpayable' || f.stateMutability === 'payable')
    };
  }, [contract.abi]);

  const handleFunctionExecute = useCallback(async (functionName: string, args: any[]): Promise<any> => {
    setExecutingFunction(functionName);
    
    try {
      if (!contractAddress) throw new Error('Contract address is required');
      if (!connectedAccount && !azguardState.isConnected) {
        throw new Error('No wallet connected. Please connect a wallet first.');
      }

      console.log(`Executing ${functionName} with args:`, args);
      
      const func = functions.find(f => f.name === functionName);
      if (!func) throw new Error('Function not found');

      const contractAddr = AztecAddress.fromString(contractAddress);

      if (func.stateMutability === 'view' || func.stateMutability === 'pure') {
        // Read functions
        if (azguardState.isConnected && azguardState.selectedAccount) {
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
          try {
            const contractArtifact = loadContractArtifact(contract as any);
            const contractInstance = await Contract.at(contractAddr, contractArtifact, connectedAccount);
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
        // Write functions
        if (azguardState.isConnected && azguardState.selectedAccount) {
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
          
          return {
            success: true,
            transactionHash: result.result,
            timestamp: new Date().toISOString(),
            method: 'azguard_transaction',
            note: 'Aztec transaction executed via Azguard wallet'
          };
        } else if (connectedAccount) {
          try {
            const contractArtifact = loadContractArtifact(contract as any);
            const contractInstance = await Contract.at(contractAddr, contractArtifact, connectedAccount);
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
  }, [contractAddress, connectedAccount, azguardState, executeOperations, functions, contract]);

  return (
    <div className="contract-interface">
      <ContractHeader 
        contract={contract} 
        readCount={readFunctions.length} 
        writeCount={writeFunctions.length} 
        onClose={onClose} 
      />

      <AddressInput address={contractAddress} onChange={setContractAddress} />

      <FunctionTabs 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        readCount={readFunctions.length} 
        writeCount={writeFunctions.length} 
      />

      <div className="functions-container">
        {activeTab === 'read' && readFunctions.length > 0 && (
          <FunctionsList 
            functions={readFunctions} 
            onExecute={handleFunctionExecute} 
            executingFunction={executingFunction} 
          />
        )}

        {activeTab === 'write' && writeFunctions.length > 0 && (
          <FunctionsList 
            functions={writeFunctions} 
            onExecute={handleFunctionExecute} 
            executingFunction={executingFunction} 
          />
        )}

        {/* Empty states */}
        {activeTab === 'read' && readFunctions.length === 0 && <EmptyState type="read" />}
        {activeTab === 'write' && writeFunctions.length === 0 && <EmptyState type="write" />}
        {functions.length === 0 && <EmptyState type="none" />}
      </div>
    </div>
  );
};