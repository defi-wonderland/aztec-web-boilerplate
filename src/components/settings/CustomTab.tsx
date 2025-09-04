import React, { useState, useEffect } from 'react';
import { useConfig } from '../../hooks';
import { isValidConfig } from '../../utils';
import { ConnectionTester } from './ConnectionTester';

interface CustomConfig {
  nodeUrl: string;
  contractAddress: string;
  dripperContractAddress: string;
  tokenContractAddress: string;
  deployerAddress: string;
  deploymentSalt: string;
  dripperDeploymentSalt: string;
  tokenDeploymentSalt: string;
  proverEnabled: boolean;
}

interface ConfigField {
  key: keyof CustomConfig;
  label: string;
  type: 'text' | 'checkbox';
  placeholder?: string;
  isSpecial?: boolean;
}

const configFields: ConfigField[] = [
  { key: 'nodeUrl', label: 'Node URL', type: 'text', isSpecial: true },
  { key: 'contractAddress', label: 'Contract Address', type: 'text', placeholder: '0x...' },
  { key: 'tokenContractAddress', label: 'Token Contract', type: 'text', placeholder: '0x...' },
  { key: 'dripperContractAddress', label: 'Dripper Contract', type: 'text', placeholder: '0x...' },
  { key: 'deployerAddress', label: 'Deployer Address', type: 'text', placeholder: '0x...' },
  { key: 'deploymentSalt', label: 'Deployment Salt', type: 'text', placeholder: '0x...' },
  { key: 'dripperDeploymentSalt', label: 'Dripper Salt', type: 'text', placeholder: '0x...' },
  { key: 'tokenDeploymentSalt', label: 'Token Salt', type: 'text', placeholder: '0x...' },
  { key: 'proverEnabled', label: 'Prover Enabled', type: 'checkbox' },
];

const DEFAULT_CONFIG: CustomConfig = {
  nodeUrl: '',
  contractAddress: '',
  dripperContractAddress: '',
  tokenContractAddress: '',
  deployerAddress: '',
  deploymentSalt: '',
  dripperDeploymentSalt: '',
  tokenDeploymentSalt: '',
  proverEnabled: true,
};

export const CustomTab: React.FC = () => {
  const [customConfig, setCustomConfig] = useState<CustomConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');
  
  const { setCustomConfig: saveCustomConfig, getCustomConfig, clearCustomConfig } = useConfig();

  const handleCustomConfigChange = (field: string, value: string | boolean) => {
    setCustomConfig(prev => ({ ...prev, [field]: value }));
    
    if (field === 'nodeUrl') {
      setConnectionTestResult('idle');
      setConnectionErrorMessage('');
    }
  };

  const handleTestComplete = (result: 'success' | 'error', message: string) => {
    setConnectionTestResult(result);
    setConnectionErrorMessage(message);
  };

  const handleSaveCustomConfig = () => {
    if (!isValidConfig(customConfig)) {
      alert('Please fill out all fields and ensure they are valid');
      return;
    }

    if (connectionTestResult !== 'success') {
      alert('Please test the node connection before saving');
      return;
    }

    setIsSaving(true);
    saveCustomConfig(customConfig);

    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  const handleRemoveCustomConfig = () => {
    if (confirm('Are you sure you want to remove the custom configuration? This action cannot be undone.')) {
      clearCustomConfig();
      setCustomConfig(DEFAULT_CONFIG);
      setConnectionTestResult('idle');
      setConnectionErrorMessage('');
    }
  };

  useEffect(() => {
    const savedConfig = getCustomConfig();
    if (savedConfig) {
      setCustomConfig(savedConfig);
    }
  }, [getCustomConfig]);

  const renderField = (field: ConfigField) => {
    if (field.isSpecial) {
      return (
        <ConnectionTester 
          nodeUrl={customConfig[field.key] as string}
          onNodeUrlChange={(url) => handleCustomConfigChange(field.key, url)}
          onTestComplete={handleTestComplete}
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={customConfig[field.key] as boolean}
          onChange={(e) => handleCustomConfigChange(field.key, e.target.checked)}
          className="checkbox-input"
        />
      );
    }

    return (
      <input
        type="text"
        className="form-input"
        value={customConfig[field.key] as string}
        onChange={(e) => handleCustomConfigChange(field.key, e.target.value)}
        placeholder={field.placeholder}
      />
    );
  };

  return (
    <div className="config-display">
      <h4>Custom Configuration</h4>
      <div className="config-grid">
        {configFields.map((field) => (
          <div key={field.key} className="config-row">
            <label className="config-label">{field.label}</label>
            {renderField(field)}
          </div>
        ))}
        {connectionTestResult === 'success' && (
          <div className="connection-success">
            ✅ Node is reachable and responding
          </div>
        )}
        {connectionTestResult === 'error' && (
          <div className="connection-error">
            ❌ {connectionErrorMessage}
          </div>
        )}
      </div>
      <br />
      <div className="form-actions">
        <button className="btn btn-danger" onClick={handleRemoveCustomConfig}>
          Delete
        </button>
        <button className="btn btn-primary" onClick={handleSaveCustomConfig} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
