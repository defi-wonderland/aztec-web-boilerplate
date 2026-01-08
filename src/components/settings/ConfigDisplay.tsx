import React from 'react';
import { AVAILABLE_NETWORKS } from '../../config/networks';
import type { AztecNetwork } from '../../config/networks/constants';
import type { NetworkConfig } from '../../config/networks/types';

interface ConfigDisplayProps {
  networkName: AztecNetwork;
}

interface ConfigField {
  key: keyof NetworkConfig;
  label: string;
  formatter?: (value: boolean) => string;
}

const CONFIG_FIELDS: ConfigField[] = [
  { key: 'nodeUrl', label: 'Node URL' },
  { key: 'tokenContractAddress', label: 'Token Contract' },
  { key: 'dripperContractAddress', label: 'Dripper Contract' },
  { key: 'deployerAddress', label: 'Deployer Address' },
  { key: 'dripperDeploymentSalt', label: 'Dripper Salt' },
  { key: 'tokenDeploymentSalt', label: 'Token Salt' },
  {
    key: 'proverEnabled',
    label: 'Prover Enabled',
    formatter: (value: boolean) => (value ? 'Yes' : 'No'),
  },
];

export const ConfigDisplay: React.FC<ConfigDisplayProps> = ({
  networkName,
}) => {
  const config = AVAILABLE_NETWORKS.find(
    (network) => network.name === networkName
  );

  if (!config) {
    return null;
  }

  return (
    <div className="config-display">
      <h4>{config.displayName} Configuration</h4>
      <div className="config-grid">
        {CONFIG_FIELDS.map(({ key, label, formatter }) => {
          const value = config[key];
          const displayValue = formatter
            ? formatter(value as boolean)
            : value || 'Not configured';

          return (
            <div key={key} className="config-row">
              <span className="config-label">{label}</span>
              <span className="config-value">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
