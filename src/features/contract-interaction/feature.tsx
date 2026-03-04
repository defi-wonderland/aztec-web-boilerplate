import React from 'react';
import { Wrench } from 'lucide-react';
import { iconSize } from '../../utils';
import { ContractInteractionScreen } from './ContractInteractionScreen';
import type { FeatureModule } from '../types';

const feature: FeatureModule = {
  id: 'contract',
  label: 'Contract UI',
  order: 200,
  icon: (size) => <Wrench size={size || iconSize()} />,
  component: ContractInteractionScreen,
};

export default feature;
