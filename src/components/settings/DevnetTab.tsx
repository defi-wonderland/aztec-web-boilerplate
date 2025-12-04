import React from 'react';
import { AVAILABLE_NETWORKS } from '../../config/networks';
import { ConfigDisplay } from './ConfigDisplay';

export const DevnetTab: React.FC = () => {
  const devnetConfig = AVAILABLE_NETWORKS.find(network => network.name === 'devnet');
  
  return (
    <ConfigDisplay 
      config={devnetConfig!} 
      title="Devnet Configuration" 
    />
  );
};

