import React from 'react';
import { Coins } from 'lucide-react';
import { iconSize } from '../../utils';
import { MintFeatureScreen } from './MintFeatureScreen';
import { mintFeatureContracts } from './config/contracts';
import type { FeatureModule } from '../types';

const feature: FeatureModule = {
  id: 'mint',
  label: 'Mint Tokens',
  order: 100,
  icon: (size) => <Coins size={size || iconSize()} />,
  component: MintFeatureScreen,
  contracts: mintFeatureContracts,
};

export default feature;
