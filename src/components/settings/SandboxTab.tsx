import React from 'react';
import { AVAILABLE_NETWORKS } from '../../config/networks';
import { ConfigDisplay } from './ConfigDisplay';

export const SandboxTab: React.FC = () => {
  const sandboxConfig = AVAILABLE_NETWORKS.find(network => network.name === 'sandbox');
  
  return (
    <ConfigDisplay 
      config={sandboxConfig!} 
      title="Local Sandbox Configuration" 
    />
  );
};
