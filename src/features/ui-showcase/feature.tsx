import React from 'react';
import { Layers } from 'lucide-react';
import { iconSize } from '../../utils';
import { UiShowcaseFeatureScreen } from './UiShowcaseFeatureScreen';
import type { FeatureModule } from '../types';

const feature: FeatureModule = {
  id: 'components',
  label: 'UI Components',
  order: 400,
  icon: (size) => <Layers size={size || iconSize()} />,
  component: UiShowcaseFeatureScreen,
};

export default feature;
