import React, { useState } from 'react';

interface ConnectionTesterProps {
  nodeUrl: string;
  onNodeUrlChange: (url: string) => void;
  onTestComplete: (result: 'success' | 'error', message: string) => void;
}

export const ConnectionTester: React.FC<ConnectionTesterProps> = ({ nodeUrl, onNodeUrlChange, onTestComplete }) => {
  const [isTesting, setIsTesting] = useState(false);

  const testNodeConnection = async () => {
    if (!nodeUrl) {
      onTestComplete('error', 'Please enter a node URL first');
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch(nodeUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jsonrpc: '2.0', 
          method: 'node_getL1ContractAddresses', 
          params: [], 
          id: 1 
        })
      });
      
      if (response.ok) {
        onTestComplete('success', '');
      } else {
        onTestComplete('error', `Node responded with status: ${response.status}`);
      }
    } catch (error) {
      onTestComplete('error', 'Failed to connect to node. Please check the URL and ensure the node is running.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="input-with-button">
      <input
        type="url"
        name="nodeUrl"
        className="form-input"
        value={nodeUrl}
        onChange={(e) => onNodeUrlChange(e.target.value)}
        placeholder="https://your-node-url.com"
      />
      <button
        type="button"
        onClick={testNodeConnection}
        disabled={isTesting || !nodeUrl}
        className="test-connection-btn"
      >
        {isTesting ? 'Testing...' : 'Test Connection'}
      </button>
    </div>
  );
};
