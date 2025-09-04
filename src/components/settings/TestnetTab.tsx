import React from 'react';
import { AVAILABLE_NETWORKS } from '../../config/networks';
import { ConfigDisplay } from './ConfigDisplay';

export const TestnetTab: React.FC = () => {
  const testnetConfig = AVAILABLE_NETWORKS.find(network => network.name === 'testnet');
  
  return (
    <ConfigDisplay 
      config={testnetConfig!} 
      title="Testnet Configuration" 
    />
  );
};
