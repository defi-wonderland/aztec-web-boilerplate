import { useContext } from 'react';
import { ConfigContext } from '../../providers/ConfigProvider';

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
